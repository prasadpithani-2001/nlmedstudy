package app.studydesk;
import java.util.*;
import java.util.regex.*;

/* Ready-made email templates for admins and teachers. Placeholders look like {{studentName}}.
   Most are filled from the student's real records. Some are typed by the sender (see TYPED).
   A placeholder with no value blocks sending, so no email goes out with a blank or invented detail. */
final class EmailTemplates {
  static final class T {
    final String key, label, audience, heading, subject, body; final boolean needsPayment;
    T(String k,String l,String a,boolean np,String h,String s,String b){ key=k; label=l; audience=a; needsPayment=np; heading=h; subject=s; body=b; }
  }
  static final List<T> ALL=List.of(
    new T("CUSTOM","Custom email","ALL",false,"A message from NLMed Study","","Write your message here."),
    new T("REGISTRATION","Registration / welcome","ALL",false,"Welcome, {{studentName}}!","Welcome to NLMed Study",
      "Thank you for joining NLMed Study. We are delighted to have you with us.\n\nFrom your dashboard you can browse courses, book demo sessions and practise for entrance exams.\n\n- Sign in with this email address\n- Explore courses in your area of interest"),
    new T("FEE_RECEIPT","Fee payment receipt","ALL",true,"Payment receipt","Payment receipt for {{courseName}}",
      "Thank you, {{studentName}}. We have recorded your payment for **{{courseName}}**.\n\n- Amount: Rs {{amount}}\n- Transaction ID: {{transactionId}}\n- Reference: {{reference}}\n- Status: {{paymentStatus}}\n- Course start: {{courseStartDate}}\n\nPlease keep this email for your records."),
    new T("PAYMENT_PENDING","Payment pending notification","ALL",true,"Your payment is being checked","Your payment is awaiting verification",
      "We have received your payment details for **{{courseName}}**. Our team is checking them now.\n\n- Amount: Rs {{amount}}\n- Reference: {{reference}}\n\nYour course will become available once your payment is approved. Thank you for your patience."),
    new T("PAYMENT_APPROVED","Payment approval confirmation","ALL",true,"Your payment is approved","Your payment has been approved",
      "Good news, {{studentName}}! Your payment for **{{courseName}}** has been approved.\n\n- Amount: Rs {{amount}}\n- Transaction ID: {{transactionId}}\n- Course start: {{courseStartDate}}\n\n[Go to my course]({{courseLink}})"),
    new T("PAYMENT_REJECTED","Payment rejection notification","ALL",true,"Your payment could not be approved","Your payment could not be approved",
      "Hello {{studentName}}, we are sorry, but we were unable to approve your payment for **{{courseName}}**.\n\n- Reason: {{rejectReason}}\n- Reference: {{reference}}\n\nYour course has not been unlocked. You can send a corrected screenshot and press I Have Paid again."),
    new T("ENROLLMENT","Course enrolment confirmation","ALL",false,"You are enrolled","You are enrolled in {{courseName}}",
      "Congratulations, {{studentName}}! You are now enrolled in **{{courseName}}**.\n\nYou can start learning from your dashboard whenever you are ready.\n\n[Open my course]({{courseLink}})"),
    new T("COURSE_ACCESS","Course access granted","ALL",false,"Your course access is ready","Your access to {{courseName}} is active",
      "Hello {{studentName}}, your access to **{{courseName}}** is now active from {{courseStartDate}}. Open the course to see your topics and live classes.\n\n[Open my course]({{courseLink}})"),
    new T("COUPON","Coupon / discount notification","ALL",false,"A special offer for you","A discount for {{courseName}}",
      "Hello {{studentName}}, we have a discount for **{{courseName}}** for you.\n\nUse the coupon code **{{couponCode}}** when you enrol. Offers are subject to our terms.\n\n[View the course]({{courseLink}})"),
    new T("EXAM_NOTICE","Entrance exam notification","ALL",false,"Entrance exam: {{examTitle}}","Entrance exam: {{examTitle}}",
      "Hello {{studentName}}, you are invited to take the entrance exam **{{examTitle}}**.\n\nPlease sign in, open Entrance Exam from the menu, and allow your camera and full-screen mode when you start. The test is supervised.\n\n[Open entrance exams]({{siteUrl}}/#/exams)"),
    new T("EXAM_RESULT","Entrance exam result","ALL",false,"Your exam result","Your result for {{examTitle}}",
      "Hello {{studentName}}, your result for **{{examTitle}}** is **{{examScore}}**.\n\nThank you for taking the exam. You can review your results from the Entrance Exam page.\n\n[View my results]({{siteUrl}}/#/exams)"),
    new T("LIVE_CLASS","Live class schedule / reminder","ALL",false,"Live class: {{classTitle}}","Live class: {{classTitle}} on {{classStart}}",
      "Hello {{studentName}}, your live class **{{classTitle}}** starts on {{classStart}}.\n\n- Please join a few minutes early.\n- Keep your camera and microphone ready.\n\n[Open live classes]({{siteUrl}}/#/dashboard)"),
    new T("PASSWORD_RESET","Password reset (admin only)","ADMIN",false,"Reset your password","Reset your NLMed Study password",
      "Hello {{studentName}}, we received a request to reset your NLMed Study password. Please use the link below within 60 minutes. The link can be used only once.\n\n[Reset my password]({{resetLink}})\n\nIf you did not make this request, please ignore this email. Your password will stay the same."),
    new T("ANNOUNCEMENT","General announcement (admin only)","ADMIN",false,"An announcement from NLMed Study","An announcement from NLMed Study",
      "Hello {{studentName}},\n\n{{announcement}}\n\nThank you for learning with us."));

  /** Values the sender types in, for things the system does not know. */
  static final List<String> TYPED=List.of("recipientName","examTitle","examScore","classTitle","classStart","couponCode","resetLink","announcement");

  static List<T> forRole(String role){
    List<T> out=new ArrayList<>(); for(T t:ALL) if("ALL".equals(t.audience)||"ADMIN".equals(role)) out.add(t); return out; }
  static T byKey(String k){ for(T t:ALL) if(t.key.equals(k)) return t; return null; }

  static final Pattern PH=Pattern.compile("\\{\\{\\s*([a-zA-Z0-9_]+)\\s*\\}\\}");
  /** Replaces {{name}} with its value. A missing value stays as it is and is reported in 'missing'. */
  static String fill(String s,Map<String,String> vars,Set<String> missing){
    if(s==null) return "";
    Matcher m=PH.matcher(s); StringBuffer sb=new StringBuffer();
    while(m.find()){
      String v=vars.get(m.group(1)), rep;
      if(v==null||v.isBlank()){ missing.add(m.group(1)); rep=m.group(0); } else rep=v;
      m.appendReplacement(sb,Matcher.quoteReplacement(rep));
    }
    m.appendTail(sb); return sb.toString();
  }

  static final Pattern LINK=Pattern.compile("\\[([^\\]]+)\\]\\((https?://[^\\s)]+)\\)"), BOLD=Pattern.compile("\\*\\*([^*]+)\\*\\*");
  /** Escapes the text, then applies **bold** and [label](https://...) links. */
  static String inline(String s){
    String e=s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;");
    e=LINK.matcher(e).replaceAll("<a href=\"$2\" style=\"color:#4f46e5;font-weight:600\">$1</a>");
    e=BOLD.matcher(e).replaceAll("<b>$1</b>");
    return e;
  }
  /** Message text to safe HTML: paragraphs (blank line between), "- " bullet lists, a "## " heading line, **bold**, [links](https://...). */
  static String html(String text){
    StringBuilder out=new StringBuilder();
    for(String block:text.split("\\n\\s*\\n")){
      String b=block.trim(); if(b.isEmpty()) continue;
      String[] lines=b.split("\\n");
      boolean bullets=true; for(String l:lines) if(!l.trim().startsWith("- ")) bullets=false;
      if(bullets){
        out.append("<ul style=\"margin:0 0 16px;padding-left:22px\">");
        for(String l:lines) out.append("<li style=\"margin:4px 0\">").append(inline(l.trim().substring(2))).append("</li>");
        out.append("</ul>");
      } else if(lines.length==1&&b.startsWith("## ")){
        out.append("<h3 style=\"margin:20px 0 8px;font-size:17px;color:#0f172a\">").append(inline(b.substring(3))).append("</h3>");
      } else {
        out.append("<p style=\"margin:0 0 16px\">");
        for(int i=0;i<lines.length;i++){ if(i>0) out.append("<br>"); out.append(inline(lines[i])); }
        out.append("</p>");
      }
    }
    return out.toString();
  }
}
