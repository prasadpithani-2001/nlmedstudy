export function CourseCard({c,i=0,enrolled}){const [g,e]=theme(c.subject),{user}=useAuth(),go=useNavigate(),staff=user&&user.role!=='STUDENT'
 const img=courseImg(c.subject),off=c.discountPct>0,free=!(c.price>0)
 const cta=enrolled?<Link to={`/learn/${c.id}`} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:scale-105">▶ Continue</Link>
  :staff?<Link to={`/course/${c.id}`} className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-navy transition hover:border-teal hover:text-teal">View</Link>
  :<button type="button" onClick={()=>go(user?`/checkout/${c.id}`:'/login')} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/30 transition hover:scale-105 hover:shadow-xl">Enroll now →</button>
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
   <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm"><Stars v={c.rating} n={c.reviews}/><span className="opacity-70">👥 {Number(c.students).toLocaleString('en-IN')} enrolled</span></div>
   <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
    {[['🎥',c.liveClasses,'live'],['📝',c.notes,'notes'],['🧠',c.assessments,'tests']].map(([ic,n,l])=><span key={l} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200">{ic} {n} {l}</span>)}
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
 export function CourseCard({c,i=0,enrolled}){const [g,e]=theme(c.subject),{user}=useAuth(),go=useNavigate(),staff=user&&user.role!=='STUDENT'
 const img=courseImg(c.subject),off=c.discountPct>0,free=!(c.price>0)
 const cta=enrolled?<Link to={`/learn/${c.id}`} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:scale-105">▶ Continue</Link>
  :staff?<Link to={`/course/${c.id}`} className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-navy transition hover:border-teal hover:text-teal">View</Link>
  :<button type="button" onClick={()=>go(user?`/checkout/${c.id}`:'/login')} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/30 transition hover:scale-105 hover:shadow-xl">Enroll now →</button>
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
   <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm"><Stars v={c.rating} n={c.reviews}/><span className="opacity-70">👥 {Number(c.students).toLocaleString('en-IN')} enrolled</span></div>
   <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
    {[['🎥',c.liveClasses,'live'],['📝',c.notes,'notes'],['🧠',c.assessments,'tests']].map(([ic,n,l])=><span key={l} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200">{ic} {n} {l}</span>)}
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