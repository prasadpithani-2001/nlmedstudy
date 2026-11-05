package app.studydesk;
import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/* Admins and teachers write to any address with the email editor.
   Email types: built-in ones (EmailTemplates) and ones an admin saved (MailTemplate). Bodies are HTML, cleaned before use.
   Placeholders such as {{studentName}} are filled from records or typed in; values are escaped before they go into the HTML.
   Anything still empty blocks the send. Every send is recorded with the sender and type. At most 30 emails an hour per staff member. */
@RestController @RequestMapping("/api") class StaffMailController {
  static final int MAX_SUBJECT=150, MAX_BODY=20000, MAX_PER_HOUR=30;
  static final Map<Long,List<Long>> RECENT=new ConcurrentHashMap<>();
  static final DateTimeFormatter DAY=DateTimeFormatter.ofPattern("d MMM yyyy");
  static final DateTimeFormatter LONG_DAY=DateTimeFormatter.ofPattern("d MMMM yyyy");
  static final Pattern EMAIL=Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");
  static final Pattern CUSTOM_KEY=Pattern.compile("^T\\d{1,12}$");
  /** What may appear in an email body: basic formatting, headings, links. Scripts, styles and images are removed. */
  static final Safelist SAFE=Safelist.basic().addTags("h2","h3","h4");

  final Auth auth; final UserRepo users; final CourseRepo courses; final EnrollRepo enrolls; final PaymentRepo payments; final CoursePlanRepo plans; final EmailLogRepo logs; final MailTemplateRepo saved; final Mailer mail;
  StaffMailController(Auth a,UserRepo u,CourseRepo c,EnrollRepo e,PaymentRepo p,CoursePlanRepo pl,EmailLogRepo l,MailTemplateRepo mt,Mailer m){
    auth=a; users=u; courses=c; enrolls=e; payments=p; plans=pl; logs=l; saved=mt; mail=m; }

  static ResponseStatusException bad(String m){ return new ResponseStatusException(HttpStatus.BAD_REQUEST,m); }
  static ResponseStatusException forbidden(String m){ return new ResponseStatusException(HttpStatus.FORBIDDEN,m); }
  static String text(Object o){ return o==null?"":String.valueOf(o).trim(); }
  static String nz(String s){ return s==null?"":s; }

  /** One email type, built-in or saved. body is HTML. */
  static final class Tpl {
    final String key, label, audience, heading, subject, body; final boolean needsPayment, builtIn;
    Tpl(String k,String l,String a,boolean np,String h,String s,String b,boolean bi){ key=k; label=l; audience=a; needsPayment=np; heading=h; subject=s; body=b; builtIn=bi; }
  }
  static Tpl builtIn(EmailTemplates.T t){ return new Tpl(t.key,t.label,t.audience,t.needsPayment,t.heading,t.subject,EmailTemplates.html(t.body),true); }
  Tpl resolve(String key){
    EmailTemplates.T t=EmailTemplates.byKey(key);
    if(t!=null) return builtIn(t);
    if(CUSTOM_KEY.matcher(key).matches()){
      MailTemplate m=saved.findById(Long.valueOf(key.substring(1))).orElse(null);
      if(m!=null) return new Tpl("T"+m.id,nz(m.label),nz(m.audience),m.needsPayment,nz(m.heading),nz(m.subject),nz(m.bodyHtml),false);
    }
    return null;
  }

  /** The registered user with this address, or null when no account uses it. The address must be valid. */
  User registeredUser(String email){
    String e=text(email);
    if(!EMAIL.matcher(e).matches()) throw bad("Enter a valid email address, for example name@example.com");
    Optional<User> u=users.findByEmail(e.toLowerCase());
    if(u.isEmpty()) u=users.findByEmail(e);
    return u.orElse(null);
  }
  /** Admins see every payment; a teacher sees only payments made to them. */
  static boolean visibleTo(User st,Payment p){ return "ADMIN".equals(st.role)||Objects.equals(p.ownerId,st.id); }

  @GetMapping("/staff/email-recipients") List<Map<String,Object>> recipients(@RequestHeader(value="Authorization",required=false) String h){
    auth.staff(h);
    List<Map<String,Object>> out=new ArrayList<>();
    for(User u:users.findAll()){
      if(u.email==null||u.email.isBlank()) continue;
      Map<String,Object> m=new LinkedHashMap<>(); m.put("id",u.id); m.put("name",nz(u.name)); m.put("email",u.email); m.put("role",nz(u.role)); out.add(m);
    }
    out.sort((x,y)->String.valueOf(x.get("name")).compareToIgnoreCase(String.valueOf(y.get("name"))));
    return out;
  }

  /** Courses the editor can use: all for an admin, only the teacher's own for a teacher. */
  @GetMapping("/staff/email-courses") List<Map<String,Object>> emailCourses(@RequestHeader(value="Authorization",required=false) String h){
    User st=auth.staff(h);
    List<Map<String,Object>> out=new ArrayList<>();
    for(Course c:courses.findAll()){
      if(!"ADMIN".equals(st.role)&&!Objects.equals(c.ownerId,st.id)) continue;
      Map<String,Object> m=new LinkedHashMap<>(); m.put("id",c.id); m.put("name",nz(c.name)); m.put("price",c.price); out.add(m);
    }
    out.sort((x,y)->String.valueOf(x.get("name")).compareToIgnoreCase(String.valueOf(y.get("name"))));
    return out;
  }

  /** Email types for this person: built-in and saved. Admin-only types are not shown to teachers. */
  @GetMapping("/staff/email-templates") List<Map<String,Object>> templates(@RequestHeader(value="Authorization",required=false) String h){
    User st=auth.staff(h);
    List<Tpl> all=new ArrayList<>();
    for(EmailTemplates.T t:EmailTemplates.forRole(st.role)) all.add(builtIn(t));
    for(MailTemplate m:saved.findAll()){
      Tpl t=resolve("T"+m.id);
      if(t!=null&&("ALL".equals(t.audience)||"ADMIN".equals(st.role))) all.add(t);
    }
    List<Map<String,Object>> out=new ArrayList<>();
    for(Tpl t:all){
      Map<String,Object> m=new LinkedHashMap<>(); m.put("key",t.key); m.put("label",t.label); m.put("needsPayment",t.needsPayment);
      m.put("heading",t.heading); m.put("subject",t.subject); m.put("body",t.body); m.put("builtIn",t.builtIn); m.put("audience",t.audience);
      out.add(m);
    }
    return out;
  }

  /** Admin: save the editor's current message as a new email type (or update one). */
  @PostMapping("/admin/email-templates") Map<String,Object> saveType(@RequestHeader(value="Authorization",required=false) String h,@RequestBody Map<String,Object> b){
    User st=auth.need(h,"ADMIN");
    String label=text(b.get("label"));
    if(label.isEmpty()||label.length()>80) throw bad("Give the email type a name (up to 80 characters).");
    String audience="ADMIN".equalsIgnoreCase(text(b.get("audience")))?"ADMIN":"ALL";
    String subject=text(b.get("subject"));
    if(subject.isEmpty()||subject.length()>MAX_SUBJECT) throw bad("Enter a subject (up to "+MAX_SUBJECT+" characters).");
    String heading=text(b.get("heading")); if(heading.isEmpty()) heading=label;
    if(heading.length()>150) throw bad("The heading is too long (up to 150 characters).");
    String body=Jsoup.clean(text(b.get("body")),SAFE);
    if(body.isBlank()) throw bad("Write the message before saving the email type.");
    if(body.length()>MAX_BODY) throw bad("The message is too long (up to "+MAX_BODY+" characters).");
    MailTemplate m;
    String id=text(b.get("id"));
    if(!id.isEmpty()){ try{ m=saved.findById(Long.valueOf(id)).orElseThrow(()->bad("That email type no longer exists.")); }catch(NumberFormatException ex){ throw bad("That email type could not be found."); } }
    else { m=new MailTemplate(); m.createdBy=nz(st.name); }
    m.label=label; m.audience=audience; m.needsPayment=Boolean.TRUE.equals(b.get("needsPayment"));
    m.subject=subject; m.heading=heading; m.bodyHtml=body; m.updatedAt=java.time.LocalDateTime.now();
    saved.save(m);
    Map<String,Object> out=new LinkedHashMap<>(); out.put("key","T"+m.id); out.put("id",m.id); return out;
  }

  /** Admin: delete a saved email type. Built-in types cannot be deleted. */
  @DeleteMapping("/admin/email-templates/{id}") Map<String,Object> deleteType(@RequestHeader(value="Authorization",required=false) String h,@PathVariable Long id){
    auth.need(h,"ADMIN");
    if(!saved.existsById(id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"That email type no longer exists.");
    saved.deleteById(id);
    return Map.of("ok",true);
  }

  /** Details for the composer. A registered user gets their courses and the payments this person may see. */
  @GetMapping("/staff/email-student") Map<String,Object> studentInfo(@RequestHeader(value="Authorization",required=false) String h,@RequestParam(required=false) String email){
    User st=auth.staff(h);
    User to=registeredUser(email);
    Map<String,Object> m=new LinkedHashMap<>();
    m.put("registered",to!=null); m.put("email",text(email));
    if(to==null){ m.put("name",""); m.put("courses",new ArrayList<>()); m.put("payments",new ArrayList<>()); return m; }
    m.put("name",nz(to.name)); m.put("role",nz(to.role));
    List<Map<String,Object>> cs=new ArrayList<>();
    for(Enrollment e:enrolls.findAll()) if(Objects.equals(e.userId,to.id)) courses.findById(e.courseId).ifPresent(c->{ Map<String,Object> x=new LinkedHashMap<>(); x.put("id",c.id); x.put("name",nz(c.name)); cs.add(x); });
    m.put("courses",cs);
    List<Payment> ps=new ArrayList<>();
    for(Payment p:payments.findAll()) if(Objects.equals(p.userId,to.id)&&visibleTo(st,p)) ps.add(p);
    ps.sort((x,y)->Long.compare(y.id,x.id));
    List<Map<String,Object>> pl=new ArrayList<>();
    for(Payment p:ps){ Map<String,Object> x=new LinkedHashMap<>(); x.put("id",p.id); x.put("reference",nz(p.reference)); x.put("amount",p.amount); x.put("courseName",nz(p.courseName)); x.put("courseId",p.courseId); x.put("status",p.getDisplayStatus()); x.put("transactionId",p.utr); x.put("at",p.at==null?null:p.at.toLocalDate().format(DAY)); pl.add(x); }
    m.put("payments",pl);
    return m;
  }

  static final class Built { String subject, heading, html, plain, recipientEmail; final Set<String> missing=new LinkedHashSet<>(); Tpl template; Map<String,String> vars; }

  /** Fills the email for one address. Preview and send both use this, so the preview is exactly what is sent. */
  Built build(User st,Map<String,Object> b){
    String address=text(b.get("studentEmail"));
    User to=registeredUser(address);
    String key=text(b.get("template")); if(key.isEmpty()) key="CUSTOM";
    Tpl t=resolve(key); if(t==null) throw bad("Choose an email type");
    if("ADMIN".equals(t.audience)&&!"ADMIN".equals(st.role)) throw forbidden("Only admins can send this email type.");
    @SuppressWarnings("unchecked")
    Map<String,Object> typed=b.get("vars") instanceof Map ? (Map<String,Object>) b.get("vars") : Collections.<String,Object>emptyMap();

    Payment p=null; String pid=text(b.get("paymentId"));
    if(!pid.isEmpty()){
      if(to==null) throw bad("Payment records belong to registered users. Clear the payment choice for this address.");
      try{ p=payments.findById(Long.valueOf(pid)).orElse(null); }catch(NumberFormatException ex){ p=null; }
      if(p==null||!Objects.equals(p.userId,to.id)||!visibleTo(st,p)) throw bad("That payment record could not be found for this person.");
    } else if(t.needsPayment&&to!=null){
      Payment best=null;
      for(Payment x:payments.findAll()) if(Objects.equals(x.userId,to.id)&&visibleTo(st,x)&&(best==null||x.id>best.id)) best=x;
      p=best;
    }

    Course chosen=null; String cid=text(b.get("courseId"));
    if(!cid.isEmpty()){
      try{ chosen=courses.findById(Long.valueOf(cid)).orElse(null); }catch(NumberFormatException ex){ chosen=null; }
      if(chosen==null) throw bad("That course could not be found.");
      if(!"ADMIN".equals(st.role)&&!Objects.equals(chosen.ownerId,st.id)) throw forbidden("You can only use courses you teach.");
      if(p!=null&&!Objects.equals(p.courseId,chosen.id)) throw bad("The selected payment is for a different course. Choose that payment, or a different course.");
    }

    Map<String,String> vars=new LinkedHashMap<>();
    String site=Mailer.SITE.endsWith("/")?Mailer.SITE.substring(0,Mailer.SITE.length()-1):Mailer.SITE;
    String typedName=text(typed.get("recipientName"));
    String name=to!=null?(to.name==null||to.name.isBlank()?"":to.name):typedName;
    if(!name.isEmpty()) vars.put("studentName",name);
    vars.put("studentEmail",address); vars.put("platformName","NLMed Study"); vars.put("siteUrl",site);
    if(to!=null&&to.createdAt!=null) vars.put("registrationDate",to.createdAt.toLocalDate().format(LONG_DAY));
    Course c=chosen;
    if(p!=null){
      if(c==null) c=courses.findById(p.courseId).orElse(null);
      vars.put("amount",String.valueOf(p.amount)); vars.put("reference",nz(p.reference));
      vars.put("transactionId",p.utr==null||p.utr.isBlank()?"Not entered by the student":p.utr);
      vars.put("paymentStatus",statusLabel(p.getDisplayStatus()));
      if(p.rejectReason!=null&&!p.rejectReason.isBlank()) vars.put("rejectReason",p.rejectReason);
      if(p.ownerId!=null) users.findById(p.ownerId).ifPresent(o->vars.put("teacherName",nz(o.name)));
      if(p.planId!=null) plans.findById(p.planId).ifPresent(pl->{ if(pl.startsOn!=null) vars.put("courseStartDate",pl.startsOn.format(DAY)); });
    }
    if(c==null&&p==null&&to!=null){
      for(Enrollment e:enrolls.findAll()) if(Objects.equals(e.userId,to.id)){ c=courses.findById(e.courseId).orElse(null); if(c!=null) break; }
    }
    if(c!=null){
      final Course cc=c;
      vars.put("courseName",nz(cc.name)); vars.put("courseLink",site+"/#/learn/"+cc.id);
      if(!vars.containsKey("teacherName")&&cc.ownerId!=null) users.findById(cc.ownerId).ifPresent(o->vars.put("teacherName",nz(o.name)));
      if(!vars.containsKey("courseStartDate")&&to!=null) enrolls.findAll().forEach(e->{ if(Objects.equals(e.userId,to.id)&&Objects.equals(e.courseId,cc.id)&&e.at!=null) vars.put("courseStartDate",e.at.toLocalDate().format(DAY)); });
    }
    if(p==null&&c!=null) vars.put("amount",String.valueOf(c.price));   // no payment: the course fee

    // typed values fill in or replace; payment facts come only from the payment record
    for(Map.Entry<String,Object> en:typed.entrySet()){
      String k=en.getKey(); if(k==null||!k.matches("[a-zA-Z][a-zA-Z0-9_]{0,39}")) continue;
      if(p!=null&&("transactionId".equals(k)||"reference".equals(k)||"paymentStatus".equals(k))) continue;
      String v=text(en.getValue()); if(v.isEmpty()) continue;
      vars.put(k,v.length()>300?v.substring(0,300):v);
    }
    if(p==null&&vars.containsKey("paymentStatus")){
      String ps=vars.get("paymentStatus").toLowerCase();
      if(ps.contains("paid")||ps.contains("approv")) throw bad("A paid or approved status needs a payment record that shows it. Choose the payment, or use Pending or Rejected.");
    }
    if(vars.containsKey("recipientName")&&!vars.containsKey("studentName")) vars.put("studentName",vars.get("recipientName"));

    // values go into the HTML escaped, so a name such as "A & B" stays readable
    Map<String,String> escaped=new LinkedHashMap<>();
    for(Map.Entry<String,String> en:vars.entrySet()) escaped.put(en.getKey(),Mailer.esc(en.getValue()));

    Built r=new Built(); r.recipientEmail=address; r.template=t; r.vars=vars;
    String subject=text(b.get("subject")); if(subject.isEmpty()) subject=t.subject;
    String message=text(b.get("message")); if(message.isEmpty()) message=t.body;
    if(subject.length()>MAX_SUBJECT) throw bad("The subject is too long (up to "+MAX_SUBJECT+" characters).");
    if(message.length()>MAX_BODY) throw bad("The message is too long (up to "+MAX_BODY+" characters).");
    r.subject=EmailTemplates.fill(subject,vars,r.missing);
    r.heading=EmailTemplates.fill(t.heading,vars,r.missing);
    String body=EmailTemplates.fill(Jsoup.clean(message,SAFE),escaped,r.missing);
    if(!r.missing.isEmpty()) return r;   // nothing is built while anything is still empty

    String role="ADMIN".equals(st.role)?"NLMed Study administration":"your teacher";
    String footer="This message was sent to you by "+nz(st.name)+" from "+role+" at NLMed Study. If you have questions, reply to our support team.";
    String greeting="Hello "+vars.getOrDefault("studentName","there")+",";
    r.html=Mailer.layout(Mailer.esc(r.heading),"<p style=\"margin:0 0 16px\">"+Mailer.esc(greeting)+"</p>"+body
      +"<p style=\"color:#64748b;font-size:13px\">"+Mailer.esc(footer)+"</p>",null,null);
    r.plain=greeting+"\n\n"+Jsoup.parse(body).text()+"\n\n"+footer;
    return r;
  }

  static String statusLabel(String s){
    switch(nz(s)){
      case "NOT_SUBMITTED": return "Not submitted";
      case "PENDING_VERIFICATION": return "Submitted, awaiting approval";
      case "APPROVED": return "Approved";
      case "COURSE_ACCESS_ACTIVE": return "Approved, course access active";
      case "REJECTED": return "Rejected";
      case "RESUBMISSION_REQUIRED": return "Resubmission required";
      case "EXPIRED": return "Expired";
      case "CANCELLED": return "Cancelled";
      default: return nz(s);
    }
  }

  /** Shows exactly what the recipient will receive. Nothing is sent or recorded. */
  @PostMapping("/staff/email-preview") Map<String,Object> preview(@RequestHeader(value="Authorization",required=false) String h,@RequestBody Map<String,Object> b){
    User st=auth.staff(h);
    Built r=build(st,b);
    Map<String,Object> m=new LinkedHashMap<>();
    m.put("subject",r.subject); m.put("heading",r.heading); m.put("html",r.html); m.put("plain",r.plain);
    m.put("missing",new ArrayList<>(r.missing));
    m.put("filled",r.vars==null?new LinkedHashMap<String,String>():r.vars);
    return m;
  }

  /** Sends the email and records it. Blocked while any placeholder is still empty. */
  @PostMapping("/staff/send-email") Map<String,Object> send(@RequestHeader(value="Authorization",required=false) String h,@RequestBody Map<String,Object> b){
    User st=auth.staff(h);
    Built r=build(st,b);
    if(!r.missing.isEmpty()) throw bad("Please fill in: "+String.join(", ",r.missing)+". Then preview and send again.");
    List<Long> times=RECENT.computeIfAbsent(st.id,k->new ArrayList<>());
    synchronized(times){
      long cutoff=System.currentTimeMillis()-3600_000L; times.removeIf(x->x<cutoff);
      if(times.size()>=MAX_PER_HOUR) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"You have sent "+MAX_PER_HOUR+" emails in the last hour. Please try again later.");
      times.add(System.currentTimeMillis());
    }
    String err=mail.deliverAs(r.recipientEmail,r.subject,r.html,r.plain,nz(st.name)+" via NLMed Study",st.email);
    try{
      String key=r.template.label, sender=nz(st.name), to=r.recipientEmail, subj=r.subject;
      logs.findFirstByToAddressIgnoreCaseAndSubjectOrderByIdDesc(to,subj).ifPresent(l->{ l.sender=sender; l.template=key; logs.save(l); });
    }catch(Exception ignored){ }
    Map<String,Object> m=new LinkedHashMap<>(); m.put("sent",err==null); m.put("problem",err);
    return m;
  }
}
