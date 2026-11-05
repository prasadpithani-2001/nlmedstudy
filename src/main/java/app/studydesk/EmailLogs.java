package app.studydesk;
import jakarta.persistence.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.*;

/* Every email the system tries to send: who it went to, what it was about, who sent it (for staff emails), and whether the mail server accepted it. */
@Entity class EmailLog { @Id @GeneratedValue public Long id; @Column(length=200) public String toAddress; @Column(length=200) public String subject; @Column(length=10) public String status; @Column(length=300) public String problem; @Column(length=120) public String sender; @Column(length=40) public String template; public LocalDateTime at=LocalDateTime.now(); }
interface EmailLogRepo extends JpaRepository<EmailLog,Long>{
  List<EmailLog> findTop500ByOrderByIdDesc();
  List<EmailLog> findTop500ByToAddressIgnoreCaseOrderByIdDesc(String to);
  Optional<EmailLog> findFirstByToAddressIgnoreCaseAndSubjectOrderByIdDesc(String to,String subject);
}

@RestController @RequestMapping("/api") class EmailLogController {
  final Auth auth; final EmailLogRepo logs;
  EmailLogController(Auth a,EmailLogRepo l){ auth=a; logs=l; }
  /** Admins see every email. A teacher sees only the emails sent to their own address. */
  @GetMapping("/staff/email-log") List<EmailLog> staffList(@RequestHeader(value="Authorization",required=false) String h){
    User st=auth.staff(h);
    if("ADMIN".equals(st.role)) return logs.findTop500ByOrderByIdDesc();
    return logs.findTop500ByToAddressIgnoreCaseOrderByIdDesc(st.email==null?"":st.email);
  }
  /** Admin only: the latest email attempts, newest first (kept for compatibility). */
  @GetMapping("/admin/email-log") List<EmailLog> list(@RequestHeader(value="Authorization",required=false) String h){
    auth.need(h,"ADMIN"); return logs.findTop500ByOrderByIdDesc(); }
}
