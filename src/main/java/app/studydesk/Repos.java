package app.studydesk;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
interface UserRepo extends JpaRepository<User,Long>{ Optional<User> findByEmail(String e); Optional<User> findByToken(String t); }
interface CourseRepo extends JpaRepository<Course,Long>{}
interface DemoRepo extends JpaRepository<Demo,Long>{}
interface DemoRegRepo extends JpaRepository<DemoReg,Long>{ long countByDemoId(Long id); List<DemoReg> findByDemoId(Long id); }
interface EnrollRepo extends JpaRepository<Enrollment,Long>{ boolean existsByUserIdAndCourseId(Long u,Long c); List<Enrollment> findByUserId(Long u); List<Enrollment> findByUserIdAndCourseId(Long u,Long c); }
interface DoubtRepo extends JpaRepository<Doubt,Long>{ List<Doubt> findByUserId(Long u); }
interface QuestionRepo extends JpaRepository<Question,Long>{ List<Question> findByCourseId(Long c); }
interface AttemptRepo extends JpaRepository<Attempt,Long>{ List<Attempt> findByUserId(Long u); }
