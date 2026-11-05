import {createContext,useContext,useEffect,useRef,useState} from 'react'
import {Link,useLocation} from 'react-router-dom'

/* Focus session engine. It lives at the top of the app (not inside the Focus page), so a running session keeps counting,
   finishes, beeps and saves itself while the student browses courses, notes or anything else.
   - Timer is based on a real end time: correct after refresh, sleep or tab switch.
   - A session that ended while the browser was closed is saved on the day it really ended, and never auto-starts the next one.
   - Progress (today, 7 days, streak, history) is saved on this device (localStorage). */
export const KEY='ms_focus2',LOG='ms_focus_log'
export const rd=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
export const wr=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
export const dkey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
export const PH={focus:{label:'Focus',icon:'📖'},short:{label:'Short break',icon:'☕'},long:{label:'Long break',icon:'🌿'}}
const DEF={phase:'focus',focusMin:45,shortMin:5,longMin:15,endAt:null,left:45*60,count:0,task:'',sound:true,auto:false}
export const mins=(s,p)=>(p==='focus'?s.focusMin:p==='short'?s.shortMin:s.longMin)*60
const pad=n=>String(n).padStart(2,'0')
export const clock=n=>pad(Math.floor(n/60))+':'+pad(n%60)
export function streakOf(days){let n=0,d=new Date();if(!days[dkey(d)])d.setDate(d.getDate()-1);while(days[dkey(d)]){n++;d.setDate(d.getDate()-1)}return n}

const Ctx=createContext(null)
export const useFocus=()=>useContext(Ctx)

function initial(){const s={...DEF,...rd(KEY,{})};if(!s.endAt&&(!s.left||s.left>mins(s,s.phase)))s.left=mins(s,s.phase);return s}

export function FocusProvider({children}){
 const [st,setSt]=useState(initial)
 const [log,setLog]=useState(()=>{const l=rd(LOG,{});return{days:l.days||{},recent:l.recent||[]}})
 const [now,setNow]=useState(Date.now()),[banner,setBanner]=useState('')
 const ref=useRef(st),ctx=useRef(null),lock=useRef(null)
 ref.current=st
 const running=!!st.endAt,total=mins(st,st.phase)
 const left=running?Math.max(0,Math.ceil((st.endAt-now)/1000)):st.left
 const frac=total?Math.min(1,left/total):0

 useEffect(()=>{wr(KEY,st)},[st])
 useEffect(()=>{wr(LOG,log)},[log])
 // keep several open tabs in step
 useEffect(()=>{const on=e=>{if(e.key===KEY&&e.newValue){try{setSt({...DEF,...JSON.parse(e.newValue)})}catch{}}else if(e.key===LOG&&e.newValue){try{const l=JSON.parse(e.newValue);setLog({days:l.days||{},recent:l.recent||[]})}catch{}}}
  window.addEventListener('storage',on);return()=>window.removeEventListener('storage',on)},[])

 const unlockAudio=()=>{try{const A=window.AudioContext||window.webkitAudioContext;ctx.current=ctx.current||new A();ctx.current.resume()}catch{}}
 const beep=()=>{try{const c=ctx.current;if(!c)return;[0,.28,.56].forEach((t,i)=>{const o=c.createOscillator(),g=c.createGain();o.frequency.value=i===2?988:740;o.connect(g);g.connect(c.destination)
  const a=c.currentTime+t;g.gain.setValueAtTime(.0001,a);g.gain.exponentialRampToValueAtTime(.3,a+.03);g.gain.exponentialRampToValueAtTime(.0001,a+.24);o.start(a);o.stop(a+.26)})}catch{}}

 /* A phase ended (timer reached zero) or the student ended it early. Runs once per phase. */
 const complete=(early=false)=>{const s=ref.current;if(!s.endAt)return
  if(!early){const stored=rd(KEY,null);if(stored&&stored.endAt!==s.endAt){setSt({...DEF,...stored});return}} // another tab already finished it
  const t=Date.now(),leftS=Math.max(0,Math.ceil((s.endAt-t)/1000)),tot=mins(s,s.phase),late=!early&&t-s.endAt>60000
  const wasFocus=s.phase==='focus',doneMin=early?Math.floor((tot-leftS)/60):Math.round(tot/60)
  ref.current={...s,endAt:null}
  if(early&&wasFocus&&doneMin<1){setBanner('');setSt(x=>({...x,endAt:null,left:mins(x,x.phase)}));return} // under a minute: just stop, nothing saved
  const stamp=early?t:Math.min(t,s.endAt),counted=wasFocus,cnt=counted?s.count+1:s.count,next=wasFocus?(cnt>=4?'long':'short'):'focus'
  if(wasFocus){const k=dkey(new Date(stamp));setLog(l=>{const d={...l.days},cur=d[k]||{m:0,s:0};d[k]={m:cur.m+doneMin,s:cur.s+1};return{days:d,recent:[{task:s.task,m:doneMin,at:stamp,early},...l.recent].slice(0,20)}})}
  const auto=s.auto&&!late&&!early
  setSt({...s,phase:next,count:next==='long'?0:cnt,left:mins(s,next),endAt:auto?Date.now()+mins(s,next)*1000:null})
  const text=wasFocus?`${early?'Session saved':'Focus session complete 🎉'} (${doneMin} min). Time for a ${next==='long'?'long':'short'} break (${next==='long'?s.longMin:s.shortMin} min).`:early?'Break skipped. Ready for the next focus session?':'Break over. Ready for the next focus session?'
  setBanner(late?'A session finished while you were away and was saved. '+text:text)
  if(!late&&!early){if(s.sound)beep();try{navigator.vibrate?.([200,100,200])}catch{}
   try{if('Notification' in window&&Notification.permission==='granted')new Notification('NLMed Study Focus',{body:text})}catch{}}}

 // ticking from the real end time (runs on every page)
 useEffect(()=>{if(!st.endAt)return;const t=setInterval(()=>{setNow(Date.now());if(ref.current.endAt&&Date.now()>=ref.current.endAt)complete()},500)
  setNow(Date.now());if(Date.now()>=st.endAt)complete();return()=>clearInterval(t)},[st.endAt])
 // an hour-long timer in a background tab is throttled: re-check the moment the tab is visible again
 useEffect(()=>{const v=()=>{if(document.visibilityState==='visible'){setNow(Date.now());const s=ref.current;if(s.endAt&&Date.now()>=s.endAt)complete()}}
  document.addEventListener('visibilitychange',v);return()=>document.removeEventListener('visibilitychange',v)},[])
 // countdown in the tab title
 useEffect(()=>{if(!running)return;const old=document.title;document.title=`${clock(left)} · ${PH[st.phase].label}`;return()=>{document.title=old}},[running,left,st.phase])
 // keep the screen on while a session runs (re-requested after the tab was hidden)
 useEffect(()=>{if(!running)return;let gone=false
  const get=()=>navigator.wakeLock?.request('screen').then(l=>{if(gone){l.release?.().catch(()=>{});return}lock.current=l}).catch(()=>{})
  get();const v=()=>{if(document.visibilityState==='visible')get()};document.addEventListener('visibilitychange',v)
  return()=>{gone=true;document.removeEventListener('visibilitychange',v);lock.current?.release?.().catch(()=>{});lock.current=null}},[running])

 const start=()=>{unlockAudio();setBanner('');try{if('Notification' in window&&Notification.permission==='default')Notification.requestPermission()}catch{}
  setSt(s=>s.endAt?s:{...s,endAt:Date.now()+Math.max(1,s.left)*1000})}
 const pause=()=>setSt(s=>s.endAt?{...s,endAt:null,left:Math.max(1,Math.ceil((s.endAt-Date.now())/1000))}:s)
 const reset=()=>{setBanner('');setSt(s=>({...s,endAt:null,left:mins(s,s.phase)}))}
 const toPhase=p=>{setBanner('');setSt(s=>({...s,phase:p,endAt:null,left:mins(s,p)}))}
 const setLen=m=>{m=Math.min(180,Math.max(1,Math.round(+m)||0));if(!m)return false;setSt(s=>({...s,focusMin:m,left:s.phase==='focus'&&!s.endAt?m*60:s.left}));return true}
 const toggle=()=>running?pause():start()
 const clearHistory=()=>setLog({days:{},recent:[]})
 const value={st,setSt,log,now,left,total,frac,running,idle:!running&&left===total,banner,setBanner,start,pause,reset,toPhase,setLen,toggle,endNow:()=>complete(true),unlockAudio,clearHistory}
 return <Ctx.Provider value={value}>{children}</Ctx.Provider>}

/* Small chip in the header while a session is running and the student is on another page. */
export function FocusPill(){
 const f=useFocus(),loc=useLocation()
 if(!f||!f.running||loc.pathname==='/focus')return null
 return <Link to="/focus" title="Back to your focus session" aria-label={`Focus session running, ${clock(f.left)} left. Open Focus`} className="flex items-center gap-1 rounded-full bg-teal px-3 py-1 text-sm font-semibold tabular-nums text-white shadow transition hover:-translate-y-0.5"><span aria-hidden="true">{PH[f.st.phase].icon}</span>{clock(f.left)}</Link>}

/* Shows up on any page when a session finished while the student was elsewhere. */
export function FocusToast(){
 const f=useFocus(),loc=useLocation()
 if(!f||!f.banner||loc.pathname==='/focus')return null
 return <div role="status" aria-live="polite" className="fixed left-1/2 top-20 z-30 w-[min(92vw,26rem)] -translate-x-1/2 animate-fadeUp rounded-xl bg-navy p-3 text-sm text-white shadow-xl"><p>{f.banner}</p>
  <div className="mt-2 flex gap-2"><Link to="/focus" className="rounded-md bg-white/15 px-3 py-1 font-semibold hover:bg-white/25">Open Focus</Link><button className="rounded-md px-3 py-1 hover:bg-white/10" onClick={()=>f.setBanner('')}>Dismiss</button></div></div>}
