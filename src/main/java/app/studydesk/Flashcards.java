package app.studydesk;

import jakarta.persistence.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.util.*;

/* Flashcards: a teacher or admin adds cards to a course. Students see the cards of the courses they are enrolled in. */
@Entity class Flashcard {
  @Id @GeneratedValue public Long id;
  public Long courseId;
  @Column(length=120) public String subject;
  @Column(length=300) public String front;
  @Column(length=1000) public String back;
  public LocalDateTime createdAt = LocalDateTime.now();
}
interface FlashcardRepo extends JpaRepository<Flashcard,Long> {
  List<Flashcard> findByCourseIdOrderByIdAsc(Long courseId);
}

@RestController @RequestMapping("/api") class FlashcardController {
  final Auth auth; final CourseRepo courses; final EnrollRepo enrolls; final FlashcardRepo cards;
  FlashcardController(Auth a,CourseRepo c,EnrollRepo e,FlashcardRepo f){ auth=a; courses=c; enrolls=e; cards=f; }

  static Map<String,Object> view(Flashcard f){
    Map<String,Object> m=new LinkedHashMap<>();
    m.put("id",f.id); m.put("courseId",f.courseId); m.put("subject",f.subject); m.put("front",f.front); m.put("back",f.back);
    return m; }
  static String text(Map<String,String> b,String k){ String v=b.get(k); return v==null?"":v.trim(); }

  /** Student: flashcards of every course the student is enrolled in. */
  @GetMapping("/my/flashcards") List<Map<String,Object>> mine(@RequestHeader(value="Authorization",required=false) String h){
    User u=auth.need(h,null);
    List<Map<String,Object>> out=new ArrayList<>();
    for(Enrollment e:enrolls.findByUserId(u.id)) for(Flashcard f:cards.findByCourseIdOrderByIdAsc(e.courseId)) out.add(view(f));
    return out; }

  /** Cards of one course: enrolled students, or the teacher / admin who manages that course. */
  @GetMapping("/courses/{courseId}/flashcards") List<Map<String,Object>> ofCourse(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long courseId){
    User u=auth.need(h,null);
    if("TEACHER".equals(u.role)||"ADMIN".equals(u.role)) auth.managed(h,courseId,courses);
    else if(!enrolls.existsByUserIdAndCourseId(u.id,courseId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Enroll in this course to see its flashcards");
    List<Map<String,Object>> out=new ArrayList<>();
    for(Flashcard f:cards.findByCourseIdOrderByIdAsc(courseId)) out.add(view(f));
    return out; }

  /** Teacher (own course) or admin (any course): add a card. The subject is taken from the course. */
  @PostMapping("/admin/courses/{courseId}/flashcards") Map<String,Object> add(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long courseId,@RequestBody Map<String,String> b){
    Course c=auth.managed(h,courseId,courses);
    String front=text(b,"front"), back=text(b,"back");
    if(front.isEmpty()||back.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Write both the question and the answer");
    if(front.length()>300||back.length()>1000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Question up to 300 characters, answer up to 1000");
    Flashcard f=new Flashcard();
    f.courseId=courseId; f.subject=c.subject; f.front=front; f.back=back;
    cards.save(f);
    return view(f); }

  /** Delete a card. Only the teacher who owns the course (or the admin) can do it. */
  @DeleteMapping("/admin/flashcards/{id}") Map<String,Object> remove(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id){
    Flashcard f=cards.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Card not found"));
    auth.managed(h,f.courseId,courses);
    cards.delete(f);
    return Map.of("message","Flashcard deleted."); }
}