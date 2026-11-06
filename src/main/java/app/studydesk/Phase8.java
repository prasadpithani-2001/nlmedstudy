package app.studydesk;

import jakarta.mail.internet.MimeMessage;
import jakarta.persistence.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/* ===== Phase 8: NLMed Study =====
   - Mailer: enrolment + password emails. If spring.mail.host is not set, emails are printed in the server log (development mode).
   - Forgot / reset password with single-use, 30-minute tokens (only a SHA-256 hash of the token is stored).
   - Public data for the home page: stats, catalog (rating, students, discount), teachers, reviews.
   - Student dashboard and staff overview (all numbers computed from the database). */

@Component class Mailer {
  static final Logger log = LoggerFactory.getLogger(Mailer.class);
  final ObjectProvider<JavaMailSender> sender;
  @Value("${app.base-url:http://localhost:8080}") String base;
  @Value("${app.mail.from:NLMed Study <no-reply@nmedstudy.com>}") String from;
  @Value("${spring.mail.host:}") String host;
  @Value("${spring.mail.port:587}") String port;
  @Value("${app.staff-notify-email:}") String staffNotify;
  /** Demo and example addresses never receive mail. Their mail would bounce ("address not found"). */
  static boolean isPlaceholder(String address) {
    if (address == null || !address.contains("@")) return true;
    String d = address.substring(address.indexOf('@') + 1).toLowerCase();
    return d.equals("studydesk.app") || d.equals("example.com") || d.equals("example.org") || d.equals("localhost") || d.endsWith(".test") || d.endsWith(".local");
  }
  @Value("${app.support-email:support@example.com}") String support;
  /** Used by the shared email design (header links and footer). Set once at startup from the same settings. */
  static volatile String SITE = "http://localhost:8080", SUPPORT = "support@example.com";
  @jakarta.annotation.PostConstruct void initLinks() { SITE = base; SUPPORT = support; }
  volatile String lastError; volatile java.time.Instant lastOk;
  EmailLogRepo logs;
  Mailer(ObjectProvider<JavaMailSender> s, EmailLogRepo l) { sender = s; logs = l; }
  /** Keeps a record of each send attempt for the admin's Sent emails list. Never breaks sending. */
  void record(String to, String subject, String status, String problem) {
    try { EmailLog e = new EmailLog(); e.toAddress = to == null ? "" : (to.length() > 200 ? to.substring(0, 200) : to); e.subject = subject == null ? "" : (subject.length() > 200 ? subject.substring(0, 200) : subject); e.status = status; e.problem = problem == null ? null : (problem.length() > 300 ? problem.substring(0, 300) : problem); logs.save(e); } catch (Exception ignored) { }
  }

  boolean configured() { return host != null && !host.isBlank() && sender.getIfAvailable() != null; }

  String deliver(String to, String subject, String html, String text) { return deliverAs(to, subject, html, text, null, null, false); }

  /** Sends now and returns the truth: null when the mail server accepted the email, otherwise the reason. Retries twice.
      fromName shows who the email is from (for example "Dr. Meera Rao via NLMed Study"); replyTo is where replies go.
      The NL logo is embedded inside the email, so it shows even when the site is not on the public internet.
      sensitive = true for emails that carry a secret (password reset links, password-changed notices). Those are never
      redirected to the staff notification address, and their content is never written to the server log. */
  String deliverAs(String to, String subject, String html, String text, String fromName, String replyTo, boolean sensitive) {
    if (to == null || to.isBlank()) return "The email address is empty";
    if (isPlaceholder(to)) {
      if (sensitive) {
        String why = "The address " + to + " is a demo address. A password email was not sent.";
        lastError = why; record(to, subject, "FAILED", why); log.warn(why); return why;
      }
      if (staffNotify == null || staffNotify.isBlank()) {
        String why = "The address " + to + " is a demo address and cannot receive email. Change this account's email, or set APP_STAFF_NOTIFY_EMAIL.";
        lastError = why; record(to, subject, "FAILED", why); log.warn(why); return why;
      }
      to = staffNotify;
    }
    if (!configured()) {
      String why = "Email is not set up on the server. Set SMTP_HOST, SMTP_USERNAME and SMTP_PASSWORD, then restart the server.";
      log.warn("EMAIL NOT SENT to {}: {}{}", to, why, sensitive ? " (content hidden: sensitive email)" : "\n" + text);
      lastError = why; record(to, subject, "FAILED", why); return why;
    }
    JavaMailSender s = sender.getIfAvailable();
    String last = null;
    for (int attempt = 1; attempt <= 3; attempt++) {
      try {
        MimeMessage m = s.createMimeMessage();
        MimeMessageHelper h = new MimeMessageHelper(m, true, "UTF-8");
        jakarta.mail.internet.InternetAddress fromAddr = new jakarta.mail.internet.InternetAddress(from);
        h.setFrom(fromName == null || fromName.isBlank() ? fromAddr : new jakarta.mail.internet.InternetAddress(fromAddr.getAddress(), fromName, "UTF-8"));
        if (replyTo != null && !replyTo.isBlank()) h.setReplyTo(replyTo);
        h.setTo(to); h.setSubject(subject); h.setText(text, html);
        h.addInline("nlmed-logo", new org.springframework.core.io.ClassPathResource("static/email-logo.png"), "image/png");
        s.send(m);
        lastOk = java.time.Instant.now(); lastError = null; record(to, subject, "SENT", null);
        return null;
      } catch (Exception e) {
        last = e.getMessage();
        log.warn("Email to {} failed (attempt {}): {}", to, attempt, last);
        if (attempt < 3) { try { Thread.sleep(1500L * attempt); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; } }
      }
    }
    lastError = last; record(to, subject, "FAILED", last);
    return "The mail server did not accept the email: " + last;
  }

  /** What the admin sees about email: whether it is set up, and the last result. Never shows the password. */
  Map<String, Object> status() {
    Map<String, Object> m = new LinkedHashMap<>();
    boolean on = configured();
    m.put("configured", on); m.put("host", on ? host : null); m.put("port", port); m.put("from", from);
    m.put("lastError", lastError); m.put("lastSuccessAt", lastOk == null ? null : lastOk.toString());
    m.put("baseUrl", base); m.put("linksUseLocalhost", base == null || base.contains("localhost") || base.contains("127.0.0.1"));
    return m; }

  static String esc(String s) { return s == null ? "" : s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;"); }
  static String inr(int n) { return "\u20B9" + String.format(Locale.forLanguageTag("en-IN"), "%,d", n); }
  String url(String hashPath) { return (base.endsWith("/") ? base.substring(0, base.length() - 1) : base) + "/#" + hashPath; }

  /** Sends in a background thread so a slow mail server never slows the web request. */
  void send(String to, String subject, String html, String text) { background(to, subject, html, text, false); }

  /** Same as send, for emails that carry a secret (see deliverAs). */
  void sendSensitive(String to, String subject, String html, String text) { background(to, subject, html, text, true); }

  private void background(String to, String subject, String html, String text, boolean sensitive) {
    if (to == null || to.isBlank()) return;
    Thread t = new Thread(() -> deliverAs(to, subject, html, text, null, null, sensitive), "mailer");
    t.setDaemon(true); t.start();
  }

  /** The person who sent a staff email: initials, name, role and a reply button. */
  static String senderCard(String name, String roleLabel, String email) {
    String n = name == null || name.isBlank() ? "NLMed Study" : name.trim();
    String initial = n.substring(0, 1).toUpperCase();
    String reply = email == null || email.isBlank() ? "" :
      "<a href=\"mailto:" + esc(email) + "?subject=Re:\" style=\"display:inline-block;margin-top:10px;padding:9px 16px;border-radius:10px;background:#eef2ff;color:#4f46e5;font-weight:700;font-size:13px;text-decoration:none\">Reply to " + esc(n) + "</a>";
    return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:26px 0 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px\"><tr><td style=\"padding:16px 18px\">"
      + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr><td style=\"width:44px;height:44px;border-radius:22px;background:#4f46e5;color:#ffffff;text-align:center;font-size:18px;font-weight:800;line-height:44px\">" + esc(initial) + "</td>"
      + "<td style=\"padding-left:12px\"><div style=\"font-size:15px;font-weight:700;color:#0f172a\">" + esc(n) + "</div><div style=\"font-size:12px;color:#64748b\">" + esc(roleLabel) + " &middot; NLMed Study</div></td></tr></table>"
      + reply + "</td></tr></table>";
  }

  /** The one design used by every NMed Study email: a gradient hero with the NL logo, a clear content card, a button and a dark footer. */
  static String layout(String heading, String bodyHtml, String cta, String link) {
    String site = SITE.endsWith("/") ? SITE.substring(0, SITE.length() - 1) : SITE;
    String preview = heading == null ? "" : heading.replaceAll("<[^>]+>", "");
    StringBuilder h = new StringBuilder();
    h.append("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"color-scheme\" content=\"light\"><title>NLMed Study</title>")
     .append("<style>@media only screen and (max-width:620px){.wrap{width:100%!important}.pad{padding-left:22px!important;padding-right:22px!important}.h1{font-size:21px!important}.logo{width:56px!important;height:56px!important}}</style></head>")
     .append("<body style=\"margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b\">")
     .append("<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;color:transparent\">").append(esc(preview)).append("</div>")
     .append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#eef2f7;padding:32px 12px\"><tr><td align=\"center\">")
     .append("<table role=\"presentation\" class=\"wrap\" width=\"620\" cellpadding=\"0\" cellspacing=\"0\" style=\"width:620px;max-width:620px;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,.10)\">")
     // hero: the NL logo, centred, on a gradient
     .append("<tr><td align=\"center\" style=\"background:#4f46e5;background-image:linear-gradient(135deg,#4338ca 0%,#6d28d9 55%,#a855f7 100%);padding:34px 32px 30px\">")
     .append("<img class=\"logo\" src=\"cid:nlmed-logo\" width=\"72\" height=\"72\" alt=\"NL\" style=\"display:block;margin:0 auto;width:72px;height:72px;border:0;border-radius:18px\">")
     .append("<div style=\"margin-top:12px;color:#e0e7ff;font-size:11px;letter-spacing:3px;text-transform:uppercase\">Learn better &middot; Study smarter</div>")
     .append("</td></tr>")
     // body card
     .append("<tr><td class=\"pad\" style=\"padding:36px 40px 32px\">")
     .append("<h1 class=\"h1\" style=\"margin:0 0 16px;font-size:26px;line-height:1.25;font-weight:800;color:#0f172a\">").append(heading).append("</h1>")
     .append("<div style=\"font-size:15px;line-height:1.75;color:#334155\">").append(bodyHtml).append("</div>");
    if (link != null) {
      h.append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:30px 0 0\"><tr><td align=\"center\" style=\"border-radius:999px;background:#4f46e5;background-image:linear-gradient(135deg,#4f46e5,#7c3aed)\">")
       .append("<a href=\"").append(esc(link)).append("\" style=\"display:inline-block;padding:15px 34px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px\">").append(esc(cta)).append("</a></td></tr></table>")
       .append("<p style=\"margin:22px 0 0;font-size:12px;line-height:1.6;color:#64748b\">Button not working? Copy this link into your browser:<br><a href=\"").append(esc(link)).append("\" style=\"color:#4f46e5;word-break:break-all\">").append(esc(link)).append("</a></p>");
    }
    h.append("<div style=\"margin-top:30px;padding-top:22px;border-top:1px solid #e2e8f0;font-size:15px;color:#334155\">With warm regards,<br><b style=\"color:#0f172a\">NLMed Study Team</b></div>")
     .append("</td></tr>")
     // dark footer
     .append("<tr><td class=\"pad\" style=\"background:#0f172a;padding:26px 40px;font-size:12px;line-height:1.8;color:#94a3b8\">")
     .append("<div style=\"color:#e2e8f0;font-weight:700;font-size:13px\">NLMed Study</div>")
     .append("Questions? <a href=\"mailto:").append(esc(SUPPORT)).append("\" style=\"color:#a5b4fc\">").append(esc(SUPPORT)).append("</a>")
     .append(" &middot; <a href=\"").append(esc(site)).append("/#/courses\" style=\"color:#a5b4fc\">Courses</a>")
     .append(" &middot; <a href=\"").append(esc(site)).append("/#/dashboard\" style=\"color:#a5b4fc\">My dashboard</a>")
     .append(" &middot; <a href=\"").append(esc(site)).append("/#/contact\" style=\"color:#a5b4fc\">Contact</a>")
     .append("<br><span style=\"color:#64748b\">You are receiving this email because you have an account with NLMed Study. &copy; NLMed Study</span>")
     .append("</td></tr></table></td></tr></table></body></html>");
    return h.toString();
  }

  void enrolled(User student, Course c, int amount, String txn) {
    String link = url("/learn/" + c.id);
    String html = layout("Thank you for enrolling, " + esc(student.name) + "!",
      "<p>You are now enrolled in:</p><table style=\"font-size:15px;line-height:1.7\">"
        + "<tr><td style=\"padding-right:14px;color:#64748b\">Course</td><td><b>" + esc(c.name) + "</b></td></tr>"
        + "<tr><td style=\"color:#64748b\">Instructor</td><td>" + esc(c.teacher) + "</td></tr>"
        + "<tr><td style=\"color:#64748b\">Amount paid</td><td>" + inr(amount) + "</td></tr>"
        + (txn == null ? "" : "<tr><td style=\"color:#64748b\">Transaction ID</td><td>" + esc(txn) + "</td></tr>")
        + "</table><p>You can start learning from your NLMed Study dashboard whenever you are ready. We wish you every success!</p>", "Go to My Course", link);
    String text = "Hello " + student.name + ",\n\nThank you for enrolling!\n\nYou are now enrolled in:\n\nCourse: " + c.name + "\nInstructor: " + c.teacher
      + "\nAmount Paid: " + inr(amount) + (txn == null ? "" : "\nTransaction ID: " + txn) + "\n\nYou can now access your course from your NLMed Study dashboard:\n" + link
      + "\n\nThank you for choosing NLMed Study.\n\nRegards,\nNLMed Study Team";
    send(student.email, "You have successfully enrolled in " + c.name + " \u2013 NLMed Study", html, text);
  }

  void resetLink(User u, String link, int minutes) {
    String html = layout("Reset your password",
      "<p>Hello " + esc(u.name) + ",</p><p>We received a request to reset your NLMed Study password. Please use the button below within " + minutes + " minutes. The link can be used only once.</p>"
        + "<p style=\"color:#64748b;font-size:13px\">If you did not make this request, please ignore this email. Your password will stay the same.</p>", "Reset Password", link);
    String text = "Hello " + u.name + ",\n\nwe received a request to reset your NLMed Study password. Please use the link below within " + minutes + " minutes (it can be used only once):\n" + link + "\n\nIf you did not make this request, please ignore this email.\n\nNLMed Study Team";
    sendSensitive(u.email, "Reset your NLMed Study password", html, text);
  }

  void passwordChanged(User u) {
    sendSensitive(u.email, "Your NLMed Study password was changed",
      layout("Your password has been changed", "<p>Hello " + esc(u.name) + ", we are writing to let you know that your NLMed Study password has been changed.</p><p>If you made this change, there is nothing more you need to do.</p><p style=\"color:#64748b;font-size:13px\">If you did not make this change, please contact us straight away so we can help you secure your account.</p>", null, null),
      "Hello " + u.name + ",\n\nWe are writing to let you know that your NLMed Study password has been changed.\n\nIf you made this change, there is nothing more you need to do. If you did not, please contact us straight away so we can help you secure your account.\n\nWith warm regards,\nNLMed Study Team");
  }
}

@Entity class ResetToken { @Id @GeneratedValue public Long id; public Long userId; @Column(unique = true, length = 64) public String tokenHash; public LocalDateTime expiresAt; public boolean used; public LocalDateTime createdAt = LocalDateTime.now(); }
interface ResetTokenRepo extends JpaRepository<ResetToken, Long> { Optional<ResetToken> findByTokenHash(String h); List<ResetToken> findByUserIdAndUsedFalse(Long u); }

@RestController @RequestMapping("/api/auth") class PasswordController {
  static final int VALID_MIN = 30;
  final UserRepo users; final ResetTokenRepo tokens; final Mailer mail; final Auth auth;
  final Map<String, Long> last = new ConcurrentHashMap<>();
  final SecureRandom rnd = new SecureRandom();
  PasswordController(UserRepo u, ResetTokenRepo t, Mailer m, Auth a) { users = u; tokens = t; mail = m; auth = a; }

  static String hash(String raw) {
    try { byte[] d = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)); StringBuilder sb = new StringBuilder(); for (byte b : d) sb.append(String.format("%02x", b)); return sb.toString(); }
    catch (Exception e) { throw new IllegalStateException(e); }
  }

  /** Same answer whether or not the email exists, so nobody can probe which emails are registered. */
  @PostMapping("/forgot") Map<String, Object> forgot(@RequestBody Map<String, String> b) {
    String email = ExtrasController.str(b, "email");
    if (!ExtrasController.EMAIL.matcher(email).matches()) throw ExtrasController.bad("Enter a valid email address");
    long now = System.currentTimeMillis();
    if (last.size() > 1000) last.entrySet().removeIf(en -> now - en.getValue() > 10 * 60_000L);   // keep the rate-limit map small
    Long prev = last.put(email.toLowerCase(), now);
    if (prev != null && now - prev < 60_000) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Please wait a minute before asking for another link");
    Optional<User> u = users.findByEmail(email); if (u.isEmpty()) u = users.findByEmail(email.toLowerCase());
    if (u.isPresent()) {
      User user = u.get();
      for (ResetToken old : tokens.findByUserIdAndUsedFalse(user.id)) { old.used = true; tokens.save(old); }
      byte[] raw = new byte[32]; rnd.nextBytes(raw); String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
      ResetToken t = new ResetToken(); t.userId = user.id; t.tokenHash = hash(token); t.expiresAt = LocalDateTime.now().plusMinutes(VALID_MIN); tokens.save(t);
      mail.resetLink(user, mail.url("/reset-password?token=" + token), VALID_MIN);
    }
    return Map.of("message", "If that email is registered, a password reset link is on its way. It expires in " + VALID_MIN + " minutes.");
  }

  ResetToken valid(String token) {
    if (token == null || token.isBlank() || token.length() > 100) throw ExtrasController.bad("This reset link is invalid or has expired. Please request a new one.");
    ResetToken t = tokens.findByTokenHash(hash(token)).orElseThrow(() -> ExtrasController.bad("This reset link is invalid or has expired. Please request a new one."));
    if (t.used || t.expiresAt.isBefore(LocalDateTime.now())) throw ExtrasController.bad("This reset link is invalid or has expired. Please request a new one.");
    return t;
  }

  @GetMapping("/reset/validate") Map<String, Object> check(@RequestParam String token) { valid(token); return Map.of("valid", true); }

  @PostMapping("/reset") Map<String, Object> reset(@RequestBody Map<String, String> b) {
    String pw = b.get("password") == null ? "" : b.get("password"), again = b.get("confirm") == null ? "" : b.get("confirm");
    if (pw.length() < 8) throw ExtrasController.bad("Password must be at least 8 characters");
    if (pw.length() > 100) throw ExtrasController.bad("Password is too long");
    if (!pw.equals(again)) throw ExtrasController.bad("The two passwords do not match");
    ResetToken t = valid(b.get("token"));
    User u = users.findById(t.userId).orElseThrow(() -> ExtrasController.bad("This reset link is invalid or has expired. Please request a new one."));
    u.passwordHash = auth.enc.encode(pw); u.token = null; users.save(u);   // token=null signs the user out everywhere
    t.used = true; tokens.save(t);
    for (ResetToken o : tokens.findByUserIdAndUsedFalse(u.id)) { o.used = true; tokens.save(o); }
    mail.passwordChanged(u);
    return Map.of("message", "Password reset successfully!");
  }
}

/** Public, read-only data for the home, courses, teachers and about pages. */
@RestController @RequestMapping("/api") class CatalogController {
  final UserRepo users; final CourseRepo courses; final EnrollRepo enrolls; final ReviewRepo reviews; final LessonRepo lessons;
  CatalogController(UserRepo u, CourseRepo c, EnrollRepo e, ReviewRepo r, LessonRepo l) { users = u; courses = c; enrolls = e; reviews = r; lessons = l; }

  static Double avg(Collection<Review> l) { return l.isEmpty() ? null : Math.round(l.stream().mapToInt(r -> r.rating).average().orElse(0) * 10) / 10.0; }

  @GetMapping("/catalog") List<Map<String, Object>> catalog() {
    Map<Long, List<Review>> rv = reviews.findAll().stream().collect(Collectors.groupingBy(r -> r.courseId));
    Map<Long, Long> st = enrolls.findAll().stream().collect(Collectors.groupingBy(e -> e.courseId, Collectors.counting()));
    Map<Long, Long> ls = lessons.findAll().stream().collect(Collectors.groupingBy(l -> l.courseId, Collectors.counting()));
    List<Map<String, Object>> out = new ArrayList<>();
    for (Course c : courses.findAll()) {
      Map<String, Object> m = new LinkedHashMap<>();
      List<Review> r = rv.getOrDefault(c.id, List.of());
      m.put("id", c.id); m.put("name", c.name); m.put("subject", c.subject); m.put("teacher", c.teacher); m.put("teacherId", c.ownerId);
      m.put("price", c.price); m.put("listPrice", c.listPrice != null && c.listPrice > c.price ? c.listPrice : null);
      m.put("discountPct", c.listPrice != null && c.listPrice > c.price ? (c.listPrice - c.price) * 100 / c.listPrice : 0);
      m.put("liveClasses", c.liveClasses); m.put("notes", c.notes); m.put("assessments", c.assessments); m.put("lessons", ls.getOrDefault(c.id, 0L));
      m.put("rating", avg(r)); m.put("reviews", r.size()); m.put("students", st.getOrDefault(c.id, 0L));
      out.add(m);
    }
    return out;
  }

  @GetMapping("/teachers") List<Map<String, Object>> teachers() {
    List<Course> all = courses.findAll(); List<Review> rv = reviews.findAll(); List<Enrollment> en = enrolls.findAll(); List<Map<String, Object>> out = new ArrayList<>();
    for (User u : users.findAll()) {
      if (!"TEACHER".equals(u.role)) continue;
      List<Course> mine = all.stream().filter(c -> u.id.equals(c.ownerId)).collect(Collectors.toList());
      Set<Long> ids = mine.stream().map(c -> c.id).collect(Collectors.toSet());
      Map<String, Object> m = new LinkedHashMap<>();
      m.put("id", u.id); m.put("name", u.name); m.put("courses", mine.size());
      m.put("students", en.stream().filter(e -> ids.contains(e.courseId)).map(e -> e.userId).distinct().count());
      m.put("rating", avg(rv.stream().filter(r -> ids.contains(r.courseId)).collect(Collectors.toList())));
      m.put("subjects", mine.stream().map(c -> c.subject).distinct().collect(Collectors.toList()));
      out.add(m);
    }
    return out;
  }

  @GetMapping("/public/reviews") List<Map<String, Object>> latestReviews() {
    Map<Long, String> names = new HashMap<>(); for (Course c : courses.findAll()) names.put(c.id, c.name);
    List<Review> l = new ArrayList<>(reviews.findAll()); l.sort((a, b) -> Long.compare(b.id, a.id)); List<Map<String, Object>> out = new ArrayList<>();
    for (Review r : l) { if (r.comment == null || r.comment.isBlank()) continue; if (out.size() >= 6) break;
      Map<String, Object> m = new LinkedHashMap<>(); m.put("id", r.id); m.put("name", r.userName); m.put("rating", r.rating); m.put("comment", r.comment); m.put("course", names.get(r.courseId)); out.add(m); }
    return out;
  }

  @GetMapping("/public/stats") Map<String, Object> stats() {
    List<User> us = users.findAll(); List<Review> rv = reviews.findAll(); List<Course> cs = courses.findAll();
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("students", us.stream().filter(u -> "STUDENT".equals(u.role)).count());
    m.put("courses", cs.size());
    m.put("teachers", us.stream().filter(u -> "TEACHER".equals(u.role)).count());
    m.put("liveClasses", cs.stream().mapToInt(c -> c.liveClasses).sum());
    m.put("enrollments", enrolls.count());
    m.put("satisfaction", rv.isEmpty() ? null : (int) (rv.stream().filter(r -> r.rating >= 4).count() * 100 / rv.size()));
    return m;
  }
}

/** Student dashboard + staff overview. Teachers see only their own money and students; admin sees everything. */
@RestController @RequestMapping("/api") class DashboardController {
  final Auth auth; final CourseRepo courses; final EnrollRepo enrolls; final LessonRepo lessons; final LessonDoneRepo done; final PaymentRepo payments;
  final DemoRepo demos; final AttemptRepo attempts;
  DashboardController(Auth a, CourseRepo c, EnrollRepo e, LessonRepo l, LessonDoneRepo d, PaymentRepo p, DemoRepo dm, AttemptRepo at) { auth = a; courses = c; enrolls = e; lessons = l; done = d; payments = p; demos = dm; attempts = at; }

  @GetMapping("/my/dashboard") Map<String, Object> mine(@RequestHeader(value = "Authorization", required = false) String h) {
    User u = auth.need(h, null);
    Map<Long, Course> cm = courses.findAll().stream().collect(Collectors.toMap(c -> c.id, c -> c));
    Set<Long> dn = done.findByUserId(u.id).stream().map(d -> d.lessonId).collect(Collectors.toSet());
    Map<Long, List<Lesson>> ls = lessons.findAll().stream().collect(Collectors.groupingBy(l -> l.courseId));
    List<Map<String, Object>> my = new ArrayList<>(), certs = new ArrayList<>();
    for (Enrollment e : enrolls.findByUserId(u.id)) {
      Course c = cm.get(e.courseId); if (c == null) continue;
      List<Lesson> l = ls.getOrDefault(c.id, List.of()); long d = l.stream().filter(x -> dn.contains(x.id)).count(); int pct = l.isEmpty() ? 0 : (int) (d * 100 / l.size());
      Map<String, Object> m = new LinkedHashMap<>();
      m.put("courseId", c.id); m.put("name", c.name); m.put("subject", c.subject); m.put("teacher", c.teacher); m.put("percent", pct); m.put("done", d); m.put("total", l.size()); m.put("since", e.at == null ? null : e.at.toString()); m.put("paid", e.paid);
      my.add(m);
      if (!l.isEmpty() && pct == 100) { Map<String, Object> ct = new LinkedHashMap<>(); ct.put("courseId", c.id); ct.put("name", c.name); certs.add(ct); }
    }
    List<Payment> ps = new ArrayList<>(payments.findByUserId(u.id)); ps.sort((a, b) -> Long.compare(b.id, a.id));
    List<Demo> up = demos.findAll().stream().filter(d -> d.startsAt != null && d.startsAt.isAfter(LocalDateTime.now())).sorted((a, b) -> a.startsAt.compareTo(b.startsAt)).limit(3).collect(Collectors.toList());
    List<Map<String, Object>> demoOut = new ArrayList<>();
    for (Demo d : up) { Map<String, Object> m = new LinkedHashMap<>(); m.put("id", d.id); m.put("title", d.title); m.put("topic", d.topic); m.put("startsAt", d.startsAt.toString()); demoOut.add(m); }
    List<Attempt> at = attempts.findByUserId(u.id);
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("name", u.name); out.put("courses", my); out.put("certificates", certs);
    out.put("payments", ps.size() > 5 ? ps.subList(0, 5) : ps); out.put("upcoming", demoOut);
    out.put("assessments", at.size()); out.put("averageScore", Math.round(at.stream().mapToDouble(x -> x.total == 0 ? 0 : x.correct * 100.0 / x.total).average().orElse(0)));
    return out;
  }

  @GetMapping("/staff/overview") Map<String, Object> overview(@RequestHeader(value = "Authorization", required = false) String h) {
    User st = auth.staff(h); boolean admin = "ADMIN".equals(st.role); LocalDate today = LocalDate.now();
    List<Course> all = courses.findAll(); Set<Long> mineIds = new HashSet<>(); List<Course> mine = new ArrayList<>();
    for (Course c : all) if (admin || c.ownerId == null || st.id.equals(c.ownerId)) { mine.add(c); mineIds.add(c.id); }
    List<Payment> ps = payments.findAll().stream().filter(p -> QrPaymentController.mine(st, p)).collect(Collectors.toList());
    List<Enrollment> en = enrolls.findAll().stream().filter(e -> mineIds.contains(e.courseId)).collect(Collectors.toList());
    int total = 0, month = 0; long pending = 0; Map<LocalDate, Integer> byDay = new TreeMap<>(); Map<Long, int[]> byCourse = new HashMap<>();
    for (int i = 13; i >= 0; i--) byDay.put(today.minusDays(i), 0);
    for (Payment p : ps) {
      if ("PENDING_VERIFICATION".equals(p.status)) pending++;
      if (!"SUCCESS".equals(p.status)) continue;
      LocalDateTime when = p.reviewedAt != null ? p.reviewedAt : p.at;
      if (when == null) continue;   // a payment with no date cannot be placed on the chart
      total += p.amount; LocalDate d = when.toLocalDate();
      if (d.getYear() == today.getYear() && d.getMonth() == today.getMonth()) month += p.amount;
      if (byDay.containsKey(d)) byDay.merge(d, p.amount, Integer::sum);
      byCourse.computeIfAbsent(p.courseId, k -> new int[2])[0] += p.amount;
    }
    for (Enrollment e : en) byCourse.computeIfAbsent(e.courseId, k -> new int[2])[1]++;
    Map<Long, String> names = new HashMap<>(); for (Course c : all) names.put(c.id, c.name);
    List<Map<String, Object>> days = new ArrayList<>(), per = new ArrayList<>();
    byDay.forEach((d, v) -> { Map<String, Object> m = new LinkedHashMap<>(); m.put("date", d.toString()); m.put("amount", v); days.add(m); });
    byCourse.forEach((id, v) -> { if (!mineIds.contains(id)) return; Map<String, Object> m = new LinkedHashMap<>(); m.put("course", names.get(id)); m.put("amount", v[0]); m.put("students", v[1]); per.add(m); });
    per.sort((a, b) -> Integer.compare((int) b.get("amount"), (int) a.get("amount")));
    List<Payment> recent = new ArrayList<>(ps); recent.removeIf(p -> "AWAITING".equals(p.status) || "CANCELLED".equals(p.status) || "EXPIRED".equals(p.status)); recent.sort((a, b) -> Long.compare(b.id, a.id));
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("scope", admin ? "all" : "mine"); out.put("revenue", total); out.put("month", month); out.put("pending", pending);
    out.put("students", en.stream().map(e -> e.userId).distinct().count()); out.put("enrollments", en.size()); out.put("courses", mine.size());
    out.put("days", days); out.put("byCourse", per); out.put("recent", recent.size() > 6 ? recent.subList(0, 6) : recent);
    return out;
  }
}