import {useEffect,useRef,useState} from 'react'
import {PH,clock,dkey,streakOf,useFocus} from '../focus'

/* Focus page: only the screen. The timer itself lives in ../focus (FocusProvider), so it keeps running when you leave this page.
   Space = start/pause, R = reset. Works with touch on phones (big buttons, ring scales to the screen width). */
const R=128,C=2*Math.PI*R

export function Focus(){
 const f=useFocus(),[custom,setCustom]=useState('')
 const {st,setSt,log,left,total,frac,running,idle,banner}=f
 const tog=useRef(null);tog.current={toggle:f.toggle,reset:f.reset}
 useEffect(()=>{const k=e=>{const t=e.target.tagName;if(['INPUT','TEXTAREA','SELECT','BUTTON'].includes(t)||e.ctrlKey||e.metaKey)return
  if(e.code==='Space'){e.preventDefault();tog.current.toggle()}else if(e.key==='r'||e.key==='R')tog.current.reset()}
  window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[])
 const saveCustom=()=>{if(custom&&f.setLen(custom))setCustom('')}

 const k0=dkey(new Date()),today=log.days[k0]||{m:0,s:0},streak=streakOf(log.days)
 const week=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return{d,m:log.days[dkey(d)]?.m||0}}),maxM=Math.max(60,...week.map(w=>w.m))
 const ph=PH[st.phase],ring=st.phase==='focus'?'rgb(var(--accent))':'#10b981'
 const endsAt=running?new Date(st.endAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):null
 const elapsedMin=Math.floor((total-left)/60)

 return <div className="mx-auto max-w-md text-center">
  <p className="font-hand text-3xl text-teal">Distraction-free learning</p>
  <h1 className="sr-only">Focus session</h1>
  <p className="text-sm opacity-70">Your session keeps running while you browse other pages.</p>
  <div role="tablist" aria-label="Session type" className="mt-3 flex flex-wrap justify-center gap-1">{Object.entries(PH).map(([k,v])=><button key={k} role="tab" aria-selected={st.phase===k} disabled={running} onClick={()=>f.toPhase(k)} className={`btn2 !min-h-[40px] !px-3 !py-1.5 text-sm ${st.phase===k?'bg-teal/15':''} disabled:opacity-50`}>{v.icon} {v.label}</button>)}</div>

  <div className="relative mx-auto my-5 grid h-[min(18rem,78vw)] w-[min(18rem,78vw)] place-items-center">
   <svg viewBox="0 0 288 288" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true"><circle cx="144" cy="144" r={R} fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="12"/>
    <circle cx="144" cy="144" r={R} fill="none" stroke={ring} strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C*(1-frac)} style={{transition:'stroke-dashoffset .3s linear'}}/></svg>
   <span className={`absolute inset-6 rounded-full ${st.phase==='focus'?'bg-teal/15':'bg-emerald-500/15'} ${running?'animate-breathe':''}`} aria-hidden="true"/>
   <div className="relative"><div role="timer" aria-label={`${ph.label}, ${Math.floor(left/60)} minutes ${left%60} seconds left`} className="font-serif text-5xl tabular-nums text-navy sm:text-6xl">{clock(left)}</div>
    <div className="mt-1 text-lg">{ph.icon} {ph.label}{running||idle?'':' · paused'}</div>
    <div className="text-sm opacity-70">{endsAt?`ends at ${endsAt}`:idle?`${Math.round(total/60)} min`:'press Resume'}</div></div></div>

  <div className="mb-3 flex justify-center gap-2" aria-label={`Session ${Math.min(st.count+1,4)} of 4`} title="4 focus sessions, then a long break">{[0,1,2,3].map(i=><span key={i} className={`h-3 w-3 rounded-full ${i<st.count?'bg-teal':i===st.count&&st.phase==='focus'?'bg-teal/40 ring-2 ring-teal':'bg-stone-300'}`}/>)}</div>

  <div className="flex flex-wrap justify-center gap-2"><button className="btn min-w-[130px] text-lg" onClick={f.toggle}>{running?'⏸ Pause':idle?'▶ Start':'▶ Resume'}</button>
   <button className="btn2" onClick={f.reset} disabled={idle}>↺ Reset</button>
   {running&&(st.phase!=='focus'||elapsedMin>=1)&&<button className="btn2" onClick={f.endNow} title={st.phase==='focus'?'Stop now and save the minutes you studied':'Skip the break'}>{st.phase==='focus'?`✓ Finish & save ${elapsedMin} min`:'Skip break'}</button>}
   {!running&&st.phase!=='focus'&&<button className="btn2" onClick={()=>f.toPhase('focus')}>Skip break</button>}</div>
  <p className="mt-1 text-xs opacity-60">Space = start/pause · R = reset</p>

  <p role="status" aria-live="polite" className={`mx-auto mt-3 max-w-sm rounded-lg bg-teal/15 p-3 font-semibold text-navy ${banner?'':'hidden'}`}>{banner}</p>

  {st.phase==='focus'&&<div className="mx-auto mt-4 max-w-sm"><label htmlFor="ft" className="sr-only">What are you studying?</label><input id="ft" className="inp text-center" maxLength={80} placeholder="What will you study in this session?" value={st.task} onChange={e=>{const v=e.target.value;setSt(s=>({...s,task:v}))}}/></div>}

  <div className="mx-auto mt-4 flex max-w-sm flex-wrap items-center justify-center gap-2 text-sm"><span className="opacity-70">Focus length</span>
   {[25,45,60,90].map(m=><button key={m} aria-pressed={st.focusMin===m} disabled={running} className={`btn2 !min-h-[36px] !px-3 !py-1 ${st.focusMin===m?'bg-teal/15':''} disabled:opacity-50`} onClick={()=>f.setLen(m)}>{m}</button>)}
   <input aria-label="Custom focus minutes" className="inp !min-h-[36px] !w-20 !py-1 text-center" type="number" min="1" max="180" placeholder="custom" disabled={running} value={custom} onChange={e=>setCustom(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveCustom()} onBlur={saveCustom}/></div>
  <div className="mx-auto mt-2 flex max-w-sm flex-wrap items-center justify-center gap-3 text-sm">
   <label className="flex items-center gap-1">Short break <select className="inp !min-h-[36px] !w-auto !py-1" disabled={running} value={st.shortMin} onChange={e=>{const v=+e.target.value;setSt(s=>({...s,shortMin:v,left:s.phase==='short'&&!s.endAt?v*60:s.left}))}}>{[3,5,10].map(m=><option key={m} value={m}>{m} min</option>)}</select></label>
   <label className="flex items-center gap-1">Long break <select className="inp !min-h-[36px] !w-auto !py-1" disabled={running} value={st.longMin} onChange={e=>{const v=+e.target.value;setSt(s=>({...s,longMin:v,left:s.phase==='long'&&!s.endAt?v*60:s.left}))}}>{[10,15,20,30].map(m=><option key={m} value={m}>{m} min</option>)}</select></label>
   <label className="flex items-center gap-1"><input type="checkbox" checked={st.sound} onChange={e=>{f.unlockAudio();const v=e.target.checked;setSt(s=>({...s,sound:v}))}}/> 🔔 Sound</label>
   <label className="flex items-center gap-1"><input type="checkbox" checked={st.auto} onChange={e=>{const v=e.target.checked;setSt(s=>({...s,auto:v}))}}/> Auto-start next</label></div>

  <section className="box mt-6 text-left" aria-label="Your focus stats"><div className="grid grid-cols-3 text-center"><div><div className="font-serif text-3xl">{today.s}</div><div className="text-xs opacity-70">sessions today</div></div><div><div className="font-serif text-3xl">{today.m}</div><div className="text-xs opacity-70">minutes today</div></div><div><div className="font-serif text-3xl">🔥 {streak}</div><div className="text-xs opacity-70">day streak</div></div></div>
   <div className="mt-4 flex h-20 items-end gap-2" role="img" aria-label={`Focus minutes over the last 7 days: ${week.map(w=>w.m).join(', ')}`}>{week.map((w,i)=><div key={i} className="flex flex-1 flex-col items-center justify-end gap-1"><div title={`${w.m} min`} className={`w-full rounded-t ${i===6?'bg-teal':'bg-teal/40'}`} style={{height:Math.max(3,w.m/maxM*56)}}/><span className="text-[10px] opacity-70">{w.d.toLocaleDateString([],{weekday:'narrow'})}</span></div>)}</div>
   <div className="mt-3 border-t border-stone-300/60 pt-2"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Completed sessions</h2>{log.recent.length>0&&<button className="text-xs underline opacity-70" onClick={()=>confirm('Clear your focus history on this device?')&&f.clearHistory()}>Clear</button>}</div>
    {log.recent.length===0?<p className="mt-1 text-sm opacity-70">Finished sessions appear here.</p>:<ul className="mt-1 grid gap-1 text-sm">{log.recent.slice(0,8).map((r,i)=><li key={i} className="flex justify-between gap-2"><span className="truncate">✓ {r.task||'Focus session'}</span><span className="shrink-0 opacity-70">{r.m} min · {new Date(r.at).toLocaleDateString([],{day:'numeric',month:'short'})} {new Date(r.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></li>)}</ul>}</div>
   <p className="mt-2 text-xs opacity-60">Saved on this device.</p></section>
 </div>}
