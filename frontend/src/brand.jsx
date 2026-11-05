/* NLMed Study brand: the "NL" monogram.
   The N leans into a tall L. The foot of the L runs on as a heartbeat (ECG) line.
   Colours follow the site accent (CSS variables), so the logo changes with the style picker and dark mode. */
let n = 0
export function BrandMark({size = 40, className = ''}) {
  const id = 'nlg' + (n = (n + 1) % 1000)
  return <svg width={size} height={size} viewBox="0 0 64 64" className={`brandmark ${className}`} role="img" aria-label="NLMed Study logo" focusable="false">
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={{stopColor: 'rgb(var(--accent))'}}/>
        <stop offset="1" style={{stopColor: 'rgb(var(--accent2))'}}/>
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="19" fill={`url(#${id})`}/>
    <path d="M6 14C14 4 30 2 46 5" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="3" strokeLinecap="round"/>
    <path d="M11 48V20L26 48" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M26 48V12" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round"/>
    <path className="logo-ecg" pathLength="100" d="M26 48H37L41 40L46 55L50 46H56" fill="none" stroke="#fff" strokeOpacity=".95" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
}

export function Logo({size = 40, text = true}) {
  return <span className="flex items-center gap-2.5">
    <BrandMark size={size}/>
    {text && <span className="leading-none"><span className="block font-serif text-lg font-extrabold tracking-tight text-navy sm:text-xl">NL<span className="gradient-text">Med</span></span>
      <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[.32em] opacity-60">Study</span></span>}
  </span>
}

/* Same drawing as a data URL for the browser tab icon (index.html carries a copy, this one is for runtime use). */
export const FAVICON = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#4f46e5'/><stop offset='1' stop-color='#7c3aed'/></linearGradient></defs><rect width='64' height='64' rx='19' fill='url(#g)'/><path d='M11 48V20L26 48M26 48V12' fill='none' stroke='#fff' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/><path d='M26 48H37L41 40L46 55L50 46H56' fill='none' stroke='#fff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/></svg>`)
