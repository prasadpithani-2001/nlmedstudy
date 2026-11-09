import {useEffect,useMemo,useState} from 'react'
import {Count,Reveal,SplitText} from '../fx'
import {Link,useNavigate,useParams} from 'react-router-dom'
import api,{msg} from '../api'
import {useAuth} from '../App'
export const inr=n=>'â‚¹'+Number(n).toLocaleString('en-IN')
export function useGet(url){const [d,setD]=useState(null);useEffect(()=>{let live=true;api.get(url).then(r=>live&&setD(r.data)).catch(()=>live&&setD([]));return()=>{live=false}},[url]);return d}

/* every course gets a banner colour + icon from its subject (no image files needed) */
const THEME={Cardiology:['from-rose-500 to-orange-400','â¤ï¸'],Physiology:['from-sky-500 to-indigo-500','ðŸ«'],Anatomy:['from-violet-500 to-fuchsia-500','ðŸ¦´'],Pharmacology:['from-emerald-500 to-teal-500','ðŸ’Š'],Pathology:['from-amber-500 to-red-500','ðŸ”¬']}
export const theme=s=>THEME[s]||['from-indigo-500 to-violet-500','ðŸŽ“']
const IMG={Anatomy:'anatomy',Physiology:'physiology',Cardiology:'physiology',Pathology:'pathology',Pharmacology:'materia-medica','Materia Medica':'materia-medica',Organon:'organon','Homeopathic Pharmacy':'homeopathic-pharmacy'}
export const courseImg=s=>`/course-images/${IMG[s]||'organon'}.jpg`
export const Stars=({v,n})=>v==null?<span className="chip">New</span>:<span className="inline-flex items-center gap-1 text-sm"><b className="text-amber-500">â˜… {v.toFixed(1)}</b>{n!=null&&<span className="opacity-60">({n})</span>}</span>
export const initials=n=>(n||'?').replace(/^(Dr\.?|Prof\.?)\s+/i,'').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase()
export const Skeletons=({n=3,h='h-72'})=>[...Array(n)].map((_,i)=><div key={i} className={`skel ${h}`}/>)
export const Empty=({icon='ðŸ“­',title,children})=><div className="box col-span-full py-10 text-center"><div className="text-4xl">{icon}</div><h3 className="mt-2 text-lg text-navy">{title}</h3><p className="mx-auto mt-1 max-w-md text-sm opacity-70">{children}</p></div>

/* which courses the signed-in student already owns (null until loaded) */
export function useEnrolled(){const {user}=useAuth(),[s,setS]=useState(null)
 useEffect(()=>{if(user?.role!=='STUDENT'){setS(new Set());return}api.get('/my/courses').then(r=>setS(new Set(r.data.map(e=>e.courseId)))).catch(()=>setS(new Set()))},[user])
 return s}

export function CourseCard({c,i=0,enrolled}){const [g,e]=theme(c.subject),{user}=useAuth(),go=useNavigate(),staff=user&&user.role!=='STUDENT'
 const img=courseImg(c.subject),off=c.discountPct>0,free=!(c.price>0)
 const cta=enrolled?<Link to={`/learn/${c.id}`} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:scale-105">â–¶ Continue</Link>
  :staff?<Link to={`/course/${c.id}`} className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-navy transition hover:border-teal hover:text-teal">View</Link>
  :<button type="button" onClick={()=>go(user?`/checkout/${c.id}`:'/login')} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/30 transition hover:scale-105 hover:shadow-xl">Enroll now â†’</button>
 return <article style={{animationDelay:i*80+'ms'}} className="group relative flex animate-fadeUp flex-col overflow-hidden rounded-3xl bg-white/80 shadow-xl ring-1 ring-slate-900/5 backdrop-blur-xl transition duration-500 hover:-translate-y-1.5 hover:shadow-2xl dark:bg-slate-900/70 dark:ring-white/10">
  <span className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${g} opacity-0 blur-2xl transition duration-500 group-hover:opacity-25`} aria-hidden="true"/>
  <Link to={`/course/${c.id}`} aria-label={`View ${c.name}`} className="relative block h-40 overflow-hidden sm:h-48">
   <span className={`absolute inset-0 bg-gradient-to-br ${g}`} aria-hidden="true"/>
   <img src={img} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-2xl"/>
   <img src={img} alt={c.subject} loading="lazy" className="relative h-full w-full object-contain p-3 drop-shadow-2xl transition duration-700 group-hover:scale-110"/>
   <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent" aria-hidden="true"/>
   <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/50 bg-white/80 px-2.5 py-0.5 text-[11px] font-bold text-slate-800 shadow backdrop-blur-md">{e} {c.subject}</span>
   {off&&<span className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-rose-600 to-orange-500 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-lg">{c.discountPct}% OFF</span>}
  </Link>
  <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
   <div>
    <h3 className="line-clamp-2 text-base font-bold leading-snug text-navy sm:text-lg"><Link to={`/course/${c.id}`} className="hover:text-teal">{c.name}</Link></h3>
    <p className="mt-1.5 flex items-center gap-2 text-xs opacity-75 sm:text-sm"><span className="avatar h-6 w-6 shrink-0 text-[10px]" aria-hidden="true">{initials(c.teacher)}</span><span className="truncate">{c.teacher}</span></p>
   </div>
   <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm"><Stars v={c.rating} n={c.reviews}/><span className="opacity-70">ðŸ‘¥ {Number(c.students).toLocaleString('en-IN')} enrolled</span></div>
   <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
    {[['ðŸŽ¥',c.liveClasses,'live'],['ðŸ“',c.notes,'notes'],['ðŸ§ ',c.assessments,'tests']].map(([ic,n,l])=><span key={l} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200">{ic} {n} {l}</span>)}
   </div>
   <div className="mt-auto flex items-end justify-between gap-3 border-t border-slate-200/70 pt-3">
    <div className="min-w-0">
     <div className="flex items-baseline gap-2"><span className="text-xl font-extrabold text-navy sm:text-2xl">{free?'Free':inr(c.price)}</span>{c.listPrice&&<span className="text-xs text-slate-400 line-through sm:text-sm">{inr(c.listPrice)}</span>}</div>
     {off&&<p className="text-[11px] font-semibold text-emerald-600">You save {inr(c.listPrice-c.price)}</p>}
    </div>
    {cta}
   </div>
  </div>
 </article>}
  </Link>
  <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
   <div>
    <h3 className="line-clamp-2 text-base font-bold leading-snug text-navy sm:text-lg"><Link to={`/course/${c.id}`} className="hover:text-teal">{c.name}</Link></h3>
    <p className="mt-1.5 flex items-center gap-2 text-xs opacity-75 sm:text-sm"><span className="avatar h-6 w-6 shrink-0 text-[10px]" aria-hidden="true">{initials(c.teacher)}</span><span className="truncate">{c.teacher}</span></p>
   </div>
   <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm"><Stars v={c.rating} n={c.reviews}/><span className="opacity-70">ðŸ‘¥ {Number(c.students).toLocaleString('en-IN')} enrolled</span></div>
   <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
    {[['ðŸŽ¥',c.liveClasses,'live'],['ðŸ“',c.notes,'notes'],['ðŸ§ ',c.assessments,'tests']].map(([ic,n,l])=><span key={l} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200">{ic} {n} {l}</span>)}
   </div>
   <div className="mt-auto flex items-end justify-between gap-3 border-t border-slate-200/70 pt-3">
    <div className="min-w-0">
     <div className="flex items-baseline gap-2"><span className="text-xl font-extrabold text-navy sm:text-2xl">{free?'Free':inr(c.price)}</span>{c.listPrice&&<span className="text-xs text-slate-400 line-through sm:text-sm">{inr(c.listPrice)}</span>}</div>
     {off&&<p className="text-[11px] font-semibold text-emerald-600">You save {inr(c.listPrice-c.price)}</p>}
    </div>
    {cta}
   </div>
  </div>
 </article>}
 const stats=st&&!Array.isArray(st)?st:null
 const featured=useMemo(()=>(Array.isArray(cat)?[...cat].sort((a,b)=>b.students-a.students||(b.rating||0)-(a.rating||0)||a.id-b.id).slice(0,3):[]),[cat])
 const numbers=stats?[[stats.students,'Students',''],[stats.courses,'Courses',''],[stats.teachers,'Expert Teachers',''],stats.satisfaction!=null?[stats.satisfaction,'Student Satisfaction','%']:[stats.liveClasses,'Live Classes','']]:[]
 return <>
 <section className="relative grid items-center gap-8 py-6 sm:gap-10 sm:py-8 lg:grid-cols-[1.1fr_.9fr] lg:py-14">
  <div><span className="chip animate-fadeUp">âœ¨ Your personalized learning platform</span>
   <h1 className="mt-4 text-4xl font-extrabold leading-[1.1] text-navy sm:text-5xl md:text-6xl lg:text-7xl"><SplitText text="Learn Better."/><br/><SplitText text="Study Smarter." delay={220}/><br/><SplitText className="gradient-text" text="Achieve More." delay={440}/></h1>
   <p className="mt-4 max-w-xl text-base opacity-80 sm:mt-5 sm:text-lg">Your personalized learning platform with expert courses, live sessions and focused learning.</p>
   <div className="mt-6 flex flex-wrap gap-2.5 sm:mt-7 sm:gap-3"><Link className="btn !px-5 !py-2.5 text-sm sm:!px-7 sm:!py-3 sm:text-base" to="/courses">Explore Courses â†’</Link><Link className="btn2 !px-5 !py-2.5 text-sm sm:!px-7 sm:!py-3 sm:text-base" to="/demos">Book Demo Session</Link></div>
   <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs opacity-75 sm:mt-7 sm:gap-x-5 sm:text-sm"><span>âœ… Live + recorded classes</span><span>âœ… Secure UPI / QR / card payments</span><span>âœ… Certificates</span></div></div>
  <HeroArt/></section>

 <section aria-label="Learning statistics" className="grid grid-cols-2 gap-3 md:grid-cols-4">{st===null?<Skeletons n={4} h="h-24 sm:h-28"/>:numbers.map(([n,l,suf],i)=><Reveal key={l} delay={i*80}><div className="box text-center"><div className="gradient-text font-serif text-3xl font-extrabold sm:text-4xl"><Count to={Number(n)||0}/>{suf||'+'}</div><div className="mt-1 text-xs font-medium opacity-75 sm:text-sm">{l}</div></div></Reveal>)}</section>

 <Section eyebrow="Top picks" title="Featured Courses" sub="Hand-built courses with live classes, notes, tests and doubt support." action={<Link className="btn2" to="/courses">View all courses â†’</Link>}>
  <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">{cat===null?<Skeletons h="h-64 sm:h-72"/>:featured.length===0?<Empty icon="ðŸ“š" title="Courses are coming soon">Teachers are preparing their courses. Check back shortly.</Empty>:featured.map((c,i)=><CourseCard key={c.id} c={c} i={i} enrolled={en?.has(c.id)}/>)}</div></Section>

 <Section eyebrow="Why choose us" title="Why NLMed Study?" sub="Everything you need to prepare with confidence, without the clutter.">
  <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">{WHY.map(([ic,t,d],i)=><Reveal key={t} delay={i*60}><div className="box h-full p-3.5 hover:-translate-y-1 sm:p-5"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal/20 to-brand2/20 text-xl sm:h-12 sm:w-12 sm:text-2xl">{ic}</div><h3 className="mt-2 text-sm text-navy sm:mt-3 sm:text-lg">{t}</h3><p className="mt-1 text-xs opacity-75 sm:text-sm">{d}</p></div></Reveal>)}</div></Section>

 <Section eyebrow="Meet your mentors" title="Popular Teachers" action={<Link className="btn2" to="/teachers">All teachers â†’</Link>}>
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">{teachers===null?<Skeletons h="h-32 sm:h-40"/>:(Array.isArray(teachers)?teachers:[]).length===0?<Empty icon="ðŸ‘©â€ðŸ«" title="Teachers will appear here">Once teachers join, their profiles show up on this page.</Empty>:teachers.slice(0,3).map(t=><TeacherCard key={t.id} t={t}/>)}</div></Section>

 <Section eyebrow="Loved by learners" title="Student Reviews">
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3">{reviews===null?<Skeletons h="h-32 sm:h-40"/>:(Array.isArray(reviews)?reviews:[]).length===0?<Empty icon="ðŸ’¬" title="Reviews will appear here">Enrolled students can rate and review a course from its page. Their words show up here.</Empty>:reviews.slice(0,3).map(r=><figure key={r.id} className="box flex flex-col p-4 sm:p-5"><div className="text-amber-500">{'â˜…'.repeat(r.rating)}<span className="opacity-30">{'â˜…'.repeat(5-r.rating)}</span></div><blockquote className="mt-2 flex-1 text-sm sm:text-[15px]">â€œ{r.comment}â€</blockquote><figcaption className="mt-3 flex items-center gap-3 sm:mt-4"><span className="avatar h-8 w-8 text-xs sm:h-9 sm:w-9 sm:text-sm" aria-hidden="true">{initials(r.name)}</span><span className="text-sm"><b className="block text-navy">{r.name}</b><span className="text-xs opacity-60 sm:text-sm">{r.course}</span></span></figcaption></figure>)}</div></Section>

 <section id="demo" className="mt-12 scroll-mt-24 sm:mt-16"><div className="mb-4 sm:mb-5"><p className="text-xs font-bold uppercase tracking-wider text-teal sm:text-sm">Try before you enroll</p><h2 className="text-2xl text-navy sm:text-3xl">Free Demo Sessions</h2></div>
  <div className="grid gap-4 lg:grid-cols-2">{demos===null?<Skeletons n={2} h="h-40"/>:(demos||[]).length===0?<Empty icon="ðŸŽ¥" title="No demo sessions scheduled">New demo sessions are announced here.</Empty>:demos.map(d=><DemoCard key={d.id} d={d}/>)}</div></section>

 {!user&&<section className="stat-glass relative mt-12 overflow-hidden p-6 text-center sm:mt-16 sm:p-8 md:p-12"><div className="hero-blob -left-10 -top-10 h-56 w-56 bg-white"/><h2 className="relative text-2xl text-white sm:text-3xl md:text-4xl">Ready to start learning?</h2><p className="relative mx-auto mt-2 max-w-lg text-sm text-white/85 sm:text-base">Create a free account in a minute and explore courses, demos and focus sessions.</p><div className="relative mt-5 flex flex-wrap justify-center gap-3 sm:mt-6"><Link to="/register" className="inline-flex min-h-[44px] items-center rounded-xl bg-white px-5 py-2.5 font-bold text-slate-900 transition hover:-translate-y-0.5 hover:shadow-xl sm:px-6">Create free account</Link><Link to="/courses" className="inline-flex min-h-[44px] items-center rounded-xl border border-white/60 px-5 py-2.5 font-semibold text-white transition hover:bg-white/10 sm:px-6">Browse courses</Link></div></section>}</>}

function TeacherCard({t}){return <article className="box flex gap-3 p-4 sm:gap-4 sm:p-5"><span className="avatar h-12 w-12 shrink-0 text-base sm:h-16 sm:w-16 sm:text-xl" aria-hidden="true">{initials(t.name)}</span><div className="min-w-0"><h3 className="truncate text-base text-navy sm:text-lg">{t.name}</h3>
 <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs sm:text-sm"><Stars v={t.rating}/><span className="opacity-70">ðŸ‘¥ {t.students} students</span><span className="opacity-70">ðŸ“š {t.courses} courses</span></div>
 <div className="mt-2 flex flex-wrap gap-1">{(t.subjects||[]).map(s=><span key={s} className="chip">{s}</span>)}</div></div></article>}

export function Teachers(){const t=useGet('/teachers')
 return <><header className="mb-5 sm:mb-6"><p className="text-xs font-bold uppercase tracking-wider text-teal sm:text-sm">Our faculty</p><h1 className="text-3xl text-navy sm:text-4xl">Expert Teachers</h1><p className="mt-1 max-w-xl text-sm opacity-75 sm:text-base">Learn directly from educators who care about your understanding, not just your marks.</p></header>
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">{t===null?<Skeletons h="h-32 sm:h-36"/>:(Array.isArray(t)?t:[]).length===0?<Empty icon="ðŸ‘©â€ðŸ«" title="No teachers yet">Teacher profiles appear here once they join.</Empty>:t.map(x=><TeacherCard key={x.id} t={x}/>)}</div></>}

export function Demos(){const d=useGet('/demos')
 return <><header className="mb-5 sm:mb-6"><p className="text-xs font-bold uppercase tracking-wider text-teal sm:text-sm">Free to attend</p><h1 className="text-3xl text-navy sm:text-4xl">Demo Sessions</h1><p className="mt-1 max-w-xl text-sm opacity-75 sm:text-base">Experience a live class before you enroll. Reserve a seat, get the join link instantly.</p></header>
  <div className="grid gap-4 lg:grid-cols-2">{d===null?<Skeletons n={2} h="h-40"/>:(d||[]).length===0?<Empty icon="ðŸŽ¥" title="No demo sessions right now">Please check back soon or <Link className="underline" to="/contact">contact us</Link>.</Empty>:d.map(x=><DemoCard key={x.id} d={x}/>)}</div></>}

export function Courses(){const c=useGet('/catalog'),en=useEnrolled(),[q,setQ]=useState(''),[sub,setSub]=useState('All'),[sort,setSort]=useState('popular')
 const subjects=useMemo(()=>['All',...new Set((Array.isArray(c)?c:[]).map(x=>x.subject).filter(Boolean))],[c])
 const list=useMemo(()=>{let l=(Array.isArray(c)?c:[]).filter(x=>(sub==='All'||x.subject===sub)&&(x.name+' '+x.teacher+' '+x.subject).toLowerCase().includes(q.trim().toLowerCase()))
  const by={popular:(a,b)=>b.students-a.students||a.id-b.id,rating:(a,b)=>(b.rating||0)-(a.rating||0),low:(a,b)=>a.price-b.price,high:(a,b)=>b.price-a.price}[sort];return [...l].sort(by)},[c,q,sub,sort])
 return <><header className="mb-5 sm:mb-6"><p className="text-xs font-bold uppercase tracking-wider text-teal sm:text-sm">Learn at your pace</p><h1 className="text-3xl text-navy sm:text-4xl">Courses</h1></header>
  <div className="box mb-5 grid gap-3 p-3 sm:mb-6 sm:p-5 md:grid-cols-[1fr_auto]"><input className="inp" type="search" aria-label="Search courses" placeholder="Search by course, subject or teacherâ€¦" value={q} onChange={e=>setQ(e.target.value)}/>
   <select className="inp md:w-52" aria-label="Sort courses" value={sort} onChange={e=>setSort(e.target.value)}><option value="popular">Most popular</option><option value="rating">Highest rated</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select>
   <div className="flex flex-wrap gap-1.5 sm:gap-2 md:col-span-2" role="group" aria-label="Filter by subject">{subjects.map(s=><button key={s} aria-pressed={sub===s} onClick={()=>setSub(s)} className={`rounded-full border px-3 py-1 text-xs font-semibold transition sm:px-4 sm:text-sm ${sub===s?'border-transparent bg-gradient-to-r from-teal to-brand2 text-white shadow':'border-slate-300 hover:border-teal hover:text-teal'}`}>{s}</button>)}</div></div>
  <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">{c===null?<Skeletons n={4} h="h-64 sm:h-72"/>:list.length===0?<Empty icon="ðŸ”" title="No courses found">Try a different search or subject filter.</Empty>:list.map((x,i)=><CourseCard key={x.id} c={x} i={i} enrolled={en?.has(x.id)}/>)}</div></>}

export function CourseDetail(){const {id}=useParams(),{user}=useAuth(),go=useNavigate(),all=useGet('/catalog'),topics=useGet(`/courses/${id}/topics`),en=useEnrolled()
 const c=(Array.isArray(all)?all:[]).find(x=>x.id==id)
 if(all===null)return <div className="grid gap-4"><div className="skel h-56"/><div className="skel h-72"/></div>
 if(!c)return <Empty icon="ðŸ§­" title="Course not found">It may have been removed. <Link className="underline" to="/courses">Browse all courses</Link>.</Empty>
 const [g,e]=theme(c.subject),owned=en?.has(c.id),staff=user&&user.role!=='STUDENT'
 const incl=[['ðŸŽ¥',`${c.liveClasses} live classes`],['âœï¸',`${c.notes} handwritten notes`],['ðŸ§ ',`${c.assessments} assessments`],['â–¶ï¸',`${c.lessons} video lessons`],['â“','Doubt support'],['ðŸŽ“','Certificate on completion']]
 return <>
  <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${g} p-5 text-white shadow-xl sm:p-6 md:p-10`}><span className="absolute -right-10 -top-10 h-60 w-60 rounded-full bg-white/10" aria-hidden="true"/><img src={courseImg(c.subject)} alt="" className="absolute bottom-4 right-6 hidden h-44 w-44 rounded-2xl object-cover shadow-2xl md:block"/>
   <nav aria-label="Breadcrumb" className="text-sm text-white/80"><Link className="hover:underline" to="/courses">Courses</Link> / {c.subject}</nav>
   <h1 className="relative mt-2 max-w-2xl text-2xl font-extrabold text-white sm:text-3xl md:text-5xl">{c.name}</h1>
   <div className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:gap-x-5 sm:text-sm"><span className="flex items-center gap-2"><span className="avatar h-7 w-7 border border-white/40 text-xs sm:h-8 sm:w-8" aria-hidden="true">{initials(c.teacher)}</span>{c.teacher}</span>
    <span>{c.rating==null?'â­ New course':`â­ ${c.rating.toFixed(1)} (${c.reviews} reviews)`}</span><span>ðŸ‘¥ {Number(c.students).toLocaleString('en-IN')} students</span><span>â³ {c.liveClasses} live classes</span></div></section>
  <div className="mt-5 grid gap-5 sm:mt-6 sm:gap-6 lg:grid-cols-[1fr_340px]">
   <div className="grid min-w-0 content-start gap-5 sm:gap-6">
    <section className="box"><h2 className="text-lg text-navy sm:text-xl">About this course</h2><p className="mt-2 text-sm opacity-80 sm:text-base">A structured {c.subject.toLowerCase()} course by {c.teacher}: live interactive classes, handwritten notes, curated resources and topic-wise tests that show your weak areas, with doubt support whenever you are stuck.</p>
     <div className="mt-4 grid gap-2 sm:grid-cols-2">{incl.map(([i,t])=><div key={t} className="flex items-center gap-3 rounded-xl bg-teal/5 px-3 py-2 text-sm">
      <span className="text-lg sm:text-xl" aria-hidden="true">{i}</span>{t}</div>)}</div></section>
    <section className="box"><h2 className="text-lg text-navy sm:text-xl">Curriculum</h2>
     {topics===null?<div className="skel mt-3 h-32"/>:(topics||[]).length===0?<p className="mt-2 text-sm opacity-70">Topics will appear once the teacher adds them.</p>:<ol className="mt-3 grid gap-2">{topics.map((t,i)=><li key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-200/70 px-3 py-2.5"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-teal to-brand2 text-xs font-bold text-white sm:h-8 sm:w-8 sm:text-sm">{i+1}</span><span className="min-w-0 flex-1 text-sm font-medium sm:text-base">{t.title}</span><span className="shrink-0 text-xs opacity-60">{owned?'Unlocked':'ðŸ”’ Enroll'}</span></li>)}</ol>}</section>
    <section className="box flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg text-navy sm:text-xl">Not sure yet?</h2><p className="text-sm opacity-75">Attend a free demo session and see how the class works.</p></div><Link className="btn2" to="/demos">ðŸŽ¥ Watch a free demo</Link></section>
    <Reviews id={id}/></div>
   <aside className="lg:sticky lg:top-24 lg:self-start"><div className="box grid gap-3 shadow-xl">
    <div className="flex flex-wrap items-end gap-2"><span className="text-3xl font-extrabold text-navy sm:text-4xl">{c.price>0?inr(c.price):'Free'}</span>{c.listPrice&&<span className="mb-1 text-slate-400 line-through">{inr(c.listPrice)}</span>}{c.discountPct>0&&<span className="chip mb-1.5 !bg-rose-100 !text-rose-700">{c.discountPct}% off</span>}</div>
    {owned?<Link className="btn !py-3" to={`/learn/${c.id}`}>â–¶ Start Learning</Link>:staff?<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">You are signed in as {user.role.toLowerCase()}. Use a student account to enroll.</p>
     :<button className="btn !py-3 text-base" onClick={()=>go(user?`/checkout/${c.id}`:'/login')}>{user?'Enroll Now':'Login to Enroll'}</button>}
    <p className="text-center text-xs opacity-70">ðŸ”’ Secure payment Â· QR Â· UPI Â· Card Â· coupon codes accepted</p>
    <ul className="grid gap-1.5 border-t border-slate-200/70 pt-3 text-sm">{incl.map(([i,t])=><li key={t}>{i} {t}</li>)}</ul></div></aside></div></>}

const AboutCard=({i,t,d})=><div className="box p-4 sm:p-5"><div className="text-2xl sm:text-3xl">{i}</div><h3 className="mt-2 text-base text-navy sm:text-lg">{t}</h3><p className="mt-1 text-sm opacity-75">{d}</p></div>
export function About(){const st=useGet('/public/stats'),s=st&&!Array.isArray(st)?st:null
 return <><section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal to-brand2 p-6 text-white sm:p-8 md:p-14"><div className="hero-blob -right-10 -top-10 h-60 w-60 bg-white"/><p className="relative text-xs font-bold uppercase tracking-wider text-white/80 sm:text-sm">About NLMed Study</p><h1 className="relative mt-2 max-w-2xl text-3xl font-extrabold text-white sm:text-4xl md:text-5xl">A calmer, smarter way to learn medicine.</h1><p className="relative mt-3 max-w-2xl text-base text-white/85 sm:mt-4 sm:text-lg">NLMed Study brings live classes, handwritten notes, tests and doubt support into one focused place, so you spend your energy learning, not searching.</p></section>
  <div className="mt-6 grid gap-3 sm:mt-8 sm:gap-4 md:grid-cols-3"><AboutCard i="ðŸŽ¯" t="Our mission" d="Make high-quality medical teaching accessible, personal and distraction-free."/><AboutCard i="ðŸ¤" t="Teacher-first payments" d="Every teacher sets their own payment account. Your fee goes straight to the person teaching you."/><AboutCard i="ðŸ§ " t="Built for focus" d="No social feed. Just your lessons, notes, tests and a focus timer that keeps you on track."/></div>
  {s&&<div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 md:grid-cols-4">{[[s.students,'Students'],[s.courses,'Courses'],[s.teachers,'Teachers'],[s.liveClasses,'Live classes']].map(([n,l])=><div key={l} className="box text-center"><div className="gradient-text font-serif text-3xl font-extrabold sm:text-4xl"><Count to={Number(n)||0}/>+</div><div className="text-xs opacity-75 sm:text-sm">{l}</div></div>)}</div>}
  <div className="mt-6 flex flex-wrap justify-center gap-3 sm:mt-8"><Link className="btn" to="/courses">Explore courses</Link><Link className="btn2" to="/contact">Contact us</Link></div></>}

function Reviews({id}){const [v,setV]=useState(0),r=useGet(`/courses/${id}/reviews?v=${v}`),{user}=useAuth(),[m,setM]=useState(''),items=r?.items||[]
 const send=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{await api.post(`/courses/${id}/reviews`,f);setM('');e.target.reset();setV(v+1)}catch(x){setM(msg(x))}}
 return <section className="box"><h2 className="text-lg text-navy sm:text-xl">Student reviews {r?.average?<span className="ml-2 text-amber-500">â˜… {r.average}</span>:''}</h2>
  {r===null?<div className="skel mt-3 h-20"/>:items.length===0?<p className="mt-2 text-sm opacity-70">No reviews yet. Enrolled students can be the first to share their experience.</p>:<div className="mt-3 grid gap-3">{items.map(i=><div key={i.id} className="flex gap-3 border-b border-slate-200/60 pb-3 last:border-0"><span className="avatar h-8 w-8 shrink-0 text-xs sm:h-9 sm:w-9 sm:text-sm" aria-hidden="true">{initials(i.userName)}</span><div className="min-w-0"><div className="text-sm"><b className="text-navy">{i.userName}</b> <span className="text-amber-500">{'â˜…'.repeat(i.rating)}</span></div><p className="text-sm sm:text-[15px]">{i.comment}</p></div></div>)}</div>}
  {user?.role==='STUDENT'&&<form onSubmit={send} className="mt-4 flex flex-wrap gap-2"><select aria-label="Rating" className="inp max-w-[90px]" name="rating">{[5,4,3,2,1].map(n=><option key={n}>{n}</option>)}</select><input className="inp min-w-[160px] flex-1" name="comment" placeholder="Your review (enrolled students only)" required/><button className="btn">Post</button></form>}
  {m&&<p role="alert" className="mt-2 text-sm text-rose-700">{m}</p>}</section>}
