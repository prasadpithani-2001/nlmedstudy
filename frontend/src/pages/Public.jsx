import {useEffect,useMemo,useState} from 'react'
import {Count,Reveal,SplitText} from '../fx'
import {Link,useNavigate,useParams} from 'react-router-dom'
import api,{msg} from '../api'
import {useAuth} from '../App'
export const inr=n=>'₹'+Number(n).toLocaleString('en-IN')
export function useGet(url){const [d,setD]=useState(null);useEffect(()=>{let live=true;api.get(url).then(r=>live&&setD(r.data)).catch(()=>live&&setD([]));return()=>{live=false}},[url]);return d}

/* every course gets a banner colour + icon from its subject (no image files needed) */
const THEME={Cardiology:['from-rose-500 to-orange-400','❤️'],Physiology:['from-sky-500 to-indigo-500','🫁'],Anatomy:['from-violet-500 to-fuchsia-500','🦴'],Pharmacology:['from-emerald-500 to-teal-500','💊'],Pathology:['from-amber-500 to-red-500','🔬']}
export const theme=s=>THEME[s]||['from-indigo-500 to-violet-500','🎓']
export const Stars=({v,n})=>v==null?<span className="chip">New</span>:<span className="inline-flex items-center gap-1 text-sm"><b className="text-amber-500">★ {v.toFixed(1)}</b>{n!=null&&<span className="opacity-60">({n})</span>}</span>
export const initials=n=>(n||'?').replace(/^(Dr\.?|Prof\.?)\s+/i,'').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase()
export const Skeletons=({n=3,h='h-72'})=>[...Array(n)].map((_,i)=><div key={i} className={`skel ${h}`}/>)
export const Empty=({icon='📭',title,children})=><div className="box col-span-full py-10 text-center"><div className="text-4xl">{icon}</div><h3 className="mt-2 text-lg text-navy">{title}</h3><p className="mx-auto mt-1 max-w-md text-sm opacity-70">{children}</p></div>

/* which courses the signed-in student already owns (null until loaded) */
export function useEnrolled(){const {user}=useAuth(),[s,setS]=useState(null)
 useEffect(()=>{if(user?.role!=='STUDENT'){setS(new Set());return}api.get('/my/courses').then(r=>setS(new Set(r.data.map(e=>e.courseId)))).catch(()=>setS(new Set()))},[user])
 return s}

export function CourseCard({c,i=0,enrolled}){const [g,e]=theme(c.subject),{user}=useAuth(),go=useNavigate(),staff=user&&user.role!=='STUDENT'
 return <article style={{animationDelay:i*80+'ms'}} className="ccard group flex animate-fadeUp flex-col">
  <Link to={`/course/${c.id}`} aria-label={`View ${c.name}`} className={`relative block h-40 overflow-hidden bg-gradient-to-br ${g}`}>
   <span className="absolute -right-4 -top-4 h-28 w-28 rounded-full bg-white/15" aria-hidden="true"/><span className="absolute -bottom-8 left-6 h-24 w-24 rounded-full bg-white/10" aria-hidden="true"/>
   <span className="absolute inset-0 grid place-items-center text-6xl drop-shadow-lg transition duration-500 group-hover:scale-110" aria-hidden="true">{e}</span>
   <span className="absolute left-3 top-3 rounded-full bg-surface/90 px-3 py-0.5 text-xs font-bold text-slate-800">{c.subject}</span>
   {c.discountPct>0&&<span className="absolute right-3 top-3 rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-bold text-white">{c.discountPct}% OFF</span>}</Link>
  <div className="flex flex-1 flex-col p-4"><h3 className="text-lg leading-snug text-navy"><Link to={`/course/${c.id}`} className="hover:text-teal">{c.name}</Link></h3>
   <p className="mt-1 flex items-center gap-2 text-sm opacity-80"><span className="avatar h-6 w-6 text-[10px]" aria-hidden="true">{initials(c.teacher)}</span>{c.teacher}</p>
   <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"><Stars v={c.rating} n={c.reviews}/><span className="opacity-70">👥 {Number(c.students).toLocaleString('en-IN')} enrolled</span></div>
   <p className="mt-2 text-xs opacity-70">{c.liveClasses} live classes · {c.notes} notes · {c.assessments} tests</p>
   <div className="mt-auto flex items-end justify-between gap-2 pt-4"><div><span className="text-xl font-extrabold text-navy">{c.price>0?inr(c.price):'Free'}</span>{c.listPrice&&<span className="ml-2 text-sm text-slate-400 line-through">{inr(c.listPrice)}</span>}</div>
    {enrolled?<Link className="btn2 !py-1.5" to={`/learn/${c.id}`}>Start Learning</Link>:staff?<Link className="btn2 !py-1.5" to={`/course/${c.id}`}>View</Link>:<button className="btn !py-1.5" onClick={()=>go(user?`/checkout/${c.id}`:'/login')}>Enroll</button>}</div></div></article>}

export function DemoCard({d}){const [open,setOpen]=useState(false),[res,setRes]=useState(null),[err,setErr]=useState(''),[busy,setBusy]=useState(false),dt=new Date(d.startsAt),left=d.maxSeats-d.seatsTaken
 const submit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));setErr('');setBusy(true)
  try{setRes((await api.post(`/demos/${d.id}/register`,f)).data)}catch(x){setErr(msg(x))}setBusy(false)}
 return <div className="box flex gap-4"><div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-teal to-brand2 text-center text-white"><div><div className="text-xl font-extrabold leading-none">{dt.getDate()}</div><div className="text-[11px] uppercase">{dt.toLocaleString('en-IN',{month:'short'})}</div></div></div>
  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="chip">FREE DEMO · ₹0</span><span className={`chip ${left<=5?'!bg-amber-100 !text-amber-800':''}`}>{left>0?`${left} seats left`:'Full'}</span></div>
   <h3 className="mt-1 text-lg text-navy">{d.topic}</h3><p className="text-sm opacity-70">🕒 {dt.toLocaleString('en-IN',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
   {res?<p role="status" className="mt-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">✅ {res.message} Join link: <a className="underline" href={res.joinLink}>{res.joinLink}</a></p>
   :open?<form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-2"><input className="inp" name="name" placeholder="Full name" aria-label="Full name" required/><input className="inp" name="email" type="email" placeholder="Email" aria-label="Email" required/>
    <input className="inp" name="mobile" placeholder="Mobile" aria-label="Mobile" required/><input className="inp" name="education" placeholder="Current education" aria-label="Current education" required/>
    {err&&<p role="alert" className="text-sm text-rose-700 sm:col-span-2">{err}</p>}<button className="btn sm:col-span-2" disabled={busy}>{busy?'Reserving…':'Reserve my free seat'}</button></form>
   :<button className="btn mt-3 !py-1.5" disabled={left<=0} onClick={()=>setOpen(true)}>{left>0?'Book Demo Session':'Seats full'}</button>}</div></div>}

const Section=({eyebrow,title,sub,action,children})=><section className="mt-16"><Reveal><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div>{eyebrow&&<p className="text-sm font-bold uppercase tracking-wider text-teal">{eyebrow}</p>}<h2 className="text-3xl text-navy">{title}</h2>{sub&&<p className="mt-1 max-w-xl opacity-75">{sub}</p>}</div>{action}</div></Reveal>{children}</section>

function HeroArt(){return <div className="relative mx-auto h-[380px] w-full max-w-md" aria-hidden="true">
 <div className="hero-blob -left-6 top-6 h-56 w-56 bg-teal"/><div className="hero-blob -right-4 bottom-4 h-56 w-56 bg-brand2"/>
 <div className="absolute inset-x-4 top-6 rounded-3xl border border-white/60 bg-surface/70 p-5 shadow-2xl shadow-teal/20 backdrop-blur-xl dark:bg-slate-900/60">
  <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-400 text-2xl">❤️</div><div><div className="font-serif font-bold text-navy">Live class today</div><div className="text-xs opacity-60">Interactive · 7:00 PM</div></div></div>
  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">{[['🎥','Live'],['✍️','Notes'],['🧠','Tests']].map(([n,l])=><div key={l} className="rounded-xl bg-teal/10 py-2"><div className="text-lg">{n}</div>{l}</div>)}</div>
  <div className="mt-4 flex items-center justify-between text-xs"><span>Course progress</span><b>72%</b></div><div className="pbar mt-1"><i style={{width:'72%'}}/></div>
  <div className="mt-4 flex items-end gap-1.5">{[0,1,2,3,4,5,6].map(i=><span key={i} className={`flex-1 rounded-lg ${i<5?'bg-gradient-to-t from-teal to-brand2':'bg-slate-200/70'}`} style={{height:20+((i*37)%28)}}/>)}</div></div>
 <div className="float-a absolute -left-2 bottom-16 flex items-center gap-2 rounded-2xl border border-white/60 bg-surface/85 px-3 py-2 shadow-xl backdrop-blur dark:bg-slate-900/70"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-lg">🎓</span><span className="text-xs"><b className="block text-navy">Certificate</b>on completion</span></div>
 <div className="float-b absolute -right-2 top-0 flex items-center gap-2 rounded-2xl border border-white/60 bg-surface/85 px-3 py-2 shadow-xl backdrop-blur dark:bg-slate-900/70"><span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-100 text-lg">🔴</span><span className="text-xs"><b className="block text-navy">Live now</b>Interactive class</span></div>
 <div className="float-a absolute bottom-0 right-6 flex items-center gap-2 rounded-2xl border border-white/60 bg-surface/85 px-3 py-2 shadow-xl backdrop-blur dark:bg-slate-900/70"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-lg">⏱️</span><span className="text-xs"><b className="block text-navy">Focus session</b>Stay consistent</span></div></div>}

const WHY=[['👩‍🏫','Expert Teachers','Learn from experienced medical educators who teach with real clinical examples.'],['🎥','Interactive Classes','Join live classes in your browser with a digital board, doubts and recordings.'],['⏱️','Focus Sessions','A built-in focus timer with breaks, streaks and daily stats keeps you consistent.'],['🔒','Secure Payments','Pay by QR code, UPI or card. Money goes directly to your teacher.'],['🎯','Personalized Learning','Notes, resources and tests that point out your weak topics.'],['📈','Progress Tracking','See lesson progress, scores and certificates in one dashboard.']]

export function Home(){const cat=useGet('/catalog'),demos=useGet('/demos'),st=useGet('/public/stats'),teachers=useGet('/teachers'),reviews=useGet('/public/reviews'),en=useEnrolled(),{user}=useAuth()
 const stats=st&&!Array.isArray(st)?st:null
 const featured=useMemo(()=>(Array.isArray(cat)?[...cat].sort((a,b)=>b.students-a.students||(b.rating||0)-(a.rating||0)||a.id-b.id).slice(0,3):[]),[cat])
 const numbers=stats?[[stats.students,'Students',''],[stats.courses,'Courses',''],[stats.teachers,'Expert Teachers',''],stats.satisfaction!=null?[stats.satisfaction,'Student Satisfaction','%']:[stats.liveClasses,'Live Classes','']]:[]
 return <>
 <section className="relative grid items-center gap-10 py-8 lg:grid-cols-[1.1fr_.9fr] lg:py-14">
  <div><span className="chip animate-fadeUp">✨ Your personalized learning platform</span>
   <h1 className="mt-4 text-5xl font-extrabold leading-[1.05] text-navy md:text-6xl lg:text-7xl"><SplitText text="Learn Better."/><br/><SplitText text="Study Smarter." delay={220}/><br/><SplitText className="gradient-text" text="Achieve More." delay={440}/></h1>
   <p className="mt-5 max-w-xl text-lg opacity-80">Your personalized learning platform with expert courses, live sessions and focused learning.</p>
   <div className="mt-7 flex flex-wrap gap-3"><Link className="btn !px-7 !py-3 text-base" to="/courses">Explore Courses →</Link><Link className="btn2 !px-7 !py-3 text-base" to="/demos">Book Demo Session</Link></div>
   <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm opacity-75"><span>✅ Live + recorded classes</span><span>✅ Secure UPI / QR / card payments</span><span>✅ Certificates</span></div></div>
  <HeroArt/></section>

 <section aria-label="Learning statistics" className="grid grid-cols-2 gap-3 md:grid-cols-4">{st===null?<Skeletons n={4} h="h-28"/>:numbers.map(([n,l,suf],i)=><Reveal key={l} delay={i*80}><div className="box text-center"><div className="gradient-text font-serif text-4xl font-extrabold"><Count to={Number(n)||0}/>{suf||'+'}</div><div className="mt-1 text-sm font-medium opacity-75">{l}</div></div></Reveal>)}</section>

 <Section eyebrow="Top picks" title="Featured Courses" sub="Hand-built courses with live classes, notes, tests and doubt support." action={<Link className="btn2" to="/courses">View all courses →</Link>}>
  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{cat===null?<Skeletons/>:featured.length===0?<Empty icon="📚" title="Courses are coming soon">Teachers are preparing their courses. Check back shortly.</Empty>:featured.map((c,i)=><CourseCard key={c.id} c={c} i={i} enrolled={en?.has(c.id)}/>)}</div></Section>

 <Section eyebrow="Why choose us" title="Why NLMed Study?" sub="Everything you need to prepare with confidence, without the clutter.">
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{WHY.map(([ic,t,d],i)=><Reveal key={t} delay={i*60}><div className="box h-full hover:-translate-y-1"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-teal/20 to-brand2/20 text-2xl">{ic}</div><h3 className="mt-3 text-lg text-navy">{t}</h3><p className="mt-1 text-sm opacity-75">{d}</p></div></Reveal>)}</div></Section>

 <Section eyebrow="Meet your mentors" title="Popular Teachers" action={<Link className="btn2" to="/teachers">All teachers →</Link>}>
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{teachers===null?<Skeletons h="h-40"/>:(Array.isArray(teachers)?teachers:[]).length===0?<Empty icon="👩‍🏫" title="Teachers will appear here">Once teachers join, their profiles show up on this page.</Empty>:teachers.slice(0,3).map(t=><TeacherCard key={t.id} t={t}/>)}</div></Section>

 <Section eyebrow="Loved by learners" title="Student Reviews">
  <div className="grid gap-4 md:grid-cols-3">{reviews===null?<Skeletons h="h-40"/>:(Array.isArray(reviews)?reviews:[]).length===0?<Empty icon="💬" title="Reviews will appear here">Enrolled students can rate and review a course from its page. Their words show up here.</Empty>:reviews.slice(0,3).map(r=><figure key={r.id} className="box flex flex-col"><div className="text-amber-500">{'★'.repeat(r.rating)}<span className="opacity-30">{'★'.repeat(5-r.rating)}</span></div><blockquote className="mt-2 flex-1 text-[15px]">“{r.comment}”</blockquote><figcaption className="mt-4 flex items-center gap-3"><span className="avatar h-9 w-9 text-sm" aria-hidden="true">{initials(r.name)}</span><span className="text-sm"><b className="block text-navy">{r.name}</b><span className="opacity-60">{r.course}</span></span></figcaption></figure>)}</div></Section>

 <section id="demo" className="mt-16 scroll-mt-24"><div className="mb-5"><p className="text-sm font-bold uppercase tracking-wider text-teal">Try before you enroll</p><h2 className="text-3xl text-navy">Free Demo Sessions</h2></div>
  <div className="grid gap-4 lg:grid-cols-2">{demos===null?<Skeletons n={2} h="h-40"/>:(demos||[]).length===0?<Empty icon="🎥" title="No demo sessions scheduled">New demo sessions are announced here.</Empty>:demos.map(d=><DemoCard key={d.id} d={d}/>)}</div></section>

 {!user&&<section className="stat-glass relative mt-16 overflow-hidden p-8 text-center md:p-12"><div className="hero-blob -left-10 -top-10 h-56 w-56 bg-white"/><h2 className="relative text-3xl text-white md:text-4xl">Ready to start learning?</h2><p className="relative mx-auto mt-2 max-w-lg text-white/85">Create a free account in a minute and explore courses, demos and focus sessions.</p><div className="relative mt-6 flex flex-wrap justify-center gap-3"><Link to="/register" className="inline-flex min-h-[44px] items-center rounded-xl bg-white px-6 py-2.5 font-bold text-slate-900 transition hover:-translate-y-0.5 hover:shadow-xl">Create free account</Link><Link to="/courses" className="inline-flex min-h-[44px] items-center rounded-xl border border-white/60 px-6 py-2.5 font-semibold text-white transition hover:bg-white/10">Browse courses</Link></div></section>}</>}

function TeacherCard({t}){return <article className="box flex gap-4"><span className="avatar h-16 w-16 shrink-0 text-xl" aria-hidden="true">{initials(t.name)}</span><div className="min-w-0"><h3 className="text-lg text-navy">{t.name}</h3>
 <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm"><Stars v={t.rating}/><span className="opacity-70">👥 {t.students} students</span><span className="opacity-70">📚 {t.courses} courses</span></div>
 <div className="mt-2 flex flex-wrap gap-1">{(t.subjects||[]).map(s=><span key={s} className="chip">{s}</span>)}</div></div></article>}

export function Teachers(){const t=useGet('/teachers')
 return <><header className="mb-6"><p className="text-sm font-bold uppercase tracking-wider text-teal">Our faculty</p><h1 className="text-4xl text-navy">Expert Teachers</h1><p className="mt-1 max-w-xl opacity-75">Learn directly from educators who care about your understanding, not just your marks.</p></header>
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{t===null?<Skeletons h="h-36"/>:(Array.isArray(t)?t:[]).length===0?<Empty icon="👩‍🏫" title="No teachers yet">Teacher profiles appear here once they join.</Empty>:t.map(x=><TeacherCard key={x.id} t={x}/>)}</div></>}

export function Demos(){const d=useGet('/demos')
 return <><header className="mb-6"><p className="text-sm font-bold uppercase tracking-wider text-teal">Free to attend</p><h1 className="text-4xl text-navy">Demo Sessions</h1><p className="mt-1 max-w-xl opacity-75">Experience a live class before you enroll. Reserve a seat, get the join link instantly.</p></header>
  <div className="grid gap-4 lg:grid-cols-2">{d===null?<Skeletons n={2} h="h-40"/>:(d||[]).length===0?<Empty icon="🎥" title="No demo sessions right now">Please check back soon or <Link className="underline" to="/contact">contact us</Link>.</Empty>:d.map(x=><DemoCard key={x.id} d={x}/>)}</div></>}

export function Courses(){const c=useGet('/catalog'),en=useEnrolled(),[q,setQ]=useState(''),[sub,setSub]=useState('All'),[sort,setSort]=useState('popular')
 const subjects=useMemo(()=>['All',...new Set((Array.isArray(c)?c:[]).map(x=>x.subject).filter(Boolean))],[c])
 const list=useMemo(()=>{let l=(Array.isArray(c)?c:[]).filter(x=>(sub==='All'||x.subject===sub)&&(x.name+' '+x.teacher+' '+x.subject).toLowerCase().includes(q.trim().toLowerCase()))
  const by={popular:(a,b)=>b.students-a.students||a.id-b.id,rating:(a,b)=>(b.rating||0)-(a.rating||0),low:(a,b)=>a.price-b.price,high:(a,b)=>b.price-a.price}[sort];return [...l].sort(by)},[c,q,sub,sort])
 return <><header className="mb-6"><p className="text-sm font-bold uppercase tracking-wider text-teal">Learn at your pace</p><h1 className="text-4xl text-navy">Courses</h1></header>
  <div className="box mb-6 grid gap-3 md:grid-cols-[1fr_auto]"><input className="inp" type="search" aria-label="Search courses" placeholder="Search by course, subject or teacher…" value={q} onChange={e=>setQ(e.target.value)}/>
   <select className="inp md:w-52" aria-label="Sort courses" value={sort} onChange={e=>setSort(e.target.value)}><option value="popular">Most popular</option><option value="rating">Highest rated</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select>
   <div className="flex flex-wrap gap-2 md:col-span-2" role="group" aria-label="Filter by subject">{subjects.map(s=><button key={s} aria-pressed={sub===s} onClick={()=>setSub(s)} className={`rounded-full border px-4 py-1 text-sm font-semibold transition ${sub===s?'border-transparent bg-gradient-to-r from-teal to-brand2 text-white shadow':'border-slate-300 hover:border-teal hover:text-teal'}`}>{s}</button>)}</div></div>
  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{c===null?<Skeletons n={4}/>:list.length===0?<Empty icon="🔍" title="No courses found">Try a different search or subject filter.</Empty>:list.map((x,i)=><CourseCard key={x.id} c={x} i={i} enrolled={en?.has(x.id)}/>)}</div></>}

export function CourseDetail(){const {id}=useParams(),{user}=useAuth(),go=useNavigate(),all=useGet('/catalog'),topics=useGet(`/courses/${id}/topics`),en=useEnrolled()
 const c=(Array.isArray(all)?all:[]).find(x=>x.id==id)
 if(all===null)return <div className="grid gap-4"><div className="skel h-56"/><div className="skel h-72"/></div>
 if(!c)return <Empty icon="🧭" title="Course not found">It may have been removed. <Link className="underline" to="/courses">Browse all courses</Link>.</Empty>
 const [g,e]=theme(c.subject),owned=en?.has(c.id),staff=user&&user.role!=='STUDENT'
 const incl=[['🎥',`${c.liveClasses} live classes`],['✍️',`${c.notes} handwritten notes`],['🧠',`${c.assessments} assessments`],['▶️',`${c.lessons} video lessons`],['❓','Doubt support'],['🎓','Certificate on completion']]
 return <>
  <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${g} p-6 text-white shadow-xl md:p-10`}><span className="absolute -right-10 -top-10 h-60 w-60 rounded-full bg-white/10" aria-hidden="true"/><span className="absolute bottom-0 right-10 text-[9rem] leading-none opacity-30" aria-hidden="true">{e}</span>
   <nav aria-label="Breadcrumb" className="text-sm text-white/80"><Link className="hover:underline" to="/courses">Courses</Link> / {c.subject}</nav>
   <h1 className="relative mt-2 max-w-2xl text-3xl font-extrabold text-white md:text-5xl">{c.name}</h1>
   <div className="relative mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"><span className="flex items-center gap-2"><span className="avatar h-8 w-8 border border-white/40 text-xs" aria-hidden="true">{initials(c.teacher)}</span>{c.teacher}</span>
    <span>{c.rating==null?'⭐ New course':`⭐ ${c.rating.toFixed(1)} (${c.reviews} reviews)`}</span><span>👥 {Number(c.students).toLocaleString('en-IN')} students</span><span>⏳ {c.liveClasses} live classes</span></div></section>
  <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
   <div className="grid content-start gap-6">
    <section className="box"><h2 className="text-xl text-navy">About this course</h2><p className="mt-2 opacity-80">A structured {c.subject.toLowerCase()} course by {c.teacher}: live interactive classes, handwritten notes, curated resources and topic-wise tests that show your weak areas, with doubt support whenever you are stuck.</p>
     <div className="mt-4 grid gap-2 sm:grid-cols-2">{incl.map(([i,t])=><div key={t} className="flex items-center gap-3 rounded-xl bg-teal/5 px-3 py-2"><span className="text-xl" aria-hidden="true">{i}</span>{t}</div>)}</div></section>
    <section className="box"><h2 className="text-xl text-navy">Curriculum</h2>
     {topics===null?<div className="skel mt-3 h-32"/>:(topics||[]).length===0?<p className="mt-2 text-sm opacity-70">Topics will appear once the teacher adds them.</p>:<ol className="mt-3 grid gap-2">{topics.map((t,i)=><li key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-200/70 px-3 py-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-teal to-brand2 text-sm font-bold text-white">{i+1}</span><span className="flex-1 font-medium">{t.title}</span><span className="text-xs opacity-60">{owned?'Unlocked':'🔒 Enroll to open'}</span></li>)}</ol>}</section>
    <section className="box flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl text-navy">Not sure yet?</h2><p className="text-sm opacity-75">Attend a free demo session and see how the class works.</p></div><Link className="btn2" to="/demos">🎥 Watch a free demo</Link></section>
    <Reviews id={id}/></div>
   <aside className="lg:sticky lg:top-24 lg:self-start"><div className="box grid gap-3 shadow-xl">
    <div className="flex items-end gap-2"><span className="text-4xl font-extrabold text-navy">{c.price>0?inr(c.price):'Free'}</span>{c.listPrice&&<span className="mb-1 text-slate-400 line-through">{inr(c.listPrice)}</span>}{c.discountPct>0&&<span className="chip mb-1.5 !bg-rose-100 !text-rose-700">{c.discountPct}% off</span>}</div>
    {owned?<Link className="btn !py-3" to={`/learn/${c.id}`}>▶ Start Learning</Link>:staff?<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">You are signed in as {user.role.toLowerCase()}. Use a student account to enroll.</p>
     :<button className="btn !py-3 text-base" onClick={()=>go(user?`/checkout/${c.id}`:'/login')}>{user?'Enroll Now':'Login to Enroll'}</button>}
    <p className="text-center text-xs opacity-70">🔒 Secure payment · QR · UPI · Card · coupon codes accepted</p>
    <ul className="grid gap-1.5 border-t border-slate-200/70 pt-3 text-sm">{incl.map(([i,t])=><li key={t}>{i} {t}</li>)}</ul></div></aside></div></>}

const AboutCard=({i,t,d})=><div className="box"><div className="text-3xl">{i}</div><h3 className="mt-2 text-lg text-navy">{t}</h3><p className="mt-1 text-sm opacity-75">{d}</p></div>
export function About(){const st=useGet('/public/stats'),s=st&&!Array.isArray(st)?st:null
 return <><section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal to-brand2 p-8 text-white md:p-14"><div className="hero-blob -right-10 -top-10 h-60 w-60 bg-white"/><p className="relative text-sm font-bold uppercase tracking-wider text-white/80">About NLMed Study</p><h1 className="relative mt-2 max-w-2xl text-4xl font-extrabold text-white md:text-5xl">A calmer, smarter way to learn medicine.</h1><p className="relative mt-4 max-w-2xl text-lg text-white/85">NLMed Study brings live classes, handwritten notes, tests and doubt support into one focused place, so you spend your energy learning, not searching.</p></section>
  <div className="mt-8 grid gap-4 md:grid-cols-3"><AboutCard i="🎯" t="Our mission" d="Make high-quality medical teaching accessible, personal and distraction-free."/><AboutCard i="🤝" t="Teacher-first payments" d="Every teacher sets their own payment account. Your fee goes straight to the person teaching you."/><AboutCard i="🧠" t="Built for focus" d="No social feed. Just your lessons, notes, tests and a focus timer that keeps you on track."/></div>
  {s&&<div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">{[[s.students,'Students'],[s.courses,'Courses'],[s.teachers,'Teachers'],[s.liveClasses,'Live classes']].map(([n,l])=><div key={l} className="box text-center"><div className="gradient-text font-serif text-4xl font-extrabold"><Count to={Number(n)||0}/>+</div><div className="text-sm opacity-75">{l}</div></div>)}</div>}
  <div className="mt-8 flex flex-wrap justify-center gap-3"><Link className="btn" to="/courses">Explore courses</Link><Link className="btn2" to="/contact">Contact us</Link></div></>}

function Reviews({id}){const [v,setV]=useState(0),r=useGet(`/courses/${id}/reviews?v=${v}`),{user}=useAuth(),[m,setM]=useState(''),items=r?.items||[]
 const send=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{await api.post(`/courses/${id}/reviews`,f);setM('');e.target.reset();setV(v+1)}catch(x){setM(msg(x))}}
 return <section className="box"><h2 className="text-xl text-navy">Student reviews {r?.average?<span className="ml-2 text-amber-500">★ {r.average}</span>:''}</h2>
  {r===null?<div className="skel mt-3 h-20"/>:items.length===0?<p className="mt-2 text-sm opacity-70">No reviews yet. Enrolled students can be the first to share their experience.</p>:<div className="mt-3 grid gap-3">{items.map(i=><div key={i.id} className="flex gap-3 border-b border-slate-200/60 pb-3 last:border-0"><span className="avatar h-9 w-9 shrink-0 text-sm" aria-hidden="true">{initials(i.userName)}</span><div><div className="text-sm"><b className="text-navy">{i.userName}</b> <span className="text-amber-500">{'★'.repeat(i.rating)}</span></div><p className="text-[15px]">{i.comment}</p></div></div>)}</div>}
  {user?.role==='STUDENT'&&<form onSubmit={send} className="mt-4 flex flex-wrap gap-2"><select aria-label="Rating" className="inp max-w-[90px]" name="rating">{[5,4,3,2,1].map(n=><option key={n}>{n}</option>)}</select><input className="inp min-w-[200px] flex-1" name="comment" placeholder="Your review (enrolled students only)" required/><button className="btn">Post</button></form>}
  {m&&<p role="alert" className="mt-2 text-sm text-rose-700">{m}</p>}</section>}
