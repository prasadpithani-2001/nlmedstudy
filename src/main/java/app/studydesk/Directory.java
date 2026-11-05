package app.studydesk;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

/* ===== Phase 10.1: registered student directory =====
   Teacher: students enrolled in the teacher's own courses, with only those courses listed.
   Admin: every registered student, with all of their enrolled courses. Students are never listed to students. */
@RestController @RequestMapping("/api/staff") class StudentDirectoryController {
  final Auth auth; final CourseRepo courses; final EnrollRepo enrolls; final UserRepo users;
  StudentDirectoryController(Auth a,CourseRepo c,EnrollRepo e,UserRepo u){auth=a;courses=c;enrolls=e;users=u;}

  @GetMapping("/student-directory") List<Map<String,Object>> directory(@RequestHeader(value="Authorization",required=false) String h){
    User st=auth.teach(h);
    Map<Long,Course> mine=new HashMap<>();
    for(Course c:courses.findAll()) if(auth.manages(st,c)) mine.put(c.id,c);
    Map<Long,List<Enrollment>> byUser=new HashMap<>();
    for(Enrollment e:enrolls.findAll()) if(mine.containsKey(e.courseId)) byUser.computeIfAbsent(e.userId,k->new ArrayList<>()).add(e);
    Map<Long,User> all=new HashMap<>(); for(User u:users.findAll()) all.put(u.id,u);
    Collection<User> pool="ADMIN".equals(st.role)?all.values():byUser.keySet().stream().map(all::get).filter(Objects::nonNull).collect(Collectors.toList());
    List<Map<String,Object>> out=new ArrayList<>();
    for(User u:pool){
      if(!"STUDENT".equals(u.role)) continue;
      List<Map<String,Object>> cs=new ArrayList<>();
      for(Enrollment e:byUser.getOrDefault(u.id,List.of())){
        Course c=mine.get(e.courseId); if(c==null) continue;
        Map<String,Object> m=new LinkedHashMap<>(); m.put("courseId",c.id); m.put("course",c.name); m.put("paid",e.paid); m.put("since",e.at==null?null:e.at.toString()); cs.add(m); }
      cs.sort((a,b)->String.valueOf(a.get("course")).compareTo(String.valueOf(b.get("course"))));
      Map<String,Object> row=new LinkedHashMap<>();
      row.put("id",u.id); row.put("name",u.name); row.put("email",u.email); row.put("enrolled",cs.size()); row.put("courses",cs);
      out.add(row); }
    out.sort((a,b)->String.valueOf(a.get("name")).compareToIgnoreCase(String.valueOf(b.get("name"))));
    return out; }
}
