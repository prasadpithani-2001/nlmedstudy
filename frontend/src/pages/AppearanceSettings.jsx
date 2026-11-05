import {useEffect,useState} from 'react'
import api,{msg} from '../api'
import {useAuth} from '../App'
import {FONTS,SIZES,WEIGHTS,THEMES,ACCENT_IDS,DEFAULTS,cached,applyAppearance,remember,fetchAppearance} from '../appearance'
import {ACCENTS} from '../fx'

/* Font & Appearance for the WHOLE site (students included). Admin: always editable, and decides whether teachers may edit.
   Teacher: editable only while the admin allows it. Saved on the server, so every student screen picks it up. */
export function AppearanceSettings(){
 const {user}=useAuth(),admin=user?.role==='ADMIN'
 const [saved,setSaved]=useState(cached),[a,setA]=useState(cached),[note,setNote]=useState(''),[bad,setBad]=useState(false),[busy,setBusy]=useState(false)
 const canEdit=admin||saved.teacherCanEdit
 useEffect(()=>{fetchAppearance().then(o=>{setSaved(o);setA(o)}).catch(()=>{})
  const on=()=>{const c=cached();setSaved(c)};window.addEventListener('ms-appearance',on)
  return()=>{window.__apPreview=false;window.removeEventListener('ms-appearance',on);applyAppearance(cached())}},[])
 const dirty=['font','size','weight','teacherCanEdit','theme','accent'].some(k=>a[k]!==saved[k])
 const change=(k,v)=>{const n={...a,[k]:v};setA(n);window.__apPreview=true;applyAppearance(n)}
 const flash=(m,b)=>{setNote(m);setBad(!!b);setTimeout(()=>setNote(''),5000)}
 const save=async()=>{setBusy(true);try{const r=(await api.put('/staff/appearance',a)).data;const o=remember(r);setSaved(o);setA(o);window.__apPreview=false;applyAppearance(o);flash('Saved. Students will see the new font on their next page load or within a minute.')}catch(e){flash(msg(e),true)}setBusy(false)}
 const reset=()=>{setA({...DEFAULTS,teacherCanEdit:a.teacherCanEdit});window.__apPreview=true;applyAppearance({...DEFAULTS,teacherCanEdit:a.teacherCanEdit})}
 const discard=()=>{setA(saved);window.__apPreview=false;applyAppearance(saved)}
 return <section className="box grid gap-4" aria-labelledby="apH">
  <div><h2 id="apH" className="text-xl text-navy">Font &amp; appearance (whole website)</h2>
   <p className="text-sm opacity-70">One setting for the entire site. What you save here changes the font for students and teachers on their own screens too.</p></div>
  {!canEdit&&<p role="status" className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800">The admin has not allowed teachers to change the site font. You can see the current look but cannot save changes.</p>}
  <fieldset disabled={!canEdit} className="grid gap-4 disabled:opacity-60">
   <div><label className="mb-1 block font-semibold">Font family</label>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Font family">
     {FONTS.map(f=>{const on=a.font===f.id;return <button type="button" key={f.id} role="radio" aria-checked={on} onClick={()=>change('font',f.id)}
      className={`rounded-xl border p-3 text-left transition hover:-translate-y-0.5 ${on?'border-teal bg-teal/10 ring-2 ring-teal/30':'border-slate-300 hover:border-teal'}`}>
      <span className="block text-lg font-bold text-navy" style={f.css?{fontFamily:f.css+',sans-serif'}:undefined}>{f.name}</span>
      <span className="block text-xs opacity-70" style={f.css?{fontFamily:f.css+',sans-serif'}:undefined}>{f.note||'Aa Bb Cc 123 · Learn better'}</span></button>})}</div></div>
   <div className="grid gap-4 sm:grid-cols-2">
    <div><label htmlFor="apS" className="mb-1 block font-semibold">Text size</label><select id="apS" className="inp" value={a.size} onChange={e=>change('size',e.target.value)}>{SIZES.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></div>
    <div><label htmlFor="apW" className="mb-1 block font-semibold">Text weight</label><select id="apW" className="inp" value={a.weight} onChange={e=>change('weight',e.target.value)}>{WEIGHTS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></div></div>
   {admin&&<label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 p-3"><input type="checkbox" className="mt-1 h-5 w-5" checked={a.teacherCanEdit} onChange={e=>{const n={...a,teacherCanEdit:e.target.checked};setA(n)}}/>
    <span><b className="block">Allow teachers to change the site font</b><span className="text-sm opacity-70">When off, only admins can change it. Teachers will see it read-only.</span></span></label>}
  </fieldset>
  {admin&&<fieldset className="grid gap-4"><legend className="mb-1 font-semibold">Default look for visitors</legend>
   <p className="text-sm opacity-70">Used by everyone who has not picked their own theme or accent colour on their device. A personal choice always wins.</p>
   <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Default theme">{THEMES.map(([k,l])=>{const on=a.theme===k;return <button type="button" key={k} role="radio" aria-checked={on} onClick={()=>change('theme',k)} className={`btn2 !min-h-[40px] ${on?'!border-teal bg-teal/10':''}`}>{k==='dark'?'🌙 ':'☀️ '}{l}</button>})}</div>
   <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Default accent colour">{ACCENTS.filter(([k])=>ACCENT_IDS.includes(k)).map(([k,c,l])=>{const on=a.accent===k;return <button type="button" key={k} role="radio" aria-checked={on} aria-label={l} title={l} onClick={()=>change('accent',k)} className={`h-9 w-9 rounded-full border-2 transition hover:scale-110 ${on?'border-navy ring-2 ring-offset-2 ring-teal':'border-white'}`} style={{background:c}}/>})}</div>
  </fieldset>}
  <div className="rounded-xl border border-dashed border-slate-300 p-4"><p className="text-xs font-bold uppercase tracking-wider text-teal">Live preview</p>
   <h3 className="mt-1 text-2xl text-navy">Learn Better. Study Smarter. Achieve More.</h3>
   <p className="mt-1">Live classes, handwritten notes, tests and doubt support in one focused place. 0123456789 · ₹5,499</p></div>
  <p role="status" aria-live="polite" className={`${note?'':'hidden'} rounded-xl px-4 py-2 text-sm font-medium ${bad?'bg-rose-50 text-rose-800':'bg-emerald-50 text-emerald-800'}`}>{note}</p>
  <div className="flex flex-wrap gap-2"><button type="button" className="btn" disabled={!canEdit||!dirty||busy} onClick={save}>{busy?'Saving…':'Save for everyone'}</button>
   <button type="button" className="btn2" disabled={!canEdit} onClick={reset}>Reset to default</button>
   {dirty&&<button type="button" className="btn2" onClick={discard}>Discard changes</button>}</div>
 </section>}
