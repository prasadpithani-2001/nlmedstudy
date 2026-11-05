/* NLMed Study motion engine ("Advanced animations").
   - Three levels the visitor can pick in the Style menu: full / lite / off (default follows the OS "reduce motion" setting).
     The level lives on <html data-motion="..."> and every effect below, and motion.css, obeys it.
   - Scroll reveals (6 variants), word-by-word headline reveal, count-up numbers (₹, %, decimals).
   - Pointer effects shared by the whole site: card spotlight, 3D tilt, magnetic buttons, click ripple, soft cursor glow.
   - Scroll effects: parallax, header shadow, background drift.
   - Celebration: cannon confetti with fluttering pieces, and an animated success mark. */
import {Fragment,useEffect,useRef,useState} from 'react'

/* ---------------- motion level ---------------- */
const KEY = 'ms_motion'
export const LEVELS = [
  ['full', 'Full', '✨', 'Every effect: page transitions, 3D tilt, parallax, cursor glow'],
  ['lite', 'Lite', '🍃', 'Soft fades only. No looping, tilting or parallax'],
  ['off', 'Off', '⏸️', 'No animation at all'],
]
const sysReduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) { return false } }
export const getMotion = () => {
  let s = null
  try { s = localStorage.getItem(KEY) } catch (e) {}
  return LEVELS.some(l => l[0] === s) ? s : (sysReduce() ? 'off' : 'full')
}
export const motionLevel = () => document.documentElement.dataset.motion || getMotion()
export const motionOff = () => motionLevel() === 'off'
export function setMotion(level) {
  try { localStorage.setItem(KEY, level) } catch (e) {}
  document.documentElement.dataset.motion = level
  window.dispatchEvent(new Event('ms-motion'))
}
export function resetMotion() {
  try { localStorage.removeItem(KEY) } catch (e) {}
  document.documentElement.dataset.motion = getMotion()
  window.dispatchEvent(new Event('ms-motion'))
}
export const initMotion = () => { document.documentElement.dataset.motion = getMotion() }
export function useMotion() {
  const [m, setM] = useState(motionLevel)
  useEffect(() => {
    const f = () => setM(motionLevel())
    addEventListener('ms-motion', f)
    return () => removeEventListener('ms-motion', f)
  }, [])
  return m
}

/* ---------------- scroll reveal ---------------- */
export function useInView(threshold = .15) {
  const ref = useRef(null), [v, setV] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setV(true); return }
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); o.disconnect() } }, {threshold, rootMargin: '0px 0px -6% 0px'})
    o.observe(el)
    const safety = setTimeout(() => setV(true), 3000)   // never leave content hidden, e.g. inside a panel that opens later
    return () => { o.disconnect(); clearTimeout(safety) }
  }, [threshold])
  return [ref, v]
}

/** Fades content in when it scrolls into view. variant: up | down | left | right | zoom | blur | flip */
export function Reveal({children, delay = 0, className = '', variant = 'up', as: Tag = 'div'}) {
  const [ref, v] = useInView()
  return <Tag ref={ref} data-rv={variant} style={{'--d': delay + 'ms'}} className={`rv ${className} ${v ? 'rv-on' : ''}`}>{children}</Tag>
}

/** Headline that rises word by word. Screen readers get the plain sentence. */
export function SplitText({text, className = '', delay = 0, step = 70, as: Tag = 'span'}) {
  const [ref, v] = useInView(.3), words = String(text).split(' ')
  return <Tag ref={ref} className={`split ${v ? 'split-on' : ''} ${className}`} aria-label={text}>
    {words.map((w, i) => <Fragment key={i}><span className="split-w" aria-hidden="true"><span style={{'--d': (delay + i * step) + 'ms'}}>{w}</span></span>{i < words.length - 1 ? ' ' : ''}</Fragment>)}
  </Tag>
}

/** Number that counts up when visible and glides to the new value when `to` changes. */
export function Count({to, prefix = '', suffix = '', decimals = 0, duration = 1400, locale = 'en-IN'}) {
  const [ref, v] = useInView(), target = Number(to) || 0, cur = useRef(0), [n, setN] = useState(0)
  useEffect(() => {
    if (!v) return
    if (motionOff()) { cur.current = target; setN(target); return }
    let raf, t0
    const from = cur.current, ease = p => 1 - Math.pow(1 - p, 4)
    const step = t => {
      if (t0 == null) t0 = t
      const p = Math.min((t - t0) / duration, 1)
      cur.current = from + (target - from) * ease(p)
      setN(cur.current)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [v, target, duration])
  const shown = decimals ? n : Math.round(n)
  return <span ref={ref} className="tabnum">{prefix}{shown.toLocaleString(locale, {minimumFractionDigits: decimals, maximumFractionDigits: decimals})}{suffix}</span>
}

/* ---------------- global pointer + scroll effects ---------------- */
export function useMotionFX() {
  useEffect(() => {
    const root = document.documentElement
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches
    const lvl = () => root.dataset.motion
    const clamp = (v, m) => Math.max(-m, Math.min(m, v))

    /* cursor glow: a soft light that trails the pointer (full level, mouse only) */
    let glow = null, gx = -300, gy = -300, tx = -300, ty = -300, graf = 0
    if (fine) { glow = document.createElement('div'); glow.className = 'cursor-glow'; glow.setAttribute('aria-hidden', 'true'); document.body.appendChild(glow) }
    const glowLoop = () => {
      gx += (tx - gx) * .14; gy += (ty - gy) * .14
      glow.style.transform = `translate3d(${gx}px,${gy}px,0)`
      graf = (Math.abs(tx - gx) > .5 || Math.abs(ty - gy) > .5) ? requestAnimationFrame(glowLoop) : 0
    }

    const move = e => {
      if (glow && lvl() === 'full' && e.pointerType === 'mouse') { tx = e.clientX - 160; ty = e.clientY - 160; if (!graf) graf = requestAnimationFrame(glowLoop) }
      const t = e.target
      if (!t || !t.closest) return
      const box = t.closest('.box')
      if (box) { const r = box.getBoundingClientRect(); box.style.setProperty('--mx', e.clientX - r.left + 'px'); box.style.setProperty('--my', e.clientY - r.top + 'px') }
      if (lvl() !== 'full' || e.pointerType !== 'mouse') return
      const card = t.closest('.ccard,[data-tilt]')
      if (card) {
        const r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5
        card.style.setProperty('--ry', (px * 9).toFixed(2) + 'deg'); card.style.setProperty('--rx', (-py * 9).toFixed(2) + 'deg')
      }
      const btn = t.closest('.btn')
      if (btn && !btn.disabled) {
        const r = btn.getBoundingClientRect()
        btn.style.setProperty('--tx', clamp((e.clientX - (r.left + r.width / 2)) * .16, 5).toFixed(1) + 'px')
        btn.style.setProperty('--ty', clamp((e.clientY - (r.top + r.height / 2)) * .22, 4).toFixed(1) + 'px')
      }
    }
    const leave = e => {
      const el = e.target.closest && e.target.closest('.ccard,[data-tilt],.btn')
      if (el && !el.contains(e.relatedTarget)) ['--rx', '--ry', '--tx', '--ty'].forEach(p => el.style.removeProperty(p))
    }
    /* click ripple on buttons */
    const down = e => {
      const b = e.target.closest && e.target.closest('.btn,.btn2')
      if (!b || b.disabled || lvl() === 'off') return
      const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2, i = document.createElement('span')
      i.className = 'ripple'; i.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`
      b.appendChild(i); setTimeout(() => i.remove(), 750)
    }
    /* scroll: parallax, header shadow, background drift (one rAF per frame) */
    let ticking = false
    const scroll = () => {
      if (ticking) return; ticking = true
      requestAnimationFrame(() => {
        ticking = false
        const y = scrollY
        if (y > 8) root.dataset.scrolled = ''; else delete root.dataset.scrolled
        if (lvl() !== 'full') return
        root.style.setProperty('--sy', y + 'px')
        document.querySelectorAll('[data-parallax]').forEach(el => {
          const r = el.getBoundingClientRect()
          if (r.bottom < -200 || r.top > innerHeight + 200) return
          el.style.translate = `0 ${((r.top + r.height / 2 - innerHeight / 2) * -(parseFloat(el.dataset.parallax) || .15)).toFixed(1)}px`
        })
      })
    }
    addEventListener('pointermove', move, {passive: true}); addEventListener('pointerout', leave); addEventListener('pointerdown', down, {passive: true})
    addEventListener('scroll', scroll, {passive: true}); addEventListener('resize', scroll); scroll()
    return () => {
      removeEventListener('pointermove', move); removeEventListener('pointerout', leave); removeEventListener('pointerdown', down)
      removeEventListener('scroll', scroll); removeEventListener('resize', scroll)
      cancelAnimationFrame(graf); glow && glow.remove()
    }
  }, [])
}

/* ---------------- celebration ---------------- */
/** Two confetti cannons with tumbling pieces (rectangles, dots, triangles). Calm: nothing at level off, half the pieces at lite. */
export function confetti() {
  if (motionOff()) return
  const lite = motionLevel() === 'lite', dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight
  const c = document.createElement('canvas')
  c.setAttribute('aria-hidden', 'true')
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:80'
  c.width = W * dpr; c.height = H * dpr; document.body.appendChild(c)
  const x = c.getContext('2d'); x.scale(dpr, dpr)
  const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '79 70 229').split(/\s+/).join(',')
  const cols = [`rgb(${acc})`, '#8b5cf6', '#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#facc15']
  const cannon = (ox, dir) => Array.from({length: lite ? 40 : 90}, () => {
    const a = (dir > 0 ? -Math.PI / 3.2 : -Math.PI + Math.PI / 3.2) + (Math.random() - .5) * .8, s = 11 + Math.random() * 12
    return {x: ox, y: H * .92, vx: Math.cos(a) * s, vy: Math.sin(a) * s, w: 6 + Math.random() * 7, h: 3 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - .5) * .3, f: Math.random() * 6, vf: .1 + Math.random() * .2, c: cols[Math.random() * cols.length | 0], s: Math.random() * 3 | 0}
  })
  const ps = [...cannon(0, 1), ...cannon(W, -1)], LIFE = 230
  let t = 0
  const frame = () => {
    t++; x.clearRect(0, 0, W, H)
    for (const p of ps) {
      p.vy += .3; p.vx *= .985; p.vy *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.f += p.vf
      x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.scale(1, Math.cos(p.f)); x.fillStyle = p.c
      x.globalAlpha = Math.max(0, Math.min(1, (LIFE - t) / 60))
      if (p.s === 0) x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      else if (p.s === 1) { x.beginPath(); x.arc(0, 0, p.h / 1.4, 0, 7); x.fill() }
      else { x.beginPath(); x.moveTo(0, -p.w / 2); x.lineTo(p.w / 2, p.w / 2); x.lineTo(-p.w / 2, p.w / 2); x.closePath(); x.fill() }
      x.restore()
    }
    if (t < LIFE) requestAnimationFrame(frame); else c.remove()
  }
  frame()
}

/** Animated success mark: ring draws, tick draws, two soft halos pulse outward. Use on a coloured background (it is white). */
export function SuccessMark({size = 88}) {
  return <span className="succ" style={{width: size, height: size}} role="img" aria-label="Payment successful">
    <i/><i/>
    <svg className="check" width={size} height={size} viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="25" fill="none" stroke="#fff" strokeWidth="2.5"/><path fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" d="M14 27l8 8 16-17"/></svg>
  </span>
}

/* ---------------- site polish: scroll progress and back-to-top ---------------- */
/** A thin bar across the top that fills as the page scrolls. */
export function ScrollProgress(){
  const bar=useRef(null)
  useEffect(()=>{
    const upd=()=>{ const h=document.documentElement, max=h.scrollHeight-h.clientHeight, p=max>0?Math.min(1,scrollY/max):0; if(bar.current) bar.current.style.transform=`scaleX(${p})` }
    upd(); addEventListener('scroll',upd,{passive:true}); addEventListener('resize',upd)
    return()=>{ removeEventListener('scroll',upd); removeEventListener('resize',upd) }
  },[])
  return <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]">
    <div ref={bar} className="h-full origin-left" style={{transform:'scaleX(0)',background:'linear-gradient(90deg,rgb(var(--accent)),rgb(var(--accent2)))'}}/>
  </div>
}

/** A round button that appears after scrolling down. Its ring fills as the page is scrolled. */
export function ScrollTop(){
  const [show,setShow]=useState(false), [p,setP]=useState(0)
  useEffect(()=>{
    const upd=()=>{ const h=document.documentElement, max=h.scrollHeight-h.clientHeight; setShow(scrollY>480); setP(max>0?Math.min(1,scrollY/max):0) }
    upd(); addEventListener('scroll',upd,{passive:true})
    return()=>removeEventListener('scroll',upd)
  },[])
  const C=2*Math.PI*18
  return <button type="button" aria-label="Back to top" onClick={()=>scrollTo({top:0,behavior:motionOff()?'auto':'smooth'})}
    className={`fixed bottom-5 left-5 z-[55] grid h-12 w-12 place-items-center rounded-full bg-surface/90 text-navy shadow-lg backdrop-blur transition-all duration-500 dark:bg-slate-800 ${show?'translate-y-0 opacity-100':'pointer-events-none translate-y-6 opacity-0'}`}>
    <svg width="44" height="44" viewBox="0 0 44 44" className="absolute" aria-hidden="true" style={{transform:'rotate(-90deg)'}}>
      <circle cx="22" cy="22" r="18" fill="none" stroke="rgb(var(--accent)/.18)" strokeWidth="3"/>
      <circle cx="22" cy="22" r="18" fill="none" stroke="rgb(var(--accent))" strokeWidth="3" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C*(1-p)}/>
    </svg>
    <span aria-hidden="true" className="relative text-sm font-bold">↑</span>
  </button>
}
