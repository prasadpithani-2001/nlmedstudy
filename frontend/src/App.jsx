import {Emails} from './pages/Emails'
import {TopBack,OfflineBanner} from './ui'
import {ScrollProgress,ScrollTop} from './motion'
import {HashRouter,Routes,Route,Link,Navigate,useNavigate,useLocation} from 'react-router-dom'
import {createContext,useContext,useEffect,useRef,useState} from 'react'
import api,{msg} from './api'
import {Home,Courses,CourseDetail,Demos,Teachers,About,useGet} from './pages/Public'
import {Login,Register,Forgot,Reset} from './pages/Auth'
import {StudentDashboard,MyPayments} from './pages/Dash'
import {Contact} from './pages/Contact'
import {Exams} from './pages/Exams'
import {Payments} from './pages/Payments'
import {Focus} from './pages/Focus'
import {FocusProvider,FocusPill,FocusToast} from './focus'
import {Checkout} from './pages/Checkout'
import {PaymentResult} from './pages/PaymentResult'
import {Learn} from './pages/Student'
import {Teacher} from './pages/Teacher'
import {Admin} from './pages/Admin'
import {Live} from './pages/Live'
import {StudentProfile} from './pages/StudentProfile'
import {Backdrop,Palette,ThemeButton,SearchButton,StylePicker,ScrollBar,useSpotlight} from './fx'
import {MyReportsPage,CATEGORIES} from './pages/Reports'
import {Logo} from './brand'
import {ProofUpload} from './pages/ProofUpload'
const Ctx=createContext();export const useAuth=()=>useContext(Ctx)
function Guard({role,children}){const {user}=useAuth();if(!user)return <Navigate to="/login"/>;if(role&&![].concat(role).includes(user.role))return <Navigate to="/"/>;return children}
/* One header tab. ACTIVE (aria-current=page) follows the current route and stays highlighted; HOVER is a separate lighter effect (see .navlink in index.css). */
function NavItem({to,starts=[],children,onClick}){const l=useLocation(),[path,hash]=to.split('#')
 const active=hash?l.pathname===(path||'/')&&l.hash==='#'+hash:l.pathname===path||starts.some(x=>l.pathname.startsWith(x))
 return <Link className="navlink whitespace-nowrap text-[15px] font-medium" to={to} onClick={onClick} aria-current={active?'page':undefined}>{children}</Link>}
/* Account menu: avatar + name, role links and Log out. Always visible (no screen size hides it), so logging out never depends on header width. */
function UserMenu({user,links,onLogout}){const [open,setOpen]=useState(false),ref=useRef(null),l=useLocation()
 useEffect(()=>{setOpen(false)},[l.pathname])
 useEffect(()=>{if(!open)return;const o=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)},k=e=>{if(e.key==='Escape')setOpen(false)};addEventListener('pointerdown',o);addEventListener('keydown',k);return()=>{removeEventListener('pointerdown',o);removeEventListener('keydown',k)}},[open])
 return <div className="relative" ref={ref}>
  <button type="button" className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-surface/60 py-1 pl-1 pr-3 text-sm font-semibold transition hover:border-teal hover:bg-teal/10 dark:bg-white/5" aria-haspopup="menu" aria-expanded={open} aria-label={`Account menu for ${user.name}`} onClick={()=>setOpen(!open)}>
   <span className="avatar h-8 w-8 text-sm" aria-hidden="true">{(user.name||'?')[0].toUpperCase()}</span><span className="hidden max-w-[6.5rem] truncate xl:inline">{user.name}</span><span aria-hidden="true" className="text-xs opacity-60">▾</span></button>
  {open&&<div role="menu" aria-label="Account" className="box absolute right-0 top-full z-50 mt-2 w-60 animate-fadeUp !bg-ivory !p-2 dark:!bg-[#111a26]">
   <div className="px-3 pb-2 pt-1"><p className="truncate font-semibold text-navy">{user.name}</p><p className="text-xs uppercase tracking-wider opacity-60">{String(user.role||'').toLowerCase()}</p></div>
   {links.map(([to,label])=><Link key={to+label} role="menuitem" to={to} className="navlink block text-sm">{label}</Link>)}
   <button type="button" role="menuitem" className="navlink mt-1 block w-full border-t border-slate-200/70 text-left text-sm font-semibold !text-rose-700" onClick={onLogout}>⎋ Log out</button></div>}</div>}
function Nav(){const {user,setUser}=useAuth();const go=useNavigate(),l=useLocation(),[open,setOpen]=useState(false)
 useEffect(()=>{setOpen(false)},[l.pathname])
 const close=()=>setOpen(false)
 const tabs=<><NavItem to="/" onClick={close}>Home</NavItem><NavItem to="/courses" starts={['/course/','/checkout/']} onClick={close}>Courses</NavItem><NavItem to="/demos" onClick={close}>Demo Sessions</NavItem><NavItem to="/teachers" onClick={close}>Teachers</NavItem><NavItem to="/exams" onClick={close}>Entrance Exam</NavItem><NavItem to="/focus" onClick={close}>Focus Session</NavItem><NavItem to="/about" onClick={close}>About</NavItem></>
 const roleLinks=<>{user?.role==='STUDENT'&&<><NavItem to="/dashboard" starts={['/learn/']} onClick={close}>My Learning</NavItem><NavItem to="/my-payments" onClick={close}>My Payments</NavItem><NavItem to="/my-reports" onClick={close}>My Reports</NavItem><NavItem to="/profile" onClick={close}>My Profile</NavItem></>}
  {user?.role==='TEACHER'&&<NavItem to="/teacher" onClick={close}>Dashboard</NavItem>}{user?.role==='ADMIN'&&<><NavItem to="/admin" onClick={close}>Admin</NavItem><NavItem to="/teacher" onClick={close}>Manage Courses</NavItem></>}
  {(user?.role==='ADMIN'||user?.role==='TEACHER')&&<NavItem to="/payments" onClick={close}>Payments</NavItem>}{(user?.role==='ADMIN'||user?.role==='TEACHER')&&<NavItem to="/emails" onClick={close}>Emails</NavItem>}</>
 const logout=()=>{localStorage.removeItem('ms_user');setUser(null);go('/')}
 const menuLinks=user?.role==='STUDENT'?[['/dashboard','📚 My Learning'],['/my-payments','🧾 My Payments'],['/my-reports','📝 My Reports'],['/profile','👤 My Profile'],['/exams','📝 Entrance Exam']]
  :user?.role==='TEACHER'?[['/teacher','📊 Dashboard'],['/payments','💳 Payments'],['/emails','✉️ Emails']]
  :user?.role==='ADMIN'?[['/admin','🛡️ Admin'],['/teacher','📚 Manage Courses'],['/payments','💳 Payments'],['/emails','✉️ Emails']]:[]
 return <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-surface/80 backdrop-blur-xl">
  <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
   <Link to="/" aria-label="NLMed Study home"><Logo/></Link>
   <nav aria-label="Main" className="mx-auto hidden min-w-0 flex-1 items-center justify-center gap-0.5 overflow-hidden 2xl:flex [&_.navlink]:px-2.5 [&_.navlink]:text-sm">{tabs}</nav>
   <div className="ml-auto flex shrink-0 items-center gap-1.5 2xl:ml-0">
    <FocusPill/><SearchButton/><StylePicker/><ThemeButton/>
    {user?<UserMenu user={user} links={menuLinks} onLogout={logout}/>
    :<><Link className="btn2 hidden !py-1.5 sm:inline-flex" to="/login">Login</Link><Link className="btn !py-1.5" to="/register">Sign up</Link></>}
    <button className="btn2 !min-h-[40px] !px-3 2xl:hidden" aria-label="Menu" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'✕':'☰'}</button></div></div>
  {open&&<nav aria-label="Mobile" className="menu-panel mx-auto grid max-w-7xl gap-1 border-t border-slate-200/70 px-4 pb-4 pt-2 2xl:hidden">{tabs}{roleLinks}{!user&&<Link className="navlink" to="/login" onClick={close}>Login</Link>}{user&&<button type="button" className="navlink text-left" onClick={()=>{close();logout()}}>Log out ({user.name})</button>}</nav>}
  </header>}
const MAX_SHOT_BYTES = 1000000
function Report(){const {user}=useAuth(),[open,setOpen]=useState(false),[m,setM]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[shot,setShot]=useState(''),[cat,setCat]=useState('Payment'),[course,setCourse]=useState(''),[courses,setCourses]=useState([]),[done,setDone]=useState('')
 useEffect(()=>{if(!open||!user||courses.length)return;const req=user.role==='TEACHER'?api.get('/staff/courses'):api.get('/my/dashboard')
   req.then(r=>setCourses(user.role==='TEACHER'?(r.data||[]).map(c=>({id:c.id,name:c.name})):(r.data?.courses||[]).map(c=>({id:c.courseId,name:c.name})))).catch(()=>{})},[open,user,courses.length])
 if(!user||user.role==='ADMIN')return null
 const pick=e=>{const f=e.target.files?.[0];setErr('');if(!f)return setShot('');if(!/^image\/(png|jpeg|webp)$/.test(f.type))return setErr('Use a PNG, JPG or WEBP screenshot');if(f.size>MAX_SHOT_BYTES)return setErr('Screenshot is too large (max 1 MB)');const r=new FileReader();r.onload=()=>setShot(String(r.result));r.onerror=()=>setErr('Could not read that file');r.readAsDataURL(f)}
 const send=async e=>{e.preventDefault();setErr('');setDone('');if(m.trim().length<10)return setErr('Describe the problem in at least 10 characters');setBusy(true)
   try{await api.post('/issues',{category:cat,message:m.trim(),courseId:course?Number(course):null,screenshot:shot||null});setM('');setShot('');setCourse('');setDone('Thanks! The admin has been notified. Track it under My reports.')}catch(x){setErr(msg(x))}finally{setBusy(false)}}
 return <div className="fixed bottom-4 right-4 z-20">{open&&<form onSubmit={send} className="box mb-2 grid w-80 max-w-[calc(100vw-2rem)] animate-fadeUp gap-2" aria-label="Report a problem">
 <label htmlFor="rc">What kind of problem?</label>
 <select id="rc" className="inp" value={cat} onChange={e=>setCat(e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
 <label htmlFor="rcourse">Course (optional)</label>
 <select id="rcourse" className="inp" value={course} onChange={e=>setCourse(e.target.value)}><option value="">Not about a course</option>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
 <label htmlFor="rm">Describe it</label><textarea id="rm" value={m} onChange={e=>setM(e.target.value)} rows={3} maxLength={2000} className="inp" placeholder="What happened, and what did you expect?"/>
 <label htmlFor="rshot" className="text-sm">Screenshot (optional, max 1 MB)</label><input id="rshot" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={pick}/>
 {shot&&<div className="flex items-center gap-2"><img src={shot} alt="Screenshot preview" className="h-14 w-20 rounded-lg object-cover"/><button type="button" className="btn2 !min-h-[32px] !py-1 text-sm" onClick={()=>setShot('')}>Remove</button></div>}
 <button className="btn" disabled={busy}>{busy?'Sending…':'Send to admin'}</button>
 <p role="status" className="text-teal">{done}</p><p role="alert" className="text-amber-700">{err}</p></form>}
 <button className="btn2 bg-ivory" aria-expanded={open} onClick={()=>setOpen(!open)}>⚠ Report a problem</button></div>}
const TITLES={'/':'Home','/emails':'Emails','/courses':'Courses','/demos':'Demo Sessions','/teachers':'Teachers','/focus':'Focus Session','/about':'About','/contact':'Contact','/exams':'Entrance Exam','/login':'Login','/register':'Sign up','/forgot-password':'Forgot Password','/reset-password':'Reset Password','/dashboard':'My Learning','/my-payments':'My Payments','/my-reports':'My Reports','/profile':'My Profile','/payments':'Payments','/teacher':'Dashboard','/admin':'Admin'}
function Page({children}){const l=useLocation()
 /* route trail for Back navigation (see useBack in ui.jsx): a page is pushed on the way in and popped when the person goes back */
 useEffect(()=>{const t=(window.__nmedTrail=window.__nmedTrail||[]),p=l.pathname;if(t[t.length-2]===p)t.pop();else if(t[t.length-1]!==p)t.push(p);if(t.length>60)t.splice(0,t.length-60)},[l.pathname])
 useEffect(()=>{const t=TITLES[l.pathname];document.title=(t&&t!=='Home'?t+' · ':'')+'NLMed Study'+(t==='Home'||!t?' — Learn Better. Study Smarter. Achieve More.':'')},[l.pathname])
 useEffect(()=>{if(l.pathname==='/'&&l.hash==='#demo'){const t=setTimeout(()=>document.getElementById('demo')?.scrollIntoView({behavior:'smooth'}),150);return()=>clearTimeout(t)}},[l.pathname,l.hash])
 return <div key={l.pathname} className="page-enter">{children}</div>}
function Footer(){const c=useGet('/contact-info'),i=c&&!Array.isArray(c)?c:{}
 const L=({to,children})=><li><Link className="opacity-80 transition hover:text-teal hover:opacity-100" to={to}>{children}</Link></li>
 return <><footer className="mt-16 border-t border-slate-200/70 bg-white/50 px-4 pb-6 pt-12 backdrop-blur"><div className="mx-auto grid max-w-7xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
  <div><Link to="/" aria-label="NLMed Study home"><Logo/></Link><p className="mt-3 max-w-xs text-sm opacity-80">Learn Better. Study Smarter. Achieve More. Expert courses, live sessions and focused learning in one place.</p></div>
  <div><h2 className="font-serif text-base text-navy">Explore</h2><ul className="mt-2 grid gap-1.5 text-sm"><L to="/courses">Courses</L><L to="/demos">Demo Sessions</L><L to="/teachers">Teachers</L><L to="/exams">Entrance Exam</L><L to="/focus">Focus Session</L><L to="/about">About NLMed Study</L><L to="/contact">Contact</L></ul></div>
  <div><h2 className="font-serif text-base text-navy">Contact</h2><ul className="mt-2 grid gap-1.5 text-sm">{i.phone&&<li>📞 <a className="hover:underline" href={`tel:${i.phone.replace(/[^+\d]/g,'')}`}>{i.phone}</a></li>}{i.email&&<li>✉️ <a className="break-all hover:underline" href={`mailto:${i.email}`}>{i.email}</a></li>}{i.address&&<li>📍 {i.address}</li>}{i.hours&&<li>🕒 {i.hours}</li>}<L to="/contact">Send us a message →</L></ul></div>
  <div><h2 className="font-serif text-base text-navy">Secure payments</h2><p className="mt-2 flex flex-wrap gap-2 text-sm">{['QR code','UPI','Card'].map(x=><span key={x} className="chip">{x}</span>)}</p><p className="mt-3 text-xs opacity-70">Payments go directly to the teacher's UPI or card account. We never store your card details.</p></div></div>
  <div className="mx-auto mt-10 flex max-w-7xl flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-4 text-xs opacity-70"><span>© {new Date().getFullYear()} NLMed Study. All rights reserved.</span><span>Made for focused learners.</span></div></footer>
  {i.whatsapp&&<a href={`https://wa.me/${i.whatsapp}`} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp" className="fixed bottom-4 left-4 z-20 grid h-14 w-14 place-items-center rounded-full bg-[#25d366] text-2xl text-white shadow-lg transition hover:scale-110"><span className="absolute inset-0 animate-ping2 rounded-full bg-[#25d366]" aria-hidden="true"/><span className="relative" aria-hidden="true">💬</span></a>}</>}
const NotFound=()=><div className="mx-auto max-w-md py-16 text-center"><p className="gradient-text font-serif text-7xl font-extrabold">404</p><h1 className="mt-2 text-2xl text-navy">We couldn't find that page</h1><p className="mt-1 opacity-80">The link may be old or mistyped.</p><Link className="btn mt-5" to="/">Back to Home</Link></div>
export default function App(){
 const [user,setUser]=useState(()=>JSON.parse(localStorage.getItem('ms_user')||'null'));useSpotlight()
 return <Ctx.Provider value={{user,setUser}}><FocusProvider><HashRouter><ScrollBar/><Backdrop/><Palette/><Nav/><main className="mx-auto max-w-7xl px-4 py-6"><Page>
 <OfflineBanner/><TopBack/><ScrollProgress/><ScrollTop/><Routes><Route path="/" element={<Home/>}/><Route path="/courses" element={<Courses/>}/><Route path="/course/:id" element={<CourseDetail/>}/>
 <Route path="/contact" element={<Contact/>}/><Route path="/exams" element={<Exams/>}/><Route path="/my-reports" element={<Guard role="STUDENT"><MyReportsPage/></Guard>}/><Route path="/checkout/:id" element={<Guard role="STUDENT"><Checkout/></Guard>}/><Route path="/payment/:ref" element={<Guard><PaymentResult/></Guard>}/><Route path="/live/:id" element={<Guard><Live/></Guard>}/><Route path="/focus" element={<Focus/>}/><Route path="/demos" element={<Demos/>}/><Route path="/teachers" element={<Teachers/>}/><Route path="/about" element={<About/>}/>
 <Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/><Route path="/forgot-password" element={<Forgot/>}/><Route path="/reset-password" element={<Reset/>}/>
 <Route path="/dashboard" element={<Guard role="STUDENT"><StudentDashboard/></Guard>}/><Route path="/my-payments" element={<Guard role="STUDENT"><MyPayments/></Guard>}/><Route path="/profile" element={<Guard role="STUDENT"><StudentProfile/></Guard>}/><Route path="/learn/:id" element={<Guard><Learn/></Guard>}/>
 <Route path="/emails" element={<Guard role={['ADMIN','TEACHER']}><Emails/></Guard>}/><Route path="/payments" element={<Guard role={['ADMIN','TEACHER']}><Payments/></Guard>}/><Route path="/teacher" element={<Guard role={['TEACHER','ADMIN']}><Teacher/></Guard>}/><Route path="/admin" element={<Guard role="ADMIN"><Admin/></Guard>}/><Route path="/proof/:token" element={<ProofUpload/>}/><Route path="*" element={<NotFound/>}/></Routes></Page></main><Footer/><Report/><FocusToast/></HashRouter></FocusProvider></Ctx.Provider>}
