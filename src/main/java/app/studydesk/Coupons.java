package app.studydesk;
import jakarta.persistence.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;

/* ===== Phase 9: coupons (general, per-student free, entrance-exam rewards) + entrance exams =====
   Coupon: discountPercent 1..100 (100 = course is free). Optional limits: one student's email, one course, number of uses, expiry date.
   Who creates them: ADMIN (any course) or TEACHER (own courses only). kind = GENERAL | STUDENT | EXAM.
   Entrance exam: staff writes MCQs and score tiers like "90:100,75:50,60:25" (score >= 90% -> 100% off, >= 75% -> 50% off, >= 60% -> 25% off).
   A student gets ONE attempt per exam; if the score reaches a tier a single-use coupon is created for that student's email and emailed.
   A 100% coupon enrols the student without payment (POST /api/courses/{id}/redeem), recorded as a Successful payment of 0 with method COUPON.
   The old built-in code WELCOME10 (10% for everyone) still works. */

@Entity class Coupon { @Id @GeneratedValue public Long id;
  @Column(unique=true,length=40) public String code;
  public int discountPercent;
  public Long ownerId; public String ownerName, ownerRole;
  /** null = any course of the owner (admin: any course) */ public Long courseId;
  /** null/empty = anyone, otherwise only this student's email */ public String email;
  public String kind="GENERAL";
  /** 0 = unlimited */ public int maxUses=1; public int uses=0;
  public LocalDate expiresOn; public boolean active=true;
  @Column(length=200) public String note;
  public LocalDateTime at=LocalDateTime.now(); }
interface CouponRepo extends JpaRepository<Coupon,Long>{ Optional<Coupon> findByCodeIgnoreCase(String c); List<Coupon> findByEmailIgnoreCase(String e); }

@Entity class Exam { @Id @GeneratedValue public Long id; public Long ownerId; public String ownerName;
  /** null = coupon works on any course of the owner */ public Long courseId;
  @Column(length=120) public String title; @Column(length=300) public String description;
  @Column(length=200) public String tiers="90:100,75:50,60:25";
  public boolean active=true; public LocalDateTime at=LocalDateTime.now(); }
interface ExamRepo extends JpaRepository<Exam,Long>{}
@Entity class ExamQuestion { @Id @GeneratedValue public Long id; public Long examId; @Column(length=500) public String text; @Column(length=700) public String options; public int correct; }
interface ExamQuestionRepo extends JpaRepository<ExamQuestion,Long>{ List<ExamQuestion> findByExamId(Long e); }
@Entity class ExamAttempt { @Id @GeneratedValue public Long id; public Long examId, userId; public String userName, userEmail, couponCode;
  public int score, total, scorePct, discountPercent; public LocalDateTime at=LocalDateTime.now(); }
interface ExamAttemptRepo extends JpaRepository<ExamAttempt,Long>{ List<ExamAttempt> findByExamId(Long e); Optional<ExamAttempt> findFirstByExamIdAndUserId(Long e,Long u); }

/** One place that decides whether a coupon code is valid for this student and course. */
@Component class CouponService {
  static final SecureRandom RND=new SecureRandom();
  static final String ALPHA="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  final CouponRepo coupons;
  CouponService(CouponRepo c){coupons=c;}

  static class Res { final int percent; final Coupon coupon; final String message;
    Res(int p,Coupon c,String m){percent=p;coupon=c;message=m;} }
  static Res no(String m){ return new Res(0,null,m); }

  /** user may be null (not logged in): coupons tied to an email then ask the student to log in. */
  Res resolve(String code,User user,Course course){
    String c=code==null?"":code.trim();
    if(c.isEmpty()) return no("");
    if("WELCOME10".equalsIgnoreCase(c)) return new Res(10,null,"Coupon applied: 10% off");
    Coupon k=coupons.findByCodeIgnoreCase(c).orElse(null);
    if(k==null||!k.active) return no("That coupon code is not valid");
    if(k.expiresOn!=null&&LocalDate.now().isAfter(k.expiresOn)) return no("This coupon has expired");
    if(k.maxUses>0&&k.uses>=k.maxUses) return no("This coupon has already been used");
    if(k.email!=null&&!k.email.isBlank()){
      if(user==null) return no("Log in with the email this coupon was issued to");
      if(!k.email.equalsIgnoreCase(user.email)) return no("This coupon was issued to a different student"); }
    if(k.courseId!=null&&!k.courseId.equals(course.id)) return no("This coupon is for a different course");
    if(k.courseId==null&&!"ADMIN".equals(k.ownerRole)&&k.ownerId!=null&&course.ownerId!=null&&!k.ownerId.equals(course.ownerId)) return no("This coupon is not valid for this course");
    return new Res(k.discountPercent,k,k.discountPercent>=100?"Coupon applied: this course is free for you":"Coupon applied: "+k.discountPercent+"% off"); }

  /** Counts one use (called when the student is actually enrolled). WELCOME10 is not counted. */
  synchronized void used(String code){
    if(code==null||code.isBlank()) return;
    coupons.findByCodeIgnoreCase(code.trim()).ifPresent(k->{ k.uses++; coupons.save(k); }); }

  synchronized String gen(String prefix){
    for(int n=0;n<50;n++){ StringBuilder sb=new StringBuilder(prefix).append('-'); for(int i=0;i<8;i++) sb.append(ALPHA.charAt(RND.nextInt(ALPHA.length())));
      if(coupons.findByCodeIgnoreCase(sb.toString()).isEmpty()) return sb.toString(); }
    throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,"Could not create a coupon code, try again"); }
}

@RestController @RequestMapping("/api") class CouponController {
  static final Pattern CODE=Pattern.compile("^[A-Z0-9_\\-]{4,30}$");
  final Auth auth; final CouponRepo coupons; final CourseRepo courses; final EnrollRepo enrolls; final PaymentRepo payments; final UserRepo users; final Mailer mail; final CouponService svc;
  final ExamRepo exams; final ExamQuestionRepo eqs; final ExamAttemptRepo attempts;
  CouponController(Auth a,CouponRepo k,CourseRepo c,EnrollRepo e,PaymentRepo p,UserRepo u,Mailer m,CouponService s,ExamRepo x,ExamQuestionRepo q,ExamAttemptRepo t){
    auth=a;coupons=k;courses=c;enrolls=e;payments=p;users=u;mail=m;svc=s;exams=x;eqs=q;attempts=t; }

  // ---------- small helpers ----------
  static String s(Object o){ return o==null?"":String.valueOf(o).trim(); }
  static int toInt(Object o,int d){ try{ return Integer.parseInt(s(o)); }catch(NumberFormatException e){ return d; } }
  static ResponseStatusException bad(String m){ return new ResponseStatusException(HttpStatus.BAD_REQUEST,m); }
  static ResponseStatusException conflict(String m){ return new ResponseStatusException(HttpStatus.CONFLICT,m); }
  static ResponseStatusException notFound(String m){ return new ResponseStatusException(HttpStatus.NOT_FOUND,m); }
  String cname(Long id){ if(id==null) return null; return courses.findById(id).map(c->c.name).orElse("(deleted course)"); }
  String roleOf(Long uid){ if(uid==null) return null; return users.findById(uid).map(u->u.role).orElse(null); }
  User optUser(String h){ try{ return h==null?null:auth.need(h,null); }catch(ResponseStatusException e){ return null; } }
  LocalDate parseDate(String t,String what){
    if(t.isEmpty()) return null;
    try{ LocalDate d=LocalDate.parse(t); if(d.isBefore(LocalDate.now())) throw bad(what+" must be today or later"); return d; }
    catch(java.time.format.DateTimeParseException e){ throw bad(what+" must be a date like 2026-12-31"); } }
  /** optional course the staff member is allowed to manage */
  Long courseOf(User st,Object raw,boolean required){
    String t=s(raw);
    if(t.isEmpty()){ if(required) throw bad("Choose the course"); return null; }
    long id; try{ id=Long.parseLong(t); }catch(NumberFormatException e){ throw bad("Choose a valid course"); }
    Course c=courses.findById(id).orElseThrow(()->notFound("Course not found"));
    if(!auth.manages(st,c)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"This course belongs to another teacher");
    return c.id; }
  boolean mineC(User st,Coupon k){ return "ADMIN".equals(st.role)||Objects.equals(k.ownerId,st.id); }

  String status(Coupon k){
    if(!k.active) return "DISABLED";
    if(k.expiresOn!=null&&LocalDate.now().isAfter(k.expiresOn)) return "EXPIRED";
    if(k.maxUses>0&&k.uses>=k.maxUses) return "USED";
    return "ACTIVE"; }
  Map<String,Object> view(Coupon k){
    Map<String,Object> m=new LinkedHashMap<>(); m.put("id",k.id); m.put("code",k.code); m.put("percent",k.discountPercent); m.put("kind",k.kind);
    m.put("email",k.email); m.put("courseId",k.courseId); m.put("course",k.courseId==null?"Any course":cname(k.courseId));
    m.put("uses",k.uses); m.put("maxUses",k.maxUses); m.put("expires",k.expiresOn==null?null:k.expiresOn.toString());
    m.put("active",k.active); m.put("status",status(k)); m.put("note",k.note); m.put("owner",k.ownerName); m.put("at",k.at.toString()); return m; }

  void mailCoupon(String to,String name,String code,int pct,String courseName,LocalDate exp,String why){
    try{
      String body="<p>"+Mailer.esc(why)+"</p><p style=\"margin:18px 0 6px\">Your coupon code:</p>"
        +"<p style=\"font-size:26px;font-weight:700;letter-spacing:2px;background:#eef2ff;padding:12px 18px;border-radius:10px;display:inline-block;margin:0\">"+Mailer.esc(code)+"</p>"
        +"<p>"+(pct>=100?"This coupon makes your course <b>free</b>.":"It gives you <b>"+pct+"% off</b>.")
        +(courseName==null?" Valid on our courses.":" Valid for <b>"+Mailer.esc(courseName)+"</b>.")+(exp==null?"":" Use it before "+exp+".")
        +" Log in with this email address ("+Mailer.esc(to)+"), open the course and enter the code at checkout.</p>";
      String text=why+"\nYour coupon code: "+code+"\n"+(pct>=100?"This coupon makes your course free.":"It gives you "+pct+"% off.")+(courseName==null?"":" Course: "+courseName+".")+(exp==null?"":" Use it before "+exp+".")+"\nLog in with "+to+" and enter the code at checkout.";
      mail.send(to,"Your NLMed Study coupon: "+code,Mailer.layout("Hello"+(name==null||name.isBlank()?"":", "+Mailer.esc(name))+"!",body,"Browse courses",mail.url("/courses")),text);
    }catch(Exception ex){ /* email problems must never block the request */ } }

  // ================= checkout =================
  @GetMapping("/coupon") Map<String,Object> check(@RequestHeader(value="Authorization",required=false) String h,@RequestParam Long courseId,@RequestParam(required=false) String code){
    Course c=courses.findById(courseId).orElseThrow(()->notFound("Course not found"));
    CouponService.Res r=svc.resolve(code,optUser(h),c); int off=c.price*r.percent/100;
    Map<String,Object> m=new LinkedHashMap<>(); m.put("valid",r.percent>0); m.put("percent",r.percent); m.put("discount",off); m.put("total",c.price-off); m.put("free",r.percent>=100); m.put("message",r.message); return m; }

  /** Student's own unused coupons (matched by their account email). */
  @GetMapping("/my/coupons") List<Map<String,Object>> myCoupons(@RequestHeader(value="Authorization",required=false) String h){
    User u=auth.need(h,null); List<Coupon> l=new ArrayList<>(coupons.findByEmailIgnoreCase(u.email)); l.sort((x,y)->Long.compare(y.id,x.id));
    List<Map<String,Object>> out=new ArrayList<>(); for(Coupon k:l) if("ACTIVE".equals(status(k))) out.add(view(k)); return out; }

  /** A 100% coupon enrols without payment. Recorded as a Successful payment of 0 so it appears in Payment Received and My Payments. */
  @PostMapping("/courses/{id}/redeem") Map<String,Object> redeem(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id,@RequestBody Map<String,String> b){
    User u=auth.need(h,null);
    if(QrPaymentController.staffRole(u)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Staff accounts cannot enrol in courses");
    Course c=courses.findById(id).orElseThrow(()->notFound("Course not found"));
    String code=b==null?"":s(b.get("coupon"));
    synchronized(this){
      if(enrolls.existsByUserIdAndCourseId(u.id,id)) throw conflict("Already enrolled");
      CouponService.Res r=svc.resolve(code,u,c);
      if(r.percent<100) throw bad(r.percent==0&&!r.message.isEmpty()?r.message:"This coupon does not make the course free. Pay the remaining amount at checkout.");
      String shown=r.coupon!=null?r.coupon.code:code.toUpperCase();
      Enrollment e=new Enrollment(); e.userId=u.id; e.courseId=id; e.paid=0; enrolls.save(e);
      Payment p=new Payment(); p.userId=u.id; p.userName=u.name; p.userEmail=u.email; p.courseId=id; p.courseName=c.name; p.method="COUPON"; p.status="SUCCESS";
      p.reference="NMSFREE"+Long.toString(System.currentTimeMillis(),36).toUpperCase()+(100+new Random().nextInt(900));
      p.detail="Free coupon "+shown; p.utr="FREE-"+shown; p.coupon=shown; p.amount=0; p.ownerId=c.ownerId; p.ownerName=c.teacher; p.reviewedBy="Free coupon"; p.reviewedAt=LocalDateTime.now();
      payments.save(p); svc.used(shown);
      try{ mail.enrolled(u,c,0,p.utr); }catch(Exception ex){ /* never block enrolment */ }
      Map<String,Object> m=new LinkedHashMap<>(); m.put("reference",p.reference); m.put("status",p.status); m.put("amount",0); m.put("course",c.name); m.put("courseId",id);
      m.put("method","COUPON"); m.put("detail",p.detail); m.put("utr",p.utr); m.put("payTo",c.teacher); m.put("message","You are enrolled for free with coupon "+shown+"."); return m; } }

  // ================= staff: coupons =================
  @GetMapping("/staff/coupons") List<Map<String,Object>> list(@RequestHeader(value="Authorization",required=false) String h){
    User st=auth.staff(h); List<Coupon> l=new ArrayList<>(coupons.findAll()); l.removeIf(k->!mineC(st,k)); l.sort((x,y)->Long.compare(y.id,x.id));
    List<Map<String,Object>> out=new ArrayList<>(); for(Coupon k:l) out.add(view(k)); return out; }

  @PostMapping("/staff/coupons") Map<String,Object> create(@RequestHeader(value="Authorization",required=false) String h,@RequestBody Map<String,Object> b){
    User st=auth.staff(h);
    int pct=toInt(b.get("percent"),0); if(pct<1||pct>100) throw bad("Discount must be between 1% and 100%");
    String email=s(b.get("email")).toLowerCase();
    if(!email.isEmpty()&&!ExtrasController.EMAIL.matcher(email).matches()) throw bad("Enter a valid student email, or leave it empty for any student");
    Long cid=courseOf(st,b.get("courseId"),false);
    int max=s(b.get("maxUses")).isEmpty()?1:toInt(b.get("maxUses"),-1); if(max<0||max>100000) throw bad("Number of uses must be 0 (unlimited) to 100000");
    if(pct==100&&email.isEmpty()&&(max<1||max>100)) throw bad("A free (100%) coupon for any student needs a limit of 1 to 100 uses. Safer: give it to one student's email.");
    LocalDate exp=parseDate(s(b.get("expires")),"Expiry date");
    String code=s(b.get("code")).toUpperCase();
    if(code.isEmpty()) code=svc.gen(pct==100?"FREE":"NLMED");
    else{ if(!CODE.matcher(code).matches()) throw bad("Code: 4-30 letters, numbers, - or _");
      if("WELCOME10".equals(code)||coupons.findByCodeIgnoreCase(code).isPresent()) throw conflict("That code already exists. Choose another."); }
    String note=s(b.get("note")); if(note.length()>200) throw bad("Note is too long");
    Coupon k=new Coupon(); k.code=code; k.discountPercent=pct; k.ownerId=st.id; k.ownerName=st.name; k.ownerRole=st.role; k.courseId=cid; k.email=email.isEmpty()?null:email;
    k.kind=email.isEmpty()?"GENERAL":"STUDENT"; k.maxUses=max; k.expiresOn=exp; k.note=note.isEmpty()?null:note; coupons.save(k);
    if(k.email!=null){ User su=users.findByEmail(k.email).orElse(null); mailCoupon(k.email,su==null?null:su.name,k.code,pct,cname(cid),exp,st.name+" has sent you a coupon for NLMed Study."); }
    return view(k); }

  /** Give a course free to a list of students: one single-use 100% coupon per email, sent by email. */
  @PostMapping("/staff/coupons/free-students") Map<String,Object> freeStudents(@RequestHeader(value="Authorization",required=false) String h,@RequestBody Map<String,Object> b){
    User st=auth.staff(h);
    Long cid=courseOf(st,b.get("courseId"),true); Course c=courses.findById(cid).orElseThrow(()->notFound("Course not found"));
    LocalDate exp=parseDate(s(b.get("expires")),"Expiry date"); if(exp==null) exp=LocalDate.now().plusDays(60);
    String raw=s(b.get("emails")); if(raw.isEmpty()) throw bad("Paste at least one student email");
    LinkedHashSet<String> set=new LinkedHashSet<>(); for(String t:raw.split("[\\s,;]+")) if(!t.isBlank()) set.add(t.trim().toLowerCase());
    if(set.size()>100) throw bad("Up to 100 emails at a time");
    String note=s(b.get("note")); if(note.length()>150) throw bad("Note is too long");
    List<Map<String,String>> created=new ArrayList<>(), skipped=new ArrayList<>();
    for(String em:set){
      Map<String,String> row=new LinkedHashMap<>(); row.put("email",em);
      if(!ExtrasController.EMAIL.matcher(em).matches()){ row.put("reason","Not a valid email"); skipped.add(row); continue; }
      User su=users.findByEmail(em).orElse(null);
      if(su!=null&&enrolls.existsByUserIdAndCourseId(su.id,c.id)){ row.put("reason","Already enrolled"); skipped.add(row); continue; }
      if(su!=null&&QrPaymentController.staffRole(su)){ row.put("reason","Staff account"); skipped.add(row); continue; }
      Coupon k=new Coupon(); k.code=svc.gen("FREE"); k.discountPercent=100; k.ownerId=st.id; k.ownerName=st.name; k.ownerRole=st.role; k.courseId=c.id; k.email=em; k.kind="STUDENT";
      k.maxUses=1; k.expiresOn=exp; k.note=note.isEmpty()?"Free seat given by "+st.name:note; coupons.save(k);
      mailCoupon(em,su==null?null:su.name,k.code,100,c.name,exp,st.name+" has given you free access to a course on NLMed Study.");
      row.put("code",k.code); created.add(row); }
    Map<String,Object> m=new LinkedHashMap<>(); m.put("created",created); m.put("skipped",skipped); m.put("course",c.name);
    m.put("message",created.size()+" free coupon"+(created.size()==1?"":"s")+" created and emailed"+(skipped.isEmpty()?".":", "+skipped.size()+" skipped.")); return m; }

  @PutMapping("/staff/coupons/{id}/active") Map<String,Object> setActive(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id,@RequestBody Map<String,Object> b){
    User st=auth.staff(h); Coupon k=coupons.findById(id).orElseThrow(()->notFound("Coupon not found"));
    if(!mineC(st,k)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"This coupon belongs to another teacher");
    k.active=Boolean.parseBoolean(s(b.get("active"))); coupons.save(k); return view(k); }

  // ================= entrance exams =================
  static List<int[]> tiers(String t){
    List<int[]> l=new ArrayList<>(); if(t==null) return l;
    for(String part:t.split(",")){ String[] x=part.trim().split(":"); if(x.length!=2) continue;
      try{ int min=Integer.parseInt(x[0].trim()), d=Integer.parseInt(x[1].trim()); if(min>=0&&min<=100&&d>=1&&d<=100) l.add(new int[]{min,d}); }catch(NumberFormatException e){ /* skip */ } }
    l.sort((p,q)->Integer.compare(q[0],p[0])); return l; }
  static boolean validTiers(String t){ if(t==null||t.isBlank()) return false; int parts=0; for(String p:t.split(",")) if(!p.isBlank()) parts++; return parts>0&&parts<=6&&parts==tiers(t).size(); }
  static int award(String t,int pct){ for(int[] x:tiers(t)) if(pct>=x[0]) return x[1]; return 0; }
  static List<Map<String,Object>> tierView(String t){ List<Map<String,Object>> out=new ArrayList<>(); for(int[] x:tiers(t)){ Map<String,Object> m=new LinkedHashMap<>(); m.put("minScore",x[0]); m.put("discount",x[1]); out.add(m); } return out; }

  Map<String,Object> examView(Exam e,User student){
    Map<String,Object> m=new LinkedHashMap<>(); m.put("id",e.id); m.put("title",e.title); m.put("description",e.description); m.put("courseId",e.courseId);
    m.put("course",e.courseId==null?"Any course":cname(e.courseId)); m.put("teacher",e.ownerName); m.put("questions",eqs.findByExamId(e.id).size()); m.put("tiers",tierView(e.tiers)); m.put("tiersText",e.tiers); m.put("active",e.active);
    if(student!=null){ Optional<ExamAttempt> a=attempts.findFirstByExamIdAndUserId(e.id,student.id); m.put("attempted",a.isPresent());
      if(a.isPresent()){ ExamAttempt t=a.get(); m.put("score",t.score); m.put("total",t.total); m.put("scorePct",t.scorePct); m.put("discount",t.discountPercent); m.put("couponCode",t.couponCode); } }
    return m; }

  /** True when the student is already enrolled in the course this exam is for. Exams with no course apply to everyone and are never hidden here. */
  boolean enrolledIn(User u,Exam e){ return e.courseId!=null&&enrolls.existsByUserIdAndCourseId(u.id,e.courseId); }
  @GetMapping("/exams") List<Map<String,Object>> examList(@RequestHeader(value="Authorization",required=false) String h){
    User u=auth.need(h,null); boolean student="STUDENT".equals(u.role); List<Exam> l=new ArrayList<>(exams.findAll()); l.removeIf(e->!e.active||(student&&enrolledIn(u,e))); l.sort((x,y)->Long.compare(y.id,x.id));
    List<Map<String,Object>> out=new ArrayList<>(); for(Exam e:l) out.add(examView(e,u)); return out; }

  /** Questions WITHOUT the correct answers. Already-attempted exams return only the result. */
  @GetMapping("/exams/{id}") Map<String,Object> examOne(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id){
    User u=auth.need(h,null); Exam e=exams.findById(id).filter(x->x.active).orElseThrow(()->notFound("Exam not found"));
    if("STUDENT".equals(u.role)&&enrolledIn(u,e)) throw notFound("Exam not found");
    Map<String,Object> m=examView(e,u);
    if(!Boolean.TRUE.equals(m.get("attempted"))){ List<Map<String,Object>> qs=new ArrayList<>();
      for(ExamQuestion q:eqs.findByExamId(id)){ Map<String,Object> x=new LinkedHashMap<>(); x.put("id",q.id); x.put("text",q.text); x.put("options",Arrays.asList(q.options.split("\\|"))); qs.add(x); }
      m.put("items",qs); }
    return m; }

  @PostMapping("/exams/{id}/submit") Map<String,Object> submit(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id,@RequestBody Map<String,Object> b){
    User u=auth.need(h,null);
    if(QrPaymentController.staffRole(u)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Staff accounts cannot take the exam");
    ProctorGuard.requireCamera("exam-"+id,u.id);
    Exam e=exams.findById(id).filter(x->x.active).orElseThrow(()->notFound("Exam not found"));
    if("STUDENT".equals(u.role)&&enrolledIn(u,e)) throw conflict("You are already enrolled in this course, so this entrance exam is not needed.");
    List<ExamQuestion> qs=eqs.findByExamId(id); if(qs.isEmpty()) throw bad("This exam has no questions yet");
    Object ao=b.get("answers"); Map<?,?> ans; if(ao instanceof Map) ans=(Map<?,?>)ao; else ans=new HashMap<String,Object>();
    synchronized(this){
      if(attempts.findFirstByExamIdAndUserId(id,u.id).isPresent()) throw conflict("You have already taken this exam. Each student gets one attempt.");
      int right=0; for(ExamQuestion q:qs){ Object a=ans.get(String.valueOf(q.id)); if(a!=null&&toInt(a,-1)==q.correct) right++; }
      int pct=(int)Math.round(100.0*right/qs.size()), disc=award(e.tiers,pct);
      ExamAttempt t=new ExamAttempt(); t.examId=id; t.userId=u.id; t.userName=u.name; t.userEmail=u.email; t.score=right; t.total=qs.size(); t.scorePct=pct; t.discountPercent=disc;
      LocalDate exp=null; String code=null;
      if(disc>0){ Coupon k=new Coupon(); k.code=svc.gen("ENT"); k.discountPercent=disc; k.ownerId=e.ownerId; k.ownerName=e.ownerName; k.ownerRole=roleOf(e.ownerId); k.courseId=e.courseId;
        k.email=u.email.toLowerCase(); k.kind="EXAM"; k.maxUses=1; k.expiresOn=LocalDate.now().plusDays(30); k.note="Entrance exam: "+e.title+" ("+pct+"%)"; coupons.save(k);
        code=k.code; exp=k.expiresOn; t.couponCode=code; }
      attempts.save(t);
      if(code!=null) mailCoupon(u.email,u.name,code,disc,cname(e.courseId),exp,"Well done! You scored "+pct+"% in the entrance exam \""+e.title+"\".");
      Map<String,Object> m=new LinkedHashMap<>(); m.put("score",right); m.put("total",qs.size()); m.put("percent",pct); m.put("discount",disc); m.put("couponCode",code); m.put("expires",exp==null?null:exp.toString());
      m.put("courseId",e.courseId); m.put("course",e.courseId==null?"Any course":cname(e.courseId));
      m.put("message",disc>=100?"Excellent! You won a FREE course.":disc>0?"Great score! You won a "+disc+"% discount coupon.":"Thanks for taking the exam. This score did not reach a reward level."); return m; } }

  // ----- staff side -----
  boolean mineE(User st,Exam e){ return "ADMIN".equals(st.role)||Objects.equals(e.ownerId,st.id); }

  @GetMapping("/staff/exams") List<Map<String,Object>> staffExams(@RequestHeader(value="Authorization",required=false) String h){
    User st=auth.staff(h); List<Exam> l=new ArrayList<>(exams.findAll()); l.removeIf(e->!mineE(st,e)); l.sort((x,y)->Long.compare(y.id,x.id));
    List<Map<String,Object>> out=new ArrayList<>(); for(Exam e:l){ Map<String,Object> m=examView(e,null); m.put("attempts",attempts.findByExamId(e.id).size()); out.add(m); } return out; }

  @PostMapping("/staff/exams") Map<String,Object> createExam(@RequestHeader(value="Authorization",required=false) String h,@RequestBody Map<String,Object> b){
    User st=auth.staff(h);
    String title=s(b.get("title")); if(title.length()<3||title.length()>120) throw bad("Give the exam a title (3 to 120 characters)");
    String desc=s(b.get("description")); if(desc.length()>300) throw bad("Description is too long (300 characters max)");
    String tiers=s(b.get("tiers")).replaceAll("\\s",""); if(tiers.isEmpty()) tiers="90:100,75:50,60:25";
    if(!validTiers(tiers)) throw bad("Reward levels look like 90:100,75:50,60:25 (minimum score %:discount %, 1 to 6 levels)");
    Long cid=courseOf(st,b.get("courseId"),false);
    Object qo=b.get("questions"); if(!(qo instanceof List)) throw bad("Add at least one question");
    List<?> raw=(List<?>)qo; if(raw.isEmpty()||raw.size()>100) throw bad("An exam needs 1 to 100 questions");
    List<ExamQuestion> built=new ArrayList<>(); int n=0;
    for(Object o:raw){ n++;
      if(!(o instanceof Map)) throw bad("Question "+n+" is not valid");
      Map<?,?> q=(Map<?,?>)o; String text=s(q.get("text")); if(text.isEmpty()||text.length()>400) throw bad("Question "+n+": write the question (up to 400 characters)");
      Object oo=q.get("options"); if(!(oo instanceof List)) throw bad("Question "+n+": add the answer options");
      List<String> opts=new ArrayList<>(); for(Object x:(List<?>)oo){ String t=s(x).replace('|','/'); if(!t.isEmpty()){ if(t.length()>120) throw bad("Question "+n+": an option is too long (120 characters max)"); opts.add(t); } }
      if(opts.size()<2||opts.size()>6) throw bad("Question "+n+": give 2 to 6 options");
      int correct=toInt(q.get("correct"),-1); if(correct<0||correct>=opts.size()) throw bad("Question "+n+": mark the correct option");
      ExamQuestion eq=new ExamQuestion(); eq.text=text; eq.options=String.join("|",opts); eq.correct=correct; built.add(eq); }
    Exam e=new Exam(); e.ownerId=st.id; e.ownerName=st.name; e.courseId=cid; e.title=title; e.description=desc.isEmpty()?null:desc; e.tiers=tiers; exams.save(e);
    for(ExamQuestion eq:built){ eq.examId=e.id; eqs.save(eq); }
    return examView(e,null); }

  @PutMapping("/staff/exams/{id}/active") Map<String,Object> examActive(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id,@RequestBody Map<String,Object> b){
    User st=auth.staff(h); Exam e=exams.findById(id).orElseThrow(()->notFound("Exam not found"));
    if(!mineE(st,e)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"This exam belongs to another teacher");
    e.active=Boolean.parseBoolean(s(b.get("active"))); exams.save(e); return examView(e,null); }

  @GetMapping("/staff/exams/{id}/attempts") List<Map<String,Object>> examAttempts(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id){
    User st=auth.staff(h); Exam e=exams.findById(id).orElseThrow(()->notFound("Exam not found"));
    if(!mineE(st,e)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"This exam belongs to another teacher");
    List<ExamAttempt> l=new ArrayList<>(attempts.findByExamId(id)); l.sort((x,y)->Long.compare(y.id,x.id));
    List<Map<String,Object>> out=new ArrayList<>();
    for(ExamAttempt t:l){ Map<String,Object> m=new LinkedHashMap<>(); m.put("id",t.id); m.put("userId",t.userId); m.put("student",t.userName); m.put("email",t.userEmail); m.put("score",t.score); m.put("total",t.total);
      m.put("percent",t.scorePct); m.put("discount",t.discountPercent); m.put("couponCode",t.couponCode); m.put("at",t.at.toString()); out.add(m); }
    return out; }
}
