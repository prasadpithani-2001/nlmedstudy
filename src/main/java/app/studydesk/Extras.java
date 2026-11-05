package app.studydesk;
import jakarta.persistence.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/* ===== Phase 5: contact details, payments (UPI / QR / Card), coupon check ===== */

/** Simple key/value settings (contact details are stored here so staff can edit them without a redeploy). */
@Entity class Setting { @Id @Column(name="k") public String k; @Column(name="v",length=1000) public String v; }
interface SettingRepo extends JpaRepository<Setting,String>{}

/** Message sent from the public Contact form. status: NEW | DONE */
@Entity class ContactMsg { @Id @GeneratedValue public Long id; public String name, email, mobile, status="NEW"; @Column(length=2000) public String message; public LocalDateTime at=LocalDateTime.now(); }
interface ContactMsgRepo extends JpaRepository<ContactMsg,Long>{}

/** One payment attempt. method: QR | UPI | CARD. status: AWAITING | PENDING | PENDING_VERIFICATION | SUCCESS | REJECTED/FAILED | CANCELLED | EXPIRED | REFUNDED. Card number / CVV are NEVER stored. */
@Entity class Payment { @Id @GeneratedValue public Long id; public Long userId, courseId; public String userName, userEmail, courseName, method, status, reference, detail;
  /** Status flow: AWAITING (order open) -> PENDING_VERIFICATION (student says paid, owner checks) -> SUCCESS | REJECTED | EXPIRED | CANCELLED. REFUNDED is set when money is returned. */
  public String utr, rejectReason, reviewedBy, coupon, ownerName; /** staff account the money was paid to */ public Long ownerId, planId; 
  /** Payment proof (screenshot): file name on disk, JPG/PNG/WEBP, who sent it (DEVICE or PHONE), when. Stored outside the public folders. */
  public String proofFile, proofType, proofSource; @com.fasterxml.jackson.annotation.JsonIgnore public String proofTokenHash; public LocalDateTime proofAt, proofTokenExpires; public Integer proofUploads; /** last time an upload link email was attempted */ public LocalDateTime emailSentAt;
  /** Verification step: NOT_SUBMITTED, PENDING_VERIFICATION, APPROVED, REJECTED, RESUBMISSION_REQUIRED. Kept apart from status (which also covers money states). */
  public String verification;
  /** Plans that start on a later date: that start date. The payment shows APPROVED until then. */
  public String accessStartsOn;
  /** Filled only for lists shown to staff: the plan's topic titles and dates. Not stored. */
  @Transient public String planTopics, planDates;
  public LocalDateTime reviewedAt, expiresAt, submittedAt;
  public int amount; public LocalDateTime at=LocalDateTime.now();
  /** What students and staff see, in one list of steps: NOT_SUBMITTED -> PENDING_VERIFICATION -> APPROVED -> COURSE_ACCESS_ACTIVE,
      or REJECTED -> RESUBMISSION_REQUIRED. Old rows without a verification value are read from their status. */
  public String getDisplayStatus(){
    String s=status==null?"":status;
    if("SUCCESS".equals(s)) return accessStartsOn!=null&&java.time.LocalDate.now().isBefore(java.time.LocalDate.parse(accessStartsOn))?"APPROVED":"COURSE_ACCESS_ACTIVE";   // approved; a later-starting plan shows APPROVED until its start date
    if(verification!=null) return verification;
    switch(s){ case "AWAITING": return "NOT_SUBMITTED"; case "PENDING_VERIFICATION": return "PENDING_VERIFICATION"; case "REJECTED": return "REJECTED"; default: return s; }
  } }
interface PaymentRepo extends JpaRepository<Payment,Long>{ List<Payment> findByUserId(Long u); Optional<Payment> findByReference(String r); Optional<Payment> findByProofTokenHash(String h); Optional<Payment> findFirstByUtrAndStatusIn(String utr,Collection<String> st); List<Payment> findByUtrAndStatusIn(String utr,Collection<String> st); List<Payment> findByUserIdAndCourseIdAndStatusIn(Long u,Long c,Collection<String> st); }

@RestController @RequestMapping("/api") class ExtrasController {
  static final Map<String,String> CONTACT_DEFAULTS=new LinkedHashMap<>();
  static { // PLACEHOLDERS - replace from Teacher dashboard > Contact details
    CONTACT_DEFAULTS.put("phone","+91 00000 00000"); CONTACT_DEFAULTS.put("whatsapp","");
    CONTACT_DEFAULTS.put("email","support@example.com"); CONTACT_DEFAULTS.put("address","Add your institute address, city, state, PIN");
    CONTACT_DEFAULTS.put("hours","Mon-Sat, 9:00 AM - 7:00 PM IST"); CONTACT_DEFAULTS.put("instagram",""); CONTACT_DEFAULTS.put("youtube","");
  }
  static final Set<String> METHODS=Set.of("QR","UPI","CARD");
  static final Pattern MOBILE=Pattern.compile("^[6-9]\\d{9}$"), UPI=Pattern.compile("^[a-zA-Z0-9.\\-_]{2,64}@[a-zA-Z]{2,32}$"), EMAIL=Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

  final Auth auth; final SettingRepo settings; final ContactMsgRepo msgs; final PaymentRepo payments; final CourseRepo courses; final EnrollRepo enrolls;
  final Map<String,Long> lastMsg=new ConcurrentHashMap<>();
  @Value("${pay.mode:demo}") String payMode;
  ExtrasController(Auth a,SettingRepo s,ContactMsgRepo m,PaymentRepo p,CourseRepo c,EnrollRepo e){auth=a;settings=s;msgs=m;payments=p;courses=c;enrolls=e;}

  User staff(String h){ User u=auth.need(h,null); if(!"TEACHER".equals(u.role)&&!"ADMIN".equals(u.role)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Staff access only"); return u; }
  static ResponseStatusException bad(String m){ return new ResponseStatusException(HttpStatus.BAD_REQUEST,m); }

  // ---------- contact details ----------
  @GetMapping("/contact-info") Map<String,String> contactInfo(){
    Map<String,String> out=new LinkedHashMap<>(CONTACT_DEFAULTS);
    for(String k:CONTACT_DEFAULTS.keySet()) settings.findById(k).ifPresent(s->{ if(s.v!=null) out.put(k,s.v); });
    return out; }
  @PutMapping("/admin/contact-info") Map<String,String> saveContact(@RequestHeader(value="Authorization",required=false) String h,@RequestBody Map<String,String> b){
    staff(h);
    for(String k:CONTACT_DEFAULTS.keySet()){ if(!b.containsKey(k)) continue; String v=b.get(k)==null?"":b.get(k).trim();
      if(v.length()>300) throw bad("'"+k+"' is too long");
      if(k.equals("whatsapp")){ v=v.replaceAll("\\D",""); if(!v.isEmpty()&&(v.length()<10||v.length()>15)) throw bad("WhatsApp number must be 10-15 digits with country code, e.g. 919876543210"); }
      if(k.equals("email")&&!v.isEmpty()&&!EMAIL.matcher(v).matches()) throw bad("Enter a valid email address");
      if((k.equals("instagram")||k.equals("youtube"))&&!v.isEmpty()&&!v.startsWith("https://")) throw bad("Social links must start with https://");
      Setting s=settings.findById(k).orElseGet(Setting::new); s.k=k; s.v=v; settings.save(s); }
    return contactInfo(); }
  @PostMapping("/contact") Map<String,Object> contact(@RequestBody Map<String,String> b){
    String name=str(b,"name"), email=str(b,"email"), msg=str(b,"message"), mobile=str(b,"mobile");
    if(name.isEmpty()||msg.isEmpty()) throw bad("Please enter your name and message");
    if(!EMAIL.matcher(email).matches()) throw bad("Enter a valid email so we can reply");
    if(msg.length()>2000||name.length()>100) throw bad("Your message is too long");
    long now=System.currentTimeMillis(); Long prev=lastMsg.put(email.toLowerCase(),now);
    if(prev!=null&&now-prev<20_000) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Please wait a few seconds before sending another message");
    ContactMsg m=new ContactMsg(); m.name=name; m.email=email; m.mobile=mobile; m.message=msg; msgs.save(m);
    return Map.of("message","Thanks "+name+"! We have received your message and will reply soon."); }
  @GetMapping("/admin/contact-messages") List<ContactMsg> inbox(@RequestHeader(value="Authorization",required=false) String h){ staff(h); List<ContactMsg> l=new ArrayList<>(msgs.findAll()); l.sort((x,y)->Long.compare(y.id,x.id)); return l; }
  @PutMapping("/admin/contact-messages/{id}/status") ContactMsg inboxStatus(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id,@RequestBody Map<String,String> b){
    staff(h); String s=b.get("status"); if(!"NEW".equals(s)&&!"DONE".equals(s)) throw bad("Unknown status");
    ContactMsg m=msgs.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Message not found")); m.status=s; return msgs.save(m); }

  // ---------- coupon + payment ----------
  static int percent(String code){ return "WELCOME10".equalsIgnoreCase(code==null?"":code.trim())?10:0; }
  // GET /api/coupon moved to CouponController (Coupons.java): general, per-student and entrance-exam coupons
  @GetMapping("/my/payments") List<Payment> myPayments(@RequestHeader(value="Authorization",required=false) String h){ List<Payment> l=new ArrayList<>(payments.findByUserId(auth.need(h,null).id)); l.sort((x,y)->Long.compare(y.id,x.id)); return l; }
  @GetMapping("/admin/payment-log") List<Payment> paymentLog(@RequestHeader(value="Authorization",required=false) String h){ User st=staff(h); /* payment records: admin + teacher only; a teacher sees only their own */ List<Payment> l=new ArrayList<>(payments.findAll()); l.removeIf(p->!QrPaymentController.mine(st,p)); l.sort((x,y)->Long.compare(y.id,x.id)); return l; }

  static String str(Map<String,String> b,String k){ String v=b.get(k); return v==null?"":v.trim(); }
  static String digits(String s){ return s==null?"":s.replaceAll("\\D",""); }
  static boolean luhn(String n){ int sum=0; boolean alt=false; for(int i=n.length()-1;i>=0;i--){ int d=n.charAt(i)-'0'; if(alt){ d*=2; if(d>9) d-=9; } sum+=d; alt=!alt; } return sum%10==0; }
}
