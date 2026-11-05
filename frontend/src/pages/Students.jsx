import {useEffect,useMemo,useState} from 'react'
import api,{msg} from '../api'
import {inr,initials} from './Public'

/* Registered students (Phase 11). Teacher: students enrolled in the teacher's own courses.
   Admin: every registered student. Data comes from GET /api/staff/student-directory, which enforces that scope. */
export function StudentDirectory({title='Registered students'}){
 const [rows,setRows]=useState(null),[err,setErr]=useState(''),[q,setQ]=useState(''),[course,setCourse]=useState('')
 useEffect(()=>{api.get('/staff/student-directory').then(r=>setRows(r.data)).catch(e=>{setErr(msg(e));setRows([])})},[])
 const courses=useMemo(()=>{const m=new Map();(rows||[]).forEach(s=>s.courses.forEach(c=>m.set(String(c.courseId),c.course)));return [...m]},[rows])
 const list=useMemo(()=>(rows||[]).filter(s=>(!course||s.courses.some(c=>String(c.courseId)===course))
   &&(s.name+' '+s.email+' '+s.courses.map(c=>c.course).join(' ')).toLowerCase().includes(q.trim().toLowerCase())),[rows,q,course])
 return <section className="box" aria-labelledby="dir-h">
  <div className="mb-4 flex flex-wrap items-end gap-2">
   <div className="mr-auto min-w-0"><h2 id="dir-h" className="text-xl text-navy">{title}</h2>
    <p className="text-sm opacity-70">{rows?`${list.length} of ${rows.length} student${rows.length===1?'':'s'} shown`:'Loading…'}</p></div>
   <input className="inp max-w-[240px]" type="search" placeholder="Search name, email or course" aria-label="Search students" value={q} onChange={e=>setQ(e.target.value)}/>
   <select className="inp max-w-[200px]" aria-label="Filter by course" value={course} onChange={e=>setCourse(e.target.value)}><option value="">All courses</option>{courses.map(([id,n])=><option key={id} value={id}>{n}</option>)}</select>
  </div>
  {err&&<p role="alert" className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{err}</p>}
  {rows===null?<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><div className="skel h-36"/><div className="skel h-36"/><div className="skel h-36"/></div>
  :list.length===0?<p className="py-8 text-center text-sm opacity-70">{rows.length===0?'No registered students yet. They appear here after they sign up.':'No students match your search.'}</p>
  :<ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{list.map((s,i)=><li key={s.id} className="ccard animate-fadeUp !p-4" style={{animationDelay:Math.min(i,12)*40+'ms'}}>
    <div className="flex items-start gap-3"><span className="avatar h-11 w-11 shrink-0 text-sm" aria-hidden="true">{initials(s.name)}</span>
     <div className="min-w-0 flex-1"><b className="block truncate text-navy">{s.name}</b><span className="block break-all text-xs opacity-70">{s.email}</span></div></div>
    <div className="mt-3 flex flex-wrap gap-1.5">{s.courses.length===0?<span className="chip !bg-slate-200/60 !text-slate-600 dark:!bg-white/10 dark:!text-slate-300">Not enrolled yet</span>
     :s.courses.map(c=><span key={c.courseId} className="chip" title={`Paid ${inr(c.paid)}`}>{c.course}</span>)}</div>
    <p className="mt-2 text-xs opacity-60">{s.enrolled} enrolled course{s.enrolled===1?'':'s'}</p></li>)}</ul>}
 </section>}
