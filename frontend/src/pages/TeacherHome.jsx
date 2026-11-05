import {useEffect,useMemo,useState} from 'react'
import {RecentPayments} from './RecentPayments'
import {Link} from 'react-router-dom'
import api,{msg} from '../api'
import {useAuth} from '../App'
import {inr,initials,theme} from './Public'
import {Bars} from './Dash'
import {StatTile} from '../ui'

/* Teacher dashboard (Phase 11): key numbers, course summaries, upcoming sessions, revenue and recent students.
   Every number comes from the server; the server limits each teacher to their own courses and students. */
const greet=()=>{const h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening'}
const EMPTY_OV={revenue:0,month:0,pending:0,days:[],byCourse:[],recent:[]}

export function TeacherHome(){
 const {user}=useAuth()
 const [ov,setOv]=useState(null),[courses,setCourses]=useState(null),[students,setStudents]=useState(null),[mats,setMats]=useState(null),[demos,setDemos]=useState(null),[err,setErr]=useState('')
 useEffect(()=>{const pick=(u,set,fb)=>api.get(u).then(r=>set(r.data)).catch(e=>{set(fb);setErr(msg(e))})
  pick('/staff/overview',setOv,EMPTY_OV);pick('/staff/courses',setCourses,[]);pick('/staff/students',setStudents,[]);pick('/staff/materials',setMats,[]);pick('/demos',setDemos,[])},[])

 const perCourse=useMemo(()=>(courses||[]).map(c=>{const en=(students||[]).filter(s=>s.courseId===c.id)
   return {...c,enrolled:en.length,avg:en.length?Math.round(en.reduce((a,s)=>a+(s.percent||0),0)/en.length):0,files:(mats||[]).filter(m=>m.courseId===c.id).length}}),[courses,students,mats])
 const uniq=useMemo(()=>new Set((students||[]).map(s=>s.email)).size,[students])
 const upcoming=useMemo(()=>(demos||[]).filter(d=>new Date(d.startsAt).getTime()>=Date.now()-3600e3).sort((a,b)=>new Date(a.startsAt)-new Date(b.startsAt)).slice(0,4),[demos])
 const recent=useMemo(()=>[...(students||[])].sort((a,b)=>String(b.since).localeCompare(String(a.since))).slice(0,5),[students])
 const firstName=user?.name||'there'

 return <div className="grid min-w-0 grid-cols-1 gap-6">
  <section className="stat-glass relative overflow-hidden p-6 md:p-8" aria-label="Welcome">
   <div className="hero-blob -right-12 -top-16 h-64 w-64 bg-white"/>
   <div className="relative flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0 break-words"><p className="text-sm font-semibold text-white/80">{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</p>
     <h2 className="mt-1 text-3xl font-extrabold text-white md:text-4xl">{greet()}, {firstName}</h2>
     <p className="mt-1 text-white/85">Here is how your courses and students are doing today.</p></div>
    <div className="flex flex-wrap gap-2">
     {courses?.[0]&&<Link to={`/live/${courses[0].id}`} className="inline-flex items-center rounded-xl bg-surface px-4 py-2 text-sm font-bold !text-slate-900 shadow-lg transition hover:-translate-y-0.5">🔴 Go live</Link>}
     <Link to="/teacher?tab=resources" className="inline-flex items-center rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/30">🗂️ Upload</Link>
     <Link to="/teacher?tab=demos" className="inline-flex items-center rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/30">🎥 Schedule demo</Link></div></div>
  </section>

  {err&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Some numbers could not be loaded: {err}</p>}

  <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
   <StatTile icon="💰" label="Revenue" value={ov?inr(ov.revenue||0):'…'} hint={ov?`${inr(ov.month||0)} this month`:''} to="/payments"/>
   <StatTile icon="👥" label="Students" value={students?uniq:'…'} hint={students?`${students.length} enrolment${students.length===1?'':'s'}`:''} to="/teacher?tab=students"/>
   <StatTile icon="📚" label="Courses" value={courses?courses.length:'…'} hint={mats?`${mats.length} file${mats.length===1?'':'s'} uploaded`:''} to="/teacher?tab=courses"/>
   <StatTile icon="🔔" label="Needs approval" value={ov?ov.pending||0:'…'} hint={ov?(ov.pending?'Check and approve in Payments':'All clear'):''} to="/payments"/>
  </section>

  <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
   <section className="box" aria-labelledby="cs-h">
    <div className="mb-4 flex items-center justify-between gap-2"><h2 id="cs-h" className="text-xl text-navy">Course summary</h2><Link to="/teacher?tab=courses" className="text-sm font-semibold text-teal hover:underline">Manage courses →</Link></div>
    {courses===null?<div className="skel h-48"/>:perCourse.length===0?<p className="py-8 text-center text-sm opacity-70">No courses yet. <Link className="font-semibold text-teal underline" to="/teacher?tab=courses">Create your first course</Link>.</p>
    :<ul className="grid min-w-0 grid-cols-1 gap-3">{perCourse.map(c=>{const [g,e]=theme(c.subject);return <li key={c.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200/70 p-3 transition duration-200 hover:border-teal/50 hover:bg-teal/5">
     <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${g} text-xl`} aria-hidden="true">{e}</span>
     <div className="min-w-[160px] flex-1"><b className="block truncate text-navy">{c.name}</b><span className="text-xs opacity-65">{c.enrolled} student{c.enrolled===1?'':'s'} · {c.files} file{c.files===1?'':'s'} · {inr(c.price)}</span></div>
     <div className="w-40"><div className="mb-1 flex justify-between text-xs"><span>Avg progress</span><b>{c.avg}%</b></div><div className="pbar"><i style={{width:c.avg+'%'}}/></div></div>
     <Link to={`/live/${c.id}`} className="btn2 !min-h-[36px] !py-1 text-sm">🔴 Live</Link></li>})}</ul>}
   </section>

   <section className="box" aria-labelledby="up-h">
    <h2 id="up-h" className="mb-4 text-xl text-navy">Upcoming sessions</h2>
    {demos===null?<div className="skel h-40"/>:upcoming.length===0?<p className="py-6 text-center text-sm opacity-70">No upcoming demo sessions. <Link className="font-semibold text-teal underline" to="/teacher?tab=demos">Schedule one</Link>.</p>
    :<ul className="grid min-w-0 grid-cols-1 gap-3">{upcoming.map(d=>{const t=new Date(d.startsAt);return <li key={d.id} className="flex items-center gap-3 rounded-2xl border border-slate-200/70 p-3">
     <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-teal to-brand2 text-center text-white"><div><div className="text-lg font-extrabold leading-none">{t.getDate()}</div><div className="text-[10px] uppercase">{t.toLocaleString('en-IN',{month:'short'})}</div></div></div>
     <div className="min-w-0 flex-1"><b className="block truncate text-navy">{d.topic}</b><span className="text-xs opacity-65">{t.toLocaleString('en-IN',{weekday:'short',hour:'2-digit',minute:'2-digit'})} · {d.seatsTaken}/{d.maxSeats} seats</span></div>
     {d.meetingLink&&<a className="btn2 !min-h-[36px] !py-1 text-sm" href={d.meetingLink} target="_blank" rel="noreferrer">Join</a>}</li>})}</ul>}
    <p className="mt-4 text-xs opacity-60">Run a live class from the 🔴 button next to any course.</p>
   </section>
  </div>

  <RecentPayments/>

  <a href="#/emails" className="box flex items-center justify-between gap-3 no-underline"><span><b className="text-lg text-navy">Emails sent</b><br/><span className="text-sm opacity-70">Emails about your students and payments</span></span><span aria-hidden="true">→</span></a>

  <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
   <section className="box" aria-labelledby="rv-h">
    <div className="mb-2 flex items-center justify-between gap-2"><h2 id="rv-h" className="text-xl text-navy">Revenue · last 14 days</h2><Link to="/payments" className="text-sm font-semibold text-teal hover:underline">Payments →</Link></div>
    {ov===null?<div className="skel h-44"/>:ov.days&&ov.days.length?<Bars days={ov.days}/>:<p className="py-10 text-center text-sm opacity-70">No payment activity yet.</p>}
   </section>
   <section className="box" aria-labelledby="rs-h">
    <div className="mb-3 flex items-center justify-between gap-2"><h2 id="rs-h" className="text-xl text-navy">Recent students</h2><Link to="/teacher?tab=students" className="text-sm font-semibold text-teal hover:underline">All students →</Link></div>
    {students===null?<div className="skel h-40"/>:recent.length===0?<p className="py-6 text-center text-sm opacity-70">Students appear here automatically once a payment is approved.</p>
    :<ul className="divide-y divide-slate-200/60">{recent.map(s=><li key={s.id} className="flex items-center gap-3 py-2.5"><span className="avatar h-9 w-9 shrink-0 text-xs" aria-hidden="true">{initials(s.student)}</span>
     <div className="min-w-0 flex-1"><b className="block truncate text-navy">{s.student}</b><span className="block truncate text-xs opacity-60">{s.course}</span></div>
     <span className="shrink-0 text-xs opacity-60">{s.since?new Date(s.since).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):''}</span></li>)}</ul>}
   </section>
  </div>

  <section aria-label="Quick actions" className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
   {[['🗂️','Upload resources','Notes, slides and recordings','/teacher?tab=resources'],['🎁','Coupons & exams','Give free access, run entrance tests','/teacher?tab=coupons'],['💳','Payments','See verified payments and export CSV','/payments'],['💬','Messages & doubts','Answer students and contact messages','/teacher?tab=messages']].map(([i,t,d,to])=><Link key={to} to={to} className="box flex items-center gap-3 no-underline">
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal/15 to-brand2/15 text-xl" aria-hidden="true">{i}</span>
    <span className="min-w-0 flex-1"><b className="block text-navy">{t}</b><span className="text-xs opacity-65">{d}</span></span><span className="opacity-40" aria-hidden="true">→</span></Link>)}
  </section>
 </div>}
