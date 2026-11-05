package app.studydesk;
import jakarta.persistence.*;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.data.jpa.repository.JpaRepository;
import java.nio.file.*;
import java.util.*;

@Entity class Topic { @Id @GeneratedValue public Long id; public Long courseId; public String title; public int position; }
/** kind = NOTE (handwritten notes) or RESOURCE (study material). category/size/uploadedAt/uploadedBy are filled on upload (older rows are derived on read). */
@Entity class Material { @Id @GeneratedValue public Long id; public Long courseId, topicId; public String kind, title, fileName, contentType;
  public String originalName, category; public Long size, uploadedBy; public java.time.LocalDateTime uploadedAt; }
interface TopicRepo extends JpaRepository<Topic,Long>{ List<Topic> findByCourseIdOrderByPosition(Long c); }
interface MaterialRepo extends JpaRepository<Material,Long>{ List<Material> findByCourseIdAndKind(Long c,String k); List<Material> findByCourseId(Long c); List<Material> findByCourseIdIn(Collection<Long> c); }

@RestController @RequestMapping("/api") class ContentController {
  static final Path DIR=Path.of("uploads").toAbsolutePath().normalize();   // absolute: never depends on the servlet temp folder
  final Auth auth; final CourseRepo courses; final EnrollRepo enrolls; final TopicRepo topics; final MaterialRepo mats; final AccessRules rules;
  ContentController(Auth a,CourseRepo c,EnrollRepo e,TopicRepo t,MaterialRepo m,AccessRules r){auth=a;courses=c;enrolls=e;topics=t;mats=m;rules=r;}

  /** ADMIN: all. TEACHER: only courses they manage. STUDENT: only enrolled courses. */
  boolean canAccess(User u,Long courseId){
    if("ADMIN".equals(u.role)) return true;
    if("TEACHER".equals(u.role)){ Course c=courses.findById(courseId).orElse(null); return c!=null&&auth.manages(u,c); }
    return rules.canUseCourse(u.id,courseId); }

  // ---- teacher: set up course, price, topics ----
  @PostMapping("/admin/courses") Course newCourse(@RequestHeader(value="Authorization",required=false) String h,@RequestBody Map<String,String> b){
    User owner=auth.teach(h); Course c=new Course(); c.ownerId=owner.id;
    c.name=b.get("name")==null?"":b.get("name").trim(); c.subject=b.get("subject")==null?"":b.get("subject").trim();
    if(c.name.isEmpty()||c.subject.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enter the course name and subject");
    c.teacher=b.get("teacher")==null||b.get("teacher").isBlank()?owner.name:b.get("teacher").trim();   // instructor shown on cards and in emails = the creator
    try{ c.price=Integer.parseInt(b.get("price").trim()); }catch(Exception e){ throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enter the price as a whole number of rupees"); }
    if(c.price<0||c.price>1_000_000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enter a price between 0 and 10,00,000");
    c=courses.save(c); int pos=1; for(String tt:new String[]{"Introduction","Core Concepts","Clinical Cases","Revision"}){ Topic t1=new Topic(); t1.courseId=c.id; t1.title=tt; t1.position=pos++; topics.save(t1); }
    return c; }
  @PostMapping("/admin/courses/{id}/topics") Topic addTopic(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id,@RequestBody Map<String,String> b){
    auth.managed(h,id,courses); Topic t=new Topic(); t.courseId=id; t.title=b.get("title"); t.position=topics.findByCourseIdOrderByPosition(id).size()+1; return topics.save(t); }
  @GetMapping("/courses/{id}/topics") List<Topic> topics(@PathVariable Long id){ return topics.findByCourseIdOrderByPosition(id); }

  // ---- files: type rules ----
  static final Map<String,String[]> TYPES=new LinkedHashMap<>();   // ext -> {category, content type}
  static { String[][] t={{"pdf","PDF","application/pdf"},{"doc","DOC","application/msword"},{"docx","DOC","application/vnd.openxmlformats-officedocument.wordprocessingml.document"},{"txt","DOC","text/plain"},
    {"ppt","SLIDES","application/vnd.ms-powerpoint"},{"pptx","SLIDES","application/vnd.openxmlformats-officedocument.presentationml.presentation"},
    {"xls","SHEET","application/vnd.ms-excel"},{"xlsx","SHEET","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
    {"png","IMAGE","image/png"},{"jpg","IMAGE","image/jpeg"},{"jpeg","IMAGE","image/jpeg"},{"webp","IMAGE","image/webp"},{"gif","IMAGE","image/gif"},
    {"mp4","VIDEO","video/mp4"},{"webm","VIDEO","video/webm"},{"mov","VIDEO","video/quicktime"},{"m4v","VIDEO","video/mp4"}};
    for(String[] r:t) TYPES.put(r[0],new String[]{r[1],r[2]}); }
  static final long MAX_DOC=50L*1024*1024, MAX_VIDEO=600L*1024*1024;
  static String extOf(String n){ return n!=null&&n.contains(".")?n.substring(n.lastIndexOf('.')+1).toLowerCase():""; }
  static String catOf(Material m){ if(m.category!=null) return m.category; String[] t=TYPES.get(extOf(m.fileName)); return t==null?"OTHER":t[0]; }
  static boolean inline(String cat){ return cat.equals("PDF")||cat.equals("IMAGE")||cat.equals("VIDEO"); }   // only these are shown in the browser; the rest download

  Map<String,Object> dto(Material m,Map<Long,String> topicNames,Map<Long,String> courseNames){
    String cat=catOf(m); Map<String,Object> d=new LinkedHashMap<>();
    d.put("id",m.id); d.put("courseId",m.courseId); d.put("course",courseNames.get(m.courseId)); d.put("topicId",m.topicId); d.put("topic",m.topicId==null?null:topicNames.get(m.topicId));
    d.put("kind",m.kind); d.put("title",m.title); d.put("fileName",m.originalName!=null?m.originalName:m.fileName); d.put("category",cat); d.put("size",m.size);
    d.put("uploadedAt",m.uploadedAt==null?null:m.uploadedAt.toString()); d.put("previewable",inline(cat)); return d; }
  List<Map<String,Object>> dtos(List<Material> ms){
    Map<Long,String> tn=new HashMap<>(), cn=new HashMap<>(); topics.findAll().forEach(t->tn.put(t.id,t.title)); courses.findAll().forEach(c->cn.put(c.id,c.name));
    List<Material> sorted=new ArrayList<>(ms); sorted.sort((a,b)->{ String x=a.uploadedAt==null?"":a.uploadedAt.toString(), y=b.uploadedAt==null?"":b.uploadedAt.toString(); int c=y.compareTo(x); return c!=0?c:Long.compare(b.id,a.id); });
    List<Map<String,Object>> out=new ArrayList<>(); for(Material m:sorted) out.add(dto(m,tn,cn)); return out; }

  // ---- teacher: upload notes / resources (PDF, documents, slides, images, videos) ----
  @PostMapping(value="/admin/materials",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) Map<String,Object> upload(@RequestHeader(value="Authorization",required=false) String h,
      @RequestParam Long courseId,@RequestParam(required=false) Long topicId,@RequestParam(defaultValue="RESOURCE") String kind,@RequestParam(required=false) String title,@RequestParam MultipartFile file) throws Exception {
    Course course=auth.managed(h,courseId,courses); User me=auth.teach(h);
    String orig=Optional.ofNullable(file.getOriginalFilename()).orElse("file").replaceAll("[\\\\/]","_"); String ext=extOf(orig); String[] type=TYPES.get(ext);
    if(type==null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"This file type is not supported. Upload PDF, Word, PowerPoint, Excel, TXT, images (JPG, PNG, WEBP, GIF) or videos (MP4, WEBM, MOV).");
    if(file.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"The file is empty");
    if(!(kind.equals("NOTE")||kind.equals("RESOURCE")||kind.equals("RECORDING"))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose Handwritten note, Resource or Class recording");
    long max=type[0].equals("VIDEO")?MAX_VIDEO:MAX_DOC;
    if(file.getSize()>max) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"File is too large. The limit is "+(max>>20)+" MB for "+(type[0].equals("VIDEO")?"videos":"documents and images")+".");
    if(topicId!=null){ Topic t=topics.findById(topicId).orElse(null); if(t==null||!courseId.equals(t.courseId)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"That topic does not belong to this course"); }
    Files.createDirectories(DIR); String name=UUID.randomUUID()+"."+ext; file.transferTo(DIR.resolve(name));
    Material m=new Material(); m.courseId=courseId; m.topicId=topicId; m.kind=kind; m.fileName=name; m.originalName=orig; m.contentType=type[1]; m.category=type[0]; m.size=file.getSize(); m.uploadedBy=me.id; m.uploadedAt=java.time.LocalDateTime.now();
    m.title=title==null||title.isBlank()?orig.replaceFirst("\\.[^.]+$",""):title.trim(); if(m.title.length()>150) m.title=m.title.substring(0,150);
    m=mats.save(m); return dtos(List.of(m)).get(0); }
  @PutMapping("/admin/materials/{id}") Map<String,Object> edit(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id,@RequestBody Map<String,Object> b){
    Material m=mats.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"File not found")); auth.managed(h,m.courseId,courses);
    if(b.get("title")!=null){ String t=String.valueOf(b.get("title")).trim(); if(t.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enter a title"); m.title=t.length()>150?t.substring(0,150):t; }
    if(b.get("kind")!=null){ String k=String.valueOf(b.get("kind")); if(!(k.equals("NOTE")||k.equals("RESOURCE")||k.equals("RECORDING"))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown type"); m.kind=k; }
    if(b.containsKey("topicId")){ Object v=b.get("topicId"); if(v==null||String.valueOf(v).isBlank()) m.topicId=null; else { Long tid=Long.valueOf(String.valueOf(v)); Topic t=topics.findById(tid).orElse(null); if(t==null||!m.courseId.equals(t.courseId)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"That topic does not belong to this course"); m.topicId=tid; } }
    m=mats.save(m); return dtos(List.of(m)).get(0); }
  @DeleteMapping("/admin/materials/{id}") void delete(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id) throws Exception {
    Material m=mats.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"File not found")); auth.managed(h,m.courseId,courses); mats.deleteById(id);
    if(m.fileName!=null&&m.fileName.matches("[0-9a-f\\-]{36}\\.[a-z0-9]+")) Files.deleteIfExists(DIR.resolve(m.fileName)); }

  /** Teacher / admin: every file in the courses they manage (optionally one course). */
  @GetMapping("/staff/materials") List<Map<String,Object>> staffList(@RequestHeader(value="Authorization",required=false) String h,@RequestParam(required=false) Long courseId){
    User st=auth.teach(h);
    if(courseId!=null){ auth.managed(h,courseId,courses); return dtos(mats.findByCourseId(courseId)); }
    Set<Long> ids=new HashSet<>(); for(Course c:courses.findAll()) if(auth.manages(st,c)) ids.add(c.id);
    return ids.isEmpty()?List.of():dtos(mats.findByCourseIdIn(ids)); }

  // ---- student: only enrolled students (or the course's teacher) can list/open ----
  @GetMapping("/courses/{id}/materials") List<Map<String,Object>> all(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id){ return dtos(guard(h,id,null)); }
  @GetMapping("/courses/{id}/notes") List<Map<String,Object>> notes(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id){ return dtos(guard(h,id,"NOTE")); }
  @GetMapping("/courses/{id}/resources") List<Map<String,Object>> resources(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id){ return dtos(guard(h,id,"RESOURCE")); }
  List<Material> guard(String h,Long id,String kind){ User u=auth.need(h,null); if(!canAccess(u,id)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Enroll in this course to unlock its resources"); List<Material> l=new ArrayList<>(kind==null?mats.findByCourseId(id):mats.findByCourseIdAndKind(id,kind)); if("STUDENT".equals(u.role)) l.removeIf(m->!rules.canUseMaterial(u.id,id,m.topicId)); return l; }

  /** View or download. Works from <img>/<iframe>/<video> too: send the Authorization header OR ?token=. Add &download=1 to force a download. */
  @GetMapping("/materials/{id}/file") ResponseEntity<FileSystemResource> file(@RequestHeader(value="Authorization",required=false) String h,@RequestParam(required=false) String token,@RequestParam(required=false) String download,@PathVariable Long id){
    User u=auth.viewer(h,token);
    Material m=mats.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"File not found"));
    if(!canAccess(u,m.courseId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Enroll in this course to unlock its resources");
    if("STUDENT".equals(u.role)&&!rules.canUseMaterial(u.id,m.courseId,m.topicId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"This file is not part of your assigned plan");
    Path p=DIR.resolve(m.fileName).normalize(); if(!p.startsWith(DIR)||!Files.isRegularFile(p)) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"This file is missing on the server. Ask your teacher to upload it again.");
    String[] t=TYPES.get(extOf(m.fileName)); String ct=t==null?"application/octet-stream":t[1]; boolean dl=download!=null||!inline(catOf(m));
    String nm=m.originalName!=null?m.originalName:m.fileName;
    ContentDisposition cd=(dl?ContentDisposition.attachment():ContentDisposition.inline()).filename(nm,java.nio.charset.StandardCharsets.UTF_8).build();
    return ResponseEntity.ok().contentType(MediaType.parseMediaType(ct)).header(HttpHeaders.CONTENT_DISPOSITION,cd.toString()).header("X-Content-Type-Options","nosniff").header(HttpHeaders.CACHE_CONTROL,"private, max-age=300").body(new FileSystemResource(p)); }
}
