package app.studydesk;
import jakarta.persistence.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.util.*;

/* ===== Course plans: a teacher gives one student chosen topics, for a number of days or between two dates, at a fee the teacher sets.
   Flow: teacher assigns (PENDING_PAYMENT) -> student pays through the normal payment flow -> teacher/admin approves the payment -> ACTIVE.
   Access: an ACTIVE plan opens only its topics, and only while today is inside its dates. Full course enrolments are unchanged. */

@Entity class CoursePlan { @Id @GeneratedValue public Long id;
  public Long courseId, studentId, assignedById; public String assignedByName, topicIds, status="PENDING_PAYMENT";
  /** days = length counted from the day the payment is approved. null = fixed dates startsOn..endsOn. */
  public Integer days; public LocalDate startsOn, endsOn; public int fee;
  public LocalDateTime createdAt=LocalDateTime.now(), activatedAt;
  static List<Long> topicIdsOf(CoursePlan p){ List<Long> out=new ArrayList<>(); if(p.topicIds!=null) for(String s:p.topicIds.split(",")) if(!s.isBlank()) out.add(Long.valueOf(s.trim())); return out; }
}
interface CoursePlanRepo extends JpaRepository<CoursePlan,Long>{ List<CoursePlan> findByStudentId(Long s); List<CoursePlan> findByCourseId(Long c); }

/** Who may open what. Full enrolment = whole course. A plan = only its topics, only while today is inside its dates. */
@Component class AccessRules {
  final EnrollRepo enrolls; final CoursePlanRepo plans;
  AccessRules(EnrollRepo e,CoursePlanRepo p){ enrolls=e; plans=p; }
  boolean fullAccess(Long userId,Long courseId){ return enrolls.existsByUserIdAndCourseId(userId,courseId); }
  CoursePlan activePlan(Long userId,Long courseId){
    LocalDate today=LocalDate.now();
    for(CoursePlan p:plans.findByStudentId(userId))
      if(Objects.equals(courseId,p.courseId)&&"ACTIVE".equals(p.status)&&p.startsOn!=null&&p.endsOn!=null&&!today.isBefore(p.startsOn)&&!today.isAfter(p.endsOn)) return p;
    return null; }
  boolean canUseCourse(Long userId,Long courseId){ return fullAccess(userId,courseId)||activePlan(userId,courseId)!=null; }
  /** Full enrolment: every file of the course. A plan: only files tagged with one of its topics. */
  boolean canUseMaterial(Long userId,Long courseId,Long topicId){
    if(fullAccess(userId,courseId)) return true;
    CoursePlan p=activePlan(userId,courseId);
    return p!=null&&topicId!=null&&CoursePlan.topicIdsOf(p).contains(topicId); }
}

@RestController @RequestMapping("/api") class CoursePlanController {
  final Auth auth; final CourseRepo courses; final TopicRepo topics; final UserRepo users; final EnrollRepo enrolls; final CoursePlanRepo plans; final PaymentRepo payments; final Mailer mail;
  CoursePlanController(Auth a,CourseRepo c,TopicRepo t,UserRepo u,EnrollRepo e,CoursePlanRepo p,PaymentRepo pay,Mailer m){
    auth=a; courses=c; topics=t; users=u; enrolls=e; plans=p; payments=pay; mail=m; }

  static ResponseStatusException bad(String m){ return new ResponseStatusException(HttpStatus.BAD_REQUEST,m); }
  static ResponseStatusException conflict(String m){ return new ResponseStatusException(HttpStatus.CONFLICT,m); }
  static String text(Object o){ return o==null?"":String.valueOf(o).trim(); }
  static String joinIds(List<Long> ids){ StringBuilder sb=new StringBuilder(); for(Long i:ids){ if(sb.length()>0) sb.append(','); sb.append(i); } return sb.toString(); }

  /** Shown status: an ACTIVE plan whose last day has passed is EXPIRED. */
  static String statusOf(CoursePlan p){ if("ACTIVE".equals(p.status)&&p.endsOn!=null&&p.endsOn.isBefore(LocalDate.now())) return "EXPIRED"; return p.status; }
  /** A payment for this plan can be approved only while the plan is waiting and its dates have not passed. */
  static boolean canStart(CoursePlan p){ if(!"PENDING_PAYMENT".equals(p.status)) return false; return p.days!=null||(p.endsOn!=null&&!p.endsOn.isBefore(LocalDate.now())); }
  /** Starts the plan when its payment is approved. Day-based plans start today; date-based plans keep their dates. */
  static void activate(CoursePlanRepo plans,CoursePlan p){
    LocalDate today=LocalDate.now();
    if(p.days!=null){ p.startsOn=today; p.endsOn=today.plusDays(p.days-1); }
    p.status="ACTIVE"; p.activatedAt=LocalDateTime.now(); plans.save(p); }
  static String planSummary(CoursePlan p){ return "Rs "+p.fee+" for "+(p.days!=null?p.days+" days":p.startsOn+" to "+p.endsOn); }

  List<Long> checkTopics(Long courseId,Object raw){
    if(!(raw instanceof List<?> l)||l.isEmpty()) throw bad("Choose at least one topic");
    Set<Long> valid=new HashSet<>(); for(Topic t:topics.findByCourseIdOrderByPosition(courseId)) valid.add(t.id);
    List<Long> out=new ArrayList<>();
    for(Object o:l){
      Long id; try{ id=Long.valueOf(text(o)); }catch(NumberFormatException e){ throw bad("Choose topics from the list"); }
      if(!valid.contains(id)) throw bad("That topic does not belong to this course");
      if(!out.contains(id)) out.add(id); }
    return out; }
  static int parseFee(Object raw){
    int f; try{ f=Integer.parseInt(text(raw)); }catch(NumberFormatException e){ throw bad("Enter the fee as a whole number of rupees"); }
    if(f<1||f>1_000_000) throw bad("Enter a fee between 1 and 10,00,000");
    return f; }
  static LocalDate parseDate(Object raw,String label){ try{ return LocalDate.parse(text(raw)); }catch(Exception e){ throw bad("Enter a valid "+label+" date"); } }

  /** Applies the teacher's terms. A new plan needs every term; a waiting plan can change any of them. */
  void applyTerms(CoursePlan p,Map<String,Object> b,boolean creating){
    if(creating||b.containsKey("topicIds")) p.topicIds=joinIds(checkTopics(p.courseId,b.get("topicIds")));
    if(creating||b.containsKey("fee")) p.fee=parseFee(b.get("fee"));
    boolean byDays=b.containsKey("days")&&!text(b.get("days")).isEmpty();
    boolean byDates=b.containsKey("startsOn")||b.containsKey("endsOn");
    if(byDays&&byDates) throw bad("Choose either a number of days or start and end dates, not both");
    if(byDays){
      int d; try{ d=Integer.parseInt(text(b.get("days"))); }catch(NumberFormatException e){ throw bad("Enter the number of days as a whole number"); }
      if(d<1||d>365) throw bad("The duration must be between 1 and 365 days");
      p.days=d; p.startsOn=null; p.endsOn=null;
    } else if(byDates){
      LocalDate s=parseDate(b.get("startsOn"),"start"), e=parseDate(b.get("endsOn"),"end");
      if(e.isBefore(s)) throw bad("The end date must be on or after the start date");
      if(e.isBefore(LocalDate.now())) throw bad("The end date has already passed");
      p.days=null; p.startsOn=s; p.endsOn=e;
    } else if(creating) throw bad("Enter a number of days or start and end dates");
  }

  Map<String,Object> view(CoursePlan p){
    Map<String,Object> m=new LinkedHashMap<>();
    m.put("id",p.id); m.put("courseId",p.courseId); m.put("studentId",p.studentId);
    users.findById(p.studentId).ifPresent(s->{ m.put("studentName",s.name); m.put("studentEmail",s.email); });
    courses.findById(p.courseId).ifPresent(c->m.put("course",c.name));
    List<Map<String,Object>> tp=new ArrayList<>();
    for(Long tid:CoursePlan.topicIdsOf(p)) topics.findById(tid).ifPresent(t->tp.add(Map.of("id",t.id,"title",nz(t.title))));
    m.put("topics",tp); m.put("days",p.days);
    m.put("startsOn",p.startsOn==null?null:p.startsOn.toString()); m.put("endsOn",p.endsOn==null?null:p.endsOn.toString());
    m.put("fee",p.fee); m.put("status",statusOf(p)); m.put("assignedBy",p.assignedByName);
    m.put("createdAt",p.createdAt==null?null:p.createdAt.toString()); m.put("activatedAt",p.activatedAt==null?null:p.activatedAt.toString());
    Payment last=null;
    for(Payment pay:payments.findAll()) if(Objects.equals(p.id,pay.planId)&&(last==null||pay.id>last.id)) last=pay;
    m.put("paymentStatus",last==null?"NOT_PAID":last.status);
    m.put("paymentReference",last==null?null:last.reference);
    m.put("transactionId",last==null?null:last.utr);
    return m; }
  static String nz(String s){ return s==null?"":s; }

  CoursePlan plan(Long id){ return plans.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Plan not found")); }

  /** Teacher / admin: every plan for one course they manage. */
  @GetMapping("/staff/courses/{courseId}/plans") List<Map<String,Object>> list(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long courseId){
    auth.managed(h,courseId,courses);
    List<CoursePlan> l=new ArrayList<>(plans.findByCourseId(courseId)); l.sort((x,y)->Long.compare(y.id,x.id));
    List<Map<String,Object>> out=new ArrayList<>(); for(CoursePlan p:l) out.add(view(p)); return out; }

  /** Teacher / admin assigns a plan. The student is emailed and pays from their dashboard. */
  @PostMapping("/staff/courses/{courseId}/plans") Map<String,Object> create(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long courseId,@RequestBody Map<String,Object> b){
    User st=auth.teach(h); auth.managed(h,courseId,courses);
    String email=text(b.get("studentEmail"));
    User s=users.findByEmail(email).or(()->users.findByEmail(email.toLowerCase())).orElseThrow(()->bad("No student has an account with that email"));
    if(!"STUDENT".equals(s.role)) throw bad("That account is not a student account");
    if(enrolls.existsByUserIdAndCourseId(s.id,courseId)) throw conflict("This student already has the full course, so a plan is not needed.");
    for(CoursePlan o:plans.findByStudentId(s.id))
      if(courseId.equals(o.courseId)&&("PENDING_PAYMENT".equals(o.status)||"ACTIVE".equals(o.status)))
        throw conflict("This student already has a plan for this course. Extend or revoke it first.");
    CoursePlan p=new CoursePlan(); p.courseId=courseId; p.studentId=s.id; p.assignedById=st.id; p.assignedByName=st.name;
    applyTerms(p,b,true); p.status="PENDING_PAYMENT"; plans.save(p);
    String link=mail.url("/dashboard");
    mail.send(s.email,"Your teacher assigned you a study plan",
      Mailer.layout("Your study plan is ready","<p>Hello "+QrPaymentController.htmlEsc(s.name)+", "+QrPaymentController.htmlEsc(st.name)+" assigned you a plan: "+QrPaymentController.htmlEsc(planSummary(p))+". Open your dashboard to pay the fee and start.</p>","Open my dashboard",link),
      "Hello "+s.name+", your teacher assigned you a study plan: "+planSummary(p)+". Open your dashboard to pay the fee: "+link);
    return view(p); }

  /** Teacher / admin edits a plan. A waiting plan: any term. An active plan: only a later end date and the topics. */
  @PutMapping("/staff/plans/{id}") Map<String,Object> update(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id,@RequestBody Map<String,Object> b){
    auth.teach(h); CoursePlan p=plan(id); auth.managed(h,p.courseId,courses);
    if("REVOKED".equals(p.status)) throw conflict("This plan was revoked. Assign a new plan instead.");
    if("PENDING_PAYMENT".equals(p.status)) applyTerms(p,b,false);
    else {
      for(String k:b.keySet()) if(!List.of("endsOn","topicIds").contains(k)) throw conflict("Only the end date and the topics can change on an active plan.");
      if(b.containsKey("topicIds")) p.topicIds=joinIds(checkTopics(p.courseId,b.get("topicIds")));
      if(b.containsKey("endsOn")){
        LocalDate e=parseDate(b.get("endsOn"),"end");
        if(p.endsOn!=null&&e.isBefore(p.endsOn)) throw bad("You can only extend a plan. To end access earlier, revoke it.");
        if(e.isBefore(LocalDate.now())) throw bad("The new end date must be today or later");
        p.endsOn=e; }
    }
    plans.save(p); return view(p); }

  /** Teacher / admin ends a plan now. The student loses access straight away. */
  @PostMapping("/staff/plans/{id}/revoke") Map<String,Object> revoke(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id){
    auth.teach(h); CoursePlan p=plan(id); auth.managed(h,p.courseId,courses);
    if("REVOKED".equals(p.status)) throw conflict("This plan is already revoked.");
    p.status="REVOKED"; plans.save(p); return view(p); }

  /** Student: their own plans, with what they can open and what they still have to pay. */
  @GetMapping("/my/plans") List<Map<String,Object>> mine(@RequestHeader(value="Authorization",required=false) String h){
    User u=auth.need(h,null);
    List<CoursePlan> l=new ArrayList<>(plans.findByStudentId(u.id)); l.sort((x,y)->Long.compare(y.id,x.id));
    List<Map<String,Object>> out=new ArrayList<>(); for(CoursePlan p:l) out.add(view(p)); return out; }
}
