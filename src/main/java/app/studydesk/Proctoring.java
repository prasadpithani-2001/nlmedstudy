package app.studydesk;
import jakarta.persistence.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.regex.Pattern;

/* ===== Proctoring for entrance exams and course assessments =====
   During a test the browser needs a camera and full-screen mode, takes a webcam snapshot about every 15 seconds, and records
   tab switches, leaving full screen, copy/paste, right-clicks, the Print Screen key and loss of camera or internet.
   The server refuses a submission unless at least one snapshot was saved for that student and test, so the camera step cannot be skipped
   by calling the API directly. Limits: a browser cannot stop a determined student (for example, with a second device); this makes cheating
   visible and recorded for the teacher. A session is keyed by "<scope>:<userId>", where scope is "exam-<id>" or "assess-<courseId>". */

@Entity class ProctorEvent { @Id @GeneratedValue public Long id; @Column(length=80) public String sessionKey; @Column(length=40) public String kind; @Column(length=200) public String detail; public LocalDateTime at=LocalDateTime.now(); }
interface ProctorEventRepo extends JpaRepository<ProctorEvent,Long>{ List<ProctorEvent> findBySessionKeyOrderByAtAsc(String k); long countBySessionKey(String k); }
@Entity class ProctorSnapshot { @Id @GeneratedValue public Long id; @Column(length=80) public String sessionKey; public String file; public LocalDateTime at=LocalDateTime.now(); }
interface ProctorSnapshotRepo extends JpaRepository<ProctorSnapshot,Long>{ List<ProctorSnapshot> findBySessionKeyOrderByAtAsc(String k); long countBySessionKey(String k); Optional<ProctorSnapshot> findFirstBySessionKeyOrderByAtDesc(String k); }

/** Used by the exam and assessment submit endpoints. The repository is handed over once at startup. */
@Component class ProctorGuard {
  static ProctorSnapshotRepo repo;
  ProctorGuard(ProctorSnapshotRepo r){ repo=r; }
  static void requireCamera(String scope,Long userId){
    if(repo==null||repo.countBySessionKey(scope+":"+userId)==0)
      throw new ResponseStatusException(HttpStatus.CONFLICT,"The camera check did not run. Please allow your camera and full-screen mode, then take the test again from its start page.");
  }
}

@RestController @RequestMapping("/api") class ProctorController {
  static final Path DIR=Path.of("uploads","proctor").toAbsolutePath().normalize();
  static final Set<String> KINDS=Set.of("gate_ready","camera_on","camera_off","tab_hidden","window_blur","fullscreen_exit","copy_paste","right_click","screenshot_key","offline");
  static final int MAX_EVENTS=400, MAX_SNAPS=400, SNAP_GAP_SEC=8; static final long MAX_BYTES=400_000L;
  static final Pattern SCOPE=Pattern.compile("^(exam|assess)-\\d{1,12}$");
  final Auth auth; final ProctorEventRepo events; final ProctorSnapshotRepo snaps; final ExamRepo exams; final CourseRepo courses; final UserRepo users;
  ProctorController(Auth a,ProctorEventRepo e,ProctorSnapshotRepo s,ExamRepo x,CourseRepo c,UserRepo u){ auth=a; events=e; snaps=s; exams=x; courses=c; users=u; }

  static ResponseStatusException bad(String m){ return new ResponseStatusException(HttpStatus.BAD_REQUEST,m); }
  static ResponseStatusException forbidden(){ return new ResponseStatusException(HttpStatus.FORBIDDEN,"Not available for this test"); }
  static String nz(String s){ return s==null?"":s; }
  static String scopeOk(String scope){ if(scope==null||!SCOPE.matcher(scope).matches()) throw bad("Unknown test"); return scope; }

  /** Admin: every test. Exam owner: their exams. Course owner: their course assessments. */
  boolean canReview(User st,String scope){
    if("ADMIN".equals(st.role)) return true;
    Long id=Long.valueOf(scope.substring(scope.indexOf('-')+1));
    if(scope.startsWith("exam-")) return exams.findById(id).map(e->Objects.equals(e.ownerId,st.id)).orElse(false);
    return courses.findById(id).map(c->auth.manages(st,c)).orElse(false);
  }

  /** The student's camera-and-events log for one test. */
  @PostMapping("/proctor/{scope}/event") Map<String,Object> event(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String scope,@RequestBody Map<String,String> b){
    User u=auth.need(h,null); scopeOk(scope);
    String kind=nz(b==null?null:b.get("kind")); if(!KINDS.contains(kind)) throw bad("Unknown event");
    String k=scope+":"+u.id;
    if(events.countBySessionKey(k)>=MAX_EVENTS) return Map.of("ok",false);
    ProctorEvent e=new ProctorEvent(); e.sessionKey=k; e.kind=kind; String d=nz(b.get("detail")); e.detail=d.length()>200?d.substring(0,200):d; events.save(e);
    return Map.of("ok",true);
  }

  /** A webcam snapshot (JPEG). Checked by its file signature, size and frequency. */
  @PostMapping(value="/proctor/{scope}/snapshot",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) Map<String,Object> snapshot(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String scope,@RequestParam("file") MultipartFile file) throws Exception {
    User u=auth.need(h,null); scopeOk(scope); String k=scope+":"+u.id;
    if(file==null||file.isEmpty()) throw bad("No image received");
    if(file.getSize()>MAX_BYTES) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"The snapshot is too large");
    if(snaps.countBySessionKey(k)>=MAX_SNAPS) return Map.of("ok",false);
    Optional<ProctorSnapshot> last=snaps.findFirstBySessionKeyOrderByAtDesc(k);
    if(last.isPresent()&&last.get().at.isAfter(LocalDateTime.now().minusSeconds(SNAP_GAP_SEC))) return Map.of("ok",false);
    byte[] bytes=file.getBytes();
    if(bytes.length<3||(bytes[0]&0xff)!=0xFF||(bytes[1]&0xff)!=0xD8||(bytes[2]&0xff)!=0xFF) throw bad("The snapshot must be a JPEG image");
    Files.createDirectories(DIR); String name=UUID.randomUUID()+".jpg"; Files.write(DIR.resolve(name),bytes);
    ProctorSnapshot s=new ProctorSnapshot(); s.sessionKey=k; s.file=name; snaps.save(s);
    return Map.of("ok",true);
  }

  /** Teacher / admin: the warnings and snapshots for one student's test. */
  @GetMapping("/staff/proctor/{scope}/{userId}") Map<String,Object> review(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String scope,@PathVariable Long userId){
    User st=auth.staff(h); scopeOk(scope); if(!canReview(st,scope)) throw forbidden();
    String k=scope+":"+userId;
    Map<String,Object> m=new LinkedHashMap<>();
    users.findById(userId).ifPresent(s->{ m.put("student",s.name); m.put("email",s.email); });
    List<Map<String,Object>> ev=new ArrayList<>(); int violations=0;
    for(ProctorEvent e:events.findBySessionKeyOrderByAtAsc(k)){
      Map<String,Object> x=new LinkedHashMap<>(); x.put("kind",e.kind); x.put("detail",e.detail); x.put("at",e.at.toString()); ev.add(x);
      if(!"gate_ready".equals(e.kind)&&!"camera_on".equals(e.kind)) violations++;
    }
    List<Map<String,Object>> sn=new ArrayList<>();
    for(ProctorSnapshot s:snaps.findBySessionKeyOrderByAtAsc(k)){ Map<String,Object> x=new LinkedHashMap<>(); x.put("id",s.id); x.put("at",s.at.toString()); sn.add(x); }
    m.put("events",ev); m.put("snapshots",sn); m.put("violations",violations);
    return m;
  }

  /** Teacher / admin: one snapshot, only for a test they are allowed to review. */
  @GetMapping("/staff/proctor/snapshots/{id}") ResponseEntity<byte[]> image(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id) throws Exception {
    User st=auth.staff(h);
    ProctorSnapshot s=snaps.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Snapshot not found"));
    String scope=s.sessionKey.substring(0,s.sessionKey.lastIndexOf(':'));
    if(!canReview(st,scope)) throw forbidden();
    Path f=DIR.resolve(nz(s.file)).normalize();
    if(!f.startsWith(DIR)||!Files.isRegularFile(f)) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Snapshot file missing");
    return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).header(HttpHeaders.CACHE_CONTROL,"private, no-store").body(Files.readAllBytes(f));
  }
}
