import {Link,useNavigate,useLocation} from 'react-router-dom'
import {useEffect,useLayoutEffect,useRef,useState} from 'react'

/* Shared layout pieces for every portal. Keep them small and dependency-free. */

/* ---- Back navigation -------------------------------------------------------------------------------------------
   Back goes to the page the person actually came from, inside the app. It never lands on a sign-in page (that would
   show the login form to someone who is still signed in) and it never signs anyone out; logging out is a separate
   action in the account menu / sidebar. With no in-app page to return to (a bookmark, a fresh tab), it goes to `to`,
   or to the person's own home. App.jsx records the route trail in window.__nmedTrail. */
const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password']
const storedUser = () => { try { return JSON.parse(localStorage.getItem('ms_user') || 'null') } catch (e) { return null } }
export const homeFor = u => u?.role === 'STUDENT' ? '/dashboard' : u ? '/teacher' : '/'

export function useBack(to) {
  const nav = useNavigate()
  return () => {
    const trail = window.__nmedTrail || [], prev = trail.length > 1 ? trail[trail.length - 2] : null
    const idx = window.history.state?.idx
    const inApp = !!prev && !AUTH_PAGES.some(p => prev === p || prev.startsWith(p + '?')) && (idx === undefined || idx > 0)
    if (inApp) nav(-1)
    else nav(to || homeFor(storedUser()))
  }
}

/** Back button used in page headers. */
export function BackButton({to, label = 'Back', className = ''}) {
  const back = useBack(to)
  return <button type="button" onClick={back} className={`btn2 !min-h-[40px] !px-3 !py-1.5 text-sm ${className}`} aria-label={`${label}, previous page`}>← {label}</button>
}

/** Page heading used across portals: optional back button, eyebrow, title, subtitle and actions. */
export function PageHeader({eyebrow, title, sub, back, actions, className = ''}) {
  return <header className={`mb-5 flex flex-wrap items-end justify-between gap-3 ${className}`}>
    <div className="min-w-0">{back && <div className="mb-2">{back}</div>}
      {eyebrow && <p className="text-xs font-bold uppercase tracking-widest text-teal">{eyebrow}</p>}
      <h1 className="text-3xl text-navy md:text-4xl">{title}</h1>
      {sub && <p className="mt-1 max-w-2xl text-sm opacity-75">{sub}</p>}</div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}</header>
}

/** Segmented tabs (role=tablist). Pill style with a clear active state and keyboard-friendly buttons. */
export function Seg({value, items, set, className = ''}) {
  const box = useRef(null), [ind, setInd] = useState(null)
  const measure = () => { const el = box.current && box.current.querySelector('[aria-selected="true"]'); setInd(el ? {l: el.offsetLeft, w: el.offsetWidth} : null) }
  useLayoutEffect(measure, [value, items.length])
  useEffect(() => {
    if (!box.current || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure); ro.observe(box.current); return () => ro.disconnect()
  }, [value])
  return <div ref={box} role="tablist" aria-label="Sections" className={`relative mb-4 flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-surface/60 p-1 shadow-sm dark:bg-white/5 ${className}`}>
    {ind && <span aria-hidden="true" className="seg-ind" style={{transform: `translateX(${ind.l}px)`, width: ind.w}}/>}
    {items.map(([k, l]) => <button key={k} role="tab" aria-selected={value === k} onClick={() => set(k)} className={`relative z-10 shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-300 ${value === k ? 'text-white' : 'text-slate-600 hover:bg-teal/10 hover:text-teal dark:text-slate-300'}`}>{l}</button>)}</div>
}

/** Stat tile with an icon badge (admin and teacher dashboards). */
export function StatTile({icon, label, value, hint, to}) {
  const body = <><div className="flex items-start justify-between gap-2"><span className="text-sm font-medium opacity-70">{label}</span><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal/15 to-brand2/15 text-lg transition duration-300 group-hover:scale-110" aria-hidden="true">{icon}</span></div>
    <div className="mt-2 font-serif text-3xl font-extrabold text-navy">{value}</div>{hint && <div className="mt-0.5 text-xs opacity-60">{hint}</div>}</>
  return to ? <Link to={to} className="box group block min-w-0 break-words transition hover:-translate-y-1">{body}</Link> : <div className="box group min-w-0 break-words">{body}</div>
}

/** Bottom-of-page navigation bar: the one consistent place for Back, shown at the end of each page. */
export function BackBar({to, label = 'Back', hint}) {
  const back = useBack(to)
  return <nav aria-label="Page navigation" className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-5">
    <button type="button" onClick={back} className="btn2 group" aria-label={`${label}, previous page`}><span aria-hidden="true" className="inline-block transition duration-300 group-hover:-translate-x-1">←</span> {label}</button>
    {hint && <span className="text-sm opacity-60">{hint}</span>}</nav>
}

/* Back button at the top of inner pages. Goes back one step in the app; if there is no earlier page, goes to the home page. Hidden on the home page. */
export function TopBack(){
  const nav=useNavigate(), loc=useLocation()
  if(loc.pathname==='/') return null
  const back=()=>{ if(window.history.state&&window.history.state.idx>0) nav(-1); else nav('/') }
  return <div className="mb-4">
    <button type="button" onClick={back} className="btn2 group !py-1.5" aria-label="Go back to the previous page">
      <span aria-hidden="true" className="inline-block transition duration-300 group-hover:-translate-x-1">←</span> Back</button></div>
}

/* Shown across the top when the internet connection is lost. Hides itself when it returns. */
export function OfflineBanner(){
  const [on,setOn]=useState(typeof navigator==='undefined'||navigator.onLine)
  useEffect(()=>{
    const up=()=>setOn(true), down=()=>setOn(false)
    addEventListener('online',up); addEventListener('offline',down)
    return()=>{ removeEventListener('online',up); removeEventListener('offline',down) }
  },[])
  if(on) return null
  return <div role="status" className="sticky top-0 z-[60] bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-white">You are offline. Pages may not load until your connection returns.</div>
}
