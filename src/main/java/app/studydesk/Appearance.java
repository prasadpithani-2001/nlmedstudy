package app.studydesk;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

/* ===== Site-wide font & appearance =====
   One value for the whole website, stored in the Setting table (keys ap.font, ap.size, ap.weight, ap.teacherEdit).
   GET is public (students need it to render the site). PUT: ADMIN always; TEACHER only while the admin has allowed it. */
@RestController @RequestMapping("/api") class AppearanceController {
  static final Set<String> FONTS=Set.of("default","Inter","Poppins","Roboto","Nunito","Montserrat","Plus Jakarta Sans");
  static final Set<String> SIZES=Set.of("small","normal","large","xlarge");
  static final Set<String> WEIGHTS=Set.of("normal","medium","semibold");
  static final Set<String> THEMES=Set.of("light","dark");
  static final Set<String> ACCENTS=Set.of("indigo","teal","navy","lavender","emerald","rose","amber","sky","fuchsia","violet");
  final Auth auth; final SettingRepo settings;
  AppearanceController(Auth a,SettingRepo s){auth=a;settings=s;}

  String get(String k,String d){ return settings.findById("ap."+k).map(s->s.v==null||s.v.isBlank()?d:s.v).orElse(d); }
  void put(String k,String v){ Setting s=settings.findById("ap."+k).orElseGet(Setting::new); s.k="ap."+k; s.v=v; settings.save(s); }
  Map<String,Object> view(){
    Map<String,Object> m=new LinkedHashMap<>();
    String f=get("font","default"), z=get("size","normal"), w=get("weight","normal");
    m.put("font",FONTS.contains(f)?f:"default"); m.put("size",SIZES.contains(z)?z:"normal"); m.put("weight",WEIGHTS.contains(w)?w:"normal");
    m.put("teacherCanEdit","true".equals(get("teacherEdit","false")));
    String t=get("theme","light"), ac=get("accent","indigo");
    m.put("theme",THEMES.contains(t)?t:"light"); m.put("accent",ACCENTS.contains(ac)?ac:"indigo");   // the admin's site default for visitors who have not chosen their own
    return m; }

  @GetMapping("/appearance") Map<String,Object> read(){ return view(); }

  @PutMapping("/staff/appearance") Map<String,Object> save(@RequestHeader(value="Authorization",required=false) String h,@RequestBody Map<String,Object> b){
    User u=auth.staff(h); boolean admin="ADMIN".equals(u.role);
    if(!admin&&!"true".equals(get("teacherEdit","false"))) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"The admin has not allowed teachers to change the site font");
    String f=String.valueOf(b.getOrDefault("font","default")), z=String.valueOf(b.getOrDefault("size","normal")), w=String.valueOf(b.getOrDefault("weight","normal"));
    if(!FONTS.contains(f)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown font");
    if(!SIZES.contains(z)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown text size");
    if(!WEIGHTS.contains(w)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown text weight");
    put("font",f); put("size",z); put("weight",w);
    if(admin&&b.containsKey("theme")){ String t=String.valueOf(b.get("theme")); if(!THEMES.contains(t)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown theme"); put("theme",t); }
    if(admin&&b.containsKey("accent")){ String ac=String.valueOf(b.get("accent")); if(!ACCENTS.contains(ac)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown accent colour"); put("accent",ac); }
    if(admin&&b.containsKey("teacherCanEdit")) put("teacherEdit",String.valueOf(Boolean.parseBoolean(String.valueOf(b.get("teacherCanEdit")))));
    return view(); }
}
