package app.studydesk;
import jakarta.persistence.*;
import java.time.LocalDateTime;
@Entity @Table(name="users") class User { @Id @GeneratedValue public Long id; public String name; @Column(unique=true) public String email; public String passwordHash; public String role="STUDENT"; public String token; /** staff only: mobile number that receives SMS payment alerts (digits, 10-digit Indian mobile) */ public String mobile; /** when the account was created (null for accounts from before this was stored) */ public java.time.LocalDateTime createdAt; }
@Entity class Course { @Id @GeneratedValue public Long id; public String name, subject, teacher; public int liveClasses, notes, assessments; public int price; /** staff user who receives the money for this course */ public Long ownerId; /** original price shown struck-through (optional) */ public Integer listPrice; }
@Entity class Demo { @Id @GeneratedValue public Long id; public String title, topic, meetingLink; public LocalDateTime startsAt; public int durationMin=45, maxSeats=50; }
@Entity class DemoReg { @Id @GeneratedValue public Long id; public Long demoId; public String name, email, mobile, education; public boolean reminded; }
@Entity class Enrollment { @Id @GeneratedValue public Long id; public Long userId, courseId; public int paid; public String status="PAID"; public LocalDateTime at=LocalDateTime.now(); }
@Entity class Doubt { @Id @GeneratedValue public Long id; public Long userId, courseId; public String userName, category, text; public String status="PENDING"; }
@Entity class Question { @Id @GeneratedValue public Long id; public Long courseId; public String topic, text, options; public int correct; }
@Entity class Attempt { @Id @GeneratedValue public Long id; public Long userId, courseId; public int correct, total; public LocalDateTime at=LocalDateTime.now(); }
