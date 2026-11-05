package app.studydesk;
import jakarta.persistence.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.util.*;

/* One row per student visit to a live class. A reconnect during the same visit does not add a row. */
@Entity class LiveAttendance {
  @Id @GeneratedValue public Long id;
  @Column(length=80) public String sessionKey;      // course id + the moment the teacher started the class
  public Long courseId, userId;
  @Column(length=120) public String userName;
  public LocalDateTime joinedAt, leftAt;
  public long seconds;
}
interface LiveAttendanceRepo extends JpaRepository<LiveAttendance,Long>{
  Optional<LiveAttendance> findFirstBySessionKeyAndUserIdAndLeftAtIsNullOrderByIdDesc(String sessionKey,Long userId);
  List<LiveAttendance> findByCourseIdOrderByIdDesc(Long courseId);
  List<LiveAttendance> findBySessionKeyAndLeftAtIsNull(String sessionKey);
}

/* Teacher / admin: the attendance report for a course's live classes. */
@RestController @RequestMapping("/api") class LiveAttendanceController {
  final Auth auth; final CourseRepo courses; final LiveAttendanceRepo att;
  LiveAttendanceController(Auth a,CourseRepo c,LiveAttendanceRepo r){ auth=a; courses=c; att=r; }
  @GetMapping("/staff/live/{courseId}/attendance") List<Map<String,Object>> report(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long courseId){
    auth.managed(h,courseId,courses);
    List<Map<String,Object>> out=new ArrayList<>();
    for(LiveAttendance a:att.findByCourseIdOrderByIdDesc(courseId)){
      Map<String,Object> m=new LinkedHashMap<>();
      m.put("id",a.id); m.put("sessionKey",a.sessionKey); m.put("userId",a.userId); m.put("userName",a.userName==null?"":a.userName);
      m.put("joinedAt",a.joinedAt==null?null:a.joinedAt.toString()); m.put("leftAt",a.leftAt==null?null:a.leftAt.toString());
      m.put("minutes",Math.round(a.seconds/6.0)/10.0);
      out.add(m);
    }
    return out;
  }
}
