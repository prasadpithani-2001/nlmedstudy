package app.studydesk;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.*;

/** Learning statistics for the signed-in student, computed from stored lesson completions and test attempts.
 *  Streak = consecutive days with at least one lesson or test, counted back from today (a streak still counts if the last active day was yesterday). */
@RestController @RequestMapping("/api") class LearningStatsController {
  final Auth auth; final LessonDoneRepo lessonsDone; final AttemptRepo attempts;
  LearningStatsController(Auth a, LessonDoneRepo l, AttemptRepo t){ auth=a; lessonsDone=l; attempts=t; }

  @GetMapping("/my/learning-stats") Map<String,Object> stats(@RequestHeader(value="Authorization",required=false) String h){
    User u = auth.need(h, null);
    List<LessonDone> ld = lessonsDone.findByUserId(u.id);
    List<Attempt> at = attempts.findByUserId(u.id);
    TreeSet<LocalDate> days = new TreeSet<>();
    for (LessonDone x : ld) if (x.at != null) days.add(x.at.toLocalDate());
    for (Attempt x : at) if (x.at != null) days.add(x.at.toLocalDate());
    int correct = 0, total = 0;
    for (Attempt x : at) { correct += x.correct; total += x.total; }
    int avg = total == 0 ? 0 : Math.round(100f * correct / total);
    int current = streak(days, LocalDate.now()), longest = longest(days);
    Map<String,Object> m = new LinkedHashMap<>();
    m.put("streak", current); m.put("longestStreak", longest); m.put("activeDays", days.size());
    m.put("lessonsDone", ld.size()); m.put("testsTaken", at.size()); m.put("averageScore", avg);
    m.put("badges", badges(ld.size(), at.size(), avg, longest));
    return m; }

  static int streak(TreeSet<LocalDate> days, LocalDate today){
    LocalDate d = days.contains(today) ? today : today.minusDays(1);
    int n = 0;
    while (days.contains(d)) { n++; d = d.minusDays(1); }
    return n; }

  static int longest(TreeSet<LocalDate> days){
    int best = 0, run = 0; LocalDate prev = null;
    for (LocalDate d : days) { run = (prev != null && prev.plusDays(1).equals(d)) ? run + 1 : 1; best = Math.max(best, run); prev = d; }
    return best; }

  static List<Map<String,Object>> badges(int lessons, int tests, int avg, int longest){
    List<Map<String,Object>> out = new ArrayList<>();
    out.add(badge("first-lesson", "First lesson", "Finish your first lesson", lessons >= 1));
    out.add(badge("ten-lessons", "Steady learner", "Finish 10 lessons", lessons >= 10));
    out.add(badge("first-test", "First test", "Take your first test", tests >= 1));
    out.add(badge("sharp", "Sharp mind", "Average 80% or more over 3 tests", tests >= 3 && avg >= 80));
    out.add(badge("streak-3", "On fire", "Study 3 days in a row", longest >= 3));
    out.add(badge("streak-7", "Unbroken", "Study 7 days in a row", longest >= 7));
    return out; }

  static Map<String,Object> badge(String id, String name, String how, boolean earned){
    Map<String,Object> m = new LinkedHashMap<>();
    m.put("id", id); m.put("name", name); m.put("how", how); m.put("earned", earned); return m; }
}
