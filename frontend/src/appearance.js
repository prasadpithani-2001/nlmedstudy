/* Site-wide Font & Appearance. The server stores ONE setting for the whole site (GET /api/appearance, public).
   Admin edits it; a teacher edits it only while the admin allows it. Every visitor (students too) loads it on start,
   re-checks every minute and when the tab regains focus, so a change made by staff shows up on student screens without a reload. */
import api from './api'

export const FONTS = [
  {id: 'default', name: 'NLMed default', css: null, note: 'Inter + Plus Jakarta Sans'},
  {id: 'Inter', name: 'Inter', css: "'Inter'", wghts: '400;500;600;700;800'},
  {id: 'Poppins', name: 'Poppins', css: "'Poppins'", wghts: '400;500;600;700;800'},
  {id: 'Roboto', name: 'Roboto', css: "'Roboto'", wghts: '400;500;700;900'},
  {id: 'Nunito', name: 'Nunito', css: "'Nunito'", wghts: '400;500;600;700;800'},
  {id: 'Montserrat', name: 'Montserrat', css: "'Montserrat'", wghts: '400;500;600;700;800'},
  {id: 'Plus Jakarta Sans', name: 'Plus Jakarta Sans', css: "'Plus Jakarta Sans'", wghts: '400;500;600;700;800'},
]
export const SIZES = [['small', 'Small', 93.75], ['normal', 'Normal', 100], ['large', 'Large', 108], ['xlarge', 'Extra large', 116]]
export const WEIGHTS = [['normal', 'Regular', 400], ['medium', 'Medium', 500], ['semibold', 'Semi-bold', 600]]
export const THEMES = [['light', 'Light'], ['dark', 'Dark']]
export const ACCENT_IDS = ['indigo', 'teal', 'navy', 'lavender', 'emerald', 'rose', 'amber', 'sky', 'fuchsia', 'violet']
export const DEFAULTS = {font: 'default', size: 'normal', weight: 'normal', teacherCanEdit: false, theme: 'light', accent: 'indigo'}
const KEY = 'ms_appearance'

const norm = a => {
  const o = {...DEFAULTS, ...(a || {})}
  if (!FONTS.some(f => f.id === o.font)) o.font = 'default'
  if (!SIZES.some(s => s[0] === o.size)) o.size = 'normal'
  if (!WEIGHTS.some(w => w[0] === o.weight)) o.weight = 'normal'
  o.teacherCanEdit = !!o.teacherCanEdit
  if (!THEMES.some(t => t[0] === o.theme)) o.theme = 'light'
  if (!ACCENT_IDS.includes(o.accent)) o.accent = 'indigo'
  return o
}
export const cached = () => { try { return norm(JSON.parse(localStorage.getItem(KEY) || 'null')) } catch (e) { return {...DEFAULTS} } }

function loadFont(f) {
  if (!f || !f.wghts) return
  const id = 'gf-' + f.id.replace(/\s+/g, '-')
  if (document.getElementById(id)) return
  const l = document.createElement('link')
  l.id = id; l.rel = 'stylesheet'
  l.href = `https://fonts.googleapis.com/css2?family=${f.id.replace(/\s+/g, '+')}:wght@${f.wghts}&display=swap`
  document.head.appendChild(l)
}

/* Personal typography (this device only). Overrides the site font and size when set; cleared by "Reset" in the Style panel. */
export const TYPE_KEY = 'ms_type'
export function readType() { try { const v = JSON.parse(localStorage.getItem(TYPE_KEY) || '{}'); return v && typeof v === 'object' ? v : {} } catch (e) { return {} } }
export function saveType(t) { try { localStorage.setItem(TYPE_KEY, JSON.stringify(t)) } catch (e) {} applyAppearance(cached()) }
export function clearType() { try { localStorage.removeItem(TYPE_KEY) } catch (e) {} }

/** Put an appearance on the page (CSS variables read by Tailwind's font families and by index.css). */
export function applyAppearance(a) {
  const o = norm(a), t = readType(), r = document.documentElement.style
  const fid = FONTS.some(x => x.id === t.font) ? t.font : o.font
  const sid = SIZES.some(s => s[0] === t.size) ? t.size : o.size
  const f = FONTS.find(x => x.id === fid)
  if (f.css) {
    loadFont(f)
    const stack = `${f.css},system-ui,sans-serif`
    r.setProperty('--font-body', stack); r.setProperty('--font-head', stack); r.setProperty('--font-hand', stack)
  } else { r.removeProperty('--font-body'); r.removeProperty('--font-head'); r.removeProperty('--font-hand') }
  r.setProperty('--font-size', (SIZES.find(s => s[0] === sid)[2]) + '%')
  r.setProperty('--font-weight', String(WEIGHTS.find(w => w[0] === o.weight)[2]))
  // Theme and accent: the admin's site default applies only to visitors who have not picked their own (saved on this device).
  const chose = k => { try { return localStorage.getItem(k) !== null } catch (e) { return false } }
  if (!chose('ms_theme_v2')) document.documentElement.classList.toggle('dark', o.theme === 'dark')
  if (!chose('ms_accent')) { if (o.accent !== 'indigo') document.documentElement.dataset.accent = o.accent; else delete document.documentElement.dataset.accent }
  return o
}

/** Fade colours when the theme switches (CSS turns it off for reduced motion). */
export function animateTheme() {
  const r = document.documentElement; r.classList.add('theme-fade'); clearTimeout(window.__themeFade)
  window.__themeFade = setTimeout(() => r.classList.remove('theme-fade'), 600)
}

/** Preview only: apply without saving or caching. */
export const preview = a => applyAppearance(a)

let last = ''
export function remember(a) {
  const o = norm(a); const s = JSON.stringify(o)
  if (s !== last) { last = s; try { localStorage.setItem(KEY, s) } catch (e) {} }
  window.dispatchEvent(new Event('ms-appearance'))
  return o
}

export async function fetchAppearance() {
  const r = await api.get('/appearance')
  return remember(r.data)
}

/** Called once from main.jsx. Applies the cached look immediately (no flash), then syncs with the server. */
export function startAppearanceSync() {
  applyAppearance(cached())
  const sync = () => fetchAppearance().then(o => { if (!window.__apPreview) applyAppearance(o) }).catch(() => {})
  sync()
  setInterval(() => { if (document.visibilityState === 'visible') sync() }, 60000)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync() })
  window.addEventListener('focus', sync)
}
