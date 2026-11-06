package app.studydesk;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

/** Delete a course. Blocked when students or payments exist, so no paid access or money record breaks. */
@RestController @RequestMapping("/api") class CourseDeleteController {
  final Auth auth; final CourseRepo courses; final EnrollRepo enrolls; final PaymentRepo payments;
  final LessonRepo lessons; final LessonDoneRepo lessonDone; final TopicRepo topics; final QuestionRepo questions;
  final AttemptRepo attempts; final DoubtRepo doubts; final ReviewRepo reviews;
  CourseDeleteController(Auth a,CourseRepo c,EnrollRepo e,PaymentRepo p,LessonRepo l,LessonDoneRepo ld,TopicRepo t,QuestionRepo q,AttemptRepo at,DoubtRepo d,ReviewRepo r){
    auth=a;courses=c;enrolls=e;payments=p;lessons=l;lessonDone=ld;topics=t;questions=q;attempts=at;doubts=d;reviews=r;}

  @DeleteMapping("/admin/courses/{id}") Map<String,Object> remove(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id){
    Course c=auth.managed(h,id,courses);
    boolean hasStudents=enrolls.findAll().stream().anyMatch(e->id.equals(e.courseId));
    boolean hasPayments=payments.findAll().stream().anyMatch(p->id.equals(p.courseId));
    if(hasStudents||hasPayments) throw new ResponseStatusException(HttpStatus.CONFLICT,"Students have enrolled in this course, so it cannot be deleted. You can change its price instead.");
    List<Lesson> ls=lessons.findAll().stream().filter(x->id.equals(x.courseId)).toList();
    Set<Long> lessonIds=new HashSet<>(); for(Lesson x:ls) lessonIds.add(x.id);
    lessonDone.deleteAll(lessonDone.findAll().stream().filter(d->lessonIds.contains(d.lessonId)).toList());
    lessons.deleteAll(ls);
    topics.deleteAll(topics.findAll().stream().filter(t->id.equals(t.courseId)).toList());
    questions.deleteAll(questions.findAll().stream().filter(q->id.equals(q.courseId)).toList());
    attempts.deleteAll(attempts.findAll().stream().filter(a->id.equals(a.courseId)).toList());
    doubts.deleteAll(doubts.findAll().stream().filter(d->id.equals(d.courseId)).toList());
    reviews.deleteAll(reviews.findAll().stream().filter(r->id.equals(r.courseId)).toList());
    courses.delete(c);
    return Map.of("message","Course deleted.");
  }
}