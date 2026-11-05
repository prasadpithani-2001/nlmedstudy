package app.studydesk;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.nio.file.*;
import java.util.*;

/* ===== Phase 9: teacher profile + pictures inserted into a live class ===== */

/** Profile screen: read / rename the signed-in account and change the password. */
@RestController @RequestMapping("/api/me") class MeController {
  final Auth auth; final UserRepo users; MeController(Auth a,UserRepo u){auth=a;users=u;}
  Map<String,Object> view(User u){ Map<String,Object> m=new LinkedHashMap<>(); m.put("id",u.id); m.put("name",u.name); m.put("email",u.email); m.put("role",u.role); return m; }
  @GetMapping Map<String,Object> me(@RequestHeader(value="Authorization",required=false) String h){ return view(auth.need(h,null)); }
  @PutMapping Map<String,Object> rename(@RequestHeader(value="Authorization",required=false) String h,@RequestBody Map<String,String> b){
    User u=auth.need(h,null); String n=b.get("name")==null?"":b.get("name").trim();
    if(n.length()<2||n.length()>80) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enter your name (2 to 80 characters)");
    u.name=n; users.save(u); return view(u); }
  @PutMapping("/password") Map<String,Object> password(@RequestHeader(value="Authorization",required=false) String h,@RequestBody Map<String,String> b){
    User u=auth.need(h,null);
    if(b.get("current")==null||!auth.enc.matches(b.get("current"),u.passwordHash)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Your current password is not correct");
    String n=b.get("next"); if(n==null||n.length()<8) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"The new password must be at least 8 characters");
    u.passwordHash=auth.enc.encode(n); users.save(u); return Map.of("message","Password changed."); }
}

/** Pictures the teacher drops onto the live board. Stored on disk (uploads/live), shown to students through the live socket. */
@RestController @RequestMapping("/api/live") class LiveMediaController {
  static final Path DIR=ContentController.DIR.resolve("live");
  static final long MAX=5L*1024*1024;
  final Auth auth; final CourseRepo courses; LiveMediaController(Auth a,CourseRepo c){auth=a;courses=c;}

  static String sniff(byte[] b){   // real file signature, not just the name
    if(b.length>=3&&(b[0]&0xFF)==0xFF&&(b[1]&0xFF)==0xD8&&(b[2]&0xFF)==0xFF) return "jpg";
    if(b.length>=8&&(b[0]&0xFF)==0x89&&b[1]=='P'&&b[2]=='N'&&b[3]=='G') return "png";
    if(b.length>=12&&b[0]=='R'&&b[1]=='I'&&b[2]=='F'&&b[3]=='F'&&b[8]=='W'&&b[9]=='E'&&b[10]=='B'&&b[11]=='P') return "webp";
    return null; }

  @PostMapping(value="/{room}/image",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) Map<String,Object> upload(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String room,@RequestParam MultipartFile file) throws Exception {
    User u=auth.need(h,"TEACHER");
    if(!room.matches("\\d+")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown class");
    if(!"0".equals(room)){ Course c=courses.findById(Long.valueOf(room)).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Course not found")); if(!auth.manages(u,c)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"This class belongs to another teacher"); }
    if(file.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"The image is empty");
    if(file.getSize()>MAX) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"Image is too large. The limit is 5 MB.");
    String orig=Optional.ofNullable(file.getOriginalFilename()).orElse("").toLowerCase();
    if(!(orig.endsWith(".jpg")||orig.endsWith(".jpeg")||orig.endsWith(".png")||orig.endsWith(".webp"))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose a JPG, PNG or WEBP image");
    byte[] head=new byte[12]; try(var in=file.getInputStream()){ in.readNBytes(head,0,12); }
    String ext=sniff(head); if(ext==null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"That file is not a valid JPG, PNG or WEBP image");
    Files.createDirectories(DIR); String name=UUID.randomUUID()+"."+ext; file.transferTo(DIR.resolve(name));
    return Map.of("name",name,"url","/api/live/image/"+name); }

  @GetMapping("/image/{name}") ResponseEntity<FileSystemResource> image(@RequestHeader(value="Authorization",required=false) String h,@RequestParam(required=false) String token,@PathVariable String name){
    auth.viewer(h,token);
    if(!name.matches("[0-9a-f\\-]{36}\\.(jpg|png|webp)")) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Image not found");
    Path p=DIR.resolve(name); if(!Files.isRegularFile(p)) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Image not found");
    String ct=name.endsWith(".png")?"image/png":name.endsWith(".webp")?"image/webp":"image/jpeg";
    return ResponseEntity.ok().contentType(MediaType.parseMediaType(ct)).header("X-Content-Type-Options","nosniff").header(HttpHeaders.CACHE_CONTROL,"private, max-age=3600").body(new FileSystemResource(p)); }
}
