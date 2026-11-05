import {ProgressPanel} from './Progress'
import {useCallback,useEffect,useMemo,useState,useRef} from 'react'
import {Link} from 'react-router-dom'
import api,{msg} from '../api'
import {useAuth} from '../App'
import {inr,theme,Empty,Skeletons,initials} from './Public'
import {methodName} from './Checkout'
import {LiveBadge} from './Student'
import {Count} from '../fx'
import {BackBar} from '../ui'
import {Receipt,receiptFromPayment} from './Receipt'
import {rd,LOG,streakOf} from '../focus'

/* status -> label + tag colour (shared by student and staff views) */
export const STATUS={NOT_SUBMITTED:['Not submitted','tag-wait'],PENDING_VERIFICATION:['Submitted – awaiting approval','tag-wait'],APPROVED:['Approved','tag-wait'],COURSE_ACCESS_ACTIVE:['Approved – course access active','tag-wait'],REJECTED:['Rejected','tag-bad'],RESUBMISSION_REQUIRED:['Resubmission required','tag-wait'],SUCCESS:['Successful','tag-ok'],PENDING:['Pending','tag-wait'],AWAITING:['Awaiting payment','tag-wait'],FAILED:['Failed','tag-bad'],CANCELLED:['Cancelled','tag-off'],EXPIRED:['Cancelled','tag-off']}
export const StatusTag=({s})=>{const [l,c]=STATUS[s]||['Failed','tag-bad'];return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${c}`}>{l}</span>}
const when=t=>t?new Date(t).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'

function Ring({v,size=120}){const r=size/2-9,c=2*Math.PI*r
 return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${v}% overall progress`}><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="rgb(var(--accent))"/><stop offset="1" stopColor="rgb(var(--accent2))"/></linearGradient></defs>
  <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgb(148 163 184/.25)" strokeWidth="10"/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#rg)" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c*(1-v/100)} transform={`rotate(-90 ${size/2} ${size/2})`} style={{transition:'stroke-dashoffset 1s'}}/>
  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-current text-2xl font-extrabold">{v}%</text></svg>}

const Stat=({icon,label,value,hint,to})=>{const body=<><div className="flex items-center justify-between"><span className="text-sm font-medium opacity-70">{label}</span><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-teal/15 to-brand2/15 text-lg" aria-hidden="true">{icon}</span></div><div className="mt-2 font-serif text-3xl font-extrabold text-navy">{value}</div>{hint&&<div className="text-xs opacity-60">{hint}</div>}</>
 return to?<Link to={to} className="box block hover:-translate-y-0.5">{body}</Link>:<div className="box">{body}</div>}

import {MyPlans} from './MyPlans'
import {ProofCell} from './ProofCell'
export function StudentDashboard(){const {user}=useAuth(),[d,setD]=useState(null),[err,setErr]=useState('')
 useEffect(()=>{api.get('/my/dashboard').then(r=>setD(r.data)).catch(e=>{setErr(msg(e));setD({})})},[])
 const first=(user?.name||'').split(' ')[0]
 const courses=d?.courses||[],avg=courses.length?Math.round(courses.reduce((s,c)=>s+c.percent,0)/courses.length):0
 const cont=useMemo(()=>[...courses].sort((a,b)=>(a.percent>=100)-(b.percent>=100)||b.percent-a.percent)[0],[d])
 const streak=useMemo(()=>{try{return streakOf(rd(LOG,{}))}catch{return 0}},[])
 return <>
  <MyPlans/>
  <header className="stat-glass relative overflow-hidden p-6 md:p-8"><div className="hero-blob -right-10 -top-16 h-60 w-60 bg-white"/>
   <h1 className="relative text-3xl font-extrabold text-white md:text-4xl">Welcome back, {first} 👋</h1><p className="relative mt-1 text-white/85">{courses.length?'Pick up where you left off.':'Find a course and start your journey.'}</p>
   <Link to="/profile" className="relative mt-4 inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/30">👤 My profile &amp; password</Link></header>
  {err&&<p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{err}</p>}
  <section aria-label="Overview" className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{d===null?<Skeletons n={4} h="h-28"/>:<><Stat icon="📚" label="My courses" value={courses.length} to="/courses"/><Stat icon="📈" label="Average progress" value={avg+'%'}/><Stat icon="🧠" label="Assessments" value={d.assessments??0} hint={`Average score ${d.averageScore??0}%`}/><Stat icon="🎓" label="Certificates" value={(d.certificates||[]).length}/></>}</section>
  <div className="mt-5"><ProgressPanel courses={courses} upcoming={d?.upcoming||[]}/></div>

  {cont&&<section className="mt-6" aria-label="Continue learning"><h2 className="mb-3 text-xl text-navy">Continue Learning</h2>
   <div className="box flex flex-wrap items-center gap-5"><div className={`grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br ${theme(cont.subject)[0]} text-4xl`} aria-hidden="true">{theme(cont.subject)[1]}</div>
    <div className="min-w-[220px] flex-1"><div className="text-sm opacity-70">{cont.subject} · {cont.teacher}</div><h3 className="text-xl text-navy">{cont.name}</h3><div className="mt-2 flex items-center gap-3"><div className="pbar flex-1"><i style={{width:cont.percent+'%'}}/></div><b className="text-sm">{cont.percent}%</b></div><div className="mt-1 text-xs opacity-60">{cont.done} of {cont.total} lessons completed</div></div>
    <div className="grid gap-2"><LiveBadge id={cont.courseId}/><Link className="btn" to={`/learn/${cont.courseId}`}>▶ {cont.percent>0?'Resume':'Start'} course</Link></div></div></section>}

  <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
   <div className="grid content-start gap-6">
    <section aria-label="My courses"><div className="mb-3 flex items-center justify-between"><h2 className="text-xl text-navy">My Courses</h2><Link className="text-sm font-semibold text-teal hover:underline" to="/courses">Browse more →</Link></div>
     <div className="grid gap-4 sm:grid-cols-2">{d===null?<Skeletons n={2} h="h-44"/>:courses.length===0?<Empty icon="🎒" title="You have not enrolled yet">Explore our courses and enroll to unlock live classes, notes and tests. <Link className="underline" to="/courses">Browse courses</Link></Empty>
      :courses.map(c=><article key={c.courseId} className="box"><div className="flex items-start gap-3"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${theme(c.subject)[0]} text-2xl`} aria-hidden="true">{theme(c.subject)[1]}</span><div className="min-w-0"><h3 className="leading-snug text-navy">{c.name}</h3><p className="text-xs opacity-70">{c.teacher}</p></div></div>
       <div className="mt-3 flex items-center gap-3"><div className="pbar flex-1"><i style={{width:c.percent+'%'}}/></div><b className="text-sm">{c.percent}%</b></div><LiveBadge id={c.courseId}/><Link className="btn2 mt-3 !py-1.5" to={`/learn/${c.courseId}`}>{c.percent>=100?'Review course':'Continue learning'}</Link></article>)}</div></section>

    <section aria-label="Upcoming classes"><h2 className="mb-3 text-xl text-navy">Upcoming Classes</h2>
     <div className="grid gap-3">{d===null?<Skeletons n={1} h="h-24"/>:(d.upcoming||[]).length===0?<Empty icon="📅" title="Nothing scheduled">Live classes show a red “Live now” button on your course. New demo sessions will be listed here.</Empty>
      :d.upcoming.map(u=>{const t=new Date(u.startsAt);return <div key={u.id} className="box flex items-center gap-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-teal to-brand2 text-center text-white"><div><div className="text-lg font-extrabold leading-none">{t.getDate()}</div><div className="text-[10px] uppercase">{t.toLocaleString('en-IN',{month:'short'})}</div></div></div><div className="min-w-0 flex-1"><h3 className="text-navy">{u.topic}</h3><p className="text-sm opacity-70">{t.toLocaleString('en-IN',{weekday:'long',hour:'2-digit',minute:'2-digit'})} · Free demo</p></div><Link className="btn2 !py-1.5" to="/demos">Details</Link></div>})}</div></section></div>

   <aside className="grid content-start gap-6">
    <section className="box text-center" aria-label="Progress"><h2 className="text-left text-lg text-navy">Progress</h2><div className="mt-2 flex justify-center text-navy"><Ring v={avg}/></div><p className="mt-1 text-sm opacity-70">Overall course completion</p></section>
    <section className="box" aria-label="Focus session"><h2 className="text-lg text-navy">Focus Session</h2><p className="mt-1 text-sm opacity-75">{streak>0?`🔥 ${streak}-day focus streak. Keep it going!`:'Start a distraction-free session to build your streak.'}</p><Link className="btn mt-3 w-full" to="/focus">⏱️ Start focusing</Link></section>
    <section className="box" aria-label="Recent payments"><div className="flex items-center justify-between"><h2 className="text-lg text-navy">Recent Payments</h2><Link className="text-sm font-semibold text-teal hover:underline" to="/my-payments">View all</Link></div>
     {d===null?<div className="skel mt-3 h-24"/>:(d.payments||[]).length===0?<p className="mt-2 text-sm opacity-70">No payments yet.</p>:<ul className="mt-2 grid gap-2">{d.payments.slice(0,4).map(p=><li key={p.id} className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0"><b className="block truncate text-navy">{p.courseName}</b><span className="text-xs opacity-60">{inr(p.amount)} · {methodName(p.method)}</span></span><StatusTag s={p.displayStatus||p.status}/></li>)}</ul>}</section>
    <section className="box" aria-label="Certificates"><h2 className="text-lg text-navy">Certificates</h2>{(d?.certificates||[]).length===0?<p className="mt-2 text-sm opacity-70">Finish all lessons of a course to unlock your certificate.</p>:<ul className="mt-2 grid gap-2">{d.certificates.map(c=><li key={c.courseId}><Link className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100" to={`/learn/${c.courseId}`}>🎓 {c.name}</Link></li>)}</ul>}</section></aside></div></>}

export function MyPayments(){const [rows,setRows]=useState(null),[f,setF]=useState('ALL'),[err,setErr]=useState(''),[rcpt,setRcpt]=useState(null),[note,setNote]=useState('')
 const seen=useRef({})
 /* Reloads the student's payments. A payment that moves to SUCCESS while this page is open shows a confirmation. */
 const load=useCallback(()=>api.get('/my/payments').then(r=>{const list=r.data||[]
   list.forEach(p=>{const was=seen.current[p.id];if(was&&was!==p.status&&p.status==='SUCCESS')setNote(`Payment verified for ${p.courseName}. Your course is unlocked.`);seen.current[p.id]=p.status})
   setRows(list);setErr('')}).catch(e=>{setErr(msg(e));setRows(r=>r||[])}),[])
 useEffect(()=>{ load(); const t=setInterval(load,15000); return()=>clearInterval(t) },[load])   // refresh the student's payment history every 15 s
 const waiting=(rows||[]).some(p=>['PENDING','AWAITING'].includes(p.status))
 useEffect(()=>{if(!waiting)return;const t=setInterval(load,8000);return()=>clearInterval(t)},[waiting,load])
 const list=(rows||[]).filter(p=>f==='ALL'||(f==='SUCCESS'?p.status==='SUCCESS':f==='PENDING'?['PENDING','PENDING_VERIFICATION','AWAITING'].includes(p.status):['REJECTED','FAILED','CANCELLED','EXPIRED'].includes(p.status)))
 const spent=(rows||[]).filter(p=>p.status==='SUCCESS').reduce((s,p)=>s+p.amount,0)
 return <><header className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-wider text-teal">Your purchases</p><h1 className="text-4xl text-navy">My Payments</h1></div>{rows&&<div className="box !py-2 text-right"><div className="text-xs opacity-60">Total paid</div><div className="font-serif text-2xl font-extrabold text-navy">{inr(spent)}</div></div>}</header>
  {note&&<p role="status" className="mb-4 animate-fadeUp rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">✓ {note}</p>}
  {waiting&&<p className="mb-4 flex items-center gap-2 text-sm opacity-75"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal/60"/><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal"/></span>Checking for updates every few seconds…</p>}
  <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter payments">{[['ALL','All'],['SUCCESS','Successful'],['PENDING','Pending'],['FAILED','Failed / cancelled']].map(([k,l])=><button key={k} aria-pressed={f===k} onClick={()=>setF(k)} className={`rounded-full border px-4 py-1 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 ${f===k?'border-transparent bg-gradient-to-r from-teal to-brand2 text-white shadow-md shadow-teal/25':'border-slate-300 hover:border-teal hover:text-teal'}`}>{l}</button>)}</div>
  {err&&<p role="alert" className="mb-3 text-rose-700">{err}</p>}
  {rows===null?<div className="skel h-48"/>:list.length===0?<div className="grid"><Empty icon="🧾" title="No payments to show">When you enroll in a course, your payment record appears here. <Link className="underline" to="/courses">Browse courses</Link></Empty></div>
  :<div className="box overflow-x-auto !p-0"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-100/70 text-xs uppercase tracking-wide dark:bg-white/5"><tr>{['Course','Amount','Payment Method','Transaction ID','Date','Status','Recipient',''].map((h,i)=><th key={i} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
   <tbody>{list.map(p=><tr key={p.id} className="border-t border-slate-200/60 align-top transition duration-200 hover:bg-teal/5"><td className="px-4 py-3 font-medium text-navy">{p.courseName}</td><td className="px-4 py-3 font-semibold">{inr(p.amount)}</td><td className="px-4 py-3">{methodName(p.method)}<div className="text-xs opacity-60">{p.detail}</div></td>
    <td className="px-4 py-3">{p.utr?<span className="font-mono text-xs font-semibold">{p.utr}</span>:<span className="text-xs text-amber-700">not entered</span>}<div className="font-mono text-[10px] opacity-50">ref {p.reference}</div><ProofCell p={p}/></td><td className="whitespace-nowrap px-4 py-3">{when(p.at)}</td>
    <td className="px-4 py-3"><StatusTag s={p.status}/>{p.status==='REJECTED'&&p.rejectReason&&<div className="mt-1 max-w-[180px] text-xs text-rose-700">{p.rejectReason}</div>}{['AWAITING','PENDING'].includes(p.status)&&<div className="mt-1"><Link className="text-xs font-semibold text-teal underline" to={`/checkout/${p.courseId}`}>Open</Link></div>}</td>
    <td className="px-4 py-3">{p.ownerName||'—'}</td>
    <td className="px-4 py-3">{p.status==='SUCCESS'&&<button type="button" className="btn2 !min-h-[34px] !px-3 !py-1 text-xs" onClick={()=>setRcpt(p)} aria-label={`Receipt for ${p.courseName}`}>🧾 Receipt</button>}</td></tr>)}</tbody></table></div>}
  {rcpt&&<Receipt p={receiptFromPayment(rcpt)} onClose={()=>setRcpt(null)}/>}
  <BackBar to="/dashboard" label="My learning"/></>}

export function Bars({days}){const max=Math.max(1,...days.map(d=>d.amount)),w=100/days.length
 return <div><svg viewBox="0 0 100 44" preserveAspectRatio="none" className="h-44 w-full" role="img" aria-label="Revenue for the last 14 days"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgb(var(--accent2))"/><stop offset="1" stopColor="rgb(var(--accent))"/></linearGradient></defs>
  {[0,1,2,3].map(i=><line key={i} x1="0" x2="100" y1={4+i*12} y2={4+i*12} stroke="rgb(148 163 184/.25)" strokeWidth=".3" vectorEffect="non-scaling-stroke"/>)}
  {days.map((d,i)=>{const h=Math.max(d.amount?1.5:.4,d.amount/max*38);return <g key={d.date}><title>{`${d.date}: ${inr(d.amount)}`}</title><rect x={i*w+w*.18} y={42-h} width={w*.64} height={h} rx=".8" fill="url(#bg)" opacity={d.amount?1:.25}/></g>})}</svg>
  <div className="mt-1 flex justify-between text-[11px] opacity-60"><span>{new Date(days[0].date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span><span>Last 14 days</span><span>Today</span></div></div>}

export function StaffOverview({me}){const [d,setD]=useState(null),[err,setErr]=useState('')
 const load=useCallback(()=>api.get('/staff/overview').then(r=>{setD(r.data);setErr('')}).catch(e=>setErr(msg(e))),[])
 useEffect(()=>{load();const t=setInterval(load,30000);return()=>clearInterval(t)},[load])
 const quick=[['💰','Payment Received','/payments'],['⚙️','Payment Settings','/payments#settings'],['🎥','Demo Sessions','/demos'],['📚','Courses','/courses'],['👩‍🏫','Teachers','/teachers']]
 const maxC=Math.max(1,...(d?.byCourse||[]).map(c=>c.amount))
 return <section aria-label="Overview" className="mb-8">
  {err&&<p role="alert" className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{err}</p>}
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">{d===null?<Skeletons n={6} h="h-28"/>:<>
   <div className="stat-glass col-span-2 p-5 lg:col-span-1 xl:col-span-2"><div className="text-sm text-white/80">Total revenue{d.scope==='all'?' (all accounts)':''}</div><div className="mt-1 font-serif text-4xl font-extrabold text-white">{inr(d.revenue)}</div><div className="text-xs text-white/75">{inr(d.month)} this month</div></div>
   <Stat icon="👥" label="Students" value={<Count to={Number(d.students)}/>}/><Stat icon="🧾" label="Enrollments" value={<Count to={d.enrollments}/>}/><Stat icon="📚" label="Courses" value={d.courses}/>
   <Stat icon="🔔" label="Needs approval" value={d.pending} hint={d.pending>0?'Check and approve in Payments':'All clear'} to="/payments"/></>}</div>
  <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
   <div className="box"><h2 className="mb-2 text-lg text-navy">Revenue</h2>{d===null?<div className="skel h-44"/>:d.revenue===0&&d.days.every(x=>x.amount===0)?<p className="py-10 text-center text-sm opacity-70">No successful payments yet. Revenue appears here automatically once a payment is confirmed.</p>:<Bars days={d.days}/>}</div>
   <div className="box"><h2 className="mb-3 text-lg text-navy">Top courses</h2>{d===null?<div className="skel h-40"/>:d.byCourse.length===0?<p className="py-6 text-center text-sm opacity-70">No course activity yet.</p>:<ul className="grid gap-3">{d.byCourse.slice(0,5).map(c=><li key={c.course}><div className="flex justify-between text-sm"><span className="truncate pr-2 font-medium text-navy">{c.course}</span><span className="shrink-0 font-semibold">{inr(c.amount)}</span></div><div className="pbar mt-1"><i style={{width:Math.max(c.amount?4:0,c.amount/maxC*100)+'%'}}/></div><div className="text-xs opacity-60">{c.students} students</div></li>)}</ul>}</div></div>
  <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
   <div className="box"><div className="mb-2 flex items-center justify-between"><h2 className="text-lg text-navy">Recent payments</h2><Link className="text-sm font-semibold text-teal hover:underline" to="/payments">View all →</Link></div>
    {d===null?<div className="skel h-32"/>:d.recent.length===0?<p className="py-6 text-center text-sm opacity-70">Payments from students will show up here.</p>:<ul className="divide-y divide-slate-200/60">{d.recent.map(p=><li key={p.id} className="flex items-center gap-3 py-2.5"><span className="avatar h-9 w-9 shrink-0 text-xs" aria-hidden="true">{initials(p.userName)}</span><div className="min-w-0 flex-1"><b className="block truncate text-navy">{p.userName}</b><span className="block truncate text-xs opacity-60">{p.courseName} · {methodName(p.method)}</span></div><div className="text-right"><div className="font-semibold">{inr(p.amount)}</div><StatusTag s={p.status}/></div></li>)}</ul>}</div>
   <div className="box"><h2 className="mb-3 text-lg text-navy">Quick actions</h2><div className="grid gap-2">{quick.map(([i,t,to])=><Link key={t} to={to} className="flex items-center gap-3 rounded-xl border border-slate-200/70 px-3 py-2.5 font-medium transition hover:border-teal hover:bg-teal/5"><span className="text-lg" aria-hidden="true">{i}</span>{t}<span className="ml-auto opacity-40">→</span></Link>)}</div></div></div></section>}
