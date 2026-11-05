package app.studydesk;
import jakarta.persistence.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;

/* ===== Payments: UPI, UPI QR and card, paid straight to the course owner (an admin or a teacher) =====
   There is no payment gateway. Money goes to the owner's own UPI ID, QR code or card page. Confirmation works like this:
   1. The student pays the amount shown, and types their reference in the payment note.
   2. The student presses "I have paid". That only sends a request to the owner. It never unlocks the course.
   3. The owner (or an admin) checks their bank or card account for the amount and reference, then clicks Approve
      (the student is enrolled and emailed) or Reject (with a reason; the student is emailed).
   Students are never asked for a transaction ID. Nothing the browser reports marks a payment as paid. */

/** One payment account per staff user. Every field is editable from Payments > Payment settings. */
@Entity class PayAccount { @Id public Long userId;
  public boolean qrEnabled=true, upiEnabled=true, cardEnabled=false;
  @Column(length=100) public String payee;
  @Column(length=100) public String upiId;
  @Column(length=400) public String instructions;
  @Column(length=500) public String bankDetails;
  @Column(length=60) public String cardProvider;
  @Column(length=600) public String cardLink;
  /** How long a student has to pay after starting checkout, in minutes. null = DEFAULT_WINDOW. Set by the payee. */
  public Integer windowMinutes;
  @Lob public String qrImage; }
interface PayAccountRepo extends JpaRepository<PayAccount,Long>{}

/** Legacy single QR image. Only read once to migrate old data into a PayAccount. */
@Entity class PayQr { @Id public String id="main"; @Lob public String data; }
interface PayQrRepo extends JpaRepository<PayQr,String>{}

@RestController @RequestMapping("/api") class QrPaymentController {
  static final org.slf4j.Logger LOG=org.slf4j.LoggerFactory.getLogger(QrPaymentController.class);
  static final Pattern UPI=Pattern.compile("^[a-zA-Z0-9.\\-_]{2,64}@[a-zA-Z]{2,32}$"), PHONE=Pattern.compile("^[6-9]\\d{9}$"),
    LINK=Pattern.compile("^https://[^\\s]{4,500}$"), TXN_ID=Pattern.compile("^[A-Za-z0-9_\\-]{6,40}$");
  /** Orders that still count as "in progress" for this student and course: unpaid, or waiting for the owner to approve. */
  static final List<String> OPEN=List.of("AWAITING","PENDING_VERIFICATION"), ALL_METHODS=List.of("QR","UPI","CARD");
  static final int DEFAULT_WINDOW=60, MIN_WINDOW=15, MAX_WINDOW=360, MAX_IMG=450_000;
  static int windowOf(PayAccount a){ return a.windowMinutes==null?DEFAULT_WINDOW:Math.max(MIN_WINDOW,Math.min(MAX_WINDOW,a.windowMinutes)); }

  @Value("${app.base-url:http://localhost:8080}") String appBase;   // public address used in the upload QR (must be reachable from a phone)
  final Auth auth; final PaymentRepo payments; final CourseRepo courses; final EnrollRepo enrolls; final PayAccountRepo accounts; final UserRepo users; final Mailer mail; final CouponService cs; final SmsSender sms; final CoursePlanRepo plans; final TopicRepo topics;
  QrPaymentController(Auth a,PaymentRepo p,CourseRepo c,EnrollRepo e,PayAccountRepo ac,UserRepo u,Mailer m,CouponService k,SmsSender s,CoursePlanRepo pl,TopicRepo tp){auth=a;payments=p;courses=c;enrolls=e;accounts=ac;users=u;mail=m;cs=k;sms=s;plans=pl;topics=tp;}

  static ResponseStatusException bad(String m){ return new ResponseStatusException(HttpStatus.BAD_REQUEST,m); }
  static ResponseStatusException conflict(String m){ return new ResponseStatusException(HttpStatus.CONFLICT,m); }
  static ResponseStatusException forbidden(){ return new ResponseStatusException(HttpStatus.FORBIDDEN,"Not your payment"); }
  static boolean blank(String s){ return s==null||s.isBlank(); }
  static String nz(String s){ return s==null?"":s; }
  static String low(String s){ return s==null?"":s.toLowerCase(); }
  static boolean staffRole(User u){ return "ADMIN".equals(u.role)||"TEACHER".equals(u.role); }
  static LocalDate date(String s){ try{ return s==null||s.isBlank()?null:LocalDate.parse(s.trim()); }catch(Exception e){ return null; } }
  /** Admin sees every payment, a teacher only the payments made to them (old rows without an owner stay visible to staff). */
  static boolean mine(User s,Payment p){ return "ADMIN".equals(s.role)||p.ownerId==null||Objects.equals(p.ownerId,s.id); }

  PayAccount account(Long uid){ return accounts.findById(uid).orElseGet(()->{ PayAccount a=new PayAccount(); a.userId=uid; return a; }); }

  /** Whose details apply to this course: the course owner; for old courses without an owner, the first teacher, then the first admin. */
  User ownerOf(Course c){
    if(c.ownerId!=null){ Optional<User> o=users.findById(c.ownerId); if(o.isPresent()&&staffRole(o.get())) return o.get(); }
    List<User> all=users.findAll();
    for(User u:all) if("TEACHER".equals(u.role)) return u;
    for(User u:all) if("ADMIN".equals(u.role)) return u;
    return null; }

  /** A method is offered only if the owner enabled it AND filled in what it needs. */
  boolean has(PayAccount a,String m){
    boolean upi=!blank(a.upiId);
    switch(m){
      case "QR": return a.qrEnabled&&(upi||!blank(a.qrImage));
      case "UPI": return a.upiEnabled&&upi;
      case "CARD": return a.cardEnabled&&!blank(a.cardLink);
      default: return false; } }
  Map<String,Object> availability(PayAccount a){ Map<String,Object> m=new LinkedHashMap<>(); for(String k:ALL_METHODS) m.put(k,has(a,k)); return m; }

  // ================= student side =================
  /** Before paying: who gets the money and which methods are set up. No account numbers beyond the UPI ID the student needs to pay. */
  @GetMapping("/courses/{id}/payment-options") Map<String,Object> options(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id){
    auth.need(h,null);
    Course c=courses.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Course not found"));
    User o=ownerOf(c); Map<String,Object> m=new LinkedHashMap<>(); m.put("courseId",c.id); m.put("course",c.name); m.put("price",c.price);
    if(o==null){ Map<String,Object> none=new LinkedHashMap<>(); for(String k:ALL_METHODS) none.put(k,false); m.put("payTo",null); m.put("methods",none); return m; }
    PayAccount a=account(o.id); Map<String,Object> to=new LinkedHashMap<>(); to.put("name",o.name); to.put("role",o.role);
    m.put("payTo",to); m.put("methods",availability(a)); m.put("cardProvider",nz(a.cardProvider)); m.put("note",nz(a.instructions)); return m; }

  /** Creates (or re-uses) an order. Amount, recipient and details are decided on the server, the client cannot change them. */
  @PostMapping("/courses/{id}/pay-order") Map<String,Object> order(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id,@RequestBody(required=false) Map<String,String> b){
    User u=auth.need(h,null);
    if(staffRole(u)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Staff accounts cannot buy courses");
    Course c=courses.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Course not found"));
    if(enrolls.existsByUserIdAndCourseId(u.id,id)) throw conflict("Already enrolled");
    String method=((b==null||b.get("method")==null)?"QR":b.get("method")).trim().toUpperCase();
    if(!ALL_METHODS.contains(method)) throw bad("Choose a payment method");
    User owner=ownerOf(c); if(owner==null) throw conflict("Payments are not set up for this course yet. Please contact us.");
    PayAccount a=account(owner.id);
    if(!has(a,method)) throw conflict("This payment method is not set up for this course yet. Please choose another.");
    for(Payment o:payments.findByUserIdAndCourseIdAndStatusIn(u.id,id,OPEN)){ expireIfNeeded(o);
      if("PENDING_VERIFICATION".equals(o.status)) return view(o);          // paid and waiting for the owner: never a second order
      if("AWAITING".equals(o.status)){
        if(method.equals(o.method)&&Objects.equals(o.ownerId,owner.id)) return view(o);
        o.status="CANCELLED"; o.rejectReason="Switched payment method"; payments.save(o); } }
    CoursePlan plan=planFor(u,c,b==null?null:b.get("planId"));
    String code=b==null?null:b.get("coupon"); if(plan!=null&&!blank(code)) throw bad("Coupons cannot be used on an assigned plan."); CouponService.Res cr=cs.resolve(code,u,c); int pct=cr.percent; int amount=plan!=null?plan.fee:c.price-c.price*pct/100;
    if(!blank(code)&&pct==0) throw bad(cr.message);   // a wrong / used / expired coupon is refused instead of silently charging the full price
    if(amount<=0) throw bad("This coupon makes the course free. Use \"Enroll free with coupon\" on the checkout page.");
    Payment p=new Payment(); p.userId=u.id; p.userName=u.name; p.userEmail=u.email; p.courseId=id; p.courseName=c.name; p.method=method; p.amount=amount; p.status="AWAITING";
    p.planId=plan==null?null:plan.id; p.ownerId=owner.id; p.ownerName=owner.name; p.coupon=pct>0?(cr.coupon!=null?cr.coupon.code:code.trim().toUpperCase()):null;
    p.detail="QR".equals(method)?"UPI QR":"UPI".equals(method)?"UPI app":"Card"+(blank(a.cardProvider)?"":" ("+a.cardProvider+")");
    p.reference="NMS"+Long.toString(System.currentTimeMillis(),36).toUpperCase()+(100+new Random().nextInt(900));
    p.expiresAt=LocalDateTime.now().plusMinutes(windowOf(a)); String emailTok=issueEmailLink(p); String mailErr=emailUploadLink(p,emailTok,a);
    p.emailSentAt=LocalDateTime.now(); payments.save(p);
    Map<String,Object> v=view(p); v.put("emailSent",mailErr==null); v.put("emailProblem",mailErr); return v; }

  @GetMapping("/payments/{ref}") Map<String,Object> status(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String ref){
    User u=auth.need(h,null); Payment p=find(ref);
    if(!staffRole(u)&&!Objects.equals(p.userId,u.id)) throw forbidden();
    expireIfNeeded(p); return view(p); }

  /** "I have paid". This only sends the payment to the owner for checking. It never unlocks the course. Safe to press twice. */
  @PostMapping("/payments/{ref}/submit") Map<String,Object> submit(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String ref,@RequestBody(required=false) Map<String,String> b){
    User u=auth.need(h,null);
    synchronized(this){
      Payment p=find(ref); if(!Objects.equals(p.userId,u.id)) throw forbidden();
      expireIfNeeded(p);
      if("PENDING_VERIFICATION".equals(p.status)||"SUCCESS".equals(p.status)) return view(p);
      if("EXPIRED".equals(p.status)) throw new ResponseStatusException(HttpStatus.GONE,"This payment window has closed. Start again from the course page.");
      if(!"AWAITING".equals(p.status)&&!"REJECTED".equals(p.status)) throw conflict("This payment cannot be sent for checking.");
      if(p.proofFile==null) throw bad("Upload your payment screenshot first, then press I Have Paid.");
      String txn=nz(b==null?null:b.get("transactionId")).trim();
      if(!txn.isEmpty()&&!TXN_ID.matcher(txn).matches()) throw bad("Enter the transaction ID from your payment app (6 to 40 letters or digits; for UPI it is the 12-digit UTR).");
      if(!txn.isEmpty()&&!payments.findByUtrAndStatusIn(txn,List.of("PENDING_VERIFICATION","SUCCESS")).isEmpty()) throw conflict("This transaction ID has already been used for another payment. Check the ID, or contact us.");
      p.rejectReason=null; p.verification="PENDING_VERIFICATION"; p.utr=txn.isEmpty()?null:txn; p.status="PENDING_VERIFICATION"; p.submittedAt=LocalDateTime.now(); p.expiresAt=null; payments.save(p);
      askApproval(p); return view(p); } }

  @PostMapping("/payments/{ref}/cancel") Map<String,Object> cancel(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String ref){
    User u=auth.need(h,null); Payment p=find(ref); if(!Objects.equals(p.userId,u.id)) throw forbidden();
    if(!"AWAITING".equals(p.status)) throw conflict("Only an unpaid order can be cancelled");
    p.status="CANCELLED"; p.rejectReason="Cancelled by student"; payments.save(p); return Map.of("ok",true); }

  // ================= staff side (ADMIN + TEACHER only) =================
  static boolean statusMatch(String f,String st){
    if(f==null||f.isBlank()||"ALL".equalsIgnoreCase(f)) return true;
    switch(f.toUpperCase()){
      case "FAILED": return "FAILED".equals(st)||"REJECTED".equals(st);
      case "CANCELLED": return "CANCELLED".equals(st)||"EXPIRED".equals(st);
      default: return f.equalsIgnoreCase(st); } }

  @GetMapping("/staff/payments") List<Payment> list(@RequestHeader(value="Authorization",required=false) String h,@RequestParam(required=false) String status,@RequestParam(required=false) String q,@RequestParam(required=false) String from,@RequestParam(required=false) String to,@RequestParam(required=false) Long courseId){
    User st=auth.staff(h); List<Payment> all=new ArrayList<>(payments.findAll()); all.forEach(this::expireIfNeeded);
    all.forEach(p->{ if(p.userEmail==null&&p.userId!=null) users.findById(p.userId).ifPresent(x->p.userEmail=x.email); });
    LocalDate d1=date(from), d2=date(to);
    all.removeIf(p->(courseId!=null&&!courseId.equals(p.courseId))||(d1!=null&&p.at.toLocalDate().isBefore(d1))||(d2!=null&&p.at.toLocalDate().isAfter(d2)));
    String s=low(q).trim();
    all.removeIf(p->!mine(st,p)||!statusMatch(status,p.status)
      ||(!s.isEmpty()&&!(low(p.userName).contains(s)||low(p.courseName).contains(s)||low(p.userEmail).contains(s)||low(p.reference).contains(s)||low(p.utr).contains(s)||low(p.ownerName).contains(s))));
    all.sort((x,y)->Long.compare(y.id,x.id));
    for(Payment p:all) if(p.planId!=null) plans.findById(p.planId).ifPresent(pl->{ p.planTopics=CoursePlan.topicIdsOf(pl).stream().map(id->topics.findById(id).map(t->t.title).orElse("")).filter(x->!x.isEmpty()).collect(java.util.stream.Collectors.joining(", ")); p.planDates=pl.days!=null?pl.days+" days":pl.startsOn+" to "+pl.endsOn; });
    return all; }

  @GetMapping("/staff/payments/summary") Map<String,Object> summary(@RequestHeader(value="Authorization",required=false) String h){
    User st=auth.staff(h); LocalDate today=LocalDate.now(); long waiting=0,ok=0,rej=0,awaiting=0; int tod=0,mon=0,tot=0; long oldest=0;
    for(Payment p:payments.findAll()){ if(!mine(st,p)) continue; expireIfNeeded(p);
      if("PENDING_VERIFICATION".equals(p.status)){ waiting++; if(p.submittedAt!=null) oldest=Math.max(oldest,Duration.between(p.submittedAt,LocalDateTime.now()).toMinutes()); }
      if("AWAITING".equals(p.status)) awaiting++;
      if("REJECTED".equals(p.status)||"FAILED".equals(p.status)) rej++;
      if("SUCCESS".equals(p.status)){ ok++; tot+=p.amount; LocalDate d=(p.reviewedAt!=null?p.reviewedAt:p.at).toLocalDate();
        if(d.equals(today)) tod+=p.amount; if(d.getYear()==today.getYear()&&d.getMonth()==today.getMonth()) mon+=p.amount; } }
    Map<String,Object> m=new LinkedHashMap<>(); m.put("needsApproval",waiting); m.put("pending",waiting); m.put("awaiting",awaiting); m.put("oldestPendingMinutes",oldest);
    m.put("success",ok); m.put("rejected",rej); m.put("today",tod); m.put("month",mon); m.put("total",tot);
    m.put("scope","ADMIN".equals(st.role)?"all":"mine"); return m; }

  @GetMapping(value="/staff/payments/export",produces="text/csv") ResponseEntity<String> export(@RequestHeader(value="Authorization",required=false) String h){
    User st=auth.staff(h); List<Payment> all=new ArrayList<>(payments.findAll()); all.removeIf(p->!mine(st,p)); all.sort((x,y)->Long.compare(y.id,x.id));
    StringBuilder sb=new StringBuilder("Date,Reference,Student,Course,Paid to,Method,Amount INR,Status,Transaction ID,Reviewed by,Reason\n");
    for(Payment p:all) sb.append(String.join(",",csv(p.at.toString()),csv(p.reference),csv(p.userName),csv(p.courseName),csv(p.ownerName),csv(p.method),String.valueOf(p.amount),csv(p.status),csv(p.utr),csv(p.reviewedBy),csv(p.rejectReason))).append('\n');
    return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=payments.csv").contentType(MediaType.parseMediaType("text/csv")).body(sb.toString()); }

  // ---- payment settings: every admin / teacher edits their OWN account ----
  Map<String,Object> settingsView(User st){
    PayAccount a=account(st.id); Map<String,Object> m=new LinkedHashMap<>();
    m.put("owner",st.name); m.put("role",st.role); m.put("payee",nz(a.payee)); m.put("upiId",nz(a.upiId)); m.put("instructions",nz(a.instructions)); m.put("bankDetails",nz(a.bankDetails));
    m.put("qrEnabled",a.qrEnabled); m.put("upiEnabled",a.upiEnabled); m.put("cardEnabled",a.cardEnabled); m.put("windowMinutes",windowOf(a)); m.put("windowRange",List.of(MIN_WINDOW,MAX_WINDOW));
    m.put("cardProvider",nz(a.cardProvider)); m.put("cardLink",nz(a.cardLink)); m.put("qrImage",a.qrImage); m.put("available",availability(a));
    m.put("mobile",nz(st.mobile)); return m; }

  static Long num(String s){ try{ return Long.valueOf(s); }catch(NumberFormatException e){ return null; } }
  static String text(Map<String,Object> b,String k){ Object o=b.get(k); return o==null?"":o.toString().trim(); }
  static boolean flag(Map<String,Object> b,String k,boolean d){ Object o=b.get(k); if(o==null) return d; return o instanceof Boolean?(Boolean)o:"true".equalsIgnoreCase(o.toString()); }

  @GetMapping("/staff/payment-settings") Map<String,Object> settingsGet(@RequestHeader(value="Authorization",required=false) String h){ return settingsView(auth.staff(h)); }

  @PutMapping("/staff/payment-settings") Map<String,Object> settingsPut(@RequestHeader(value="Authorization",required=false) String h,@RequestBody Map<String,Object> b){
    User st=auth.staff(h); PayAccount a=account(st.id);
    String upi=b.containsKey("upiId")?text(b,"upiId"):nz(a.upiId); if(!upi.isEmpty()&&!UPI.matcher(upi).matches()) throw bad("Enter a valid UPI ID, for example institute@okaxis");
    String payee=b.containsKey("payee")?text(b,"payee"):nz(a.payee); if(payee.length()>60) throw bad("Payee name is too long (max 60)");
    String note=b.containsKey("instructions")?text(b,"instructions"):nz(a.instructions); if(note.length()>300) throw bad("Instructions are too long (max 300)");
    String bank=b.containsKey("bankDetails")?text(b,"bankDetails"):nz(a.bankDetails); if(bank.length()>400) throw bad("Bank details are too long (max 400)");
    String prov=b.containsKey("cardProvider")?text(b,"cardProvider"):nz(a.cardProvider); if(prov.length()>40) throw bad("Card provider name is too long (max 40)");
    String link=b.containsKey("cardLink")?text(b,"cardLink"):nz(a.cardLink); if(!link.isEmpty()&&!LINK.matcher(link).matches()) throw bad("The card payment link must start with https:// and contain no spaces");
    Integer win=a.windowMinutes;
    if(b.containsKey("windowMinutes")){ try{ win=Integer.parseInt(text(b,"windowMinutes").trim()); }catch(NumberFormatException e){ throw bad("Payment time limit must be a whole number of minutes"); }
      if(win<MIN_WINDOW||win>MAX_WINDOW) throw bad("Payment time limit must be between "+MIN_WINDOW+" and "+MAX_WINDOW+" minutes"); }
    boolean qr=flag(b,"qrEnabled",a.qrEnabled), up=flag(b,"upiEnabled",a.upiEnabled), card=flag(b,"cardEnabled",a.cardEnabled);
    if(card&&link.isEmpty()) throw bad("Add your card payment link before turning on card payments");
    if(b.containsKey("mobile")){ String mob=text(b,"mobile").replaceAll("\\D",""); if(mob.length()==12&&mob.startsWith("91")) mob=mob.substring(2);
      if(!mob.isEmpty()&&!PHONE.matcher(mob).matches()) throw bad("Enter the 10-digit mobile number for payment alerts");
      st.mobile=mob.isEmpty()?null:mob; users.save(st); }
    a.userId=st.id; a.upiId=upi; a.payee=payee; a.instructions=note; a.bankDetails=bank; a.cardProvider=prov; a.cardLink=link; a.windowMinutes=win;
    a.qrEnabled=qr; a.upiEnabled=up; a.cardEnabled=card;
    accounts.save(a); return settingsView(st); }

  @PutMapping("/staff/payment-qr") Map<String,Object> qrPut(@RequestHeader(value="Authorization",required=false) String h,@RequestBody Map<String,String> b){
    User st=auth.staff(h); String d=nz(b.get("dataUrl"));
    java.util.regex.Matcher m=Pattern.compile("^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$").matcher(d);
    if(!m.matches()) throw bad("Upload a PNG, JPG or WEBP image"); if(d.length()>MAX_IMG) throw bad("Image is too large. Keep it under 300 KB.");
    byte[] raw; try{ raw=Base64.getDecoder().decode(m.group(2)); }catch(IllegalArgumentException e){ throw bad("That image is damaged"); }
    boolean png=raw.length>8&&(raw[0]&0xff)==0x89&&raw[1]=='P', jpg=raw.length>3&&(raw[0]&0xff)==0xFF&&(raw[1]&0xff)==0xD8, webp=raw.length>12&&raw[0]=='R'&&raw[1]=='I'&&raw[8]=='W';
    if(!png&&!jpg&&!webp) throw bad("That file is not a real image");
    PayAccount a=account(st.id); a.userId=st.id; a.qrImage=d; accounts.save(a); return Map.of("ok",true); }

  @DeleteMapping("/staff/payment-qr") Map<String,Object> qrDelete(@RequestHeader(value="Authorization",required=false) String h){
    User st=auth.staff(h); PayAccount a=account(st.id); a.userId=st.id; a.qrImage=null; accounts.save(a); return Map.of("ok",true); }

  /** Admin only: choose which staff account receives the money for a course. */
  @PutMapping("/admin/courses/{id}/owner") Map<String,Object> setOwner(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id,@RequestBody Map<String,Object> b){
    auth.need(h,"ADMIN"); Course c=courses.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Course not found"));
    Long uid=num(text(b,"ownerId")); if(uid==null) throw bad("Choose an owner");
    User o=users.findById(uid).orElseThrow(()->bad("That user does not exist")); if(!staffRole(o)) throw bad("The owner must be an admin or a teacher");
    c.ownerId=o.id; courses.save(c); return Map.of("ok",true,"ownerId",o.id,"ownerName",o.name); }

  /** Staff approve a payment the student said they made. Optional: the transaction ID from the owner's bank, for their records. */
  @PostMapping("/staff/payments/{ref}/approve") Map<String,Object> approve(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String ref,@RequestBody(required=false) Map<String,String> b){
    User st=auth.staff(h); String txn=nz(b==null?null:b.get("transactionId")).trim();
    if(!txn.isEmpty()&&!TXN_ID.matcher(txn).matches()) throw bad("The transaction ID should be 6 to 40 letters or digits");
    synchronized(this){
      Payment p=find(ref); if(!mine(st,p)) throw forbidden();
      if(!"PENDING_VERIFICATION".equals(p.status)) throw conflict("This payment is not waiting for approval any more.");
      if(!txn.isEmpty()) p.utr=txn;   // staff may correct the ID; otherwise the student's ID is kept
      if(p.planId!=null){ CoursePlan pl=plans.findById(p.planId).orElse(null); if(pl==null||!CoursePlanController.canStart(pl)) throw conflict("This plan can no longer start: it was revoked or its dates have passed. Reject this payment, or extend the plan first."); }
      complete(p,st.name+" (approved)");
      return view(p); } }

  /** Staff reject a payment. A reason is required and the student is told it. Money already received must be refunded by the owner. */
  @PostMapping("/staff/payments/{ref}/reject") Map<String,Object> reject(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String ref,@RequestBody(required=false) Map<String,String> b){
    User st=auth.staff(h); String why=nz(b==null?null:b.get("reason")).trim();
    if(why.length()<5) throw bad("Give a short reason (at least 5 characters). The student will see it.");
    if(why.length()>300) throw bad("The reason is too long (max 300 characters).");
    synchronized(this){
      Payment p=find(ref); if(!mine(st,p)) throw forbidden();
      if(!"PENDING_VERIFICATION".equals(p.status)) throw conflict("This payment is not waiting for approval any more.");
      p.status="REJECTED"; p.verification="REJECTED"; p.rejectReason=why; p.reviewedBy=st.name+" (rejected)"; p.reviewedAt=LocalDateTime.now(); payments.save(p);
      tellStudentRejected(p,why);
      return view(p); } }

  /** Enrols the student and marks the payment SUCCESS. Caller must hold the lock. */
  void complete(Payment cur,String reviewer){
    if(cur.planId!=null){   // a study plan: start it, no course enrolment
      CoursePlan pl=plans.findById(cur.planId).orElseThrow(()->conflict("The plan for this payment no longer exists."));
      CoursePlanController.activate(plans,pl);
      cur.accessStartsOn=(pl.startsOn!=null&&pl.startsOn.isAfter(LocalDate.now()))?pl.startsOn.toString():null;
      cur.verification="APPROVED"; cur.status="SUCCESS"; cur.reviewedBy=reviewer; cur.reviewedAt=LocalDateTime.now(); cur.expiresAt=null; payments.save(cur);
      tellStudentPlanStarted(cur,pl); return; }
    boolean fresh=!enrolls.existsByUserIdAndCourseId(cur.userId,cur.courseId);
    if(fresh){ Enrollment e=new Enrollment(); e.userId=cur.userId; e.courseId=cur.courseId; e.paid=cur.amount; enrolls.save(e); if(!blank(cur.coupon)) cs.used(cur.coupon); }
    cur.verification="APPROVED"; cur.status="SUCCESS"; cur.reviewedBy=reviewer; cur.reviewedAt=LocalDateTime.now();
    cur.rejectReason=fresh?null:"Student was already enrolled. Refund recommended.";
    cur.expiresAt=null; payments.save(cur);
    tellStudentApproved(cur,fresh); }

  // ================= notifications =================
  /** Staff who should hear about a payment: the course owner and every admin, without duplicates. */
  List<User> staffFor(Payment p){
    LinkedHashMap<Long,User> m=new LinkedHashMap<>();
    if(p.ownerId!=null) users.findById(p.ownerId).ifPresent(o->m.put(o.id,o));
    for(User a:users.findAll()) if("ADMIN".equals(a.role)) m.putIfAbsent(a.id,a);
    return new ArrayList<>(m.values()); }

  /** Email + SMS to the owner and admins: a student says they have paid; check the money and approve or reject. */
  void askApproval(Payment p){
    try{
      String course=nz(p.courseName), who=nz(p.userName), ref=nz(p.reference), link=mail.url("/payments");
      String subject="Check payment: Rs "+p.amount+" from "+who+" for "+course;
      String html="<p>A student says they have paid. <b>Check your bank or card account</b> for this amount with the reference in the payment note. The course unlocks only after you approve.</p>"
        +"<table style=\"font-size:15px;line-height:1.7\">"
        +"<tr><td style=\"padding-right:14px;color:#64748b\">Student</td><td>"+htmlEsc(who)+" ("+htmlEsc(nz(p.userEmail))+")</td></tr>"
        +"<tr><td style=\"color:#64748b\">Course</td><td>"+htmlEsc(course)+"</td></tr>"
        +"<tr><td style=\"color:#64748b\">Amount</td><td><b>Rs "+p.amount+"</b> ("+htmlEsc(nz(p.method))+")</td></tr>"
        +"<tr><td style=\"color:#64748b\">Transaction ID</td><td><b>"+htmlEsc(nz(p.utr))+"</b></td></tr>"
        +"<tr><td style=\"color:#64748b\">Reference</td><td>"+htmlEsc(ref)+"</td></tr></table>"
        +"<p><b>To approve or reject:</b></p><ol><li>Find Rs "+p.amount+" with reference "+htmlEsc(ref)+" in your account.</li>"
        +"<li>Log in to NLMed Study and open <b>Payments</b>.</li>"
        +"<li>Click <b>Approve</b> if you received it, or <b>Reject</b> and give a reason.</li></ol>"
        +"<p style=\"color:#64748b;font-size:13px\">The student is emailed the decision. If you reject a payment that was already received, refund it yourself.</p>";
      String text="A student says they have paid Rs "+p.amount+" for "+course+". Check your account for the amount and reference.\n\nStudent: "+who+" ("+nz(p.userEmail)+")\nAmount: Rs "+p.amount
        +"\nTransaction ID: "+nz(p.utr)+"\nReference: "+ref+"\n\nTo approve or reject:\n1. Find Rs "+p.amount+" with reference "+ref+" in your account.\n2. Log in to NLMed Study and open Payments.\n3. Click Approve, or Reject and give a reason.\n\n"+link;
      String smsText="NLMed: "+who+" paid Rs "+p.amount+" for "+course+". Txn ID "+nz(p.utr)+", ref "+ref+". Check account, then Approve/Reject in Payments.";
      for(User s:staffFor(p)){
        if(!blank(s.email)) mail.send(s.email,subject,Mailer.layout("Check this payment",html,"Open Payments",link),text);
        if(!blank(s.mobile)) sms.send(s.mobile,smsText); }
    }catch(Exception ex){ LOG.warn("Payment check request failed for {}: {}",p.reference,ex.getMessage()); } }

  /** Student is told the payment was approved: the enrolment email if newly enrolled, otherwise a short confirmation. */
  void tellStudentApproved(Payment p,boolean fresh){
    try{
      User su=users.findById(p.userId).orElse(null); Course cc=courses.findById(p.courseId).orElse(null);
      if(su==null||cc==null) return;
      if(fresh){ mail.enrolled(su,cc,p.amount,p.utr); return; }
      mail.send(su.email,"Your payment for "+cc.name+" was approved",
        Mailer.layout("Payment approved","<p>Hello "+htmlEsc(su.name)+", your payment of Rs "+p.amount+" for <b>"+htmlEsc(cc.name)+"</b> was approved. You were already enrolled, so nothing else is needed.</p><p>Reference: "+htmlEsc(p.reference)+"</p>","Go to My Course",mail.url("/learn/"+cc.id)),
        "Hello "+su.name+", your payment of Rs "+p.amount+" for "+cc.name+" was approved. Reference: "+p.reference+".");
    }catch(Exception ex){ LOG.warn("Approval email failed for {}: {}",p.reference,ex.getMessage()); } }

  void tellStudentPlanStarted(Payment p,CoursePlan pl){
    try{
      User su=users.findById(p.userId).orElse(null); Course cc=courses.findById(p.courseId).orElse(null);
      if(su==null||cc==null) return;
      String when=(pl.days!=null?pl.days+" days, ":"")+"from "+pl.startsOn+" to "+pl.endsOn;
      mail.send(su.email,"Your plan for "+cc.name+" is active",
        Mailer.layout("Your study plan is active","<p>Hello "+htmlEsc(su.name)+", your payment of Rs "+p.amount+" was approved. Your plan for <b>"+htmlEsc(cc.name)+"</b> is active: "+htmlEsc(when)+".</p><p>You can open only the topics your teacher assigned.</p>","Open my course",mail.url("/learn/"+cc.id)),
        "Hello "+su.name+", your plan for "+cc.name+" is active: "+when+". You can open only the topics your teacher assigned.");
    }catch(Exception ex){ LOG.warn("Plan email failed for {}: {}",p.reference,ex.getMessage()); } }

  /** Student is told the payment window closed before a payment was submitted. Runs once per order, when it expires. */
  void tellStudentExpired(Payment p){
    try{
      User su=users.findById(p.userId).orElse(null); if(su==null) return;
      String link=mail.url("/checkout/"+p.courseId);
      mail.send(su.email,"Your payment window closed: "+nz(p.courseName),
        Mailer.layout("Payment window closed","<p>Hello "+htmlEsc(su.name)+", the time allowed for your payment of <b>Rs "+p.amount+"</b> for <b>"+htmlEsc(nz(p.courseName))+"</b> has passed, so we have closed this payment.</p><p>Reference: "+htmlEsc(p.reference)+"</p><p>There is no need to worry: you can start the payment again from the course page whenever you are ready.</p>","Start payment again",link),
        "Hello "+su.name+", the payment window for "+nz(p.courseName)+" (reference "+p.reference+") has closed. Whenever you are ready, you can start the payment again: "+link);
    }catch(Exception ex){ LOG.warn("Expiry email failed for {}: {}",p.reference,ex.getMessage()); } }

  /** Student is told the payment was rejected, with the reason. */
  void tellStudentRejected(Payment p,String reason){
    try{
      User su=users.findById(p.userId).orElse(null); Course cc=courses.findById(p.courseId).orElse(null);
      if(su==null||cc==null) return;
      mail.send(su.email,"Your payment for "+cc.name+" was not approved",
        Mailer.layout("Payment not approved","<p>Hello "+htmlEsc(su.name)+", we are sorry, but we were unable to approve your payment of Rs "+p.amount+" for <b>"+htmlEsc(cc.name)+"</b>.</p><p><b>Reason:</b> "+htmlEsc(reason)+"</p><p>Your course has not been unlocked. Reference: "+htmlEsc(p.reference)+". If any money was deducted from your account, please contact us with this reference and we will be glad to help with a refund.</p>","Contact us",mail.url("/contact")),
        "Hello "+su.name+", we are sorry, but we were unable to approve your payment of Rs "+p.amount+" for "+cc.name+". Reason: "+reason+". Reference: "+p.reference+". If any money was deducted, please contact us with this reference and we will help.");
    }catch(Exception ex){ LOG.warn("Rejection email failed for {}: {}",p.reference,ex.getMessage()); } }

  // ================= payment proof: screenshot upload (from this computer, or from a phone by scanning a QR) =================
  /* Only the screenshot is stored. It never confirms a payment: the owner or admin checks the money before approving.
     A one-time upload QR carries a random token (stored only as a hash). It expires after 15 minutes, takes at most 10 uploads,
     opens only this one payment, and a new QR for the same payment replaces the old one. */
  static final java.nio.file.Path PROOF_DIR=java.nio.file.Path.of("uploads","proofs").toAbsolutePath().normalize();
  static final long MAX_PROOF=5L*1024*1024; static final int PROOF_LINK_MINUTES=15, PROOF_LINK_MAX_UPLOADS=10;
  static String sha256(String s){ try{ return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8))); }catch(Exception e){ throw new IllegalStateException(e); } }
  /** Checks the real file type from its first bytes. The file name and the browser's type are not trusted. Returns the extension or null. */
  static String imageType(byte[] b){
    if(b.length>3&&(b[0]&0xff)==0xFF&&(b[1]&0xff)==0xD8&&(b[2]&0xff)==0xFF) return "jpg";
    if(b.length>8&&(b[0]&0xff)==0x89&&b[1]=='P'&&b[2]=='N'&&b[3]=='G') return "png";
    if(b.length>12&&b[0]=='R'&&b[1]=='I'&&b[2]=='F'&&b[3]=='F'&&b[8]=='W'&&b[9]=='E'&&b[10]=='B'&&b[11]=='P') return "webp";
    return null; }
  boolean reachable(){ return !appBase.contains("localhost")&&!appBase.contains("127.0.0.1"); }

  /** Stores (or replaces) the screenshot on a payment. Sending a screenshot on an open order counts as "I have paid": it moves to PENDING_VERIFICATION. */
  synchronized Map<String,Object> saveProof(Payment p,byte[] raw,String source) throws java.io.IOException {
    expireIfNeeded(p);
    if(!"AWAITING".equals(p.status)&&!"REJECTED".equals(p.status)) throw conflict("A screenshot can be added only while the payment is open or after it was rejected. Once you press I Have Paid it cannot change.");
    if(raw==null||raw.length==0) throw bad("The file is empty");
    if(raw.length>MAX_PROOF) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"The screenshot is too large. The limit is 5 MB.");
    String ext=imageType(raw); if(ext==null) throw bad("Upload a JPG, PNG or WEBP screenshot");
    java.nio.file.Files.createDirectories(PROOF_DIR);
    String name=UUID.randomUUID()+"."+ext;
    java.nio.file.Files.write(PROOF_DIR.resolve(name),raw);
    if(p.proofFile!=null) java.nio.file.Files.deleteIfExists(PROOF_DIR.resolve(p.proofFile));   // replace: remove the old screenshot
    p.proofFile=name; p.proofType=ext; p.proofSource=source; p.proofAt=LocalDateTime.now();
    if("REJECTED".equals(p.status)) p.verification="RESUBMISSION_REQUIRED";
    payments.save(p);   // storing a screenshot does not send the payment for verification: that happens only on I Have Paid
    return view(p); }

  /** Student: upload a screenshot from this computer or phone browser. */
  @PostMapping(value="/payments/{ref}/proof",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) Map<String,Object> proofFromDevice(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String ref,@RequestParam MultipartFile file) throws Exception {
    User u=auth.need(h,null); Payment p=find(ref); if(!Objects.equals(p.userId,u.id)) throw forbidden();
    return saveProof(p,file.getBytes(),"DEVICE"); }

  /** Student: create a one-time upload QR for this payment. A new one replaces the previous one. This is not a payment QR. */
  @PostMapping("/payments/{ref}/proof-link") Map<String,Object> proofLink(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String ref){
    User u=auth.need(h,null); Payment p=find(ref); if(!Objects.equals(p.userId,u.id)) throw forbidden();
    expireIfNeeded(p);
    if(!"AWAITING".equals(p.status)&&!"REJECTED".equals(p.status)) throw conflict("This payment is no longer open for a screenshot.");
    byte[] r=new byte[32]; new java.security.SecureRandom().nextBytes(r);
    String token=Base64.getUrlEncoder().withoutPadding().encodeToString(r);
    p.proofTokenHash=sha256(token); p.proofTokenExpires=LocalDateTime.now().plusMinutes(PROOF_LINK_MINUTES); p.proofUploads=0; payments.save(p);
    Map<String,Object> m=new LinkedHashMap<>();
    m.put("url",appBase.replaceAll("/+$","")+"/#/proof/"+token); m.put("expiresAt",p.proofTokenExpires.toString());
    m.put("minutes",PROOF_LINK_MINUTES); m.put("reachable",reachable()); return m; }

  /** The payment behind an upload link. Only a known token opens it. */
  Payment byUploadToken(String token){
    if(token==null||token.length()<40||token.length()>80) throw bad("This upload link is not valid.");
    return payments.findByProofTokenHash(sha256(token)).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"This upload link is not valid. Create a new one on your computer."));
  }
  Payment openUploadToken(String token){
    Payment p=byUploadToken(token);
    if(p.proofTokenExpires==null||p.proofTokenExpires.isBefore(LocalDateTime.now())) throw new ResponseStatusException(HttpStatus.GONE,"This upload link has expired. Create a new one on your computer.");
    return p; }

  /** Phone page: what the upload link is for. Course, amount and reference only. */
  @GetMapping("/proof-session/{token}") Map<String,Object> proofSession(@PathVariable String token){
    Payment p=openUploadToken(token); int used=p.proofUploads==null?0:p.proofUploads;
    Map<String,Object> m=new LinkedHashMap<>();
    m.put("reference",p.reference); m.put("course",p.courseName); m.put("amount",p.amount); m.put("status",p.status);
    m.put("hasProof",p.proofFile!=null); m.put("reason",p.rejectReason); m.put("uploadsLeft",Math.max(0,PROOF_LINK_MAX_UPLOADS-used));
    m.put("secondsLeft",Math.max(0,Duration.between(LocalDateTime.now(),p.proofTokenExpires).getSeconds()));
    return m; }

  /** Phone: upload the screenshot through the link. No login; the token is the authority, and it expires. */
  @PostMapping(value="/proof-session/{token}/upload",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) Map<String,Object> proofFromPhone(@PathVariable String token,@RequestParam MultipartFile file) throws Exception {
    synchronized(this){
      Payment p=openUploadToken(token); int used=p.proofUploads==null?0:p.proofUploads;
      if(used>=PROOF_LINK_MAX_UPLOADS) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Too many uploads from this link. Create a new one on your computer.");
      Map<String,Object> out=saveProof(p,file.getBytes(),"PHONE");
      p.proofUploads=used+1; payments.save(p);
      return out; } }

  /** The stored screenshot: the student who paid, or staff who may see the payment. */
  /* ---- email upload link and I Have Paid ---- */
  static final int EMAIL_LINK_HOURS=48; static final java.security.SecureRandom RNG=new java.security.SecureRandom();
  /** A 48-hour upload link for the student's email. One per payment; only its hash is stored. */
  String issueEmailLink(Payment p){
    byte[] r=new byte[32]; RNG.nextBytes(r);
    String tok=Base64.getUrlEncoder().withoutPadding().encodeToString(r);
    p.proofTokenHash=sha256(tok); p.proofTokenExpires=LocalDateTime.now().plusHours(EMAIL_LINK_HOURS); p.proofUploads=0;
    return tok; }
  /** Sends the upload link now. Returns null when the mail server accepted it, otherwise the reason (shown to the student). */
  String emailUploadLink(Payment p,String token,PayAccount a){
    User su=users.findById(p.userId).orElse(null);
    if(su==null) return "Your account could not be found";
    String link=mail.url("/proof/"+token);
    String payTo=blank(a.upiId)?"the payment details shown on the checkout page":"UPI ID "+a.upiId;
    String html="<p>Hello "+htmlEsc(su.name)+", you started a payment of <b>Rs "+p.amount+"</b> for <b>"+htmlEsc(nz(p.courseName))+"</b>.</p>"
      +"<p><b>Reference:</b> "+htmlEsc(p.reference)+"</p>"
      +"<ol><li>Pay exactly Rs "+p.amount+" to "+htmlEsc(payTo)+". Type the reference in the payment note.</li>"
      +"<li>Take a screenshot of the payment confirmation.</li>"
      +"<li>Open the secure link below, upload the screenshot, then press <b>I Have Paid</b>.</li></ol>"
      +"<p style=\"color:#64748b;font-size:13px\">This link is valid for 48 hours and only for this payment, so please keep it private. Once you upload the screenshot, our team checks the payment before your course is unlocked. Thank you for your patience.</p>";
    String text="Hello "+su.name+", you started a payment of Rs "+p.amount+" for "+nz(p.courseName)+". Reference: "+p.reference+". Pay exactly Rs "+p.amount+" to "+payTo+" with the reference in the note. Then upload your screenshot at "+link+" and press I Have Paid. The link is valid for 48 hours. Thank you for your patience.";
    return mail.deliver(su.email,"Upload your payment screenshot: Rs "+p.amount+" for "+nz(p.courseName),Mailer.layout("Upload your payment screenshot",html,"Upload screenshot",link),text); }

  /** Student: send the upload link again (the first email may be in spam, or may not have arrived). At most one every 2 minutes. */
  @PostMapping("/payments/{ref}/resend-upload-link") Map<String,Object> resendLink(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String ref){
    User u=auth.need(h,null);
    synchronized(this){
      Payment p=find(ref); if(!Objects.equals(p.userId,u.id)) throw forbidden();
      expireIfNeeded(p);
      if(!"AWAITING".equals(p.status)&&!"REJECTED".equals(p.status)) throw conflict("This payment is no longer waiting for a screenshot.");
      if(p.emailSentAt!=null&&p.emailSentAt.isAfter(LocalDateTime.now().minusMinutes(2)))
        throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"We sent the link a moment ago. Check your inbox and spam folder, then try again in 2 minutes.");
      PayAccount a=p.ownerId==null?new PayAccount():account(p.ownerId);
      if("REJECTED".equals(p.status)) p.verification="RESUBMISSION_REQUIRED"; String tok=issueEmailLink(p); String err=emailUploadLink(p,tok,a);
      p.emailSentAt=LocalDateTime.now(); payments.save(p);
      Map<String,Object> m=new LinkedHashMap<>(); m.put("sent",err==null); m.put("problem",err); return m; } }

  /** Admin: is email set up, and what happened last time. */
  @GetMapping("/admin/email-status") Map<String,Object> emailStatus(@RequestHeader(value="Authorization",required=false) String h){
    auth.need(h,"ADMIN"); return mail.status(); }

  /** Student presses I Have Paid on the upload page. Only now is the payment sent for verification. Pressing it twice changes nothing. */
  @PostMapping("/proof-session/{token}/paid") Map<String,Object> iHavePaid(@PathVariable String token){
    synchronized(this){
      Payment p=openUploadToken(token); expireIfNeeded(p);
      if("PENDING_VERIFICATION".equals(p.status)||"SUCCESS".equals(p.status))
        return Map.of("ok",true,"message","Your payment is already pending verification. We will email you when it is confirmed.");
      if(!"AWAITING".equals(p.status)&&!"REJECTED".equals(p.status)) throw conflict("This payment can no longer be sent for verification.");
      if(p.proofFile==null) throw bad("Upload your payment screenshot first, then press I Have Paid.");
      p.status="PENDING_VERIFICATION"; p.verification="PENDING_VERIFICATION"; p.rejectReason=null; p.submittedAt=LocalDateTime.now(); p.expiresAt=null; payments.save(p);
      tellStudentProofReceived(p); askApproval(p);
      return Map.of("ok",true,"message","Payment details submitted successfully! Your payment is awaiting teacher/admin approval. Your course will become available once your payment is approved."); } }

  void tellStudentProofReceived(Payment p){
    try{
      User su=users.findById(p.userId).orElse(null); if(su==null) return;
      mail.send(su.email,"We received your payment screenshot: "+nz(p.courseName),
        Mailer.layout("Payment screenshot received","<p>Hello "+htmlEsc(su.name)+", we received your payment screenshot for <b>"+htmlEsc(nz(p.courseName))+"</b>.</p><p>Amount: <b>Rs "+p.amount+"</b><br>Reference: "+htmlEsc(p.reference)+"<br>Status: <b>Pending verification</b></p><p>Our team will check the payment and let you know as soon as it is confirmed. Thank you for your patience.</p>",null,null),
        "Hello "+su.name+", we received your payment screenshot for "+nz(p.courseName)+". Amount Rs "+p.amount+", reference "+p.reference+". Status: pending verification. We will email you when it is confirmed.");
    }catch(Exception ex){ LOG.warn("Screenshot receipt email failed for {}: {}",p.reference,ex.getMessage()); } }

  @GetMapping("/payments/{ref}/proof") ResponseEntity<byte[]> myProof(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String ref) throws Exception {
    User u=auth.need(h,null); Payment p=find(ref); if(!Objects.equals(p.userId,u.id)) throw forbidden(); return proofBytes(p); }
  @GetMapping("/staff/payments/{ref}/proof") ResponseEntity<byte[]> staffProof(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String ref) throws Exception {
    User st=auth.staff(h); Payment p=find(ref); if(!mine(st,p)) throw forbidden(); return proofBytes(p); }
  ResponseEntity<byte[]> proofBytes(Payment p) throws Exception {
    if(p.proofFile==null) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"No screenshot has been uploaded for this payment");
    java.nio.file.Path f=PROOF_DIR.resolve(p.proofFile).normalize();
    if(!f.startsWith(PROOF_DIR)||!java.nio.file.Files.isRegularFile(f)) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"The screenshot file is missing on the server. Ask the student to upload it again.");
    String ct="jpg".equals(p.proofType)?"image/jpeg":"png".equals(p.proofType)?"image/png":"image/webp";
    return ResponseEntity.ok().contentType(MediaType.parseMediaType(ct)).header("X-Content-Type-Options","nosniff").header(HttpHeaders.CACHE_CONTROL,"private, no-store").body(java.nio.file.Files.readAllBytes(f)); }

  // ================= helpers =================
  /** The plan a student is paying for, if any. It must be theirs, for this course, and still waiting for payment. */
  CoursePlan planFor(User u,Course c,String raw){
    if(blank(raw)) return null;
    Long pid; try{ pid=Long.valueOf(raw.trim()); }catch(NumberFormatException e){ throw bad("This plan link is not valid."); }
    CoursePlan p=plans.findById(pid).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Plan not found"));
    if(!Objects.equals(p.studentId,u.id)||!Objects.equals(p.courseId,c.id)) throw forbidden();
    if(!CoursePlanController.canStart(p)) throw conflict("This plan is not open for payment. Ask your teacher to check it.");
    return p; }
  Payment find(String ref){ return payments.findByReference(ref).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Payment not found")); }
  void expireIfNeeded(Payment p){ if("AWAITING".equals(p.status)&&p.expiresAt!=null&&p.expiresAt.isBefore(LocalDateTime.now())){ p.status="EXPIRED"; p.rejectReason="Payment window expired"; payments.save(p); tellStudentExpired(p); } }
  static String htmlEsc(String s){ return s==null?"":s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;"); }
  static String csv(String s){ if(s==null) return ""; String v=s.replace("\"","\"\""); if(!v.isEmpty()&&"=+-@".indexOf(v.charAt(0))>=0) v="'"+v; /* block spreadsheet formula injection */ return "\""+v+"\""; }
  static String enc(String s){ return URLEncoder.encode(s,StandardCharsets.UTF_8).replace("+","%20"); }

  /** What the student's screen needs. Recipient and details come from the owner's PayAccount at this moment (so edits show up at once). */
  Map<String,Object> view(Payment p){
    PayAccount a=p.ownerId==null?new PayAccount():account(p.ownerId);
    Map<String,Object> m=new LinkedHashMap<>(); m.put("reference",p.reference); m.put("status",p.status); m.put("amount",p.amount); m.put("course",p.courseName); m.put("courseId",p.courseId);
    m.put("method",p.method); m.put("detail",p.detail); m.put("utr",p.utr); m.put("reason",p.rejectReason); m.put("displayStatus",p.getDisplayStatus());
    m.put("message","SUCCESS".equals(p.status)?"Payment approved. Welcome to the course!"
      :"PENDING_VERIFICATION".equals(p.status)?"Thank you. Your payment is being checked. Your course unlocks as soon as it is approved, and we will email you."
      :null);
    m.put("hasProof",p.proofFile!=null); m.put("proofSource",p.proofSource); m.put("proofAt",p.proofAt==null?null:p.proofAt.toString());
    m.put("payTo",p.ownerName); m.put("expiresAt",p.expiresAt==null?null:p.expiresAt.toString()); m.put("secondsLeft",p.expiresAt==null?null:Math.max(0,Duration.between(LocalDateTime.now(),p.expiresAt).getSeconds()));
    if("AWAITING".equals(p.status)){
      String upi=nz(a.upiId), payee=blank(a.payee)?nz(p.ownerName):a.payee; m.put("payee",payee); m.put("instructions",nz(a.instructions)); m.put("bankDetails",nz(a.bankDetails));
      String q=blank(upi)?"":"pa="+enc(upi)+"&pn="+enc(payee)+"&am="+p.amount+".00&cu=INR&tn="+enc("NLMed Study "+p.reference);
      if("QR".equals(p.method)){ m.put("upiId",upi); m.put("qrImage",a.qrImage); if(!q.isEmpty()) m.put("upiLink","upi://pay?"+q); }
      if("UPI".equals(p.method)){ m.put("upiId",upi); if(!q.isEmpty()) m.put("upiLink","upi://pay?"+q); }
      if("CARD".equals(p.method)){ m.put("cardProvider",nz(a.cardProvider));
        m.put("cardLink",nz(a.cardLink).replace("{amount}",String.valueOf(p.amount)).replace("{reference}",enc(p.reference)).replace("{course}",enc(nz(p.courseName)))); } }
    return m; }
}

/** One-time move of the old single (global) payment settings into the first teacher's account, so nothing is lost after upgrading. */
@Configuration class PayAccountMigration {
  @Bean CommandLineRunner migratePayAccounts(SettingRepo settings,PayQrRepo oldQr,PayAccountRepo accs,UserRepo users){ return x->{
    if(accs.count()>0) return;
    String upi=settings.findById("payUpiId").map(s->s.v==null?"":s.v).orElse("");
    String img=oldQr.findById("main").map(q->q.data).orElse(null);
    if(upi.isBlank()&&img==null) return;
    User owner=null; List<User> all=users.findAll();
    for(User u:all) if("TEACHER".equals(u.role)){ owner=u; break; }
    if(owner==null) for(User u:all) if("ADMIN".equals(u.role)){ owner=u; break; }
    if(owner==null) return;
    PayAccount a=new PayAccount(); a.userId=owner.id; a.upiId=upi; a.qrImage=img;
    a.payee=settings.findById("payPayee").map(s->s.v==null?"":s.v).orElse(""); a.instructions=settings.findById("payNote").map(s->s.v==null?"":s.v).orElse("");
    accs.save(a); }; }
}

/** One-time move: the old "waiting for approval" status is now PENDING_VERIFICATION. Old rows are updated once at startup. */
@Configuration class PaymentStatusMigration {
  @Bean CommandLineRunner renameVerificationStatus(PaymentRepo payments){ return x->{
    String old="PENDING_"+"APPROVAL", now="PENDING_"+"VERIFICATION";
    for(Payment p:payments.findAll()) if(old.equals(p.status)){ p.status=now; payments.save(p); } }; }
}
