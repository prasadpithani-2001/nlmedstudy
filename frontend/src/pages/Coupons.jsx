import {ProctorPanel} from './Proctor'
import {useCallback,useEffect,useState} from 'react'
import api,{msg} from '../api'
import {Empty} from './Public'

/* Teacher / Admin: coupons and entrance exams. Everything is saved by the server; a teacher sees only their own, the admin sees all.
   - "Give free" = one single-use 100% coupon per student email, emailed to the student.
   - "Create coupon" = any % off, optionally for one student, one course, limited uses, expiry date.
   - "Entrance exam" = MCQs + reward levels (score % -> discount %). Students get one attempt and win an emailed coupon automatically. */
const STATUS={ACTIVE:'tag-ok',USED:'tag-off',EXPIRED:'tag-wait',DISABLED:'tag-bad'}
const blankQ=()=>({text:'',options:['','','',''],correct:0})
const Tag=({s})=><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[s]||'tag-off'}`}>{s}</span>
const copy=(t,flash)=>{try{navigator.clipboard.writeText(t);flash('Copied '+t)}catch{flash('Copy this code: '+t)}}

export function CouponsExams({courses,flash}){
 const [sub,setSub]=useState('free'),[list,setList]=useState(null),[exams,setExams]=useState(null),[result,setResult]=useState(null),[openEx,setOpenEx]=useState(null),[att,setAtt]=useState(null)
 const [ex,setEx]=useState({title:'',description:'',courseId:'',tiers:'90:100,75:50,60:25',questions:[blankQ()]}),[busy,setBusy]=useState(false)
 const load=useCallback(()=>{api.get('/staff/coupons').then(r=>setList(r.data)).catch(()=>setList([]));api.get('/staff/exams').then(r=>setExams(r.data)).catch(()=>setExams([]))},[])
 useEffect(()=>{load()},[load])
 const post=async(url,body,ok,after)=>{setBusy(true);try{const r=await api.post(url,body);flash(typeof ok==='function'?ok(r.data):ok);after&&after(r.data);load()}catch(x){flash(msg(x),true)}finally{setBusy(false)}}
 const toggle=async(k)=>{try{await api.put(`/staff/coupons/${k.id}/active`,{active:!k.active});load()}catch(x){flash(msg(x),true)}}
 const toggleExam=async(e)=>{try{await api.put(`/staff/exams/${e.id}/active`,{active:!e.active});load()}catch(x){flash(msg(x),true)}}
 const showAttempts=async e=>{if(openEx===e.id){setOpenEx(null);return}setOpenEx(e.id);setAtt(null);try{setAtt((await api.get(`/staff/exams/${e.id}/attempts`)).data)}catch(x){setAtt([]);flash(msg(x),true)}}
 const courseOpts=courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)
 const setQ=(i,patch)=>setEx(p=>({...p,questions:p.questions.map((q,k)=>k===i?{...q,...patch}:q)}))
 const setOpt=(i,j,v)=>setEx(p=>({...p,questions:p.questions.map((q,k)=>k===i?{...q,options:q.options.map((o,m)=>m===j?v:o)}:q)}))
 const addOpt=i=>setEx(p=>({...p,questions:p.questions.map((q,k)=>k===i&&q.options.length<6?{...q,options:[...q.options,'']}:q)}))
 const submitExam=e=>{e.preventDefault()
  const questions=ex.questions.map(q=>{const keep=q.options.map((o,j)=>({o:o.trim(),j})).filter(x=>x.o);return {text:q.text,options:keep.map(x=>x.o),correct:keep.findIndex(x=>x.j===q.correct)}})
  post('/staff/exams',{...ex,questions},'Entrance exam published. Students can take it from the Entrance Exam tab.',()=>setEx({title:'',description:'',courseId:'',tiers:'90:100,75:50,60:25',questions:[blankQ()]}))}
 const SUB=[['free','🎁','Give free'],['coupon','🎟️','Create coupon'],['exam','📝','Entrance exam'],['all','📋','All coupons']]

 return <section className="grid gap-4">
  <div role="tablist" aria-label="Coupons and exams" className="flex flex-wrap gap-2">{SUB.map(([k,i,l])=><button key={k} role="tab" aria-selected={sub===k} onClick={()=>setSub(k)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${sub===k?'border-teal bg-teal/15 text-teal':'border-slate-300/70 hover:border-teal hover:bg-teal/10'}`}>{i} {l}</button>)}</div>

  {sub==='free'&&<div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
   <form className="box grid content-start gap-3" onSubmit={e=>{e.preventDefault();const el=e.target,f=Object.fromEntries(new FormData(el));post('/staff/coupons/free-students',f,d=>d.message,d=>{setResult(d);el.reset()})}}>
    <h2 className="text-xl text-navy">Give a course free to students</h2>
    <p className="text-sm opacity-70">Each student gets their own single-use 100% coupon by email. It only works with the email you enter, so it cannot be shared.</p>
    <label htmlFor="fc">Course</label><select id="fc" name="courseId" className="inp" required defaultValue=""><option value="" disabled>Choose a course…</option>{courseOpts}</select>
    <label htmlFor="fe">Student emails</label><textarea id="fe" name="emails" rows={5} className="inp" placeholder={'student1@example.com\nstudent2@example.com'} required/>
    <label htmlFor="fx">Valid until (optional, default 60 days)</label><input id="fx" name="expires" type="date" className="inp"/>
    <label htmlFor="fn">Note (optional)</label><input id="fn" name="note" maxLength={150} className="inp" placeholder="e.g. Scholarship batch 2026"/>
    <button className="btn" disabled={busy}>{busy?'Creating…':'🎁 Create free coupons & email students'}</button></form>
   <div className="box">
    <h2 className="text-xl text-navy">Result</h2>
    {!result?<p className="mt-2 text-sm opacity-70">Codes you create appear here, and are also emailed. (Without SMTP the email is printed in the server console.)</p>:<>
     <p className="mt-2 text-sm font-semibold">{result.message} <span className="opacity-70">Course: {result.course}</span></p>
     {result.created.length>0&&<ul className="mt-2 grid gap-1.5 text-sm">{result.created.map(r=><li key={r.code} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-teal/10 px-3 py-1.5"><span className="break-all">{r.email}</span><button type="button" className="chip" onClick={()=>copy(r.code,flash)}>{r.code} ⧉</button></li>)}</ul>}
     {result.skipped.length>0&&<><p className="mt-3 text-sm font-semibold">Skipped</p><ul className="mt-1 grid gap-1 text-sm opacity-80">{result.skipped.map(r=><li key={r.email}>{r.email} — {r.reason}</li>)}</ul></>}</>}</div></div>}

  {sub==='coupon'&&<form className="box grid max-w-2xl content-start gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();const el=e.target,f=Object.fromEntries(new FormData(el));post('/staff/coupons',f,'Coupon created.',()=>{el.reset();setSub('all')})}}>
   <div className="sm:col-span-2"><h2 className="text-xl text-navy">Create a coupon</h2><p className="text-sm opacity-70">Leave the code empty to generate one. Leave the email empty to let any student use it. A 100% coupon enrols the student without payment.</p></div>
   <div><label htmlFor="cc">Code (optional)</label><input id="cc" name="code" maxLength={30} className="inp uppercase" placeholder="e.g. NEET50"/></div>
   <div><label htmlFor="cp">Discount %</label><input id="cp" name="percent" type="number" min={1} max={100} defaultValue={10} className="inp" required/></div>
   <div><label htmlFor="cco">Course</label><select id="cco" name="courseId" className="inp" defaultValue=""><option value="">Any of my courses</option>{courseOpts}</select></div>
   <div><label htmlFor="cm">Total uses (0 = unlimited)</label><input id="cm" name="maxUses" type="number" min={0} max={100000} defaultValue={1} className="inp"/></div>
   <div><label htmlFor="ce">Only for this student email (optional)</label><input id="ce" name="email" type="email" className="inp" placeholder="student@example.com"/></div>
   <div><label htmlFor="cx">Valid until (optional)</label><input id="cx" name="expires" type="date" className="inp"/></div>
   <div className="sm:col-span-2"><label htmlFor="cn">Note (optional)</label><input id="cn" name="note" maxLength={200} className="inp"/></div>
   <button className="btn sm:col-span-2" disabled={busy}>{busy?'Saving…':'Create coupon'}</button></form>}

  {sub==='exam'&&<div className="grid gap-4">
   <form className="box grid gap-3" onSubmit={submitExam}>
    <div><h2 className="text-xl text-navy">Create an entrance exam</h2><p className="text-sm opacity-70">Students take it once. Their score decides the coupon they win, which is emailed to them automatically.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
     <div><label htmlFor="et">Exam title</label><input id="et" className="inp" required minLength={3} maxLength={120} value={ex.title} onChange={e=>setEx({...ex,title:e.target.value})} placeholder="e.g. NLMed Scholarship Entrance Test"/></div>
     <div><label htmlFor="eco">Coupon works for</label><select id="eco" className="inp" value={ex.courseId} onChange={e=>setEx({...ex,courseId:e.target.value})}><option value="">Any of my courses</option>{courseOpts}</select></div>
     <div className="sm:col-span-2"><label htmlFor="ed">Description (optional)</label><input id="ed" className="inp" maxLength={300} value={ex.description} onChange={e=>setEx({...ex,description:e.target.value})}/></div>
     <div className="sm:col-span-2"><label htmlFor="eti">Reward levels (score % : discount %)</label><input id="eti" className="inp font-mono" value={ex.tiers} onChange={e=>setEx({...ex,tiers:e.target.value})}/>
      <p className="mt-1 text-xs opacity-70">Example <b>90:100,75:50,60:25</b> means: 90% or more wins a FREE course, 75% or more wins 50% off, 60% or more wins 25% off. Below the lowest level wins nothing.</p></div></div>
    <div className="grid gap-3">{ex.questions.map((q,i)=><fieldset key={i} className="rounded-xl border border-slate-300/70 p-3"><legend className="px-1 text-sm font-bold text-teal">Question {i+1}</legend>
     <input className="inp" aria-label={`Question ${i+1}`} placeholder="Type the question" value={q.text} maxLength={400} onChange={e=>setQ(i,{text:e.target.value})} required/>
     <div className="mt-2 grid gap-2">{q.options.map((o,j)=><label key={j} className="flex items-center gap-2 text-sm"><input type="radio" name={`c${i}`} checked={q.correct===j} onChange={()=>setQ(i,{correct:j})} aria-label={`Option ${j+1} is correct`}/><input className="inp" aria-label={`Question ${i+1} option ${j+1}`} placeholder={`Option ${j+1}`} value={o} maxLength={120} onChange={e=>setOpt(i,j,e.target.value)}/></label>)}</div>
     <div className="mt-2 flex flex-wrap gap-2 text-sm"><span className="opacity-70">The selected circle is the correct answer.</span>{q.options.length<6&&<button type="button" className="btn2 !py-1" onClick={()=>addOpt(i)}>+ Option</button>}{ex.questions.length>1&&<button type="button" className="btn2 !py-1" onClick={()=>setEx(p=>({...p,questions:p.questions.filter((_,k)=>k!==i)}))}>Remove question</button>}</div></fieldset>)}</div>
    <div className="flex flex-wrap gap-2"><button type="button" className="btn2" onClick={()=>setEx(p=>p.questions.length<100?{...p,questions:[...p.questions,blankQ()]}:p)}>+ Add question</button><button className="btn" disabled={busy}>{busy?'Publishing…':'Publish exam'}</button></div></form>

   <div className="box"><h2 className="mb-2 text-xl text-navy">Your exams</h2>
    {exams===null?<div className="skel h-24"/>:exams.length===0?<Empty icon="📝" title="No exams yet">Create your first entrance exam above.</Empty>:
    <ul className="grid gap-3">{exams.map(e=><li key={e.id} className="rounded-xl border border-slate-300/60 p-3">
     <div className="flex flex-wrap items-center gap-2"><b className="mr-auto text-navy">{e.title}</b><Tag s={e.active?'ACTIVE':'DISABLED'}/></div>
     <p className="text-sm opacity-75">{e.course} · {e.questions} questions · {e.attempts} attempt{e.attempts===1?'':'s'} · rewards {e.tiers.map(t=>`${t.minScore}%→${t.discount>=100?'FREE':t.discount+'% off'}`).join(', ')}</p>
     <div className="mt-2 flex flex-wrap gap-2"><button className="btn2 !py-1" onClick={()=>showAttempts(e)}>{openEx===e.id?'Hide results':'Results'}</button><button className="btn2 !py-1" onClick={()=>toggleExam(e)}>{e.active?'Disable':'Enable'}</button></div>
     {openEx===e.id&&<ProctorPanel examId={e.id} attempts={att}/>}
     {openEx===e.id&&(att===null?<div className="skel mt-2 h-16"/>:att.length===0?<p className="mt-2 text-sm opacity-70">No student has taken this exam yet.</p>:
      <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="opacity-70"><th className="pr-3">Student</th><th className="pr-3">Score</th><th className="pr-3">Reward</th><th>Coupon</th></tr></thead><tbody>{att.map(a=><tr key={a.id} className="border-t border-slate-200/60"><td className="pr-3 py-1">{a.student}<div className="text-xs opacity-60">{a.email}</div></td><td className="pr-3">{a.score}/{a.total} ({a.percent}%)</td><td className="pr-3">{a.discount>=100?'FREE':a.discount>0?a.discount+'% off':'—'}</td><td className="font-mono text-xs">{a.couponCode||'—'}</td></tr>)}</tbody></table></div>)}</li>)}</ul>}</div></div>}

  {sub==='all'&&<div className="box overflow-x-auto"><h2 className="mb-2 text-xl text-navy">All coupons</h2>
   {list===null?<div className="skel h-24"/>:list.length===0?<Empty icon="🎟️" title="No coupons yet">Create one, or give a course free to students.</Empty>:
   <table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="opacity-70"><th className="pr-3 pb-2">Code</th><th className="pr-3">Discount</th><th className="pr-3">For</th><th className="pr-3">Course</th><th className="pr-3">Uses</th><th className="pr-3">Valid until</th><th className="pr-3">Status</th><th/></tr></thead>
    <tbody>{list.map(k=><tr key={k.id} className="border-t border-slate-200/60 align-top">
     <td className="py-2 pr-3"><button type="button" className="chip" onClick={()=>copy(k.code,flash)} title="Copy code">{k.code} ⧉</button>{k.note&&<div className="mt-0.5 max-w-[14rem] text-xs opacity-60">{k.note}</div>}</td>
     <td className="pr-3 font-semibold">{k.percent>=100?'FREE':k.percent+'% off'}</td><td className="pr-3 break-all">{k.email||'Any student'}<div className="text-xs opacity-60">{k.kind==='EXAM'?'Exam reward':k.kind==='STUDENT'?'Given to student':'General'}</div></td>
     <td className="pr-3">{k.course}</td><td className="pr-3">{k.uses}/{k.maxUses||'∞'}</td><td className="pr-3">{k.expires||'No expiry'}</td><td className="pr-3"><Tag s={k.status}/></td>
     <td><button className="btn2 !py-1" onClick={()=>toggle(k)}>{k.active?'Disable':'Enable'}</button></td></tr>)}</tbody></table>}</div>}
 </section>}
