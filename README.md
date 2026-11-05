# NLMed Study — Learn Better. Study Smarter. Achieve More.
React (Vite + Tailwind + React Router + Axios) frontend, Spring Boot 3 + JPA backend, H2 or MySQL.

## Run (single command)
**After pulling Phase 5, rebuild the UI once:** `run.bat` (Windows) or `./run.sh` (Mac/Linux) does `npm install` + `npm run build` + `mvn spring-boot:run` for you.
`mvn spring-boot:run` → http://localhost:8080 (built UI is already in src/main/resources/static). MySQL: `--spring.profiles.active=mysql`.

## Frontend dev
`cd frontend && npm install && npm run dev` → http://localhost:5173 (proxies /api to :8080). Rebuild: `npm run build`, copy dist/* to src/main/resources/static.

## Logins
Admin: admin@studydesk.app / admin123 · Teacher: teacher@studydesk.app / teacher123 · Student: student@studydesk.app / student123 (or Sign Up) · Coupon: WELCOME10

## Done
Public: home, courses + search, course detail with curriculum, checkout (mock payment), free demo booking, login/register.
Student: My Learning, notes/resources (enrolled only), tests with weak areas, doubts, progress.
Teacher: stats, create course, set price, add topics, upload notes/resources, create demo, mark doubts.

## Not done yet
JWT (current tokens are random session tokens), PhonePe, email/SMS reminders, video upload/live class embed, modules+lessons,
reviews, certificates, categories, admin role screens, recommendations, S3 storage, tests (none written).

## Frontend (React + Vite + Tailwind) — frontend/
- Dev: `cd frontend && npm install && npm run dev` (proxies /api to :8080)
- Build into Spring: `npm run build` (already built once; output in src/main/resources/static)
- Pages wired to the API: Home + free demo booking, Courses, Course detail + enroll (coupon WELCOME10),
  Login/Register, Student dashboard + study desk (notes, resources, assessment, doubts), Teacher dashboard
  (stats, create course, prices, topics, note/resource upload, doubt status).
## Roadmap (not built yet)
Modules/lessons + video, certificates, reviews, categories, admin panel, coupons CRUD, JWT (currently opaque tokens),
PhonePe verification, S3 storage, email/SMS reminders, Notebook Mode viewer, Focus Mode.

## Phase 2 added
Lessons with video (embed URL or .mp4), lesson completion + course progress, certificates (100% complete), reviews,
admin panel (users/roles, payments). Admin login: admin@studydesk.app / admin123 — change before going live.
Still not built: video file upload, categories, coupon CRUD, real JWT, PhonePe, S3, reminders, Notebook/Focus Mode UI.

## Phase 2.1
Restyled UI (Fraunces + Source Sans 3 + Caveat handwriting accents, animated ECG line, fade/lift animations; respects reduced-motion).
"Report a problem" button for students/teachers → Admin sees all reported issues (filter, mark in-progress/resolved) and all student doubts.

## Phase 3 (UI)
Animated aurora background, dark/light theme toggle (remembered), glass cards, bento-grid homepage with count-up numbers
and scroll-reveal, Ctrl+K quick search, Focus page (/#/focus) with 25/45/60-min timer, breathing circle and daily streak,
loading skeletons. Frontend-only change: no backend changes in this phase.

## Phase 4: in-site live class
- /#/live/<courseId>: teacher goes live (camera + mic), students join in the browser (no Zoom/Meet). Teacher tools: pen, highlighter,
  eraser, colours, size, undo, clear, board backgrounds (plain/ruled/grid/blackboard), mute/camera, screen share.
- Video uses WebRTC peer-to-peer (one connection per student): good for small batches (about 10-15). For bigger classes use an SFU (e.g. LiveKit).
- Uploaded video lessons (MP4/WEBM/MOV, up to 600 MB) are streamed only to enrolled students.
- Doubts show the student's name. New courses get default topics.

## Phase 5: contact, payments, class modes, styles
**Contact details** - new /#/contact page (call, WhatsApp, email, map link, hours, message form) and a footer on every page. The values are PLACEHOLDERS:
log in as teacher or admin and edit them under "Contact details" (saved in the database, no rebuild). Messages from the form appear in "Contact messages" (teacher + admin).
The floating WhatsApp button appears once a WhatsApp number (digits with country code, e.g. 919876543210) is saved.

**Payments** - /#/checkout/<courseId>: PhonePe, Paytm, UPI ID and Debit/Credit card (live card preview, Luhn check, expiry/CVV rules), coupon box (WELCOME10),
processing animation, receipt, "My payments" for students, full payment log for admin. Only the last 4 digits / masked UPI or mobile are stored, never the card number or CVV.
The old /enroll endpoint now refuses paid courses (it used to enrol for free).
*Demo mode (default, `pay.mode: demo` in application.yml)*: nothing is charged. Test card 4242 4242 4242 4242 succeeds, 4000 0000 0000 0002 is declined.

### Going live with payments (required before taking real money)
Demo mode does NOT move money. To accept real payments, register as a merchant with a gateway that supports PhonePe, Paytm, UPI and cards (PhonePe PG, Paytm PG, Razorpay, Cashfree...),
set `pay.mode: live`, and replace `ExtrasController.charge()` with the gateway's order-create + signature/webhook verification. Use the gateway's hosted checkout or tokenised card fields
so raw card numbers never touch your server (PCI-DSS). Keep merchant keys in environment variables, never in the repo.

**Tablet or Board class** - the teacher picks the mode in the live lobby and can switch during the class (messages `mode` over the WebSocket; students are updated instantly).
Tablet = digital whiteboard (ruled/grid/plain/blackboard) with the camera in a corner, in a tablet-bezel frame. Board = physical board: camera fills the stage in a wooden frame,
pen/highlighter annotate on top, "Flip camera" switches to the rear camera. The Live badge on student dashboards shows which mode is running. Fullscreen button for everyone.

**Look and feel** - 🎨 Style menu: 6 live backgrounds (Aurora, Neural net, Heartbeat, Waves, Notebook, Plain), optional auto-change every 20 s, 4 accent colours (Teal, Indigo, Rose, Amber),
plus the existing dark/light switch. Also: scroll progress bar, cursor spotlight on cards, typewriter hero, confetti on successful payment, morphing live stage.
All animation respects "reduce motion". Choices are remembered per device.

## Phase 6: staff-only payments, QR payments, new Focus session
**Rebuild the UI once** (`run.bat` / `./run.sh`): it installs the new `qrcode` package and rebuilds. The prebuilt UI in `src/main/resources/static` is from Phase 5.

**Who can see payments** - the payments page (`/#/payments`), payment log, summary, CSV export and QR settings are for **ADMIN and TEACHER only**
(route guard in the UI and `Auth.staff()` on every `/api/staff/*` and `/api/admin/payment*` call). Students only pay and see their own payments.

**QR payment flow** - student picks *Scan QR code* at checkout:
1. Server creates an order with the exact amount (coupon applied server-side) and a reference, valid 15 min. The page shows a UPI QR with amount + reference filled in (and an "Open UPI app" button on phones).
2. Student pays, then sends the 12-digit UTR. Status becomes *Needs review*. Reused UTRs are refused.
3. Teacher/admin checks the bank or UPI app, then **Approve** (student is enrolled at once, student page updates by itself) or **Reject** with a reason the student sees.
4. Staff page: summary cards (needs review, today, this month, all time), tabs, search, live refresh every 15 s, CSV export.
Set it up once: Payments page > *QR payment settings* > your UPI ID, payee name, optional note and optional uploaded QR image. QR payments stay hidden from students until a UPI ID is saved.
Money goes straight to your UPI account. Nothing is charged by this app, and approval is manual, so always match amount + UTR in your bank app before approving.

**Focus session** (`/#/focus`) - rebuilt: Focus / Short break / Long break cycle (4 focus sessions then a long break), progress ring, real-end-time timer (correct after refresh, sleep or tab switch),
custom length 1-180 min, task label, sound + notification + vibration at the end, countdown in the tab title, screen wake lock, today's stats, 7-day chart and streak. Keys: Space, R, Esc.

## Phase 7: dynamic payments per teacher/admin, focus engine, active navigation
**Rebuild the UI once** (`run.bat` / `./run.sh`). The prebuilt UI in `src/main/resources/static` is older than this source.

**Dynamic payments (nothing hardcoded)** - every admin/teacher has their own payment account (table `pay_account`), edited at `/#/payments` > *Payment settings*:
QR (own QR image and/or QR generated from the UPI ID with the exact amount), PhonePe/UPI (UPI ID, PhonePe number, optional bank details), Card (hosted gateway link).
Each method has its own on/off switch and is shown to students only when it is on AND filled in. A course is paid to its owner (`Course.ownerId`: set automatically when a teacher creates it;
admin can change it under Admin > *Course owners*; old courses without an owner fall back to the first teacher). Student flow: Checkout shows "You are paying <owner> for <course>", then
`POST /api/courses/{id}/pay-order` returns that owner's details for the chosen method. Edits by the owner appear on the student's page immediately.
Card link placeholders: `{amount}`, `{reference}`, `{course}` are filled per order. Card details are typed only on the gateway page, never on this site.
Student sends the transaction ID (12-digit UTR for UPI/QR, gateway payment ID for card); the owner approves (student enrolled at once) or rejects with a reason.
Payment history (admin = all, teacher = only their own): Student, Course, Amount, Method, Transaction ID, Date, Status = Pending / Successful / Failed / Cancelled; search, filters, CSV, live refresh.
Removed: the old demo checkout that approved PhonePe/Paytm/UPI payments without money moving. Old single UPI/QR settings are copied once to the first teacher at startup.
Verification is manual (check your bank/UPI/gateway dashboard). Automatic confirmation needs a gateway account + webhook, see "Going live with payments" above.

**Focus session** - the timer now lives at the top of the app, so it keeps running (and finishes, beeps, saves) while the student uses other pages; a timer chip shows in the header.
Fixed: the page used a full-screen overlay that collapsed to a tiny box inside the animated page wrapper; it is now a normal page with the header visible. Added Finish & save early,
sessions that ended while the browser was closed are saved on the right day, multi-tab safe, mobile-sized ring. History/streak are stored on the device (localStorage).

**Navigation** - `NavItem` marks the tab of the current route with `aria-current="page"` (teal text, tinted background, full underline); hover is a lighter separate effect. Works for
`/courses` (also course pages and checkout), `/#demo`, `/focus`, `/contact`, `/dashboard`, `/teacher`, `/admin`, `/payments`.

## Phase 8: NLMed Study (rename, premium UI, forgot password, emails)
**UI build** - `src/main/resources/static` now contains a build of the current source, so `mvn spring-boot:run` shows NLMed Study straight away. After you change anything in `frontend/`, run `run.bat` / `./run.sh` (or `cd frontend && npm run build`) to rebuild it. Maven downloads `spring-boot-starter-mail` on first run.

**Brand** - the platform is **NLMed Study** everywhere (logo, nav, footer, page titles, emails, payment screens, focus notifications, payment-app note). The internal Java package is still `app.studydesk` (not visible to users).

**Navigation** - Home | Courses | Demo Sessions | Teachers | Focus Session | About | Contact. Active tab follows the route (`aria-current="page"`), hover is a lighter separate effect, mobile gets a menu.

**Forgot password** - Login > *Forgot Password?* > enter email > link by email > `/#/reset-password?token=...` > new password + confirm. Tokens are random 256-bit values, only their SHA-256 hash is stored, they work once and expire after 30 minutes,
a new request cancels older links, the response never reveals whether an email exists, requests are limited to one per minute per email, and a successful reset signs the user out everywhere and sends a "password changed" email. Passwords must be 8+ characters.

**Emails** - sent when a student is enrolled (after the teacher approves a payment, or on a free enrol): subject *You have successfully enrolled in [Course] – NLMed Study*, with course, instructor, amount, transaction ID and a "Go to My Course" button.
**Without SMTP settings, emails are printed in the server console** (handy for development: copy the reset link from there). To send real mail set environment variables, e.g. for Gmail with an app password:
`SPRING_MAIL_HOST=smtp.gmail.com SPRING_MAIL_PORT=587 SPRING_MAIL_USERNAME=you@gmail.com SPRING_MAIL_PASSWORD=app-password SPRING_MAIL_PROPERTIES_MAIL_SMTP_AUTH=true SPRING_MAIL_PROPERTIES_MAIL_SMTP_STARTTLS_ENABLE=true APP_BASE_URL=https://your-domain` (`APP_BASE_URL` is used for the links inside emails).

**New API (all computed from the database)** - `GET /api/catalog` (rating, students, discount per course), `/api/teachers`, `/api/public/stats` (home page numbers; satisfaction = share of 4-5 star reviews, hidden until reviews exist), `/api/public/reviews`,
`GET /api/my/dashboard` (courses with progress, payments, upcoming demos, certificates), `GET /api/staff/overview` (revenue, students, 14-day chart, top courses, recent payments; teacher = own data, admin = all),
`POST /api/auth/forgot`, `GET /api/auth/reset/validate`, `POST /api/auth/reset`. `/api/staff/payments` now also filters by `from`, `to` (yyyy-MM-dd) and `courseId`, and rows include the student's email.

**Pages** - new Home (hero, live stats, featured courses, why NLMed Study, teachers, reviews, demos), Courses (search, subject filter, sort), professional course page (banner, curriculum, reviews, sticky price/enrol card, "Start Learning" once enrolled),
Demo Sessions, Teachers, About, student dashboard (welcome, continue learning, my courses, upcoming, focus, recent payments, progress ring, certificates), My Payments, teacher/admin overview cards + charts,
Payment Received page with status / date-range / course filters and the recipient shown, payment success screen with "Go to My Courses".
Course discount: optional `Course.listPrice` (shown struck through). Teachers can set it via `PUT /api/admin/courses/{id}/price` with `{"price":..,"listPrice":..}`.
Demo logins are unchanged (teacher@studydesk.app / teacher123, admin@studydesk.app / admin123): change them before going live.

## Phase 8.1: audit fixes + teacher/admin workspace
Found while checking Phase 8 against the requirements document:
- **Compile error fixed**: `QrPayments.java` used `Payment.userEmail`, which did not exist, so Maven could not build. The field is added (student email now appears in Payment Received).
- **Seed data runs once** (`Seed`): restarting with the MySQL profile used to try to create the demo teacher again and fail.
- **Teachers are isolated from each other**: price, topics, notes, lessons, video uploads, doubts and stats only work on the teacher's own courses (admin: all). Before, any teacher could change another teacher's price, which would change who gets paid how much.
- **Admin can manage courses** (`/#/teacher`, nav "Manage Courses"); previously every course endpoint was TEACHER-only.
- **Instructor name** of a new course is now the creator's name (it used to be the word "Teacher", which showed up on course cards and in the enrolment email). New courses get default topics. Prices are validated (whole rupees, 0 to 10,00,000).
- **Teacher dashboard rebuilt with tabs**: Overview, Courses & prices (with optional *original price* to show a discount), Students (enrolments + lesson progress + CSV), Content, Demo sessions (create + list; there was no way to create one in the UI), Doubts, Messages.
- New endpoints: `GET /api/staff/courses`, `GET /api/staff/students`. Login response also carries the user `id`.
- Header no longer overflows on laptops, tablets and phones (full menu from 1280 px, Log out moved into the mobile menu).

### What was and was not verified
- Frontend: builds, and a headless-browser run against a mock API covered Home, nav active/hover state, Courses, course page, forgot + reset password, student dashboard, checkout (recipient, only enabled methods, QR, UTR), My Payments, every teacher tab, Payment Received + Payment Settings and a 390 px phone width (28 checks, no page errors).
- Backend: type-checked with `javac` against stub Spring APIs (no errors). It was **not** started with the real Spring Boot/Maven here, so run `mvn spring-boot:run` once and tell me about any startup error.
- Not testable here: real email delivery (needs SMTP, see Phase 8) and real money movement (payments are verified manually by the teacher).

## Phase 8.2: demo logins for all three roles
| Role | Email | Password |
|---|---|---|
| Admin | admin@studydesk.app | admin123 |
| Teacher | teacher@studydesk.app | teacher123 |
| Student | student@studydesk.app | student123 |
The demo student is created at startup if missing and is not enrolled in any course, so you can test Enroll > Pay > teacher approves > enrolment email (printed in the console without SMTP). Change or delete all three before going live.

## Phase 9: navbar fix, Style backgrounds, Contact in footer, coupons and entrance exams
**Rebuild the UI once** (`run.bat` / `./run.sh`): this phase changes the frontend (the prebuilt UI in `src/main/resources/static` is still Phase 8.1, except the Style fix below which is already applied to its `index.html`).

**Navbar** - Log out was pushed off screen on laptops because role links, Search, Style and Log out all sat in one row. Now the row is: logo, tabs, Focus timer, Search, Style, theme, and an **account menu** (avatar + name) that is always visible on every screen size. The menu holds My Learning / My Payments / Entrance Exam (student), Dashboard / Payments (teacher), Admin / Manage Courses / Payments (admin) and **Log out**. Search and Style show only icons below very wide screens.
**Contact** - removed from the top bar; it is in the footer (Explore list + the Contact column). The `/#/contact` page still works. New top tab: **Entrance Exam**.
**Style backgrounds** - the page `<body>` had an opaque `bg-ivory` class that painted over the animated backgrounds, so choosing Aurora / Neural net / Heartbeat / Waves / Notebook changed nothing. Removed (in `frontend/index.html` and the built `static/index.html`).

**Coupons** (Teacher/Admin dashboard > *Coupons & exams*; teacher = own courses only, admin = all)
- *Give free*: paste student emails + choose a course -> one single-use 100% coupon per student, tied to that email, sent by email (printed in the console without SMTP).
- *Create coupon*: any % off, optional code, course, student email, number of uses (0 = unlimited), expiry date. A 100% coupon for "any student" must have 1-100 uses.
- *All coupons*: copy code, uses, status (Active / Used / Expired / Disabled), enable/disable.
- Student checkout: a valid coupon shows the new total; **100% off shows "Enroll free with coupon"** (no payment screen). The enrolment is recorded as a Successful payment of Rs 0, method *Free coupon*, so it appears in Payment Received / My Payments, and the enrolment email is sent. The student's own coupons show as tap-to-apply chips. `WELCOME10` (10%) still works.
- Coupon rules are checked on the server (email match, course match, owner, expiry, uses). A wrong, used or expired coupon is refused instead of silently charging full price.

**Entrance exam** (*Coupons & exams > Entrance exam*): write MCQs and reward levels like `90:100,75:50,60:25` (90%+ = free course, 75%+ = 50% off, 60%+ = 25% off). Students open **Entrance Exam**, answer, submit **once**; the server scores it (answers are never sent to the browser), creates a single-use coupon for that student (valid 30 days) and emails it. Staff see every attempt with score and coupon under *Results*.
New API: `GET /api/coupon`, `GET /api/my/coupons`, `POST /api/courses/{id}/redeem`, `GET|POST /api/staff/coupons`, `POST /api/staff/coupons/free-students`, `PUT /api/staff/coupons/{id}/active`, `GET /api/exams`, `GET /api/exams/{id}`, `POST /api/exams/{id}/submit`, `GET|POST /api/staff/exams`, `PUT /api/staff/exams/{id}/active`, `GET /api/staff/exams/{id}/attempts`. New tables are created automatically (`coupon`, `exam`, `exam_question`, `exam_attempt`).
Checked here: new Java compiled against stubs and the reward-tier logic tested; all frontend files parse. Not run here: Maven/Spring startup and the Vite build (no network in this sandbox), so run `run.bat` / `./run.sh` and report any error.

## Phase 9: resources, teacher navigation, live classroom
**Rebuild the UI once** (`run.bat` / `./run.sh`), then restart the server.

**Database is now saved to disk** (`./data/studydesk`, H2 file mode) so users, courses and uploaded-file records survive restarts. Uploaded files are in `./uploads` (keep both folders when you move or back up the app). For production use MySQL (`--spring.profiles.active=mysql`).

**Resources (teacher -> student)**
- Teacher > Resources: pick a course, drag & drop one or many files (PDF, Word, PowerPoint, Excel, TXT, JPG/PNG/WEBP/GIF, MP4/WEBM/MOV), optional module/topic, Note or Resource. Files appear instantly with type, topic, date, size, View / Download / Edit / Delete. Limits: 50 MB documents & images, 600 MB videos (checked in the browser and again on the server).
- Student > My study desk > Course Resources: enrolled students see the same files (filters, search, preview of PDFs/images/videos, download). Teachers only reach files of courses they own; students only courses they are enrolled in.
- New API: `GET /api/staff/materials`, `GET /api/courses/{id}/materials`, `PUT /api/admin/materials/{id}`, `GET /api/materials/{id}/file` (header or `?token=`, `&download=1`).

**Teacher navigation** - left sidebar (desktop) / hamburger drawer (phone, tablet): Dashboard, Courses (+ Coupons & exams), My Students, Resources, Live Sessions, Demo Sessions, Payments, Payment Settings, Messages (+ Student doubts), Profile (name, password), Settings (live defaults, theme, contact details), Logout. The current section is in the URL (`/#/teacher?tab=resources`).

**Live classroom** - the whole classroom (not just the board) goes full screen, so controls never disappear. Top bar: LIVE, session timer, student count, Tools, Full screen, End class. In full screen the bar hides after 3 s of inactivity and returns on mouse move; a small 🛠 button is always there (touch devices: tap it). `T` = tools, `F` = full screen, `Esc` = exit.
- Live Session Tools panel (side panel on tablet/desktop, bottom sheet on phone): mic, camera, flip camera, screen share, drawing tools, Insert Image, shared files, chat, doubts, settings.
- Insert Image: JPG/PNG/WEBP up to 5 MB (type, size and real file signature validated); move by dragging, resize with the corner dot, remove with ✕. Late joiners see the images, strokes, chat and shared files.
- Chat for the whole class; teacher can share any course file with students during class.
- Live images are served only to logged-in users and stored in `uploads/live`.

## Phase 10: dashboards, student profile, resources scrolling, UI polish
**Rebuild the UI once** (`run.bat` / `./run.sh`): the prebuilt UI in `src/main/resources/static` is from this phase. No backend changes.

- **Resources no longer lock the page**: the file preview locked page scrolling on every render, so the Resources list (teacher) and Course Resources (student) could not be scrolled. It now locks only while a file is open.
- **Admin dashboard** rebuilt: header with Back button, KPI tiles, tabs (Overview, Reported problems, Student doubts, Users & owners, Contact). Same actions and API calls as before.
- **Teacher workspace**: header with Back button; mobile section bar sits below the top bar (it overlapped it before).
- **Student profile** (`/#/profile`, also in the account menu and the dashboard): edit name, change password (current password required), email a reset link, theme / accent / background settings (saved on this device), sign out. Uses the existing `/api/me`, `/api/me/password` and `/api/auth/forgot`.
- **Back buttons** on: Admin, Teacher workspace, My Profile, My study desk, My Payments, Payment Received.
- **Mobile header** fits 390 px wide (smaller logo text and icon padding on phones).
- Shared pieces live in `frontend/src/ui.jsx` (`BackButton`, `PageHeader`, `Seg`, `StatTile`).
- Not done: phone number and address (the account has no such fields yet; adding them needs a backend change).

## Phase 11: student details, recordings, live toolbar, teacher home
**Rebuild the UI once** (`run.bat` / `./run.sh`). Backend changes in this phase: a new endpoint `GET /api/staff/student-directory` (`Directory.java`) and the material kind `RECORDING` (`Content.java`). Run the server once after pulling and report any startup error.

- **Registered students** (Admin > *Students*, Teacher > *My Students*): name, email and enrolled courses with the amount paid. Teachers see only students enrolled in their own courses. Admin sees every registered student. Search and a course filter are on the page.
- **Teacher dashboard** is redesigned: greeting with quick actions (Go live, Upload, Schedule demo), stat cards (revenue, students, courses, payments to review), course summaries with progress and a 🔴 Live button, upcoming demo sessions, a 14-day revenue chart, recent students and quick links.
- **Back buttons** are now at the bottom of each long page (one consistent bar with a ← Back button).
- **Student profile** shows the *Registered email* and offers editing, password change and a reset link.
- **Live classroom toolbar**: Mic, Camera, Chat, Tools (teacher) or Class panel (student), Record, Full screen, End class/Leave are one toolbar. Arrow keys move between buttons; `M` mutes the teacher. On phones the bar scrolls sideways instead of covering the video.
- **Class recordings**: the teacher presses ⏺ Record. The board, pictures, the teacher's video and the microphone are mixed in the browser into one WebM file. On ⏹ Stop (or End class) it is uploaded as a course material of type *Class recording*. If the upload fails or the file is over 600 MB, it is downloaded to the teacher's device instead.
  - **Where recordings are stored:** the file goes to the server's `./uploads` folder under a random name (the same place as other course files). Its details (course, title, size, date) are stored in the database table for materials.
  - **Who can open them:** the teacher of the course, and students enrolled in that course, through the existing access check. Teachers find them under Resources > *Recordings*; students under Course Resources > *Recordings*.
  - Limitations: recordings are made in the teacher's browser, so the teacher's tab must stay open for the whole class. Pictures placed on the board are drawn, but the teacher's screen-share is only recorded if it is the camera picture at that moment.

## Phase 12: class recordings

**What it does**
- Teachers record a live class from the classroom toolbar (**Record**, **Pause/Resume**, **Stop**). A consent dialog must be confirmed first (the "Start recording" button stays disabled until the checkbox is ticked). The server stores the consent time with the recording.
- Students see a red "This class is being recorded" banner in the classroom. Pausing and stopping update the banner. Late joiners see it too.
- The recording is mixed in the teacher's browser (whiteboard, pictures, camera picture-in-picture, microphone) and uploaded in numbered 4 MB parts while the class runs. Interrupted uploads are retried with back-off. Parts that have not reached the server are kept in memory, and if the connection stays down past 512 MB recording stops early and the parts already queued are still saved.
- Elapsed time excludes pauses. If the classroom socket drops during recording, the recording continues and the teacher keeps the Stop button.
- **Recordings library** (teacher tab "Recordings", admin tab "Recordings", and a "🎬 Recordings" tab on each course page for students): storage meter, search, course and status filters, sorting, pagination, thumbnails, processing state, play, download, rename, publish/unpublish, delete with confirmation. Admins can also switch downloads on or off per recording.
- **Player**: play/pause, seek bar, 10 s skip, volume and mute, speed (0.5x to 2x), full screen, download, keyboard shortcuts (Space or K play/pause, ←/→ 5 s, J/L 10 s, M mute, F full screen), position memory per device (resumes after 5 s, not in the last 10 s), and a retry button on error.

**Where recordings are stored**
- Files: `recordings.dir` in `application.yml` (default `uploads/recordings`, override with `RECORDINGS_DIR`). Point it at a mounted volume or cloud disk to move storage off the app server. This is server storage, not a cloud-provider integration.
- Metadata (title, course, teacher, status, duration, size, publish flag, download flag, consent time): the `recording` table.
- Files are not under the public static path. Every read goes through `/api/recordings/{id}/video` or `/thumbnail`, which checks the role each time.
- Quota: `recordings.quota-gb` (default 20). The storage meter shows usage against it.

**Who can access what**
- Teachers: their own courses only. Admins: everything.
- Students: only published, finished recordings of courses they are enrolled in. Downloads for students also require the download flag to be on.
- Upload, finish and delete are limited to the course teacher and admins.

**Consent and notice**
- Consent is enforced by the server (`consent: true` is required to create a recording), and the time is stored. Students are notified in the classroom. The teacher is responsible for the legal basis for recording in their jurisdiction.

**Limitations**
- Recording runs in the teacher's browser, so the tab must stay open. The page warns before it is closed while recording.
- Timeline length follows the teacher's browser clock and frame rate. Browsers that cannot record (for example some older iOS versions) get a clear message instead.
- Recordings made in a browser have no length in their file header. The player fixes this on load and falls back to the saved length.
- Legacy recordings uploaded earlier as course materials (kind RECORDING) still appear in Resources → Recordings.

**Testing**
- `mock/rec-test.cjs` (Playwright, Chromium with fake camera and microphone) against the mock API: records a class with a pause, injects an upload failure, goes offline mid-recording, checks decoded audio and video after playback, seeking, speed, mute, rename, publish, delete, and layout at 390 px. With `LONG=1` it also records 35 s in 256 KB parts and checks resume. Last run: 40 passed, 0 failed.
- The Java backend (`Recordings.java`, `LiveSocket.java`) was checked for syntax only. Maven could not download Spring in this environment, so it was not compiled or run against a real server.

## Phase 13: payments, playback, Back navigation, premium motion

**QR payments**
- Students pay with the QR code the course's teacher or admin uploaded (Payments → QR code). The QR is shown first, with the payee's name and the exact amount. A "Show the QR with the amount filled in" toggle shows the generated UPI deep-link QR instead.
- After paying, the student enters the 12-digit UTR. Staff see it under Payments → Needs review and approve or reject. The student's checkout moves through "sent for verification" to "Payment confirmed" without a manual reload.
- If the 15-minute window expires before the student pays, the order is cancelled, but a student who sends a UTR afterwards can still reach staff. `QrPayments.utr()` reopens a lapsed order (only for the "Payment window expired" reason) and refuses other cancelled or expired orders with HTTP 410.
- Receipts: a confirmed payment has a Receipt button in My Payments and on the checkout confirmation. It opens a dialog with course, amount, payee, transaction ID, reference and date, and can be printed or saved as PDF from the browser. Receipts are not emailed.
- Returning to checkout after a successful payment shows "Payment confirmed" with the receipt, not "Already enrolled".

**Recorded class playback**
- The library passes the server's `durationSec` to the player. Browser-recorded WebM files do not carry a duration, so without the hint the seek bar would show an unusable length.
- A stall watchdog reloads the source at the current position after 9 seconds without progress (up to 4 times). Playback position is remembered per recording in localStorage, so reopening a video resumes near where it stopped (not within the last 10 seconds).
- The seek bar shows the buffered range.

**Back navigation and sign-in**
- Back returns to the page the person came from, using a route trail that App.jsx records. It never returns to a sign-in page and never signs out. With no in-app page to return to, it goes to the person's home page.
- Signed-in users who open `/login` or `/register` are redirected to their home page.
- Logout remains a separate action in the account menu and sidebars.

**Premium UI**
- Hover lift on cards (`.lift`), sheen on primary actions (`.shine`), animated payment method tiles (`.paytile`), button transitions with focus rings, shimmer loading placeholders, and a fade-in for receipts.
- All motion is disabled under `prefers-reduced-motion`. Print styles show only the receipt.

**Testing**
- `mock/pay-test.cjs` (Playwright, Chromium): owner uploads QR → student pays and enters UTR → staff approves → success and receipt → My Payments receipt → revisit checkout shows confirmation → Back and login-redirect checks. 19/19 pass.
- `mock/rec-test.cjs` regression: 35/35 default, 40/40 with `LONG=1` (multi-chunk upload, seek and resume on a 35 s recording).
- Note: the lapsed-window flow and the cancelled-order HTTP 410 path were changed in code but not exercised in the browser test.

**Limitations**
- Java files (`QrPayments.java`, `Recordings.java`, `LiveSocket.java`) were not compiled or run against Spring or a database in this environment. Browser tests used the mock API, which mirrors the endpoints but is not the real backend.
- Receipts are on-screen and print-to-PDF only; no emailed PDF.

## Phase 14: header fix, reports, student-only playback, live toolbar auto-hide

**Header**
- The desktop menu row moved to the 2xl breakpoint. Between 1280 and 1535 px the menu collapses to ☰ instead of overlapping the search and style controls. No horizontal overflow at 390, 1366 or 1757 px.

**Report a problem**
- Students and teachers send a report from the floating button. Admins see every report under Admin → Reported problems and can move it to Open, In progress or Resolved (including reopening).
- Mock tests: `mock/report-test.cjs` 7/7.

**Recordings: watch only**
- Downloads are now allowed only for the course's teacher and admins. Students never get a download link or the admin "Allow downloads" toggle. The backend (`Recordings.java`) enforces this with HTTP 403 for students who request `?download=1`.
- Student playback: the browser download menu and picture-in-picture are disabled, right-click on the video is blocked, a faint watermark with the viewer's name is shown, and the picture is blurred and paused when the tab is hidden.
- Limitation: browser screen recording and phone cameras cannot be blocked. The watermark and tab-hide make copies traceable and harder, but they do not prevent them.
- `mock/rec-test.cjs` 40/40 (includes five student-protection checks).

**Live class toolbar**
- The bar now hides after 3 seconds of mouse idle or no touch, in normal view as well as full screen (toggle "Auto-hide controls when idle"). Mouse movement, a tap, or a key press brings it back. While hidden, a ☰/💬 button stays in the corner.
- `mock/toolbar-test.cjs` 5/5.

**Not in this phase**
- Payment gateway (UPI/PhonePe and card with automatic verification). Needs a provider choice and merchant test keys. Current payment flow is unchanged: QR/UPI with staff UTR verification, card via the configured link.
- Full premium UI pass (new themes, glassmorphism, animated backgrounds across all portals). Only the header, toolbar and recording changes above were done.

**Test notes**
- `mock/pay-test.cjs` passes 19/19 on a freshly started mock. It is order-dependent: restart the mock (`node mock/server.mjs <static dir> 8092`) before running it again, because a student who has already paid is correctly shown the confirmation instead of the QR screen.
- Java changes in this phase (`Recordings.java`, one line) and the earlier phases were not compiled against Spring.

## Phase 15: reports with threads, board removed, learning panel, live watermark, more palettes

**Reports and student complaints**
- Students report a problem with a category, an optional course and an optional screenshot (PNG, JPG or WEBP, up to 1 MB). Descriptions must be at least 10 characters.
- Admin sees every report, and a teacher sees reports about their own courses (`Issues.java`, `canStaff`). Both use the same board: search, status and category filters, reply thread, screenshot view, and status buttons (Open, In progress, Resolved).
- Staff replies move an open report to In progress. A student's reply to a resolved report reopens it.
- Students open **My reports** (Student menu) to see replies and reply themselves.
- Endpoints: `POST /api/issues`, `GET /api/my/issues`, `POST /api/my/issues/{id}/reply`, `GET /api/staff/issues`, `PUT /api/staff/issues/{id}/status`, `POST /api/staff/issues/{id}/reply`, `GET /api/issues/{id}/screenshot`. The old admin endpoints still work.
- Tests: `mock/report-test.cjs` 16/16 on a freshly started mock.

**Live classroom**
- Removed the Board class mode, the class-mode picker in the lobby and settings, and the student "Show board / Big video" toggle. The tablet board with camera is the single teaching surface.
- Students see a faint watermark with their name and email over the live stage.

**Themes**
- Four more accent colours: violet, emerald, sky and fuchsia (`index.css`, `fx.jsx`), available from the 🎨 picker on every portal.

**Student learning panel (dashboard)**
- Study streak (server-side, from lesson completions and test attempts; the old per-device streak is no longer the source), longest streak, lessons done, tests taken, average score.
- Six achievement badges with the rule for each. Earned badges are highlighted.
- Upcoming classes with a countdown, course completion bars with accessible progress values, and recommended courses (same subject first).
- `LearningStatsController` (`Progress.java`) at `GET /api/my/learning-stats`. Lesson completions now store a timestamp (`LessonDone.at`); existing rows have none and are not counted toward streaks.
- Tests: `mock/progress-test.cjs` 11/11.

**Test notes**
- The live-room tests keep the mouse moving, because the class bar now auto-hides after 3 s of idle.
- Several suites depend on mock state, so restart the mock before each one.

**Not done in this phase**
- Payment gateway (still waiting for a provider and keys).
- Gradient and animated background themes beyond the existing six backgrounds.
- Notification bell, dashboard charts, and the broader animation pass.
- Java files (`Issues.java`, `Progress.java`, `Phase2.java` one-line change) were parse-checked only; they have not been compiled against Spring or run against a database.

## Phase 16: bug fixes (dark-mode Go Live, payment time limit, UPI apps, live image, student capture deterrents)

**Fixed**
- Go Live button on the teacher and admin dashboards: text was white on a white pill in dark mode. It now uses dark text (17.9:1 contrast).
- Payment time limit: the window was fixed at 15 minutes for QR and 30 for card. It is now one setting per payee (**Payments → Payment time limit**), default 60 minutes, allowed 15–360. The backend (`QrPayments.java`, `PayAccount.windowMinutes`) enforces the range; orders use the payee's value.
- PhonePe / UPI: "Open PhonePe" and "Open any UPI app" use `phonepe://` and `upi://` links with the amount. If the app does not open, the page says so and points to the UPI ID to pay manually. A PhonePe button is disabled with an explanation when no PhonePe number is set.
- Insert Image: the image layer is clipped to the board, so an image cannot push the board's size. I could not reproduce a zoom-out with the mock (it serves one tiny image), so the containment fix is precautionary; please retest with a large photo.
- Student protection on recordings: the player also pauses when the window loses focus, clears the clipboard on PrintScreen, and blurs the picture. Browsers cannot detect external screen recorders, so this is a deterrent, not prevention.
- Removed the watermark overlay from the live classroom.

**Tests**
- `mock/bugfix-test.cjs` 11/11 on a fresh mock: dark-mode contrast, time limit range and saved value, PhonePe link and fallback, image insert size and clipping.
- Regression on fresh mock state: payments 19/19, reports 16/16, live toolbar 5/5, progress 11/11, recordings 40/40.

**Not done**
- Fonts, gradient and animated backgrounds, glassmorphism, and the broader UI pass (item 7).
- Notifications, dashboard charts, and the recommendations and reports upgrades beyond Phase 15 (item 8).
- Watermarks on resources and other course materials (only recordings are watermarked).
- The "Pay before 6 pm" note is the default text owners see on checkout. Owners can change it in Payments settings.
- `QrPayments.java` was parse-checked only; it has not been compiled against Spring.

## Phase 17: site name changed to NLMed Study
- Every visible use of the site name (page titles, logo, header and footer, auth pages, receipts, payment reference, Java-sent emails, the coupon and exam examples, and the README) now says **NLMed Study**.
- The mail sender address still uses `no-reply@nmedstudy.com`. Change `app.mail.from` in `application.yml` and the sender in `Phase8.java` once you have the new domain.
- Internal identifiers (localStorage keys like `nmed-rec-pos-*`, file names such as `nmed-study-phase*.zip`) were not renamed, so existing users keep their saved settings.

## Advanced animations (motion engine)
Files: `frontend/src/motion.jsx` (logic) and `frontend/src/motion.css` (styles). Rebuild the frontend (`./run.sh` or `cd frontend && npm install && npm run build`) to see them.
- **Animation level** (🎨 Style menu → Animations): Full / Lite / Off, saved per device in `ms_motion`. Default follows the OS "reduce motion" setting. Set on `<html data-motion>`.
- **Scroll reveals**: `<Reveal variant="up|down|left|right|zoom|blur|flip">`; `<SplitText text="..."/>` for word-by-word headlines; `<Count to={n} prefix="₹" decimals={2}/>` for counters.
- **Pointer effects (Full)**: 3D tilt on `.ccard` and any `[data-tilt]`, magnetic `.btn`, soft cursor glow, card spotlight; click ripple on `.btn`/`.btn2` (Full and Lite).
- **Scroll effects (Full)**: `data-parallax="0.15"` on any element, aurora drift, header shadow once scrolled.
- **Other**: animated NL logo (ECG line draws in, mark tilts on hover), sliding tab indicator in `Seg`, circular dark-mode reveal (View Transitions API, falls back to an instant switch), cannon confetti and animated `SuccessMark` on payment success.

## Online payments (PhonePe)
Students pay on PhonePe's hosted page with UPI (PhonePe, GPay, Paytm, BHIM and other UPI apps), UPI QR codes or a debit/credit card. Nobody types a transaction ID, and nobody approves payments.

**How a payment is confirmed**
1. The student is sent to PhonePe's payment page and returns to `/api/payments/return/{reference}`.
2. The server asks PhonePe's status API for that transaction. Success is never taken from the browser.
3. PhonePe also calls `/api/webhooks/phonepe`. The server checks the X-VERIFY checksum before trusting it, which covers late confirmations and lost redirects.
4. When PhonePe reports COMPLETED and the amount matches the course price, the payment becomes SUCCESS. The student is enrolled once, the student gets the enrolment email, and the course owner and every admin get the transaction ID by email.

**Duplicates:** each attempt has its own transaction ID. A transaction ID can be linked to only one payment, and enrolment happens once, so repeat checks and repeated callbacks change nothing.

**Set up (sandbox first)**
1. Create a PhonePe merchant account and get sandbox credentials: merchant ID, salt key and salt index.
2. Copy `phonepe.env.example.bat` to `phonepe.env.bat` and fill them in, keeping `PHONEPE_ENV=sandbox`.
3. Register the callback URL `https://<your-domain>/api/webhooks/phonepe` with PhonePe. The return page works on localhost. Callbacks need a public URL, so use a tunnel such as ngrok for local testing.
4. Run `run.bat`. The console should show `PhonePe payments loaded (SANDBOX mode)`.

**Before going live:** switch to `PHONEPE_ENV=live` with live credentials, and complete PhonePe's merchant approval.

**Money and payouts:** all payments settle into your single PhonePe merchant account. This version has no automatic split to teachers or admins, so pay them out yourself and record it. Refunds are also handled outside the app for now: the app does not change enrolment when a refund is made.

**Not verified:** the PhonePe request fields, endpoints and checksum format were written without access to PhonePe's live documentation. Check them against PhonePe's current API docs, and test them in the sandbox before any real payment.

## Quick start (Windows)
1. Copy `phonepe.env.example.bat` to `phonepe.env.bat` and fill in your sandbox credentials.
2. Double-click `run.bat`. It loads the settings, builds the frontend, and starts the server.
3. Open http://localhost:8080.


## Payments (current design: UPI, QR and card, no payment gateway)
There is no PhonePe or other payment gateway. Money goes straight to the course owner's own UPI ID, QR code or card payment link (set in Payments > Payment Settings).

How a payment is confirmed:
1. The student pays the amount shown and types their reference (for example NMS...) in the payment note.
2. The student presses **I have paid**. This only sends the payment to the owner for checking. The course is NOT unlocked yet. The owner and every admin get an email and SMS with the student, course, amount and reference.
3. The owner checks their bank or card account for that amount and reference, then clicks **Approve** (optionally entering the bank transaction ID) or **Reject** (with a reason). Approval enrols the student and emails them. Rejection emails the reason.

Notes:
- Students are never asked for a transaction ID.
- Nothing the browser reports marks a payment as paid. Only the owner's approval does.
- If you reject a payment the money was already received for, refund it yourself.
- A student with a payment waiting cannot start a second order for the same course.
- Statuses: AWAITING, PENDING_APPROVAL, SUCCESS, REJECTED, EXPIRED, CANCELLED (REFUNDED when money is returned).

SMS alerts (optional): set `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`. Without them, texts are printed to the server log. SMS in India needs a DLT-registered sender ID and template. Each admin or teacher sets their mobile number in Payment Settings.

Database: `ddl-auto: update` adds `users.mobile` and the new status values. Old PhonePe columns are left in place unused, so nothing is deleted.

The older sections below that mention PhonePe describe the removed gateway and are out of date.

## Payment approval and notifications
Default: automatic. PhonePe confirms a payment and the course unlocks at once (no approval step).

Optional per staff account (Payments > Payment Settings > "I approve each payment before the course unlocks"):
1. A payment verified by PhonePe is held as **PENDING_APPROVAL**. The course is NOT unlocked yet.
2. The course owner and every admin get an **email and SMS** with student name, course, amount, transaction ID and reference, plus steps to approve or reject.
3. **Approve** (Payments page, or `POST /api/staff/payments/{ref}/approve`): status becomes SUCCESS, the student is enrolled and emailed.
4. **Reject** (`POST /api/staff/payments/{ref}/reject` with `{"reason": "..."}`): status becomes REJECTED, the student is emailed the reason. Money already captured by PhonePe must be refunded from the PhonePe dashboard.
5. Decisions are idempotent and only the course owner (or an admin) can make them. Students cannot start a second order while a payment is waiting.

Each staff account stores a mobile number for SMS (Payment Settings). Student notifications are email only, because student accounts have no mobile number on file.

SMS configuration (environment variables; without them the text is printed to the server log):
- `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`
- SMS to Indian mobile numbers must use a DLT-registered sender ID and template. Register these with your SMS provider before going live.

Database: new columns `users.mobile` and `pay_account.approval_required` and the new status value are added automatically by `ddl-auto: update`. Nothing existing is deleted.

## Test payments (no PhonePe account needed, local only)
If PHONEPE_MERCHANT_ID / PHONEPE_SALT_KEY are not set and the app runs on http://localhost, "Pay" opens a built-in test page instead of PhonePe. Choose "Simulate successful payment" or "Simulate failed payment". The result goes through the same code as a real PhonePe confirmation (amount check, enrolment, approval and emails). No money moves.
- It never runs on a public address. Real payments always need PhonePe credentials and an https APP_BASE_URL.
- Turn it off with PAYMENTS_SIMULATOR=off.
- The admin payment-gateway check reports "test" mode while it is active.

## Course plans (topics and days)
A teacher or admin can give one student chosen topics of a course, either for a number of days or between two dates, at a fee they set (Teacher portal > Course plans).
- The student is emailed, pays from their dashboard (same UPI / QR / card flow and approval), and the plan starts when the payment is approved.
- Day-based plans start on the approval day; date-based plans keep their dates. Only the end date can be extended, and an active plan can be ended at any time.
- Access: an active plan opens only its topics, and only inside its dates. Full course enrolments keep the existing behaviour.
- Live classes and video lessons are checked at course level for plan students; topic-level restriction for those is not included yet.
- Not included yet: payment screenshot upload (Phase 2) and raise-hand / microphone / camera controls (Phase 3).

## Payment screenshot upload
On the payment step, the student can:
- **Upload Screenshot:** choose a JPG, PNG or WEBP file (up to 5 MB) from the computer or phone gallery, check the preview, replace it if needed, then upload.
- **Scan to Upload Screenshot:** a QR code opens a mobile page where the student takes a photo or picks one from the gallery. The page shows only the course, amount and reference. It needs no login.

Rules:
- The QR carries a random one-time token, stored only as a hash. It expires after 15 minutes, takes at most 10 uploads, and a new QR for the same payment replaces the old one. It is for uploading proof only, never for paying.
- A screenshot never confirms a payment. The first screenshot on an open order moves it to PENDING_VERIFICATION; the owner or an admin then checks the money and approves or rejects it.
- Only the student who paid, and staff who may see the payment, can open the stored screenshot. Files are kept under `uploads/proofs`, not in a public folder.
- The phone must be able to reach the site. Set `APP_BASE_URL` to the public https address; with a localhost address the QR shows a warning.
- Status rename: PENDING_APPROVAL is now PENDING_VERIFICATION. Existing rows are updated once at startup.

## Payment screenshot workflow (email link, upload, I Have Paid)
1. The student starts a payment. The system emails them the payment instructions and a secure **Upload screenshot** link (valid 48 hours, one link per payment, only its hash is stored).
2. The link opens a mobile-friendly page (`/#/proof/<token>`). The student uploads a JPG, PNG or WEBP screenshot (checked by its real file type, up to 5 MB).
3. The student presses **I Have Paid**. Only this step sends the payment for verification (status `PENDING_VERIFICATION`), and the student gets an email confirming receipt. Pressing it twice changes nothing. Uploads are closed after this.
4. The owner or admin checks the money and approves or rejects it. Approval moves the payment to `SUCCESS`, activates access and emails the student. A screenshot alone never confirms a payment.

Notes: a new phone QR for the same payment replaces the email link (the link is a single token per payment). A repeat order for the same course reuses the existing payment and does not send a new email. Emails need SMTP settings in production; without them they are printed to the server log.

## Email setup (required for payments)
Payment instructions and upload links are emailed. Without SMTP settings, no email is sent (the server log says so), and students see "We could not email your upload link".

Set these environment variables on the server, then restart it:
- `SMTP_HOST` - your mail server, for example smtp.gmail.com, smtp.sendgrid.net or smtp-relay.brevo.com
- `SMTP_PORT` - usually 587
- `SMTP_USERNAME` and `SMTP_PASSWORD` - the account credentials (for Gmail, use an App Password)
- `APP_MAIL_FROM` (optional) - the sender address, for example `NLMed Study <no-reply@yourdomain.com>`. Many providers only send from addresses on a verified domain.
- `APP_BASE_URL` - your public https address, so the links in emails work

Then open Admin dashboard > Email, enter an address and press **Send test email**. It shows the mail server's exact answer if something is wrong.

## Proctoring for entrance exams and course assessments
- **Before the test:** the student confirms the rules, then full-screen mode and the camera are checked from their own click. The test does not start without both.
- **During the test:** a webcam snapshot is saved about every 15 seconds. These are recorded: switching tabs or clicking outside the test, leaving full screen, copy, paste, right-click, the Print Screen key, the camera being turned off, and losing the internet. If full screen or the camera is lost, the test is covered until it is restored.
- **On submit:** the server refuses the submission unless a snapshot exists for that student and test, so the camera step cannot be skipped by calling the API directly.
- **Teacher and admin:** on the Exams page, choose an attempt under "Proctoring review" to see the warnings with times and the snapshots. Teachers see only their own exams; admins see all.
- **Storage:** snapshots are saved in `uploads/proctor/` and are only served to the teacher or admin who may review that test.

Limits: a browser cannot fully stop a determined student (for example, someone using a second device or a phone pointed at the screen). This makes cheating visible and recorded; it does not make it impossible. Snapshots are periodic, not continuous video. Course-assessment review is stored on the server; a teacher screen for assessment review is not added yet.

## Live-session reminders
- **Demo sessions:** booking a free seat sends a confirmation. About an hour before the start, each registrant gets one reminder with the join link. A check runs every 5 minutes; each person is reminded once.
- **Time zone:** reminders use the server's time zone. Run the server on Indian Standard Time, or set the time zone on the server.
- **Course live classes** have no schedule in the data, so they get no reminders.

## Live class waiting room and attendance
- **Waiting room:** a student who opens a live class waits until the teacher lets them in. The teacher sees them under **People → Waiting to be let in**, with **Admit**, **Deny** and **Admit all**, and gets a notice when someone arrives. Admins join directly.
- **Attendance starts on admission:** a visit is recorded from the moment the teacher admits the student, not when they first connect. Students still waiting, or turned away, are not counted.
- **Reconnects:** a student whose connection drops during the same class gets back in without being admitted again. A new class needs a fresh admission.
- **Report:** People → Attendance report, as before.
- Not verified against a running server in this build environment: the backend was syntax-checked only, and the frontend was built with Vite. Test one student and one teacher in two browsers before using it in class.

## Live class: ending the class and student media
- **End class (teacher):** after confirming, the session is marked ENDED in the database (`LiveSession`), attendance is closed at that moment, and every connected student receives `class_ended`. Their camera and microphone are released and the screen says "This live class has ended. Thank you for attending!" with a Return to dashboard button. A student who reconnects to that class is refused.
- **Students' microphone and camera:** buttons are in the class toolbar. The device is requested on the first press (browser permission prompt) and released when the button is turned off. The teacher's roster follows the real state. Teacher mute and camera-off requests release the device too.
- **Teacher disconnects unexpectedly:** students see "Your teacher has disconnected. Waiting for them to come back…" and rejoin automatically when the teacher returns. The class is not ended.
- **Browser test:** see `tests/live-class/README.md`. It covers the client only, not the Java backend.

## Theme: admin default and personal choice
- **Admin default:** Admin → Font & appearance now also sets the default theme (light or dark) and accent colour for everyone who has not picked their own on this device. Palettes: Indigo (default), Teal, Navy blue, Lavender, Emerald, Rose, Amber, Sky, Fuchsia, Violet.
- **Personal choice wins:** the dark-mode button and the profile page save to this device and override the admin default. The choice survives refresh and login on that device. It is not stored on the account, so it does not follow the user to another device.
- **Smooth switch:** colours fade over about half a second when the theme changes. Turned off when the device asks for reduced motion.
- **Browser test:** `tests/live-class/theme.cjs` (run with `node tests/live-class/theme.cjs src/main/resources/static`).
