package app.studydesk;

import jakarta.persistence.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import java.io.*;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;

/* ===== Phase 12: class recordings =====
   One row per recorded live class. The browser uploads the video in numbered chunks (resumable: the server tells the
   browser which chunk it expects next). The server assembles the file under recordings.dir (default ./uploads/recordings,
   outside the public web folder) and keeps the metadata in the database. Every watch or download goes through
   RecordingController: the course teacher, admins, and enrolled students (only for published, finished recordings). */

@Entity @Table(name="recording") class Recording {
  @Id @GeneratedValue public Long id;
  public Long courseId, teacherId;
  public String title, status="UPLOADING", fileName, thumbName, mimeType="video/webm", failure;
  public long sizeBytes, chunksReceived;
  public int durationSec;
  public boolean published=false, allowDownload=true;
  public LocalDateTime createdAt=LocalDateTime.now(), endedAt, consentAt;
}

interface RecordingRepo extends JpaRepository<Recording,Long>{ List<Recording> findByCourseIdIn(Collection<Long> ids); }

/** Where recording files live. Set RECORDINGS_DIR to a mounted cloud volume (or any large disk) to move storage off the app server. */
@Component class RecordingStorage {
  final Path dir; final long quotaBytes;
  RecordingStorage(@Value("${recordings.dir:uploads/recordings}") String d,@Value("${recordings.quota-gb:20}") long gb) throws IOException {
    dir=Path.of(d).toAbsolutePath().normalize(); quotaBytes=gb*1024L*1024L*1024L; Files.createDirectories(dir); }
  Path part(Recording r){ return dir.resolve(r.id+".part"); }
  Path file(Recording r){ return dir.resolve(r.fileName); }
}

@RestController @RequestMapping("/api/recordings") class RecordingController {
  static final Object LOCK=new Object();
  static final int CHUNK_MAX=16*1024*1024, THUMB_MAX=2*1024*1024;
  static final long MAX_RECORDING=8L*1024*1024*1024;
  final Auth auth; final RecordingRepo recs; final CourseRepo courses; final EnrollRepo enrolls; final UserRepo users; final RecordingStorage st;
  RecordingController(Auth a,RecordingRepo r,CourseRepo c,EnrollRepo e,UserRepo u,RecordingStorage s){auth=a;recs=r;courses=c;enrolls=e;users=u;st=s;}

  static ResponseStatusException bad(String m){ return new ResponseStatusException(HttpStatus.BAD_REQUEST,m); }
  static ResponseStatusException forbidden(String m){ return new ResponseStatusException(HttpStatus.FORBIDDEN,m); }
  static ResponseStatusException notFound(String m){ return new ResponseStatusException(HttpStatus.NOT_FOUND,m); }
  static long num(Object o){ try{ return Long.parseLong(String.valueOf(o)); }catch(Exception e){ return 0; } }
  Recording rec(Long id){ return recs.findById(id).orElseThrow(()->notFound("Recording not found")); }
  Course course(Long id){ return id==null?null:courses.findById(id).orElse(null); }
  boolean canManage(User u,Recording r){ if("ADMIN".equals(u.role)) return true; Course c=course(r.courseId); return "TEACHER".equals(u.role)&&c!=null&&auth.manages(u,c); }
  boolean canWatch(User u,Recording r){ if(canManage(u,r)) return true; return "STUDENT".equals(u.role)&&"READY".equals(r.status)&&r.published&&enrolls.existsByUserIdAndCourseId(u.id,r.courseId); }
  void requireManage(User u,Recording r){ if(!canManage(u,r)) throw forbidden("This recording belongs to another teacher's course"); }

  Map<String,Object> view(Recording r,User viewer){
    Course c=course(r.courseId); User t=r.teacherId==null?null:users.findById(r.teacherId).orElse(null);
    Map<String,Object> m=new LinkedHashMap<>();
    m.put("id",r.id); m.put("courseId",r.courseId); m.put("courseName",c==null?"Deleted course":c.name); m.put("teacherName",t==null?"Teacher":t.name);
    m.put("title",r.title); m.put("status",r.status); m.put("published",r.published); m.put("allowDownload",r.allowDownload);
    m.put("durationSec",r.durationSec); m.put("sizeBytes",r.sizeBytes); m.put("chunksReceived",r.chunksReceived); m.put("failure",r.failure);
    m.put("hasThumb",r.thumbName!=null); m.put("mimeType",r.mimeType);
    m.put("createdAt",r.createdAt==null?null:r.createdAt.toString()); m.put("endedAt",r.endedAt==null?null:r.endedAt.toString());
    m.put("canManage",canManage(viewer,r)); m.put("videoUrl","/api/recordings/"+r.id+"/video"); m.put("thumbUrl","/api/recordings/"+r.id+"/thumbnail");
    return m; }

  /** 1. Start a recording. The teacher must confirm that students were told (consent is stored with the time). */
  @PostMapping("/sessions") Map<String,Object> start(@RequestHeader(value="Authorization",required=false) String h,@RequestBody Map<String,Object> b) throws IOException {
    User u=auth.teach(h);
    if(b.get("courseId")==null) throw bad("Choose a course first");
    Course c=courses.findById(num(b.get("courseId"))).orElseThrow(()->notFound("Course not found"));
    if(!auth.manages(u,c)) throw forbidden("This course belongs to another teacher");
    if(!Boolean.TRUE.equals(b.get("consent"))) throw bad("Confirm that your students have been told this class is recorded before you start.");
    Recording r=new Recording(); r.courseId=c.id; r.teacherId=u.id;
    String t=b.get("title")==null?"":String.valueOf(b.get("title")).trim();
    r.title=t.isEmpty()?c.name+" class":(t.length()>150?t.substring(0,150):t);
    String mt=String.valueOf(b.get("mimeType")); if(mt.equals("video/mp4")) r.mimeType="video/mp4";
    r.fileName=UUID.randomUUID()+(r.mimeType.equals("video/mp4")?".mp4":".webm");
    r.consentAt=LocalDateTime.now(); r.status="UPLOADING";
    synchronized(LOCK){ recs.save(r); }
    return view(r,u); }

  /** 2. Upload one chunk (raw bytes). Chunks must arrive in order; a repeated chunk is accepted, so retries are safe. */
  @PutMapping(value="/{id}/chunks/{index}",consumes=MediaType.APPLICATION_OCTET_STREAM_VALUE) Map<String,Object> chunk(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id,@PathVariable int index,@RequestBody byte[] body) throws IOException {
    User u=auth.teach(h);
    if(body==null||body.length==0) throw bad("The chunk is empty");
    if(body.length>CHUNK_MAX) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"The chunk is too large");
    synchronized(LOCK){
      Recording r=rec(id); requireManage(u,r);
      if(!"UPLOADING".equals(r.status)) throw new ResponseStatusException(HttpStatus.CONFLICT,"This recording is no longer accepting video");
      long expected=r.chunksReceived;
      Map<String,Object> res=new LinkedHashMap<>();
      if(index<expected){ res.put("expected",expected); res.put("duplicate",true); return res; }
      if(index>expected) throw new ResponseStatusException(HttpStatus.CONFLICT,"Out of order: expected chunk "+expected);
      if(r.sizeBytes+body.length>MAX_RECORDING) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"This recording is longer than the 8 GB limit");
      Files.write(st.part(r),body,StandardOpenOption.CREATE,StandardOpenOption.APPEND);
      r.chunksReceived=expected+1; r.sizeBytes+=body.length; recs.save(r);
      res.put("expected",r.chunksReceived); res.put("duplicate",false); return res; } }

  /** 3. Finish: the assembled file becomes READY. Safe to call twice. */
  @PostMapping("/{id}/finish") Map<String,Object> finish(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id,@RequestBody(required=false) Map<String,Object> b) throws IOException {
    User u=auth.teach(h);
    synchronized(LOCK){
      Recording r=rec(id); requireManage(u,r);
      if("UPLOADING".equals(r.status)){
        if(r.chunksReceived==0||!Files.isRegularFile(st.part(r))){ r.status="FAILED"; r.failure="No video was received"; }
        else { Files.move(st.part(r),st.file(r),StandardCopyOption.REPLACE_EXISTING); r.status="READY"; r.sizeBytes=Files.size(st.file(r)); }
        r.durationSec=(int)Math.max(0,Math.min(864000,b==null?0:num(b.get("durationSec"))));
        r.endedAt=LocalDateTime.now(); recs.save(r); }
      return view(r,u); } }

  /** Give up on a recording (browser closed, recording failed): the partial data is deleted. */
  @PostMapping("/{id}/abort") Map<String,Object> abort(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id,@RequestBody(required=false) Map<String,Object> b) throws IOException {
    User u=auth.teach(h);
    synchronized(LOCK){
      Recording r=rec(id); requireManage(u,r);
      if("UPLOADING".equals(r.status)){ r.status="FAILED"; r.failure=b!=null&&b.get("reason")!=null?String.valueOf(b.get("reason")).substring(0,Math.min(200,String.valueOf(b.get("reason")).length())):"Recording stopped before it was saved"; Files.deleteIfExists(st.part(r)); r.endedAt=LocalDateTime.now(); recs.save(r); }
      return view(r,u); } }

  /** Thumbnail: a JPG/PNG/WEBP picture captured from the first seconds of the class. */
  @PutMapping(value="/{id}/thumbnail",consumes=MediaType.APPLICATION_OCTET_STREAM_VALUE) Map<String,Object> thumbnail(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id,@RequestBody byte[] body) throws IOException {
    User u=auth.teach(h);
    if(body==null||body.length==0) throw bad("The thumbnail is empty");
    if(body.length>THUMB_MAX) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"The thumbnail is too large");
    String ext=LiveMediaController.sniff(body);
    if(ext==null) throw bad("The thumbnail must be a JPG, PNG or WEBP image");
    synchronized(LOCK){
      Recording r=rec(id); requireManage(u,r);
      if(r.thumbName!=null) Files.deleteIfExists(st.dir.resolve(r.thumbName));
      String name="thumb-"+r.id+"-"+UUID.randomUUID().toString().substring(0,8)+"."+ext;
      Files.write(st.dir.resolve(name),body); r.thumbName=name; recs.save(r);
      return view(r,u); } }

  /** Library: teachers see their courses, admins see everything, students see published finished recordings of their courses. */
  @GetMapping Map<String,Object> list(@RequestHeader(value="Authorization",required=false) String h,@RequestParam(required=false) Long courseId,@RequestParam(required=false) String status,
      @RequestParam(required=false) String q,@RequestParam(defaultValue="newest") String sort,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="12") int size){
    User u=auth.need(h,null);
    Set<Long> ids=new HashSet<>();
    if("STUDENT".equals(u.role)){ for(Enrollment e:enrolls.findByUserId(u.id)) ids.add(e.courseId); }
    else for(Course c:courses.findAll()) if(auth.manages(u,c)) ids.add(c.id);
    List<Recording> all=ids.isEmpty()?new ArrayList<>():recs.findByCourseIdIn(ids);
    String needle=q==null?"":q.trim().toLowerCase(); boolean student="STUDENT".equals(u.role);
    List<Recording> out=new ArrayList<>();
    for(Recording r:all){
      if(student&&!(r.published&&"READY".equals(r.status))) continue;
      if(courseId!=null&&!courseId.equals(r.courseId)) continue;
      if(status!=null&&!status.isBlank()&&!"ALL".equals(status)&&!status.equals(r.status)) continue;
      if(!needle.isEmpty()){ Course c=course(r.courseId); String hay=(String.valueOf(r.title)+" "+(c==null?"":c.name)).toLowerCase(); if(!hay.contains(needle)) continue; }
      out.add(r); }
    Comparator<Recording> byDate=(a,b)->{ if(a.createdAt==null) return b.createdAt==null?0:1; if(b.createdAt==null) return -1; return a.createdAt.compareTo(b.createdAt); };
    Comparator<Recording> cmp;
    if("oldest".equals(sort)) cmp=byDate;
    else if("longest".equals(sort)) cmp=(a,b)->Integer.compare(b.durationSec,a.durationSec);
    else if("title".equals(sort)) cmp=(a,b)->String.valueOf(a.title).compareToIgnoreCase(String.valueOf(b.title));
    else cmp=byDate.reversed();
    out.sort(cmp);
    int sz=Math.max(1,Math.min(50,size)), pg=Math.max(0,page), pages=Math.max(1,(out.size()+sz-1)/sz);
    int from=Math.min(pg*sz,out.size()), to=Math.min(from+sz,out.size());
    List<Map<String,Object>> items=new ArrayList<>(); for(Recording r:out.subList(from,to)) items.add(view(r,u));
    Map<String,Object> res=new LinkedHashMap<>(); res.put("items",items); res.put("total",out.size()); res.put("page",pg); res.put("pages",pages); res.put("size",sz);
    return res; }

  /** Storage usage: used space and counts (admin: everything + free disk; teacher: own recordings). */
  @GetMapping("/storage") Map<String,Object> storage(@RequestHeader(value="Authorization",required=false) String h){
    User u=auth.teach(h); boolean admin="ADMIN".equals(u.role);
    Set<Long> ids=new HashSet<>(); for(Course c:courses.findAll()) if(auth.manages(u,c)) ids.add(c.id);
    List<Recording> mine=admin?recs.findAll():(ids.isEmpty()?new ArrayList<>():recs.findByCourseIdIn(ids));
    long used=0; int ready=0,processing=0,failed=0;
    for(Recording r:mine){ used+=r.sizeBytes; if("READY".equals(r.status)) ready++; else if("UPLOADING".equals(r.status)) processing++; else if("FAILED".equals(r.status)) failed++; }
    Map<String,Object> m=new LinkedHashMap<>();
    m.put("scope",admin?"all":"mine"); m.put("usedBytes",used); m.put("quotaBytes",st.quotaBytes); m.put("count",mine.size());
    m.put("ready",ready); m.put("processing",processing); m.put("failed",failed);
    if(admin){ m.put("storageDir",st.dir.toString()); try{ m.put("diskFreeBytes",Files.getFileStore(st.dir).getUsableSpace()); }catch(IOException e){ m.put("diskFreeBytes",null); } }
    return m; }

  @GetMapping("/{id}") Map<String,Object> one(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id){
    User u=auth.need(h,null); Recording r=rec(id);
    if(!canWatch(u,r)) throw forbidden("You do not have access to this recording");
    return view(r,u); }

  /** Rename, publish / unpublish, and per-recording download permission (teacher of the course or admin). */
  @PatchMapping("/{id}") Map<String,Object> edit(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id,@RequestBody Map<String,Object> b){
    User u=auth.teach(h);
    synchronized(LOCK){
      Recording r=rec(id); requireManage(u,r);
      if(b.containsKey("title")){ String t=String.valueOf(b.get("title")==null?"":b.get("title")).trim(); if(t.isEmpty()) throw bad("Enter a title"); r.title=t.length()>150?t.substring(0,150):t; }
      if(b.containsKey("published")){ boolean p=Boolean.TRUE.equals(b.get("published")); if(p&&!"READY".equals(r.status)) throw new ResponseStatusException(HttpStatus.CONFLICT,"Only finished recordings can be published"); r.published=p; }
      if(b.containsKey("allowDownload")) r.allowDownload=Boolean.TRUE.equals(b.get("allowDownload"));
      recs.save(r); return view(r,u); } }

  /** Permanently delete a recording and its files. The UI asks for confirmation first. */
  @DeleteMapping("/{id}") Map<String,Object> delete(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id) throws IOException {
    User u=auth.teach(h);
    synchronized(LOCK){
      Recording r=rec(id); requireManage(u,r);
      Files.deleteIfExists(st.part(r));
      if(r.fileName!=null) Files.deleteIfExists(st.dir.resolve(r.fileName));
      if(r.thumbName!=null) Files.deleteIfExists(st.dir.resolve(r.thumbName));
      recs.delete(r);
      return Map.of("message","Recording deleted."); } }

  /** Video stream. Works with Range requests (seeking). Authorization: header, or ?token= for the <video> element. */
  @GetMapping("/{id}/video") ResponseEntity<StreamingResponseBody> video(@RequestHeader(value="Authorization",required=false) String h,@RequestParam(required=false) String token,
      @RequestParam(required=false) String download,@RequestHeader(value="Range",required=false) String range,@PathVariable Long id) throws IOException {
    User u=auth.viewer(h,token); Recording r=rec(id);
    if(!canWatch(u,r)) throw forbidden("You can watch this recording only when it is published for your enrolled course");
    boolean dl=download!=null&&!download.isBlank()&&!"0".equals(download);
    if(dl&&!canManage(u,r)) throw forbidden("Students can watch recordings but cannot download them");
    if(!"READY".equals(r.status)) throw new ResponseStatusException(HttpStatus.CONFLICT,"This recording is not ready yet");
    Path p=st.file(r); if(!Files.isRegularFile(p)) throw notFound("The recording file is missing on the server");
    long len=Files.size(p), start=0, end=len-1; boolean partial=false;
    if(range!=null&&range.startsWith("bytes=")){
      try{ String spec=range.substring(6).split(",")[0].trim(); int dash=spec.indexOf('-'); String a=spec.substring(0,dash).trim(), e2=spec.substring(dash+1).trim();
        if(a.isEmpty()){ long n=Long.parseLong(e2); start=Math.max(0,len-n); }
        else { start=Long.parseLong(a); if(!e2.isEmpty()) end=Math.min(end,Long.parseLong(e2)); }
        if(start>end||start>=len) return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE).header(HttpHeaders.CONTENT_RANGE,"bytes */"+len).build();
        partial=true; }
      catch(NumberFormatException ex){ start=0; end=len-1; partial=false; } }
    final long from=start, count=end-start+1, last=end; final Path file=p;
    String base=String.valueOf(r.title).replaceAll("[^A-Za-z0-9 ._-]","_");
    ResponseEntity.BodyBuilder bb=ResponseEntity.status(partial?HttpStatus.PARTIAL_CONTENT:HttpStatus.OK)
      .contentType(MediaType.parseMediaType(r.mimeType==null?"video/webm":r.mimeType))
      .header(HttpHeaders.ACCEPT_RANGES,"bytes").header(HttpHeaders.CONTENT_LENGTH,String.valueOf(count))
      .header(HttpHeaders.CACHE_CONTROL,"private, no-cache").header("X-Content-Type-Options","nosniff")
      .header(HttpHeaders.CONTENT_DISPOSITION,(dl?"attachment":"inline")+"; filename=\""+base+(r.mimeType.endsWith("mp4")?".mp4":".webm")+"\"");
    if(partial) bb.header(HttpHeaders.CONTENT_RANGE,"bytes "+from+"-"+last+"/"+len);
    StreamingResponseBody body=out->{
      try(RandomAccessFile raf=new RandomAccessFile(file.toFile(),"r")){
        raf.seek(from); byte[] buf=new byte[65536]; long left=count;
        while(left>0){ int n=raf.read(buf,0,(int)Math.min(buf.length,left)); if(n<0) break; out.write(buf,0,n); left-=n; } } };
    return bb.body(body); }

  @GetMapping("/{id}/thumbnail") ResponseEntity<FileSystemResource> thumbnail(@RequestHeader(value="Authorization",required=false) String h,@RequestParam(required=false) String token,@PathVariable Long id){
    User u=auth.viewer(h,token); Recording r=rec(id);
    if(!canWatch(u,r)) throw forbidden("You do not have access to this recording");
    if(r.thumbName==null) throw notFound("No thumbnail");
    Path p=st.dir.resolve(r.thumbName); if(!Files.isRegularFile(p)) throw notFound("No thumbnail");
    String ct=r.thumbName.endsWith(".png")?"image/png":r.thumbName.endsWith(".webp")?"image/webp":"image/jpeg";
    return ResponseEntity.ok().contentType(MediaType.parseMediaType(ct)).header(HttpHeaders.CACHE_CONTROL,"private, max-age=3600").header("X-Content-Type-Options","nosniff").body(new FileSystemResource(p)); }
}
