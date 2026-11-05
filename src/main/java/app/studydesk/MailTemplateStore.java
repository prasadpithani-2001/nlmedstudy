package app.studydesk;
import jakarta.persistence.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;

/* An email type that an admin created and saved from the editor. Built-in types stay in EmailTemplates. */
@Entity class MailTemplate {
  @Id @GeneratedValue public Long id;
  @Column(length=80) public String label;
  @Column(length=10) public String audience="ALL";        // ALL = admins and teachers, ADMIN = admins only
  public boolean needsPayment;
  @Column(length=150) public String subject;
  @Column(length=150) public String heading;
  @Lob public String bodyHtml;
  @Column(length=120) public String createdBy;
  public LocalDateTime updatedAt=LocalDateTime.now();
}
interface MailTemplateRepo extends JpaRepository<MailTemplate,Long>{}
