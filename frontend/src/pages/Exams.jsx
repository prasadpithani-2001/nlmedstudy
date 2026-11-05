import {useCallback,useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import api,{msg} from '../api'
import {useAuth} from '../App'
import {ProctorGate,ProctorMonitor} from './Proctor'
import {Empty} from './Public'
import {confetti} from '../fx'

/* Student: Entrance Exam. One attempt per exam. The score decides the coupon (free or % off) that is created for the student and emailed. */
const reward=d=>d>=100?'FREE course':d+'% off'
export function Exams(){
 const {user}=useAuth()
 const [armed,setArmed]=useState(false)
 const [list,setList]=useState(null),[cur,setCur]=useState(null),[ans,setAns]=useState({}),[res,setRes]=useState(null),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[mine,setMine]=useState([]),[note,setNote]=useState('')
 const load=useCallback(()=>{if(!user)return;api.get('/exams').then(r=>setList(r.data)).catch(x=>{setList([]);setErr(msg(x))});api.get('/my/coupons').then(r=>setMine(r.data)).catch(()=>{})},[user])
 useEffect(()=>{load()},[load])
 if(!user)return <div className="box mx-auto max-w-lg text-center"><div className="text-4xl">📝</div><h1 className="mt-2 text-3xl text-navy">Entrance Exam</h1><p className="mt-1 opacity-80">Take the entrance exam and win a free course or a discount coupon based on your score. Log in to start.</p><div className="mt-4 flex justify-center gap-2"><Link className="btn" to="/login">Log in</Link><Link className="btn2" to="/register">Sign up</Link></div></div>
 if(user.role!=='STUDENT')return <div className="box mx-auto max-w-lg text-center"><h1 className="text-2xl text-navy">Entrance Exam</h1><p className="mt-1 opacity-80">Exams are taken by students. Create and manage them from your dashboard, under Coupons & exams.</p><Link className="btn mt-3" to={user.role==='ADMIN'?'/admin':'/teacher'}>Open dashboard</Link></div>
 const start=async id=>{setErr('');setRes(null);setAns({});setArmed(false);try{setCur((await api.get(`/exams/${id}`)).data)}catch(x){setErr(msg(x))}}
 const submit=async()=>{setBusy(true);setErr('');try{const r=(await api.post(`/exams/${cur.id}/submit`,{answers:ans})).data;setRes(r);setCur(null);load();if(r.discount>0)confetti()}catch(x){setErr(msg(x))}finally{setBusy(false)}}
 const copy=t=>{try{navigator.clipboard.writeText(t);setNote('Copied '+t)}catch{setNote('Your code: '+t)}setTimeout(()=>setNote(''),3000)}

 if(res)return <div className="box mx-auto max-w-lg overflow-hidden text-center !p-0">
  <div className="bg-gradient-to-br from-teal to-brand2 px-6 pb-7 pt-7 text-white"><div className="text-5xl">{res.discount>=100?'🏆':res.discount>0?'🎉':'📘'}</div><h1 className="mt-2 text-3xl font-extrabold text-white">{res.percent}%</h1><p className="text-white/90">{res.score} of {res.total} correct</p></div>
  <div className="p-6"><p role="status" className="text-lg font-semibold text-navy">{res.message}</p>
   {res.couponCode&&<><p className="mt-3 text-sm opacity-75">Your coupon code (also sent to your email):</p><button type="button" className="mt-1 rounded-xl bg-teal/10 px-5 py-3 font-mono text-2xl font-bold tracking-widest text-teal" onClick={()=>copy(res.couponCode)} title="Copy">{res.couponCode}</button>
    <p className="mt-2 text-sm">{reward(res.discount)} · {res.course} · valid until {res.expires}</p></>}
   <p className="mt-1 h-5 text-xs text-teal" role="status">{note}</p>
   <div className="mt-3 flex flex-wrap justify-center gap-2">{res.couponCode&&<Link className="btn" to={res.courseId?`/course/${res.courseId}`:'/courses'}>{res.courseId?'Go to the course':'Choose a course'}</Link>}<button className="btn2" onClick={()=>setRes(null)}>Back to exams</button></div></div></div>

 if(cur&&cur.items&&!armed) return <ProctorGate title={cur.title} onReady={()=>setArmed(true)}/>
 if(cur&&cur.items){const done=cur.items.every(q=>ans[q.id]!==undefined)
  return <div className="mx-auto grid max-w-3xl gap-4"><ProctorMonitor scope={`exam-${cur.id}`}/><div><button className="text-sm underline" onClick={()=>setCur(null)}>← Back to exams</button><h1 className="mt-1 text-3xl text-navy">{cur.title}</h1>
   <p className="text-sm opacity-75">{cur.items.length} questions · one attempt only · rewards: {cur.tiers.map(t=>`${t.minScore}%+ → ${reward(t.discount)}`).join(' · ')}</p></div>
   {cur.items.map((q,i)=><fieldset key={q.id} className="box"><legend className="sr-only">Question {i+1}</legend><p className="font-semibold text-navy">{i+1}. {q.text}</p>
    <div className="mt-2 grid gap-2">{q.options.map((o,j)=><label key={j} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition hover:border-teal ${ans[q.id]===j?'border-teal bg-teal/10 font-semibold':'border-slate-300/70'}`}><input type="radio" className="accent-[rgb(var(--accent))]" name={`q${q.id}`} checked={ans[q.id]===j} onChange={()=>setAns(a=>({...a,[q.id]:j}))}/>{o}</label>)}</div></fieldset>)}
   {err&&<p role="alert" className="font-semibold text-amber-700">{err}</p>}
   <div className="flex flex-wrap items-center gap-3"><button className="btn" disabled={!done||busy} onClick={()=>{if(confirm('Submit your answers? You cannot retake this exam.'))submit()}}>{busy?'Submitting…':'Submit answers'}</button><span className="text-sm opacity-70">{Object.keys(ans).length}/{cur.items.length} answered</span></div></div>}

 return <>
  <header className="mb-5"><p className="text-sm font-bold uppercase tracking-wider text-teal">Scholarship</p><h1 className="text-4xl text-navy">Entrance Exam</h1><p className="mt-1 max-w-2xl opacity-80">Score well and win a free course or a discount coupon. Each exam can be taken once, and your coupon is emailed to you.</p></header>
  {err&&<p role="alert" className="mb-3 font-semibold text-amber-700">{err}</p>}
  {mine.length>0&&<section className="box mb-5"><h2 className="text-xl text-navy">🎟️ Your coupons</h2><ul className="mt-2 flex flex-wrap gap-2">{mine.map(k=><li key={k.id}><button type="button" className="chip !px-3 !py-1.5 !text-sm" onClick={()=>copy(k.code)}>{k.code} · {k.percent>=100?'FREE':k.percent+'% off'} · {k.course}{k.expires?` · until ${k.expires}`:''}</button></li>)}</ul><p className="mt-2 text-xs opacity-70">Enter a code in the coupon box at checkout, or tap it at checkout. {note}</p></section>}
  {list===null?<div className="grid gap-4 sm:grid-cols-2"><div className="skel h-40"/><div className="skel h-40"/></div>
   :list.length===0?<Empty icon="📝" title="No entrance exam is open right now">Your teacher will publish one soon. Check back later.</Empty>
   :<div className="grid gap-4 sm:grid-cols-2">{list.map(e=><article key={e.id} className="ccard flex flex-col p-5">
    <p className="text-xs font-bold uppercase tracking-wider text-teal">{e.course}</p><h2 className="mt-1 text-xl text-navy">{e.title}</h2>
    {e.description&&<p className="mt-1 text-sm opacity-75">{e.description}</p>}
    <p className="mt-2 text-sm opacity-75">{e.questions} questions · by {e.teacher}</p>
    <ul className="mt-2 flex flex-wrap gap-1.5">{e.tiers.map(t=><li key={t.minScore} className="chip">{t.minScore}%+ → {reward(t.discount)}</li>)}</ul>
    <div className="mt-auto pt-4">{e.attempted?<div className="rounded-xl bg-teal/10 p-3 text-sm"><b>You scored {e.scorePct}%</b> ({e.score}/{e.total}). {e.couponCode?<>Reward: <b>{reward(e.discount)}</b> · code <button type="button" className="font-mono font-bold underline" onClick={()=>copy(e.couponCode)}>{e.couponCode}</button></>:'No reward this time.'}</div>
     :<button className="btn w-full" disabled={e.questions===0} onClick={()=>start(e.id)}>Start exam</button>}</div></article>)}</div>}</>}
