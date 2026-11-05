import {useEffect,useRef,useState} from 'react'
import {Link,useNavigate} from 'react-router-dom'
import {flushSync,createPortal} from 'react-dom'
import api from './api'
import {animateTheme,applyAppearance,cached,readType,saveType,clearType,FONTS,SIZES} from './appearance'
import {useInView,Reveal,Count,SplitText,confetti,useMotionFX,useMotion,LEVELS,setMotion,resetMotion,motionOff,motionLevel} from './motion'
export {useInView,Reveal,Count,SplitText,confetti,SuccessMark} from './motion'
export const Aurora=()=><div className="aurora" aria-hidden="true"><i className="a1"/><i className="a2"/><i className="a3"/></div>
export function ThemeButton(){const [d,setD]=useState(()=>document.documentElement.classList.contains('dark'))
 const toggle=e=>{const n=!d,apply=()=>{animateTheme();document.documentElement.classList.toggle('dark',n);localStorage.setItem('ms_theme_v2',n?'dark':'light');setD(n)}
  if(!document.startViewTransition||motionLevel()!=='full'){apply();return}
  const r=e.currentTarget.getBoundingClientRect(),x=e.detail?e.clientX:r.left+r.width/2,y=e.detail?e.clientY:r.top+r.height/2,rad=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y))
  const t=document.startViewTransition(()=>{flushSync(apply)})
  t.ready.then(()=>document.documentElement.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${rad}px at ${x}px ${y}px)`]},{duration:700,easing:'cubic-bezier(.16,1,.3,1)',pseudoElement:'::view-transition-new(root)'})).catch(()=>{})}
 return <button className="navlink !px-2 sm:!px-3" onClick={toggle} aria-label="Toggle dark mode"><span key={String(d)} className="inline-block animate-pop">{d?'☀️':'🌙'}</span></button>}
export const SearchButton=()=><button className="navlink hidden sm:block" onClick={()=>dispatchEvent(new Event('ms-palette'))} aria-label="Search (Ctrl K)" title="Search (Ctrl K)">🔍</button>
export function Bento({c}){const list=c||[],sum=k=>list.reduce((s,x)=>s+(x[k]||0),0)
 const T=({cls='',delay=0,v='up',children})=><Reveal delay={delay} variant={v} className={cls}><div className="box h-full">{children}</div></Reveal>
 const Bar=({l,v})=><div className="my-1 text-sm">{l} — {v}%<div className="h-2 rounded bg-stone-200"><div className="grow h-2 rounded bg-teal" style={{width:v+'%'}}/></div></div>
 return <section aria-label="Platform highlights" className="my-8 grid gap-4 md:grid-cols-4">
 <T cls="md:col-span-2" v="left"><p className="font-hand text-2xl text-teal">taught live, with you</p><h3 className="text-2xl text-navy">Live classes</h3><p><b className="font-serif text-5xl"><Count to={sum('liveClasses')}/></b> live classes across {list.length} courses</p></T>
 <T cls="md:col-span-2" delay={100} v="right"><p className="font-hand text-2xl text-teal">the signature feature</p><h3 className="text-2xl text-navy">Handwritten notebook</h3><p className="font-hand text-2xl leading-8 text-indigo-700 dark:text-indigo-300">Heart — Blood Supply<br/>RCA → SA node · LAD → anterior wall</p><p><b><Count to={sum('notes')}/></b> handwritten notes in the catalog</p></T>
 <T cls="md:col-span-2" delay={150}><h3 className="text-xl text-navy">Test → find weakness → revise</h3><Bar l="Anatomy" v={82}/><Bar l="Physiology" v={76}/><Bar l="Pathology" v={61}/><p className="text-xs opacity-70">Sample report · <Count to={sum('assessments')}/> assessments in the catalog</p></T>
 <T delay={200} v="zoom"><h3 className="text-xl text-navy">Doubts</h3><p>Ask during class. The teacher marks them answered or important.</p></T>
 <T delay={250} v="flip"><h3 className="text-xl text-navy">Focus Mode</h3><p>Focus and break cycles, progress ring, daily stats and streak.</p><Link className="btn2 mt-2" to="/focus">Try it</Link></T>
 <T cls="md:col-span-4" delay={100} v="blur"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-2xl text-navy">Not sure yet? Attend a free demo class</h3><p>₹0. Experience the teaching before you enroll.</p></div><a className="btn" href="#demo">Reserve my free seat</a></div></T></section>}
export function Palette(){const [open,setOpen]=useState(false),[q,setQ]=useState(''),[courses,setC]=useState([]),go=useNavigate(),inp=useRef(null)
 useEffect(()=>{const k=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setOpen(o=>!o)}if(e.key==='Escape')setOpen(false)},o=()=>setOpen(true);addEventListener('keydown',k);addEventListener('ms-palette',o);return()=>{removeEventListener('keydown',k);removeEventListener('ms-palette',o)}},[])
 useEffect(()=>{if(open){setQ('');api.get('/courses').then(r=>setC(r.data)).catch(()=>{});setTimeout(()=>inp.current?.focus(),30)}},[open])
 const u=JSON.parse(localStorage.getItem('ms_user')||'null')
 const items=[{t:'Courses',to:'/courses'},{t:'Free demo',to:'/#demo'},{t:'Contact us',to:'/contact'},{t:'Focus mode',to:'/focus'},u?{t:'My dashboard',to:{STUDENT:'/dashboard',TEACHER:'/teacher',ADMIN:'/admin'}[u.role]}:{t:'Login',to:'/login'},...courses.map(c=>({t:c.name,to:'/course/'+c.id}))].filter(i=>i.t.toLowerCase().includes(q.toLowerCase()))
 const pick=i=>{setOpen(false);go(i.to)}
 if(!open)return null
 return <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 p-4 pt-24" onClick={()=>setOpen(false)}>
 <div role="dialog" aria-modal="true" aria-label="Quick search" className="box w-full max-w-lg animate-fadeUp" onClick={e=>e.stopPropagation()}>
 <input ref={inp} className="inp" placeholder="Search courses or pages…" aria-label="Search" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&items[0])pick(items[0])}}/>
 <ul className="mt-2 max-h-64 overflow-auto">{items.map(i=><li key={i.t}><button className="w-full rounded-lg px-3 py-2 text-left hover:bg-teal/10" onClick={()=>pick(i)}>{i.t}</button></li>)}{!items.length&&<li className="px-3 py-2">No matches</li>}</ul>
 <p className="mt-2 text-xs opacity-70">Enter to open · Esc to close</p></div></div>}


/* ================= Phase 5: backgrounds, accents, scroll bar, typewriter, confetti ================= */
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||motionOff()
export const BGS=[['aurora','Aurora','✨'],['particles','Neural net','🕸️'],['ecg','Heartbeat','💓'],['waves','Waves','🌊'],['notebook','Notebook','📓'],['plain','Plain','▫️']]
export const ACCENTS=[['indigo','#4f46e5','Indigo'],['teal','#0d9488','Teal'],['rose','#e11d48','Rose'],['amber','#b45309','Amber'],['violet','#7c3aed','Violet'],['navy','#1e40af','Navy blue'],['lavender','#7c6ed6','Lavender'],['emerald','#059669','Emerald'],['sky','#0284c7','Sky'],['fuchsia','#c026d3','Fuchsia']]
export const applyAccent=a=>{if(a&&a!=='indigo')document.documentElement.dataset.accent=a;else delete document.documentElement.dataset.accent}

function Particles(){const ref=useRef(null)
 useEffect(()=>{const c=ref.current,x=c.getContext('2d'),dpr=Math.min(devicePixelRatio||1,2);let w=0,h=0,raf=0,pts=[],rgb='15,118,110';const m={x:-999,y:-999}
  const col=()=>{rgb=(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'15 118 110').split(/\s+/).join(',')}
  const size=()=>{w=innerWidth;h=innerHeight;c.width=w*dpr;c.height=h*dpr;x.setTransform(dpr,0,0,dpr,0,0);const n=Math.round(Math.min(90,w*h/16000));pts=Array.from({length:n},()=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35}))}
  const frame=()=>{x.clearRect(0,0,w,h);const still=reduce()
   pts.forEach(p=>{if(!still){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>w)p.vx*=-1;if(p.y<0||p.y>h)p.vy*=-1;const dx=p.x-m.x,dy=p.y-m.y,d=Math.hypot(dx,dy);if(d<110&&d>0){p.x+=dx/d*1.6;p.y+=dy/d*1.6}}})
   for(let i=0;i<pts.length;i++){const a=pts[i];for(let j=i+1;j<pts.length;j++){const b=pts[j],d=Math.hypot(a.x-b.x,a.y-b.y);if(d<125){x.strokeStyle=`rgba(${rgb},${(1-d/125)*.35})`;x.lineWidth=1;x.beginPath();x.moveTo(a.x,a.y);x.lineTo(b.x,b.y);x.stroke()}}
    x.fillStyle=`rgba(${rgb},.6)`;x.beginPath();x.arc(a.x,a.y,2.2,0,7);x.fill()}
   if(!still)raf=requestAnimationFrame(frame)}
  const mv=e=>{m.x=e.clientX;m.y=e.clientY};col();size();frame()
  addEventListener('resize',size);addEventListener('pointermove',mv);addEventListener('ms-accent',col)
  return()=>{cancelAnimationFrame(raf);removeEventListener('resize',size);removeEventListener('pointermove',mv);removeEventListener('ms-accent',col)}},[])
 return <canvas ref={ref}/>}

export function Backdrop(){
 const lvl=useMotion(),[s,setS]=useState(()=>localStorage.getItem('ms_bg')||'aurora'),[auto,setAuto]=useState(()=>localStorage.getItem('ms_bg_auto')==='1')
 useEffect(()=>{const h=e=>{setS(e.detail.style);setAuto(e.detail.auto)};addEventListener('ms-bg',h);return()=>removeEventListener('ms-bg',h)},[])
 useEffect(()=>{if(!auto||reduce())return;const list=BGS.map(b=>b[0]).filter(k=>k!=='plain'),id=setInterval(()=>setS(cur=>list[(list.indexOf(cur)+1)%list.length]),20000);return()=>clearInterval(id)},[auto])
 return <div className="bgfx" aria-hidden="true"><div key={s+lvl} className="fadein absolute inset-0">
  {s==='aurora'&&<div className="aurora"><i className="a1"/><i className="a2"/><i className="a3"/></div>}
  {s==='particles'&&<Particles/>}
  {s==='ecg'&&<>{[['10%',34,.5],['42%',26,.35],['74%',42,.25]].map(([t,d,o],i)=><div key={i} className="ecgrow" style={{top:t,animationDuration:d+'s',opacity:o}}/>)}</>}
  {s==='waves'&&<>{[['rgb(var(--accent)/.20)',34,0],['rgb(139 92 246/.15)',46,26],['rgb(34 197 94/.13)',60,52]].map(([bg,d,b],i)=><div key={i} className="wave" style={{background:bg,animationDuration:d+'s',bottom:b,animationDirection:i%2?'reverse':'normal'}}/>)}</>}
  {s==='notebook'&&<div className="notebook"/>}</div></div>}

/* Style drawer. It is rendered through a portal on <body>, so it never sits inside the sticky, blurred header
   (that header created its own positioning context and pushed the old dropdown out of place). */
export function StylePicker(){
 const mo=useMotion(),[open,setOpen]=useState(false),[s,setS]=useState(()=>localStorage.getItem('ms_bg')||'aurora'),[auto,setAuto]=useState(()=>localStorage.getItem('ms_bg_auto')==='1'),[acc,setAcc]=useState(()=>localStorage.getItem('ms_accent')||'indigo'),[type,setType]=useState(()=>readType())
 useEffect(()=>{if(!open)return;const k=e=>{if(e.key==='Escape')setOpen(false)};addEventListener('keydown',k);const ov=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{removeEventListener('keydown',k);document.body.style.overflow=ov}},[open])
 const bg=(style,a)=>{localStorage.setItem('ms_bg',style);localStorage.setItem('ms_bg_auto',a?'1':'0');setS(style);setAuto(a);dispatchEvent(new CustomEvent('ms-bg',{detail:{style,auto:a}}))}
 const accent=a=>{localStorage.setItem('ms_accent',a);setAcc(a);applyAccent(a);dispatchEvent(new Event('ms-accent'))}
 const pickType=(k,v)=>{const n={...type,[k]:v};setType(n);saveType(n)}
 const reset=()=>{['ms_bg','ms_bg_auto','ms_accent'].forEach(k=>localStorage.removeItem(k));clearType();resetMotion();setS('aurora');setAuto(false);setAcc('indigo');setType({});applyAccent(null);dispatchEvent(new CustomEvent('ms-bg',{detail:{style:'aurora',auto:false}}));dispatchEvent(new Event('ms-accent'));applyAppearance(cached())}
 const btn=(on,extra='')=>`btn2 !min-h-[40px] !px-2 text-sm ${on?'!bg-teal/15 !border-teal':''} ${extra}`
 const h=t=><h3 className="mb-2 mt-6 text-base font-serif text-navy first:mt-0">{t}</h3>
 const panel=open&&createPortal(<div className="fixed inset-0 z-[70]">
  <div className="absolute inset-0 animate-fadeIn bg-black/30" aria-hidden="true" onClick={()=>setOpen(false)}/>
  <aside role="dialog" aria-modal="true" aria-labelledby="style-drawer-title" className="style-drawer absolute right-0 top-0 flex h-full w-full max-w-[22rem] flex-col border-l border-line bg-surface shadow-2xl">
   <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-4">
    <div><p className="font-hand text-teal">make it yours</p><h2 id="style-drawer-title" className="text-xl font-serif text-navy">Style</h2></div>
    <div className="flex items-center gap-2"><button type="button" className={btn(false)} onClick={reset}>Reset</button><button type="button" className={btn(false,'!px-3')} aria-label="Close style panel" onClick={()=>setOpen(false)}>✕</button></div>
   </div>
   <div className="grow overflow-y-auto px-5 pb-8 pt-2">
    {h('Background')}
    <div className="grid grid-cols-2 gap-2">{BGS.map(([k,l,e])=><button type="button" key={k} aria-pressed={s===k} onClick={()=>bg(k,auto)} className={btn(s===k,'text-left')}>{e} {l}</button>)}</div>
    <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={auto} onChange={e=>bg(s,e.target.checked)}/> Change background automatically</label>
    {h('Accent colour')}
    <div className="grid grid-cols-5 gap-3">{ACCENTS.map(([k,c,l])=><button type="button" key={k} aria-label={l} aria-pressed={acc===k} title={l} onClick={()=>accent(k)} className={`h-9 w-9 rounded-full border-2 transition hover:scale-110 ${acc===k?'border-navy ring-2 ring-offset-2 ring-teal':'border-white'}`} style={{background:c}}/>)}</div>
    {h('Typography')}
    <p className="mb-2 text-xs text-slate-500">Font</p>
    <div className="grid grid-cols-2 gap-2">{FONTS.map(f=><button type="button" key={f.id} aria-pressed={type.font===f.id} onClick={()=>pickType('font',f.id)} className={btn(type.font===f.id,'text-left')}>{f.name}</button>)}</div>
    <p className="mb-2 mt-4 text-xs text-slate-500">Text size</p>
    <div className="grid grid-cols-2 gap-2">{SIZES.map(([k,l])=><button type="button" key={k} aria-pressed={type.size===k} onClick={()=>pickType('size',k)} className={btn(type.size===k)}>{l}</button>)}</div>
    <p className="mt-2 text-xs text-slate-500">Not picked yet? The site setting is used. Saved on this device.</p>
    {h('Animations')}
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Animation level">{LEVELS.map(([k,l,e,tip])=><button type="button" key={k} title={tip} aria-pressed={mo===k} onClick={()=>setMotion(k)} className={btn(mo===k)}>{e} {l}</button>)}</div>
    <p className="mt-2 text-xs text-slate-500">{(LEVELS.find(l=>l[0]===mo)||LEVELS[0])[3]}</p>
    <p className="mt-6 text-xs text-slate-500">Use the 🌙 button for dark mode.</p>
   </div>
  </aside>
 </div>,document.body)
 return <><button type="button" className="navlink !px-2 sm:!px-3" title="Style: background, colours and text" aria-label="Style: background, colours and text" aria-expanded={open} aria-haspopup="dialog" onClick={()=>setOpen(o=>!o)}>🎨<span className="hidden 2xl:inline"> Style</span></button>{panel}</>}

export function ScrollBar(){const r=useRef(null)
 useEffect(()=>{const f=()=>{const m=document.documentElement.scrollHeight-innerHeight;if(r.current)r.current.style.transform=`scaleX(${m>0?Math.min(1,scrollY/m):0})`};f();addEventListener('scroll',f,{passive:true});addEventListener('resize',f);return()=>{removeEventListener('scroll',f);removeEventListener('resize',f)}},[])
 return <div ref={r} className="scrollbar-top" aria-hidden="true"/>}

/** Kept for compatibility: spotlight, tilt, magnetic buttons, ripple, cursor glow and scroll effects now live in motion.jsx. */
export const useSpotlight=useMotionFX

export function Typewriter({words}){const [i,setI]=useState(0),[n,setN]=useState(()=>reduce()?words[0].length:0),[del,setDel]=useState(false)
 useEffect(()=>{if(reduce())return;const w=words[i];let t;if(!del&&n<w.length)t=setTimeout(()=>setN(n+1),90);else if(!del)t=setTimeout(()=>setDel(true),1700);else if(n>0)t=setTimeout(()=>setN(n-1),45);else{setDel(false);setI((i+1)%words.length)}return()=>clearTimeout(t)},[n,del,i])
 return <><span className="sr-only">{words[0]}</span><span aria-hidden="true">{words[i].slice(0,n)}<span className="caret"/></span></>}
