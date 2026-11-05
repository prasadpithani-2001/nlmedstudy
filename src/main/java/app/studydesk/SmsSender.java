package app.studydesk;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;

/* SMS alerts for admins and teachers (payment approval requests).
   sms.provider = none (default: the text is printed to the server log) | twilio (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM).
   SMS in India must use a DLT-registered sender ID and approved template; the provider must be set up for that before messages reach handsets. */
@Component class SmsSender {
  static final Logger LOG = LoggerFactory.getLogger(SmsSender.class);
  final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  @Value("${sms.provider:none}") String provider;
  @Value("${sms.twilio.account-sid:}") String sid;
  @Value("${sms.twilio.auth-token:}") String token;
  @Value("${sms.twilio.from:}") String from;

  /** "9876543210", "+91 98765 43210" and "919876543210" all become "+919876543210". Null when the number cannot be used. */
  static String normalize(String raw){
    if(raw==null) return null;
    String d=raw.replaceAll("[^\\d+]","");
    if(d.startsWith("+")) d=d.substring(1);
    if(d.length()==10) d="91"+d;
    if(d.length()<11||d.length()>15) return null;
    return "+"+d; }

  /** Sends in the background and never throws, so a failed text cannot block or break a payment. */
  void send(String mobile,String body){
    String to=normalize(mobile);
    if(to==null){ LOG.info("[SMS skipped: no valid mobile number on record]"); return; }
    String text=body.length()>320?body.substring(0,317)+"...":body;
    if(!"twilio".equalsIgnoreCase(provider)||blank(sid)||blank(token)||blank(from)){
      LOG.info("[SMS not configured, printing instead]\nTo: {}\n{}",to,text); return; }
    Thread t=new Thread(()->{
      try{
        String form="To="+enc(to)+"&From="+enc(from)+"&Body="+enc(text);
        HttpRequest req=HttpRequest.newBuilder(URI.create("https://api.twilio.com/2010-04-01/Accounts/"+sid+"/Messages.json"))
          .timeout(Duration.ofSeconds(15))
          .header("Authorization","Basic "+Base64.getEncoder().encodeToString((sid+":"+token).getBytes(StandardCharsets.UTF_8)))
          .header("Content-Type","application/x-www-form-urlencoded")
          .POST(HttpRequest.BodyPublishers.ofString(form)).build();
        HttpResponse<String> r=http.send(req,HttpResponse.BodyHandlers.ofString());
        if(r.statusCode()>=300) LOG.warn("SMS to {} was not accepted: HTTP {}",to,r.statusCode());
      }catch(Exception e){ LOG.warn("SMS to {} failed: {}",to,e.getMessage()); }
    },"sms");
    t.setDaemon(true); t.start(); }

  static String enc(String s){ return URLEncoder.encode(s,StandardCharsets.UTF_8); }
  static boolean blank(String s){ return s==null||s.isBlank(); }
}
