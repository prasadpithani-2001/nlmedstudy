package app.studydesk;
import jakarta.persistence.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

/* ===== Email verification tokens and live-session reminders ===== */

/** Demo (live) sessions: a confirmation when a seat is booked, and one reminder about an hour before the start. */
@Component class Reminders {
  static final DateTimeFormatter WHEN=DateTimeFormatter.ofPattern("EEEE, d MMM yyyy 'at' h:mm a");
  final DemoRepo demos; final DemoRegRepo regs; final Mailer mail;
  Reminders(DemoRepo d,DemoRegRepo r,Mailer m){ demos=d; regs=r; mail=m; }

  static String nz(String s){ return s==null?"":s; }
  static String joinLink(Demo d){ return d.meetingLink==null||d.meetingLink.isBlank()?null:d.meetingLink; }
  static String details(Demo d){
    return "<table style=\"font-size:15px;line-height:1.7\">"
      +"<tr><td style=\"padding-right:14px;color:#64748b\">Session</td><td><b>"+Mailer.esc(nz(d.title))+"</b></td></tr>"
      +"<tr><td style=\"color:#64748b\">Topic</td><td>"+Mailer.esc(nz(d.topic))+"</td></tr>"
      +"<tr><td style=\"color:#64748b\">Starts</td><td>"+d.startsAt.format(WHEN)+"</td></tr>"
      +"<tr><td style=\"color:#64748b\">Length</td><td>"+d.durationMin+" minutes</td></tr></table>"; }

  /** Sent when a free demo seat is booked. Never blocks the booking. */
  static void confirm(Mailer mail,Demo d,DemoReg r){
    if(r.email==null||r.email.isBlank()||d.startsAt==null) return;
    String name=r.name==null||r.name.isBlank()?"there":r.name;
    mail.send(r.email,"Your demo seat is booked: "+nz(d.title),
      Mailer.layout("Your seat is booked, "+Mailer.esc(name)+"!","<p>Thank you for booking a free demo session with NLMed Study. Your seat is reserved.</p>"+details(d)+"<p>We will email you a reminder about an hour before the session starts.</p>","Join session",joinLink(d)),
      "Hello "+name+", your free demo seat is booked: "+nz(d.title)+". It starts "+d.startsAt.format(WHEN)+"."+(joinLink(d)==null?"":" Join link: "+joinLink(d)));
  }

  /** Runs every 5 minutes. Each registrant gets one reminder for sessions starting in about an hour. */
  @Scheduled(fixedDelay=300_000,initialDelay=60_000)
  void sendDue(){
    LocalDateTime now=LocalDateTime.now();
    for(Demo d:demos.findAll()){
      if(d.startsAt==null||d.startsAt.isBefore(now.plusMinutes(50))||d.startsAt.isAfter(now.plusMinutes(70))) continue;
      for(DemoReg r:regs.findByDemoId(d.id)){
        if(r.reminded||r.email==null||r.email.isBlank()) continue;
        r.reminded=true; regs.save(r);   // marked first, so a repeat run never sends it twice
        String name=r.name==null||r.name.isBlank()?"there":r.name;
        mail.send(r.email,"Reminder: your session starts in about an hour",
          Mailer.layout("Your session starts soon","<p>Hello "+Mailer.esc(name)+", a quick reminder that your demo session starts in about an hour.</p>"+details(d)+"<p>Please join a few minutes early so you are ready when we begin.</p>","Join session",joinLink(d)),
          "Hello "+name+", your demo session '"+nz(d.title)+"' starts at "+d.startsAt.format(WHEN)+". Please join a few minutes early."+(joinLink(d)==null?"":" Join link: "+joinLink(d)));
      }
    }
  }
}
