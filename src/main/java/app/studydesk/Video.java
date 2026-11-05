package app.studydesk;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.nio.file.*;
import java.util.*;

/** Teacher uploads a recorded video lesson; students stream it (access checked with ?token= because <video> cannot send headers). */
@RestController @RequestMapping("/api") class VideoController {
  static final Set<String> VID=Set.of("mp4","webm","mov","m4v");
  final Auth auth; final LessonRepo lessons; final EnrollRepo enrolls; final UserRepo users; final CourseRepo courses;
  final AccessRules rules;
  VideoController(Auth a,LessonRepo l,EnrollRepo e,UserRepo u,CourseRepo c,AccessRules r){auth=a;lessons=l;enrolls=e;users=u;courses=c;rules=r;}
  @PostMapping(value="/admin/lessons/upload",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) Lesson upload(@RequestHeader(value="Authorization",required=false) String h,
      @RequestParam Long courseId,@RequestParam Long topicId,@RequestParam String title,@RequestParam MultipartFile file) throws Exception {
    auth.managed(h,courseId,courses);
    String orig=Optional.ofNullable(file.getOriginalFilename()).orElse(""); String ext=orig.contains(".")?orig.substring(orig.lastIndexOf('.')+1).toLowerCase():"";
    if(!VID.contains(ext)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Upload a video file (MP4, WEBM or MOV)");
    Files.createDirectories(ContentController.DIR); String name=UUID.randomUUID()+"."+ext; file.transferTo(ContentController.DIR.resolve(name));
    Lesson l=new Lesson(); l.courseId=courseId; l.topicId=topicId; l.title=title; l.videoFile=name; l=lessons.save(l); l.videoUrl="/api/lessons/"+l.id+"/video"; return lessons.save(l); }
  @GetMapping("/lessons/{id}/video") ResponseEntity<FileSystemResource> video(@PathVariable Long id,@RequestParam String token){
    User u=users.findByToken(token).orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Log in first"));
    Lesson l=lessons.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Video not found"));
    if(l.videoFile==null) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Video not found");
    if("STUDENT".equals(u.role)&&!rules.canUseCourse(u.id,l.courseId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Enroll to unlock this course");
    String ct=l.videoFile.endsWith(".webm")?"video/webm":"video/mp4";
    return ResponseEntity.ok().contentType(MediaType.parseMediaType(ct)).body(new FileSystemResource(ContentController.DIR.resolve(l.videoFile))); }
}
