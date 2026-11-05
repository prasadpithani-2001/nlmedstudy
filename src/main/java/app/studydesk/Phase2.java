package app.studydesk;
import jakarta.persistence.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/** videoUrl: embed link (YouTube/Vimeo embed URL) or a direct .mp4 URL */
@Entity class Lesson { @Id @GeneratedValue public Long id; public Long courseId, topicId; public String title, videoUrl, videoFile; }
@Entity class LessonDone { @Id @GeneratedValue public Long id; public Long userId, lessonId; public java.time.LocalDateTime at=java.time.LocalDateTime.now(); }
@Entity class Review { @Id @GeneratedValue public Long id; public Long courseId, userId; public String userName, comment; public int rating; }
interface LessonRepo extends JpaRepository<Lesson,Long>{ List<Lesson> findByCourseId(Long c); }
interface LessonDoneRepo extends JpaRepository<LessonDone,Long>{ List<LessonDone> findByUserId(Long u); boolean existsByUserIdAndLessonId(Long u,Long l); }
interface ReviewRepo extends JpaRepository<Review,Long>{ List<Review> findByCourseId(Long c); }

@RestController @RequestMapping("/api") class LearnController {
  final Auth auth; final EnrollRepo enrolls; final LessonRepo lessons; final LessonDoneRepo done; final ReviewRepo reviews; final CourseRepo courses; final UserRepo users;
  LearnController(Auth a,EnrollRepo e,LessonRepo l,LessonDoneRepo d,ReviewRepo r,CourseRepo c,UserRepo u){auth=a;enrolls=e;lessons=l;done=d;reviews=r;courses=c;users=u;}

  User member(String h,Long courseId){ User u=auth.need(h,null);
    if(!"STUDENT".equals(u.role)||enrolls.existsByUserIdAndCourseId(u.id,courseId)) return u;
    throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Enroll to unlock this course"); }
  Map<String,Object> prog(User u,Long cid){
    Set<Long> ids=lessons.findByCourseId(cid).stream().map(l->l.id).collect(Collectors.toSet());
    long d=done.findByUserId(u.id).stream().filter(x->ids.contains(x.lessonId)).count();
    return Map.of("done",d,"total",ids.size(),"percent",ids.isEmpty()?0:(int)(d*100/ids.size())); }

  @PostMapping("/admin/lessons") Lesson addLesson(@RequestHeader(value="Authorization",required=false) String h,@RequestBody Map<String,String> b){
    auth.managed(h,Long.valueOf(b.get("courseId")),courses); Lesson l=new Lesson(); l.courseId=Long.valueOf(b.get("courseId")); l.topicId=Long.valueOf(b.get("topicId")); l.title=b.get("title"); l.videoUrl=b.get("videoUrl"); return lessons.save(l); }
  @GetMapping("/courses/{id}/lessons") List<Lesson> lessons(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id){ member(h,id); return lessons.findByCourseId(id); }
  @PostMapping("/lessons/{id}/complete") Map<String,Object> complete(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id){
    Lesson l=lessons.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Lesson not found")); User u=member(h,l.courseId);
    if(!done.existsByUserIdAndLessonId(u.id,id)){ LessonDone d=new LessonDone(); d.userId=u.id; d.lessonId=id; done.save(d); } return prog(u,l.courseId); }
  @GetMapping("/courses/{id}/progress") Map<String,Object> progress(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id){ return prog(member(h,id),id); }
  @GetMapping("/courses/{id}/certificate") Map<String,Object> certificate(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id){
    User u=member(h,id); Map<String,Object> p=prog(u,id);
    if((int)p.get("total")==0||(int)p.get("percent")<100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Complete all lessons to unlock your certificate");
    Course c=courses.findById(id).orElseThrow(); return Map.of("id","NMS-"+id+"-"+u.id,"student",u.name,"course",c.name,"date",LocalDate.now().toString()); }

  @GetMapping("/courses/{id}/reviews") Map<String,Object> reviews(@PathVariable Long id){ List<Review> l=reviews.findByCourseId(id);
    double avg=Math.round(l.stream().mapToInt(r->r.rating).average().orElse(0)*10)/10.0; return Map.of("average",avg,"items",l); }
  @PostMapping("/courses/{id}/reviews") Review review(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id,@RequestBody Map<String,String> b){
    User u=member(h,id); Review r=new Review(); r.courseId=id; r.userId=u.id; r.userName=u.name; r.comment=b.get("comment"); r.rating=Math.max(1,Math.min(5,Integer.parseInt(b.getOrDefault("rating","5")))); return reviews.save(r); }

  // ---- admin ----
  @GetMapping("/admin/users") List<Map<String,Object>> allUsers(@RequestHeader(value="Authorization",required=false) String h){ auth.need(h,"ADMIN");
    return users.findAll().stream().map(u->Map.<String,Object>of("id",u.id,"name",u.name,"email",u.email,"role",u.role)).collect(Collectors.toList()); }
  @PutMapping("/admin/users/{id}/role") Map<String,Object> setRole(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id,@RequestBody Map<String,String> b){
    auth.need(h,"ADMIN"); String r=b.get("role"); if(!Set.of("STUDENT","TEACHER","ADMIN").contains(r)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown role");
    User u=users.findById(id).orElseThrow(); u.role=r; users.save(u); return Map.of("id",id,"role",r); }
  @GetMapping("/admin/payments") List<Enrollment> payments(@RequestHeader(value="Authorization",required=false) String h){ auth.staff(h); return enrolls.findAll(); }
}

@Configuration class Phase2Seed {
  @Bean CommandLineRunner seedAdmin(UserRepo u,Auth a){ return x->{ if(u.findByEmail("admin@studydesk.app").isEmpty()){
    User ad=new User(); ad.name="Admin"; ad.email="admin@studydesk.app"; ad.passwordHash=a.enc.encode("admin123"); ad.role="ADMIN"; u.save(ad); } }; }
}

@Configuration class DemoStudentSeed {
  /** Demo student login for testing the student side (not enrolled in anything, so the pay-and-enrol flow can be tried). Delete or change before going live. */
  @Bean CommandLineRunner seedDemoStudent(UserRepo u,Auth a){ return x->{ if(u.findByEmail("student@studydesk.app").isEmpty()){
    User st=new User(); st.name="Demo Student"; st.email="student@studydesk.app"; st.passwordHash=a.enc.encode("student123"); st.role="STUDENT"; u.save(st); } }; }
}
