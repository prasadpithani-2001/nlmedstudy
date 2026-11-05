package app.studydesk;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.socket.*;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;
import org.springframework.web.util.UriComponentsBuilder;
import java.util.*;
import java.util.concurrent.*;
import java.time.LocalDateTime;
import java.time.Duration;

/** In-site live class: relays whiteboard strokes (teacher only) and WebRTC signalling. room = course id (0 = free demo). */
@Component class LiveSocket extends TextWebSocketHandler {
  static class Room { final Map<String,WebSocketSession> peers=new ConcurrentHashMap<>(); final List<JsonNode> strokes=new CopyOnWriteArrayList<>(); volatile String bg="plain"; volatile String mode="tablet";
    final Map<String,ObjectNode> images=Collections.synchronizedMap(new LinkedHashMap<>());   // pictures on the board (iid -> img message)
    final List<JsonNode> chat=new CopyOnWriteArrayList<>(); final Map<Long,ObjectNode> shared=Collections.synchronizedMap(new LinkedHashMap<>());   // chat history, files shared in class
    volatile long startedAt=0; volatile boolean recording=false;
    final Map<String,String> hands=Collections.synchronizedMap(new LinkedHashMap<>());
    final Map<Long,Integer> conns=new ConcurrentHashMap<>(); final Map<String,Long> joinedAt=new ConcurrentHashMap<>(); final Map<String,ObjectNode> media=new ConcurrentHashMap<>(); volatile boolean allowMic=true, allowCam=true;   // students with a hand raised (peer id -> name), in the order they raised them
    final Map<String,WebSocketSession> waiting=Collections.synchronizedMap(new LinkedHashMap<>());   // students at the door, not yet let in (socket id -> socket)
    final Set<Long> letIn=ConcurrentHashMap.newKeySet();   // students the teacher has let in during this class: a reconnect gets straight back in
    volatile boolean ended=false;   // set when the teacher ends the class: this room is finished and must not be reused
  }
  final Map<String,Room> rooms=new ConcurrentHashMap<>(); final ObjectMapper om=new ObjectMapper(); final UserRepo users; final EnrollRepo enrolls; final CourseRepo courses; final MaterialRepo mats; final Auth auth;
  final AccessRules rules; final LiveAttendanceRepo att; final LiveSessionRepo sessions;
  static final String ENDED_MSG="This live class has ended. Thank you for attending!";
  LiveSocket(UserRepo u,EnrollRepo e,CourseRepo c,MaterialRepo m,Auth a,AccessRules r,LiveAttendanceRepo at,LiveSessionRepo ss){users=u;enrolls=e;courses=c;mats=m;auth=a;rules=r;att=at;sessions=ss;}
  static double clamp(double v,double lo,double hi){ return Double.isNaN(v)?lo:Math.max(lo,Math.min(hi,v)); }
  void send(WebSocketSession s,String text){ try{ synchronized(s){ if(s.isOpen()) s.sendMessage(new TextMessage(text)); } }catch(Exception ignored){} }
  void broadcast(Room r,String text,String exceptId){ r.peers.forEach((id,s)->{ if(!id.equals(exceptId)) send(s,text); }); }
  String json(Map<String,Object> m){ try{ return om.writeValueAsString(m); }catch(Exception e){ return "{}"; } }
  boolean isLive(String room){ Room r=rooms.get(room); return r!=null&&r.peers.values().stream().anyMatch(s->"TEACHER".equals(s.getAttributes().get("role"))); }
  String mode(String room){ Room r=rooms.get(room); return r==null?"tablet":r.mode; }
  int viewers(String room){ Room r=rooms.get(room); return r==null?0:r.peers.size(); }

  /* Attendance: a visit opens when the teacher lets a student in and closes when their last connection leaves. */
  void attendJoin(Room r,String room,WebSocketSession s){
    if(!"STUDENT".equals(s.getAttributes().get("role"))) return;
    Long uid=(Long)s.getAttributes().get("uid");
    if(r.conns.merge(uid,1,Integer::sum)>1) return;   // a second tab or a reconnect: same visit
    if(att.findFirstBySessionKeyAndUserIdAndLeftAtIsNullOrderByIdDesc(room+":"+r.startedAt,uid).isPresent()) return;
    LiveAttendance a=new LiveAttendance(); a.sessionKey=room+":"+r.startedAt; a.courseId=Long.valueOf(room); a.userId=uid; a.userName=String.valueOf(s.getAttributes().get("name")); a.joinedAt=LocalDateTime.now(); att.save(a);
  }
  /* The teacher's list of students at the door. Students at the door are not shown to each other. */
  void pushWaiting(Room r){
    List<Map<String,Object>> list=new ArrayList<>();
    synchronized(r.waiting){ r.waiting.forEach((id,w)->{ Map<String,Object> x=new HashMap<>(); x.put("id",id); x.put("name",String.valueOf(w.getAttributes().get("name"))); x.put("since",w.getAttributes().get("waitingSince")); list.add(x); }); }
    String msg=json(Map.of("type","waiting_list","list",list));
    r.peers.forEach((id,p)->{ if("TEACHER".equals(p.getAttributes().get("role"))) send(p,msg); });
  }
  void attendLeave(Room r,String room,WebSocketSession s){
    Object uidAttr=s.getAttributes().get("uid"); if(!(uidAttr instanceof Long)) return;
    Long uid=(Long)uidAttr;
    Integer left=r.conns.computeIfPresent(uid,(k,v)->v>1?v-1:null);
    if(left!=null) return;   // still connected elsewhere
    att.findFirstBySessionKeyAndUserIdAndLeftAtIsNullOrderByIdDesc(room+":"+r.startedAt,uid).ifPresent(a->{
      a.leftAt=LocalDateTime.now(); a.seconds=Duration.between(a.joinedAt,a.leftAt).getSeconds(); att.save(a); });
  }
  /* A student may not enter a class that has ended, unless a live session is running for it now. */
  boolean classEnded(String room){
    Room cur=rooms.get(room);
    if(cur!=null&&cur.startedAt>0&&!cur.ended) return false;
    return sessions.findFirstByCourseIdOrderByIdDesc(Long.valueOf(room)).map(x->"ENDED".equals(x.status)).orElse(false);
  }
  /* The teacher ends the class: the session is marked ENDED in the database, attendance is closed at the end time,
     and everyone still connected is told and disconnected. A student who reconnects afterwards is turned away. */
  void endSession(Room r,String room){
    if(r.ended) return;
    r.ended=true; rooms.remove(room,r);
    LocalDateTime now=LocalDateTime.now(); String key=room+":"+r.startedAt;
    sessions.findFirstBySessionKey(key).ifPresent(x->{ x.status="ENDED"; x.endedAt=now; sessions.save(x); });
    for(LiveAttendance a:att.findBySessionKeyAndLeftAtIsNull(key)){ a.leftAt=now; a.seconds=Duration.between(a.joinedAt,now).getSeconds(); att.save(a); }
    List<WebSocketSession> everyone=new ArrayList<>(r.peers.values());
    synchronized(r.waiting){ everyone.addAll(r.waiting.values()); r.waiting.clear(); }
    String msg=json(Map.of("type","class_ended","message",ENDED_MSG));
    for(WebSocketSession p:everyone){ send(p,msg); try{ p.close(CloseStatus.NORMAL); }catch(Exception ignored){} }
  }
  /* The class roster: who is present, their microphone and camera, and when they joined. Sent to everyone. */
  String rosterJson(Room r){
    List<Map<String,Object>> list=new ArrayList<>();
    r.peers.forEach((id,p)->{
      if("TEACHER".equals(p.getAttributes().get("role"))) return;
      Map<String,Object> x=new HashMap<>(); x.put("id",id); x.put("name",String.valueOf(p.getAttributes().get("name")));
      x.put("joinedAt",r.joinedAt.getOrDefault(id,0L));
      ObjectNode ms=r.media.get(id);
      x.put("mic",ms!=null&&ms.path("mic").asBoolean(false)); x.put("cam",ms!=null&&ms.path("cam").asBoolean(false));
      x.put("hand",r.hands.containsKey(id)); list.add(x);
    });
    return json(Map.of("type","roster","list",list));
  }

  @Override public void afterConnectionEstablished(WebSocketSession s) throws Exception {
    var q=UriComponentsBuilder.fromUri(s.getUri()).build().getQueryParams();
    String room=q.getFirst("room"), token=q.getFirst("token");
    User u=token==null?null:users.findByToken(token).orElse(null);
    if(u==null||room==null||!room.matches("\\d+")){ s.close(CloseStatus.POLICY_VIOLATION); return; }
    boolean allowed="0".equals(room)||"ADMIN".equals(u.role);
    if(!allowed&&"TEACHER".equals(u.role)){ Course c=courses.findById(Long.valueOf(room)).orElse(null); allowed=c!=null&&auth.manages(u,c); }
    if(!allowed&&"STUDENT".equals(u.role)) allowed=rules.canUseCourse(u.id,Long.valueOf(room));
    if(!allowed){ s.close(CloseStatus.POLICY_VIOLATION); return; }
    if("STUDENT".equals(u.role)&&classEnded(room)){ send(s,json(Map.of("type","class_ended","message",ENDED_MSG))); s.close(CloseStatus.NORMAL); return; }
    s.getAttributes().put("name",u.name); s.getAttributes().put("role",u.role); s.getAttributes().put("room",room); s.getAttributes().put("uid",u.id);
    Room r=rooms.computeIfAbsent(room,k->new Room());
    s.getAttributes().put("roomObj",r);   // the room this socket belongs to, even after the room is replaced
    if("TEACHER".equals(u.role)&&r.startedAt==0){   // the class starts: a session row is kept for the record and for the rejoin check
      r.startedAt=System.currentTimeMillis();
      LiveSession ls=new LiveSession(); ls.courseId=Long.valueOf(room); ls.sessionKey=room+":"+r.startedAt; ls.startedAt=LocalDateTime.now(); ls.status="LIVE"; sessions.save(ls);
    }
    if("STUDENT".equals(u.role)&&!r.letIn.contains(u.id)){   // a student waits at the door until the teacher lets them in
      s.getAttributes().put("waitingSince",System.currentTimeMillis()); r.waiting.put(s.getId(),s);
      send(s,json(Map.of("type","waiting","teacher",r.peers.values().stream().anyMatch(p->"TEACHER".equals(p.getAttributes().get("role"))))));
      pushWaiting(r); return;
    }
    admit(r,room,s);
  }
  /* Lets a student (or the teacher / an admin) into the class: sends the class state, tells everyone and opens the attendance visit. */
  void admit(Room r,String room,WebSocketSession s){
    s.getAttributes().put("admitted",true); r.waiting.remove(s.getId());
    r.letIn.add((Long)s.getAttributes().get("uid"));
    List<Map<String,Object>> peers=new ArrayList<>();
    r.peers.forEach((id,p)->{ Map<String,Object> pm=new HashMap<>(); pm.put("id",id); pm.put("name",p.getAttributes().get("name")); pm.put("role",p.getAttributes().get("role")); peers.add(pm); });
    List<Map<String,Object>> handList=new ArrayList<>(); synchronized(r.hands){ r.hands.forEach((id,nm)->{ Map<String,Object> hm=new HashMap<>(); hm.put("id",id); hm.put("name",nm); handList.add(hm); }); }
    send(s,json(Map.of("type","hands","list",handList)));
    send(s,json(Map.of("type","welcome","id",s.getId(),"bg",r.bg,"mode",r.mode,"peers",peers,"startedAt",r.startedAt,"now",System.currentTimeMillis(),"recording",r.recording)));
    for(JsonNode st:r.strokes) send(s,st.toString());
    synchronized(r.images){ for(JsonNode im:r.images.values()) send(s,im.toString()); }
    for(JsonNode c:r.chat) send(s,c.toString());
    synchronized(r.shared){ for(JsonNode f:r.shared.values()) send(s,f.toString()); }
    r.joinedAt.put(s.getId(),System.currentTimeMillis()); ObjectNode ms=om.createObjectNode(); ms.put("mic",false); ms.put("cam",false); r.media.put(s.getId(),ms);
    attendJoin(r,room,s);
    r.peers.put(s.getId(),s); broadcast(r,rosterJson(r),null);
    broadcast(r,json(Map.of("type","join","id",s.getId(),"name",String.valueOf(s.getAttributes().get("name")),"role",String.valueOf(s.getAttributes().get("role")),"startedAt",r.startedAt,"now",System.currentTimeMillis())),s.getId());
    pushWaiting(r);
  }
  @Override protected void handleTextMessage(WebSocketSession s,TextMessage msg) throws Exception {
    Room r=rooms.get((String)s.getAttributes().get("room")); if(r==null) return;
    JsonNode m=om.readTree(msg.getPayload()); if(!(m instanceof ObjectNode out)) return;
    boolean host="TEACHER".equals(s.getAttributes().get("role")); out.put("from",s.getId());
    if(!host&&!Boolean.TRUE.equals(s.getAttributes().get("admitted"))) return;   // still at the door: nothing from them reaches the class
    String payload=null; String except=s.getId();   // payload: a rebuilt (validated) message; except: who not to echo to (null = everyone, e.g. chat)
    switch(m.path("type").asText()){
      case "stroke": if(!host) return; r.strokes.add(out); if(r.strokes.size()>8000) r.strokes.remove(0); break;
      case "undo": if(!host) return; if(!r.strokes.isEmpty()){ String sid=r.strokes.get(r.strokes.size()-1).path("sid").asText(); r.strokes.removeIf(n->sid.equals(n.path("sid").asText())); } break;
      case "clear": if(!host) return; r.strokes.clear(); break;
      case "bg": if(!host) return; r.bg=m.path("bg").asText("plain"); break;
      case "mode": { if(!host) return; String md=m.path("mode").asText("tablet"); r.mode="board".equals(md)?"board":"tablet"; out.put("mode",r.mode); break; } // tablet = digital whiteboard, board = physical board on camera
      case "img": { if(!host) return; String url=m.path("url").asText(""), iid=m.path("iid").asText("");   // only pictures uploaded through /api/live/{room}/image
        if(!url.matches("/api/live/image/[0-9a-f\\-]{36}\\.(jpg|png|webp)")||!iid.matches("[A-Za-z0-9_-]{4,40}")) return;
        if(r.images.size()>=30&&!r.images.containsKey(iid)) return;
        ObjectNode n=om.createObjectNode(); n.put("type","img"); n.put("iid",iid); n.put("url",url); n.put("x",clamp(m.path("x").asDouble(.1),-.5,1.2)); n.put("y",clamp(m.path("y").asDouble(.1),-.5,1.2));
        n.put("w",clamp(m.path("w").asDouble(.3),.05,1.5)); n.put("ar",clamp(m.path("ar").asDouble(1.5),.1,10)); r.images.put(iid,n); payload=n.toString(); break; }
      case "imgmove": { if(!host) return; ObjectNode n=r.images.get(m.path("iid").asText()); if(n==null) return;
        n.put("x",clamp(m.path("x").asDouble(n.path("x").asDouble()),-.5,1.2)); n.put("y",clamp(m.path("y").asDouble(n.path("y").asDouble()),-.5,1.2)); n.put("w",clamp(m.path("w").asDouble(n.path("w").asDouble()),.05,1.5));
        ObjectNode mv=om.createObjectNode(); mv.put("type","imgmove"); mv.put("iid",n.path("iid").asText()); mv.put("x",n.path("x").asDouble()); mv.put("y",n.path("y").asDouble()); mv.put("w",n.path("w").asDouble()); payload=mv.toString(); break; }
      case "imgdel": { if(!host) return; r.images.remove(m.path("iid").asText()); break; }
      case "chat": { String text=m.path("text").asText("").trim(); if(text.isEmpty()) return; if(text.length()>300) text=text.substring(0,300);
        long now=System.currentTimeMillis(); Long lastAt=(Long)s.getAttributes().get("lastChat"); if(lastAt!=null&&now-lastAt<400) return; s.getAttributes().put("lastChat",now);
        ObjectNode c=om.createObjectNode(); c.put("type","chat"); c.put("id",UUID.randomUUID().toString().substring(0,8)); c.put("name",String.valueOf(s.getAttributes().get("name"))); c.put("role",String.valueOf(s.getAttributes().get("role"))); c.put("from",s.getId()); c.put("text",text); c.put("ts",now);
        r.chat.add(c); if(r.chat.size()>100) r.chat.remove(0); payload=c.toString(); except=null; break; }
      case "share": { if(!host) return; long mid=m.path("mid").asLong(-1); Material mt=mid<0?null:mats.findById(mid).orElse(null); String room=(String)s.getAttributes().get("room");
        if(mt==null||(!"0".equals(room)&&!room.equals(String.valueOf(mt.courseId)))) return;   // only files that belong to this class
        ObjectNode f=om.createObjectNode(); f.put("type","share"); f.put("mid",mt.id); f.put("title",mt.title==null?"File":mt.title); f.put("category",ContentController.catOf(mt));
        if(r.shared.size()>=30&&!r.shared.containsKey(mid)) return; r.shared.put(mid,f); payload=f.toString(); break; }
      case "unshare": { if(!host) return; r.shared.remove(m.path("mid").asLong(-1)); break; }
      case "media": { if(host) return; ObjectNode ms=r.media.computeIfAbsent(s.getId(),k->om.createObjectNode());
        boolean mic=m.path("mic").asBoolean(false), cam=m.path("cam").asBoolean(false);
        if(mic&&!r.allowMic){ mic=false; send(s,json(Map.of("type","perm","mic",false,"cam",r.allowCam))); }   // the teacher has turned microphones off
        if(cam&&!r.allowCam){ cam=false; send(s,json(Map.of("type","perm","mic",r.allowMic,"cam",false))); }
        ms.put("mic",mic); ms.put("cam",cam); payload=rosterJson(r); except=null; break; }
      case "perm": { if(!host) return; r.allowMic=m.path("mic").asBoolean(true); r.allowCam=m.path("cam").asBoolean(true);
        payload=json(Map.of("type","perm","mic",r.allowMic,"cam",r.allowCam)); except=null; break; }
      case "mute": case "mute_all": case "request_unmute": case "request_cam": case "disable_cam": {
        if(!host) return; String kind=m.path("type").asText(); String to=m.path("to").asText("");
        String body;
        if("mute".equals(kind)||"mute_all".equals(kind)) body=json(Map.of("type","mute"));
        else if("disable_cam".equals(kind)) body=json(Map.of("type","disable_cam"));
        else body=json(Map.of("type","request","what",kind.equals("request_unmute")?"mic":"cam"));
        final String txt=body;
        if("mute_all".equals(kind)) r.peers.forEach((id,p)->{ if(!"TEACHER".equals(p.getAttributes().get("role"))) send(p,txt); });
        else { WebSocketSession t=r.peers.get(to); if(t!=null&&!"TEACHER".equals(t.getAttributes().get("role"))) send(t,txt); }
        return; }   // a student's camera / microphone state: passed on to the others
      case "hand": { if(host) return; boolean on=m.path("on").asBoolean(false); String nm=String.valueOf(s.getAttributes().get("name"));
        if(on) r.hands.put(s.getId(),nm); else r.hands.remove(s.getId());
        payload=json(Map.of("type","hand","id",s.getId(),"name",nm,"on",on)); except=null; break; }
      case "hand_ack": { if(!host) return; String to=m.path("to").asText(""); if(!r.hands.containsKey(to)) return;
        payload=json(Map.of("type","hand_ack","id",to)); except=null; break; }
      case "hand_lower": { if(!host) return; String to=m.path("to").asText(""); if(r.hands.remove(to)==null) return;
        payload=json(Map.of("type","hand","id",to,"name","","on",false)); except=null; break; }
      case "rec": { if(!host) return; r.recording=m.path("on").asBoolean(false);   // recording notice: everyone in the class is told
        ObjectNode n=om.createObjectNode(); n.put("type","rec"); n.put("on",r.recording); n.put("paused",m.path("paused").asBoolean(false)); n.put("by",String.valueOf(s.getAttributes().get("name"))); n.put("at",System.currentTimeMillis()); payload=n.toString(); except=null; break; }
      case "admit": case "admit_all": { if(!host) return; String room=(String)s.getAttributes().get("room"); List<WebSocketSession> go=new ArrayList<>();
        synchronized(r.waiting){ if("admit_all".equals(m.path("type").asText())){ go.addAll(r.waiting.values()); r.waiting.clear(); }
          else { WebSocketSession w=r.waiting.remove(m.path("to").asText("")); if(w!=null) go.add(w); } }
        for(WebSocketSession w:go){ if(w.isOpen()) admit(r,room,w); }
        pushWaiting(r); return; }
      case "deny": { if(!host) return; WebSocketSession w=r.waiting.remove(m.path("to").asText(""));
        if(w!=null){ send(w,json(Map.of("type","denied"))); try{ w.close(CloseStatus.NORMAL); }catch(Exception ignored){} }
        pushWaiting(r); return; }
      case "end": { if(!host) return; endSession(r,(String)s.getAttributes().get("room")); return; }
      case "offer": case "answer": case "ice": { WebSocketSession t=r.peers.get(m.path("to").asText()); if(t!=null) send(t,out.toString()); return; }
      default: return;
    }
    broadcast(r,payload==null?out.toString():payload,except);
  }
  @Override public void afterConnectionClosed(WebSocketSession s,CloseStatus st){
    String room=(String)s.getAttributes().get("room");
    Room r=s.getAttributes().get("roomObj") instanceof Room rr?rr:null;   // the room this socket joined: if it has ended, there is nothing to clean up
    if(r==null||r.ended) return;
    if(!Boolean.TRUE.equals(s.getAttributes().get("admitted"))){   // still at the door, or turned away: nothing to tell the class
      if(r.waiting.remove(s.getId())!=null) pushWaiting(r);
      if(r.peers.isEmpty()&&r.waiting.isEmpty()) rooms.remove(room,r);
      return;
    }
    boolean wasTeacher="TEACHER".equals(s.getAttributes().get("role"));
    r.peers.remove(s.getId()); r.joinedAt.remove(s.getId()); r.media.remove(s.getId()); attendLeave(r,room,s);
    broadcast(r,json(Map.of("type","leave","id",s.getId())),s.getId()); broadcast(r,rosterJson(r),null);
    if(r.hands.remove(s.getId())!=null) broadcast(r,json(Map.of("type","hand","id",s.getId(),"name","","on",false)),null);
    if(wasTeacher&&r.recording){ r.recording=false; broadcast(r,json(Map.of("type","rec","on",false,"by","","at",System.currentTimeMillis())),null); }
    if(r.peers.isEmpty()&&r.waiting.isEmpty()) rooms.remove(room,r);
  }
}
@RestController @RequestMapping("/api/live") class LiveController {
  final LiveSocket live; LiveController(LiveSocket l){live=l;}
  @GetMapping("/{room}") Map<String,Object> status(@PathVariable String room){ return Map.of("live",live.isLive(room),"viewers",live.viewers(room),"mode",live.mode(room)); }
}
@Configuration @EnableWebSocket class WsConfig implements WebSocketConfigurer {
  final LiveSocket h; WsConfig(LiveSocket h){this.h=h;}
  @Override public void registerWebSocketHandlers(WebSocketHandlerRegistry r){ r.addHandler(h,"/ws/live").setAllowedOrigins("*"); }
  @Bean ServletServerContainerFactoryBean wsContainer(){ ServletServerContainerFactoryBean c=new ServletServerContainerFactoryBean(); c.setMaxTextMessageBufferSize(65536); c.setMaxBinaryMessageBufferSize(65536); return c; }
}
