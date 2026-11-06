package app.studydesk;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.stereotype.Component;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Component class Auth {
  final UserRepo users; final BCryptPasswordEncoder enc=new BCryptPasswordEncoder();
  Auth(UserRepo u){users=u;}
  User need(String h,String role){
    if(h==null||!h.startsWith("Bearer ")) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Log in first");
    User u=users.findByToken(h.substring(7)).orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Session expired"));
    if(role!=null&&!role.equals(u.role)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Teacher access only");
    return u; }
  /** Session for URLs that cannot send headers (<img>, <video>, <iframe>): Authorization header first, else ?token=. */
  User viewer(String h,String token){
    if(h!=null&&h.startsWith("Bearer ")) return need(h,null);
    if(token==null||token.isBlank()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Log in first");
    return users.findByToken(token).orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Session expired")); }
  /** Course management screens: TEACHER or ADMIN. */
  User teach(String h){ User u=need(h,null); if(!"TEACHER".equals(u.role)&&!"ADMIN".equals(u.role)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Teacher or admin access only"); return u; }
  /** Admin manages every course; a teacher only their own (old courses without an owner stay open to teachers). */
  boolean manages(User u,Course c){ return "ADMIN".equals(u.role)||c.ownerId==null||u.id.equals(c.ownerId); }
  Course managed(String h,Long courseId,CourseRepo courses){ User u=teach(h); Course c=courses.findById(courseId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Course not found"));
    if(!manages(u,c)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"This course belongs to another teacher"); return c; }
  /** Payments & money screens: ADMIN or TEACHER only. */
  User staff(String h){ User u=need(h,null); if(!"ADMIN".equals(u.role)&&!"TEACHER".equals(u.role)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only admin and teacher can access payments"); return u; }
}

@RestController @RequestMapping("/api/auth") class AuthController {
  final UserRepo users; final Auth auth; final Mailer mail; AuthController(UserRepo u,Auth a,Mailer m){users=u;auth=a;mail=m;}
  /** Welcome email to a new student. Sent in the background: a mail problem never blocks signing up. */
  void welcome(User u){
    String link=mail.url("/dashboard"); String name=u.name==null||u.name.isBlank()?"there":u.name;
    mail.send(u.email,"Welcome to NLMed Study",
      Mailer.layout("Welcome, "+Mailer.esc(name)+"!","<p>Thank you for joining NLMed Study. We are delighted to have you with us.</p><p>From your dashboard you can browse courses, book demo sessions and practise for entrance exams, all at your own pace.</p><p>You can sign in at any time with this email address.</p>","Open my dashboard",link),
      "Hello "+name+", thank you for joining NLMed Study. We are delighted to have you with us. Open your dashboard whenever you are ready: "+link);
  }
  @PostMapping("/register") Map<String,Object> register(@RequestBody Map<String,String> b){
    if(b.get("password")==null||b.get("password").length()<8) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Password must be at least 8 characters");
    if(b.get("email")==null||!ExtrasController.EMAIL.matcher(b.get("email").trim()).matches()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enter a valid email address");
    if(users.findByEmail(b.get("email")).isPresent()) throw new ResponseStatusException(HttpStatus.CONFLICT,"Email already registered");
    User u=new User(); u.createdAt=LocalDateTime.now(); u.name=b.get("name"); u.email=b.get("email"); u.passwordHash=auth.enc.encode(b.get("password")); Map<String,Object> s=session(u); welcome(u); return s; }
  @PostMapping("/login") Map<String,Object> login(@RequestBody Map<String,String> b){
    User u=users.findByEmail(b.get("email")).filter(x->auth.enc.matches(b.get("password"),x.passwordHash))
      .orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Email or password is incorrect")); return session(u); }
  Map<String,Object> session(User u){ u.token=UUID.randomUUID().toString(); users.save(u); return Map.of("token",u.token,"role",u.role,"name",u.name,"id",u.id); }
}

@RestController @RequestMapping("/api") class StudyController {
  final Auth auth; final CourseRepo courses; final DemoRepo demos; final DemoRegRepo regs; final EnrollRepo enrolls;
  final DoubtRepo doubts; final QuestionRepo questions; final AttemptRepo attempts; final UserRepo users; final Mailer mail;
  StudyController(Auth a,CourseRepo c,DemoRepo d,DemoRegRepo r,EnrollRepo e,DoubtRepo db,QuestionRepo q,AttemptRepo at,UserRepo u,Mailer m){
    auth=a;courses=c;demos=d;regs=r;enrolls=e;doubts=db;questions=q;attempts=at;users=u;mail=m;}

  // ---- public ----
  @GetMapping("/courses") List<Course> courses(){ return courses.findAll(); }
  @GetMapping("/demos") List<Map<String,Object>> demos(){
    List<Map<String,Object>> out=new ArrayList<>();
    for(Demo d:demos.findAll()) out.add(Map.of("id",d.id,"title",d.title,"topic",d.topic,"startsAt",d.startsAt.toString(),
      "seatsTaken",regs.countByDemoId(d.id),"maxSeats",d.maxSeats)); return out; }
  @PostMapping("/demos/{id}/register") Map<String,Object> reserve(@PathVariable Long id,@RequestBody Map<String,String> b){
    Demo d=demos.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Demo not found"));
    if(regs.countByDemoId(id)>=d.maxSeats) throw new ResponseStatusException(HttpStatus.CONFLICT,"This demo is full");
    DemoReg r=new DemoReg(); r.demoId=id; r.name=b.get("name"); r.email=b.get("email"); r.mobile=b.get("mobile"); r.education=b.get("education"); regs.save(r);
    Reminders.confirm(mail,d,r);   // booking confirmation now; reminder about an hour before the session (see Reminders)
    return Map.of("message","Your free demo seat is reserved.","topic",d.topic,"startsAt",d.startsAt.toString(),"joinLink",d.meetingLink); }

  // ---- student ----
  @PostMapping("/courses/{id}/enroll") Map<String,Object> enroll(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id,@RequestBody Map<String,String> b){
    User u=auth.need(h,null); Course c=courses.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Course not found"));
    if(enrolls.existsByUserIdAndCourseId(u.id,id)) throw new ResponseStatusException(HttpStatus.CONFLICT,"Already enrolled");
    int off="WELCOME10".equalsIgnoreCase(b.get("coupon"))?c.price/10:0;
    if(c.price-off>0) throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED,"Please complete payment at checkout"); // paid courses go through /courses/{id}/checkout
    Enrollment e=new Enrollment(); e.userId=u.id; e.courseId=id; e.paid=c.price-off; enrolls.save(e); mail.enrolled(u,c,e.paid,null);
    return Map.of("message","Welcome to the course!","paid",e.paid,"unlocked",List.of("Live Classes","Notes","Resources","Assessments","Doubt Support")); }
  @GetMapping("/my/courses") List<Enrollment> mine(@RequestHeader(value="Authorization",required=false) String h){ return enrolls.findByUserId(auth.need(h,null).id); }
  @PostMapping("/doubts") Doubt doubt(@RequestHeader(value="Authorization",required=false) String h,@RequestBody Map<String,String> b){
    if(b.get("text")==null||b.get("text").isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Write your question first");
    Doubt d=new Doubt(); User du=auth.need(h,null); d.userId=du.id; d.userName=du.name; d.courseId=Long.valueOf(b.getOrDefault("courseId","1")); d.category=b.get("category"); d.text=b.get("text"); return doubts.save(d); }
  @GetMapping("/my/doubts") List<Doubt> myDoubts(@RequestHeader(value="Authorization",required=false) String h){ return doubts.findByUserId(auth.need(h,null).id); }
  @GetMapping("/assessments/{courseId}/questions") List<Map<String,Object>> qs(@PathVariable Long courseId){
    List<Map<String,Object>> out=new ArrayList<>();
    for(Question q:questions.findByCourseId(courseId)) out.add(Map.of("id",q.id,"topic",q.topic,"text",q.text,"options",q.options.split("\\|"))); return out; }
  @PostMapping("/assessments/{courseId}/submit") Map<String,Object> submit(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long courseId,@RequestBody Map<String,Integer> answers){
    User u=auth.need(h,null); ProctorGuard.requireCamera("assess-"+courseId,u.id); int ok=0,bad=0,skip=0; Map<String,int[]> byTopic=new TreeMap<>();
    for(Question q:questions.findByCourseId(courseId)){ Integer a=answers.get(String.valueOf(q.id)); int[] t=byTopic.computeIfAbsent(q.topic,k->new int[2]); t[1]++;
      if(a==null) skip++; else if(a==q.correct){ok++;t[0]++;} else bad++; }
    Attempt at=new Attempt(); at.userId=u.id; at.courseId=courseId; at.correct=ok; at.total=ok+bad+skip; attempts.save(at);
    Map<String,Integer> weak=new TreeMap<>(); byTopic.forEach((k,v)->weak.put(k,v[1]==0?0:v[0]*100/v[1]));
    return Map.of("correct",ok,"incorrect",bad,"skipped",skip,"percentage",at.total==0?0:ok*100/at.total,"topicScores",weak); }
  @GetMapping("/my/progress") Map<String,Object> progress(@RequestHeader(value="Authorization",required=false) String h){
    List<Attempt> a=attempts.findByUserId(auth.need(h,null).id);
    double avg=a.stream().mapToDouble(x->x.total==0?0:x.correct*100.0/x.total).average().orElse(0);
    return Map.of("assessmentsCompleted",a.size(),"averageScore",Math.round(avg)); }

  // ---- teacher / admin ----
  Set<Long> managedIds(User st){ return courses.findAll().stream().filter(c->auth.manages(st,c)).map(c->c.id).collect(Collectors.toSet()); }
  @GetMapping("/admin/stats") Map<String,Object> stats(@RequestHeader(value="Authorization",required=false) String h){
    User st=auth.teach(h); Set<Long> mine=managedIds(st);
    List<Enrollment> en=enrolls.findAll().stream().filter(e->mine.contains(e.courseId)).collect(Collectors.toList());
    int revenue=en.stream().mapToInt(e->e.paid).sum();
    return Map.of("students",en.stream().map(e->e.userId).distinct().count(),"demoRegistrations",regs.count(),"paidStudents",en.stream().filter(e->e.paid>0).map(e->e.userId).distinct().count(),"revenue",revenue,
      "pendingDoubts",doubts.findAll().stream().filter(d->"PENDING".equals(d.status)&&mine.contains(d.courseId)).count()); }
  @PutMapping("/admin/courses/{id}/price") Course price(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id,@RequestBody Map<String,Integer> b){
    Course c=auth.managed(h,id,courses); Integer p=b.get("price");
    if(p==null||p<0||p>1_000_000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enter a price between 0 and 10,00,000");
    c.price=p;
    if(b.containsKey("listPrice")){ Integer lp=b.get("listPrice"); if(lp!=null&&(lp<0||lp>1_000_000)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Original price must be between 0 and 10,00,000"); c.listPrice=(lp==null||lp<=p)?null:lp; }
    return courses.save(c); }
  @PostMapping("/admin/demos") Demo newDemo(@RequestHeader(value="Authorization",required=false) String h,@RequestBody Map<String,String> b){
    auth.teach(h); Demo d=new Demo(); d.title=blankTo(b.get("title"),"FREE DEMO"); d.topic=b.get("topic"); d.meetingLink=b.get("meetingLink");
    if(d.topic==null||d.topic.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enter the demo topic");
    try{ d.startsAt=LocalDateTime.parse(b.get("startsAt")); }catch(Exception e){ throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Pick a valid date and time"); }
    try{ d.maxSeats=Integer.parseInt(b.getOrDefault("maxSeats","50")); }catch(NumberFormatException e){ throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Seats must be a number"); }
    if(d.maxSeats<1||d.maxSeats>1000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Seats must be between 1 and 1000");
    return demos.save(d); }
  static String blankTo(String s,String d){ return s==null||s.isBlank()?d:s.trim(); }
  @GetMapping("/admin/doubts") List<Doubt> allDoubts(@RequestHeader(value="Authorization",required=false) String h){ User st=auth.teach(h); Set<Long> mine=managedIds(st); return doubts.findAll().stream().filter(d->mine.contains(d.courseId)).collect(Collectors.toList()); }
  @PutMapping("/admin/doubts/{id}/status") Doubt mark(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id,@RequestBody Map<String,String> b){
    User st=auth.teach(h); Doubt d=doubts.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Doubt not found"));
    if(!managedIds(st).contains(d.courseId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"This doubt belongs to another teacher's course");
    if(!Set.of("ANSWERED","PENDING","IMPORTANT").contains(b.get("status"))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown status");
    d.status=b.get("status"); return doubts.save(d); } // ANSWERED | PENDING | IMPORTANT
}

@Configuration class Seed {
  @Bean CommandLineRunner run(UserRepo u,CourseRepo c,DemoRepo d,QuestionRepo q,Auth a,TopicRepo tp){ return x->{
    if(c.count()>0||u.findByEmail("teacher@studydesk.app").isPresent()) return;   // seed once only (safe with a persistent MySQL database)
    User t=new User(); t.name="Dr. Naga Lakshmi"; t.email="teacher@studydesk.app"; t.passwordHash=a.enc.encode("teacher123"); t.role="TEACHER"; u.save(t);
    String[][] cs={{"Complete Cardiology","Cardiology","24","18","12","4999"},{"Respiratory System Masterclass","Physiology","20","14","10","3999"},
      {"Clinical Anatomy","Anatomy","30","26","15","5499"},{"Pharmacology Essentials","Pharmacology","18","12","9","3499"},{"Pathology High-Yield Revision","Pathology","16","16","14","3999"}};
    for(String[] r:cs){ Course k=new Course(); k.name=r[0]; k.subject=r[1]; k.teacher="Dr. Naga Lakshmi"; k.liveClasses=Integer.parseInt(r[2]); k.notes=Integer.parseInt(r[3]); k.assessments=Integer.parseInt(r[4]); k.price=Integer.parseInt(r[5]); k.ownerId=t.id; k.listPrice=(int)(Math.round(k.price*1.3/100.0)*100); c.save(k); int pos=1; for(String tt:new String[]{"Introduction","Core Concepts","Clinical Cases","Revision"}){ Topic t1=new Topic(); t1.courseId=k.id; t1.title=tt; t1.position=pos++; tp.save(t1); } }
    Demo e=new Demo(); e.title="FREE DEMO"; e.topic="Cardiovascular System — Introduction"; e.startsAt=LocalDateTime.now().plusDays(3).withHour(19).withMinute(0); e.meetingLink="https://meet.example.com/cardio-intro"; d.save(e);
    Object[][] qs={{"Anatomy","Which artery supplies the SA node in most people?","Right coronary artery|Left anterior descending|Left circumflex|Posterior descending",0},
      {"Pathology","ST elevation in II, III and aVF suggests infarction of which wall?","Anterior|Inferior|Lateral|Posterior",1},
      {"Physiology","Which phase of the cardiac cycle has all four valves closed?","Ventricular ejection|Isovolumetric contraction|Atrial systole|Rapid filling",1}};
    for(Object[] r:qs){ Question n=new Question(); n.courseId=1L; n.topic=(String)r[0]; n.text=(String)r[1]; n.options=(String)r[2]; n.correct=(Integer)r[3]; q.save(n); } }; }
}
