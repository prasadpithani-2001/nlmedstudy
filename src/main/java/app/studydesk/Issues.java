package app.studydesk;
import jakarta.persistence.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/** Problems reported by students and teachers. status: OPEN | IN_PROGRESS | RESOLVED.
 *  screenshot: optional image as a data URL (PNG, JPG or WEBP, about 1 MB at most). courseId: the course the report is about, if any. */
@Entity class Issue { @Id @GeneratedValue public Long id; public Long userId, courseId;
  public String userName, role, category, courseName, status="OPEN";
  @Column(length=2000) public String message; @Lob public String screenshot;
  public LocalDateTime at=LocalDateTime.now(), updatedAt=LocalDateTime.now(); }
interface IssueRepo extends JpaRepository<Issue,Long>{ List<Issue> findByUserIdOrderByAtDesc(Long userId); }

/** One message in a report's thread, written by the reporter or by staff. */
@Entity class IssueReply { @Id @GeneratedValue public Long id; public Long issueId, authorId;
  public String authorName, role; @Column(length=2000) public String message; public LocalDateTime at=LocalDateTime.now(); }
interface IssueReplyRepo extends JpaRepository<IssueReply,Long>{ List<IssueReply> findByIssueIdOrderByAtAsc(Long issueId); }

@RestController @RequestMapping("/api") class IssueController {
  static final int MAX_SHOT = 1_400_000;
  final Auth auth; final IssueRepo issues; final IssueReplyRepo replies; final CourseRepo courses; final DoubtRepo doubts;
  IssueController(Auth a, IssueRepo i, IssueReplyRepo r, CourseRepo c, DoubtRepo d){ auth=a; issues=i; replies=r; courses=c; doubts=d; }

  static String str(Object o){ return o==null ? "" : String.valueOf(o).trim(); }
  static String clip(String s, int n){ return s.length()>n ? s.substring(0,n) : s; }
  static Long longOf(Object o){ String s=str(o); if(s.isEmpty()) return null; try { return Long.valueOf(s); } catch (NumberFormatException e) { return null; } }
  static ResponseStatusException bad(String m){ return new ResponseStatusException(HttpStatus.BAD_REQUEST, m); }
  static ResponseStatusException forbid(){ return new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot change this report"); }
  Issue find(Long id){ return issues.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found")); }

  boolean owns(User u, Long courseId){ return courseId!=null && courses.findById(courseId).map(c -> u.id.equals(c.ownerId)).orElse(false); }
  boolean canStaff(User u, Issue i){ return "ADMIN".equals(u.role) || ("TEACHER".equals(u.role) && owns(u, i.courseId)); }
  boolean canSee(User u, Issue i){ return u.id.equals(i.userId) || canStaff(u, i); }

  Map<String,Object> view(Issue i){
    Map<String,Object> m = new LinkedHashMap<>();
    m.put("id", i.id); m.put("userId", i.userId); m.put("userName", i.userName); m.put("role", i.role);
    m.put("category", i.category); m.put("status", i.status); m.put("message", i.message);
    m.put("courseId", i.courseId); m.put("courseName", i.courseName); m.put("hasScreenshot", i.screenshot != null);
    m.put("at", i.at); m.put("updatedAt", i.updatedAt);
    m.put("replies", replies.findByIssueIdOrderByAtAsc(i.id).stream().map(r -> {
      Map<String,Object> x = new LinkedHashMap<>();
      x.put("id", r.id); x.put("authorName", r.authorName); x.put("role", r.role); x.put("message", r.message); x.put("at", r.at);
      return x; }).collect(Collectors.toList()));
    return m; }

  /** Student (or teacher) reports a problem. Optional course and optional screenshot. */
  @PostMapping("/issues") Map<String,Object> report(@RequestHeader(value="Authorization",required=false) String h, @RequestBody Map<String,Object> b){
    User u = auth.need(h, null);
    String msg = clip(str(b.get("message")), 2000);
    if (msg.length() < 10) throw bad("Describe the problem in at least 10 characters");
    Issue i = new Issue(); i.userId = u.id; i.userName = u.name; i.role = u.role; i.message = msg;
    String cat = clip(str(b.get("category")), 40); i.category = cat.isEmpty() ? "Other" : cat;
    Long cid = longOf(b.get("courseId"));
    if (cid != null) { Course c = courses.findById(cid).orElseThrow(() -> bad("Unknown course")); i.courseId = c.id; i.courseName = c.name; }
    String shot = str(b.get("screenshot"));
    if (!shot.isEmpty()) {
      if (!shot.matches("^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$")) throw bad("Screenshot must be a PNG, JPG or WEBP image");
      if (shot.length() > MAX_SHOT) throw bad("Screenshot is too large (max 1 MB)");
      i.screenshot = shot; }
    return view(issues.save(i)); }

  /** The signed-in person's own reports, with their threads. */
  @GetMapping("/my/issues") List<Map<String,Object>> mine(@RequestHeader(value="Authorization",required=false) String h){
    User u = auth.need(h, null);
    return issues.findByUserIdOrderByAtDesc(u.id).stream().map(this::view).collect(Collectors.toList()); }

  /** The reporter replies in their own thread. Replying to a resolved report reopens it. */
  @PostMapping("/my/issues/{id}/reply") Map<String,Object> myReply(@RequestHeader(value="Authorization",required=false) String h, @PathVariable Long id, @RequestBody Map<String,Object> b){
    User u = auth.need(h, null); Issue i = find(id);
    if (!u.id.equals(i.userId)) throw forbid();
    return addReply(u, i, b, false); }

  Map<String,Object> addReply(User u, Issue i, Map<String,Object> b, boolean staff){
    String m = clip(str(b.get("message")), 2000);
    if (m.isEmpty()) throw bad("Write a reply first");
    IssueReply r = new IssueReply(); r.issueId = i.id; r.authorId = u.id; r.authorName = u.name; r.role = u.role; r.message = m;
    replies.save(r);
    i.updatedAt = LocalDateTime.now();
    if (!staff && "RESOLVED".equals(i.status)) i.status = "OPEN";
    if (staff && "OPEN".equals(i.status)) i.status = "IN_PROGRESS";
    return view(issues.save(i)); }

  /** Admin sees every report; a teacher sees reports about their own courses. */
  @GetMapping("/staff/issues") List<Map<String,Object>> staffList(@RequestHeader(value="Authorization",required=false) String h){
    User u = auth.need(h, null);
    if (!"ADMIN".equals(u.role) && !"TEACHER".equals(u.role)) throw forbid();
    return issues.findAll().stream()
      .filter(i -> canStaff(u, i))
      .sorted(Comparator.comparing((Issue i) -> i.at).reversed())
      .map(this::view).collect(Collectors.toList()); }

  @PutMapping("/staff/issues/{id}/status") Map<String,Object> staffStatus(@RequestHeader(value="Authorization",required=false) String h, @PathVariable Long id, @RequestBody Map<String,Object> b){
    User u = auth.need(h, null); Issue i = find(id);
    if (!canStaff(u, i)) throw forbid();
    String s = str(b.get("status"));
    if (!Set.of("OPEN","IN_PROGRESS","RESOLVED").contains(s)) throw bad("Unknown status");
    i.status = s; i.updatedAt = LocalDateTime.now();
    return view(issues.save(i)); }

  @PostMapping("/staff/issues/{id}/reply") Map<String,Object> staffReply(@RequestHeader(value="Authorization",required=false) String h, @PathVariable Long id, @RequestBody Map<String,Object> b){
    User u = auth.need(h, null); Issue i = find(id);
    if (!canStaff(u, i)) throw forbid();
    return addReply(u, i, b, true); }

  /** Screenshot of a report. Needs the session token in the query string because <img> cannot send headers. */
  @GetMapping("/issues/{id}/screenshot") ResponseEntity<byte[]> shot(@RequestHeader(value="Authorization",required=false) String h, @RequestParam(required=false) String token, @PathVariable Long id){
    User u = auth.viewer(h, token); Issue i = find(id);
    if (!canSee(u, i) || i.screenshot == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No screenshot");
    String type = i.screenshot.substring(5, i.screenshot.indexOf(';'));
    byte[] bytes = Base64.getDecoder().decode(i.screenshot.substring(i.screenshot.indexOf(',') + 1));
    return ResponseEntity.ok().contentType(MediaType.parseMediaType(type)).body(bytes); }

  // ---- admin endpoints kept for the existing admin screen
  @GetMapping("/admin/all-doubts") List<Doubt> allDoubts(@RequestHeader(value="Authorization",required=false) String h){ auth.need(h,"ADMIN"); return doubts.findAll(); }
  @GetMapping("/admin/issues") List<Map<String,Object>> all(@RequestHeader(value="Authorization",required=false) String h){ auth.need(h,"ADMIN"); return issues.findAll().stream().map(this::view).collect(Collectors.toList()); }
  @PutMapping("/admin/issues/{id}/status") Map<String,Object> status(@RequestHeader(value="Authorization",required=false) String h, @PathVariable Long id, @RequestBody Map<String,Object> b){
    User u = auth.need(h, "ADMIN"); Issue i = find(id);
    String s = str(b.get("status"));
    if (!Set.of("OPEN","IN_PROGRESS","RESOLVED").contains(s)) throw bad("Unknown status");
    i.status = s; i.updatedAt = LocalDateTime.now(); return view(issues.save(i)); }
}
