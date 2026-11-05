package app.studydesk;
import jakarta.persistence.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.*;

/* One live class: a row is created when the teacher starts it and marked ENDED when the teacher ends it.
   The server is the source of truth: a student cannot enter a class whose latest session is ENDED. */
@Entity class LiveSession {
  @Id @GeneratedValue public Long id;
  public Long courseId;
  @Column(length=80) public String sessionKey;     // course id + the moment the teacher started (same key as attendance)
  public LocalDateTime startedAt, endedAt;
  @Column(length=20) public String status="LIVE"; // LIVE | ENDED
}
interface LiveSessionRepo extends JpaRepository<LiveSession,Long>{
  Optional<LiveSession> findFirstBySessionKey(String sessionKey);
  Optional<LiveSession> findFirstByCourseIdOrderByIdDesc(Long courseId);
}
