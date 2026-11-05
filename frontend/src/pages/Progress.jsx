import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import api from '../api'

/* Student learning panel (Phase 14): streak, lessons, tests, badges, reminders, course completion and recommendations.
   Numbers come from the server (/my/learning-stats, /my/dashboard, /courses). */

const ICON={'first-lesson':'🎓','ten-lessons':'📘','first-test':'📝','sharp':'🧠','streak-3':'🔥','streak-7':'🏆'}

export function countdown(iso){
  const ms=new Date(iso)-Date.now()
  if(!(ms>0)) return 'starting soon'
  const h=Math.floor(ms/3600000), m=Math.floor((ms%3600000)/60000)
  if(h>=24) return `in ${Math.floor(h/24)} day${Math.floor(h/24)>1?'s':''}`
  return h>0?`in ${h} h ${m} min`:`in ${m} min`
}

function Tile({icon,label,value,hint}){
  return <div className="group rounded-2xl bg-gradient-to-br from-teal/10 to-brand2/10 p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg">
    <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium opacity-70">{label}</span>
      <span aria-hidden="true" className="text-xl transition duration-300 group-hover:scale-125">{icon}</span></div>
    <div className="mt-1 font-serif text-3xl font-extrabold text-navy">{value}</div>
    {hint&&<div className="text-xs opacity-65">{hint}</div>}</div>
}

export function ProgressPanel({courses=[],upcoming=[]}){
  const [s,setS]=useState(null),[recs,setRecs]=useState(null),[tick,setTick]=useState(0)
  useEffect(()=>{api.get('/my/learning-stats').then(r=>setS(r.data)).catch(()=>setS({badges:[]}))},[])
  useEffect(()=>{
    api.get('/courses').then(r=>{
      const mine=new Set(courses.map(c=>c.courseId)), subjects=new Set(courses.map(c=>c.subject).filter(Boolean))
      const list=(r.data||[]).filter(c=>!mine.has(c.id)).map(c=>({...c,why:subjects.has(c.subject)?`Same subject as your courses (${c.subject})`:'Popular with students'}))
      setRecs(list.sort((a,b)=>(b.why.startsWith('Same')-a.why.startsWith('Same'))).slice(0,3))
    }).catch(()=>setRecs([]))
  },[courses.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{const t=setInterval(()=>setTick(x=>x+1),60000);return()=>clearInterval(t)},[])

  if(s===null) return <section aria-label="Your progress" className="grid gap-4 lg:grid-cols-3"><div className="skel h-64 rounded-2xl lg:col-span-2"/><div className="skel h-64 rounded-2xl"/></section>

  const badges=s.badges||[], earned=badges.filter(b=>b.earned).length
  return <section aria-label="Your progress" className="grid gap-4 lg:grid-cols-3">
    <div className="box lg:col-span-2">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-xl text-navy">Your learning</h2>
        <p className="text-sm opacity-70">Streaks count days you finished a lesson or took a test.</p></div>
        <span className="chip">{earned} of {badges.length} badges</span></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile icon="🔥" label="Study streak" value={`${s.streak||0} d`} hint={`Longest ${s.longestStreak||0} days`}/>
        <Tile icon="📘" label="Lessons done" value={s.lessonsDone||0} hint={`${s.activeDays||0} active days`}/>
        <Tile icon="📝" label="Tests taken" value={s.testsTaken||0}/>
        <Tile icon="🎯" label="Average score" value={`${s.averageScore||0}%`}/>
      </div>
      <h3 className="mb-2 mt-5 text-base font-bold text-navy">Achievements</h3>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Badges">{badges.map(b=><li key={b.id} title={b.how}
          className={`rounded-xl border p-3 transition duration-300 ${b.earned?'border-teal/40 bg-teal/10 hover:-translate-y-0.5 hover:shadow-md':'border-slate-200/70 opacity-60 dark:border-white/10'}`}>
        <div className="flex items-center gap-2"><span aria-hidden="true" className={`text-2xl ${b.earned?'':'grayscale'}`}>{ICON[b.id]||'⭐'}</span>
          <b className="text-sm text-navy">{b.name}</b></div>
        <p className="mt-1 text-xs opacity-75">{b.earned?'Earned':b.how}</p></li>)}</ul>
    </div>

    <div className="box grid content-start gap-5">
      <div><h2 className="text-lg text-navy">Upcoming classes</h2>
        {upcoming.length===0?<p className="mt-1 text-sm opacity-70">No classes scheduled. We will remind you here.</p>
          :<ul className="mt-2 grid gap-2">{upcoming.slice(0,3).map(u=><li key={u.id} className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm dark:bg-amber-400/10">
            <span className="min-w-0 break-words"><b>{u.topic||u.title}</b></span><span className="shrink-0 font-semibold text-amber-800 dark:text-amber-300" data-tick={tick}>{countdown(u.startsAt)}</span></li>)}</ul>}
      </div>
      <div><h2 className="text-lg text-navy">Course completion</h2>
        {courses.length===0?<p className="mt-1 text-sm opacity-70">Enroll in a course to start tracking.</p>
          :<ul className="mt-2 grid gap-3">{courses.slice(0,4).map(c=><li key={c.courseId}><div className="flex justify-between gap-2 text-sm"><span className="min-w-0 truncate">{c.name}</span><b>{c.percent>=100?'✓ Done':`${c.percent}%`}</b></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" role="progressbar" aria-label={`${c.name} progress`} aria-valuenow={c.percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-gradient-to-r from-teal to-brand2 transition-all duration-700" style={{width:`${Math.min(100,c.percent||0)}%`}}/></div></li>)}</ul>}
      </div>
      <div><h2 className="text-lg text-navy">Recommended for you</h2>
        {recs===null?<div className="skel mt-2 h-14 rounded-xl"/>:recs.length===0?<p className="mt-1 text-sm opacity-70">You are enrolled in everything we offer right now.</p>
          :<ul className="mt-2 grid gap-2">{recs.map(c=><li key={c.id}><Link to={`/course/${c.id}`} className="block rounded-xl border border-slate-200/70 p-3 transition duration-300 hover:-translate-y-0.5 hover:border-teal hover:shadow-md dark:border-white/10">
            <b className="text-sm text-navy">{c.name}</b><p className="text-xs opacity-70">{c.why}</p></Link></li>)}</ul>}
      </div>
    </div>
  </section>
}
