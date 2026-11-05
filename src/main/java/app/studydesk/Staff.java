package app.studydesk;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

/* ===== Phase 8.1: teacher / admin views of their own courses and students =====
   A teacher sees only the courses they own (old courses without an owner stay visible); the admin sees every course. */
@RestController @RequestMapping("/api") class StaffStudentsController {
  final Auth auth; final CourseRepo courses; final EnrollRepo enrolls; final UserRepo users; final LessonRepo lessons; final LessonDoneRepo done;
  StaffStudentsController(Auth a,CourseRepo c,EnrollRepo e,UserRepo u,LessonRepo l,LessonDoneRepo d){auth=a;courses=c;enrolls=e;users=u;lessons=l;done=d;}

  /** Courses this staff member manages (used by the Teacher dashboard so teachers never see each other's courses). */
  @GetMapping("/staff/courses") List<Course> myCourses(@RequestHeader(value="Authorization",required=false) String h){
    User st=auth.teach(h); return courses.findAll().stream().filter(c->auth.manages(st,c)).collect(Collectors.toList()); }

  /** Every enrolment in those courses with the student's lesson progress. */
  @GetMapping("/staff/students") List<Map<String,Object>> students(@RequestHeader(value="Authorization",required=false) String h){
    User st=auth.teach(h);
    Map<Long,Course> mine=new HashMap<>(); for(Course c:courses.findAll()) if(auth.manages(st,c)) mine.put(c.id,c);
    Map<Long,User> um=new HashMap<>(); for(User u:users.findAll()) um.put(u.id,u);
    Map<Long,List<Lesson>> ls=new HashMap<>(); for(Lesson l:lessons.findAll()) ls.computeIfAbsent(l.courseId,k->new ArrayList<>()).add(l);
    Map<Long,Set<Long>> dn=new HashMap<>(); for(LessonDone d:done.findAll()) dn.computeIfAbsent(d.userId,k->new HashSet<>()).add(d.lessonId);
    List<Map<String,Object>> out=new ArrayList<>();
    for(Enrollment e:enrolls.findAll()){
      Course c=mine.get(e.courseId); User s=um.get(e.userId); if(c==null||s==null) continue;
      List<Lesson> l=ls.getOrDefault(c.id,List.of()); Set<Long> d=dn.getOrDefault(s.id,Set.of()); long n=l.stream().filter(x->d.contains(x.id)).count();
      Map<String,Object> m=new LinkedHashMap<>();
      m.put("id",e.id); m.put("student",s.name); m.put("email",s.email); m.put("courseId",c.id); m.put("course",c.name); m.put("paid",e.paid);
      m.put("since",e.at==null?null:e.at.toString()); m.put("done",n); m.put("total",l.size()); m.put("percent",l.isEmpty()?0:(int)(n*100/l.size()));
      out.add(m); }
    out.sort((a,b)->String.valueOf(b.get("since")).compareTo(String.valueOf(a.get("since"))));
    return out; }
}
