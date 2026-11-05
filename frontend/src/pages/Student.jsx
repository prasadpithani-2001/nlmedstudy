import {ProctorGate,ProctorMonitor} from './Proctor'
import {useEffect,useState} from 'react'
import {Link,useParams} from 'react-router-dom'
import api,{msg,isFile,vsrc} from '../api'
import {StudentResources} from './Materials'
import {useGet,inr} from './Public'
import {methodName} from './Checkout'
import {BackBar,PageHeader} from '../ui'
import {StudentRecordings} from './Recordings'
const Tab=({a,set,id,children})=><button onClick={()=>set(id)} aria-pressed={a===id} className={`rounded-lg px-4 py-2 ${a===id?'bg-navy text-white':'border border-stone-300'}`}>{children}</button>
export function Learn(){const {id}=useParams(),[tab,setTab]=useState('lessons'),topics=useGet(`/courses/${id}/topics`)
 const [qs,setQs]=useState(null),[ans,setAns]=useState({}),[out,setOut]=useState(null),[text,setText]=useState(''),[note,setNote]=useState(''),[armedT,setArmedT]=useState(false)
 useEffect(()=>{if(tab==='test'&&!qs)api.get(`/assessments/${id}/questions`).then(r=>setQs(r.data))},[tab])
 const lessons=useGet(`/courses/${id}/lessons`),[ver,setVer]=useState(0),pg=useGet(`/courses/${id}/progress?v=${ver}`),[cur,setCur]=useState(null),[cert,setCert]=useState(null)
 const topic=t=>(topics||[]).find(x=>x.id===t)?.title||'General'
 const ask=async e=>{e.preventDefault();try{await api.post('/doubts',{courseId:id,category:'Concept',text});setText('');setNote('Doubt submitted. Your teacher will reply soon.')}catch(x){setNote(msg(x))}}
 return <><PageHeader eyebrow="Your course" title="My study desk"/><LiveBadge id={id}/><div className="my-3 flex flex-wrap gap-2">
 <Tab a={tab} set={setTab} id="lessons">▶ Lessons</Tab><Tab a={tab} set={setTab} id="res">📚 Course Resources</Tab><Tab a={tab} set={setTab} id="rec">🎬 Recordings</Tab><Tab a={tab} set={setTab} id="test">🧠 Assessment</Tab><Tab a={tab} set={setTab} id="doubt">❓ Ask a Doubt</Tab><Tab a={tab} set={setTab} id="cert">🎓 Certificate</Tab></div>
 <div className="box">
 {tab==='lessons'&&<div><div className="h-2 rounded bg-stone-200"><div className="h-2 rounded bg-teal" style={{width:(pg?.percent||0)+'%'}}/></div><p className="mb-2 text-sm">Course progress {pg?.percent||0}%</p>
  {cur&&<div className="my-3">{isFile(cur.videoUrl)?<video controls className="w-full rounded-lg" src={vsrc(cur.videoUrl)}/>:<iframe title={cur.title} className="aspect-video w-full rounded-lg" src={cur.videoUrl} allowFullScreen/>}
  <button className="btn mt-2" onClick={async()=>{await api.post(`/lessons/${cur.id}/complete`);setVer(ver+1)}}>Mark complete</button></div>}
  {Array.isArray(lessons)&&lessons.map(l=><button key={l.id} className="block w-full border-b py-2 text-left" onClick={()=>setCur(l)}>{topic(l.topicId)} — {l.title}</button>)}
  {Array.isArray(lessons)&&lessons.length===0&&<p>Your teacher has not added lessons yet.</p>}</div>}
 {tab==='cert'&&<div>{cert?<div className="rounded-xl border-4 border-double border-navy p-8 text-center"><p>Certificate of Completion</p><h2 className="font-serif text-3xl text-navy">{cert.student}</h2><p>has completed <b>{cert.course}</b></p><p className="text-sm">{cert.date} · ID {cert.id}</p><button className="btn2 mt-3" onClick={()=>window.print()}>Print / Save PDF</button></div>
  :<button className="btn" onClick={async()=>{try{setCert((await api.get(`/courses/${id}/certificate`)).data);setNote('')}catch(e){setNote(msg(e))}}}>Get my certificate</button>}</div>}
 {tab==='res'&&<StudentResources courseId={id}/>}
 {tab==='rec'&&<StudentRecordings courseId={id}/>}
 {tab==='test'&&(out?<div><h2 className="font-serif text-2xl">{out.correct} correct · {out.percentage}%</h2><p>Incorrect {out.incorrect} · Skipped {out.skipped}</p>
  <h3 className="mt-3 font-semibold">Your weak areas</h3>{Object.entries(out.topicScores).map(([k,v])=><div key={k}>{k}: {v}%<div className="h-2 rounded bg-stone-200"><div className="h-2 rounded bg-teal" style={{width:v+'%'}}/></div></div>)}</div>
  :!armedT?<ProctorGate title="Course assessment" onReady={()=>setArmedT(true)}/>:<><ProctorMonitor scope={`assess-${id}`}/>{(qs||[]).map((q,i)=><fieldset key={q.id} className="mb-4"><legend className="font-semibold">Q{i+1}. {q.text}</legend>{q.options.map((o,j)=><label key={j} className="block py-1"><input type="radio" name={'q'+q.id} onChange={()=>setAns({...ans,[q.id]:j})}/> {o}</label>)}</fieldset>)}
  <button className="btn" onClick={async()=>setOut((await api.post(`/assessments/${id}/submit`,ans)).data)}>Submit assessment</button></>)}
 {tab==='doubt'&&<form onSubmit={ask} className="grid gap-2"><label htmlFor="d">Your question</label><textarea id="d" className="inp" rows={4} value={text} onChange={e=>setText(e.target.value)} required/><button className="btn">Submit Doubt</button></form>}
 <p role="status" className="mt-2 font-semibold">{note}</p></div><BackBar to="/dashboard" label="My learning"/></>}

export function LiveBadge({id}){const [l,setL]=useState(false),[md,setMd]=useState('tablet');useEffect(()=>{const f=()=>api.get(`/live/${id}`).then(r=>{setL(r.data.live);setMd(r.data.mode||'tablet')}).catch(()=>{});f();const t=setInterval(f,10000);return()=>clearInterval(t)},[id])
 return l?<Link to={`/live/${id}`} className="btn mb-2 animate-pulse !bg-none !bg-red-600">🔴 Live now · {md==='board'?'📋 Board class':'✍️ Tablet class'} — Join class</Link>:null}
