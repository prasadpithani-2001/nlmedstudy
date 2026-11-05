import {useEffect,useState} from 'react'
import api,{msg} from '../api'
import {inr} from './Public'

/* Teacher / admin: assign a student chosen topics for a number of days or between two dates, at a fee you set.
   The student pays from their dashboard; the plan starts when the payment is approved. Access is checked on the server. */
const STATUS={PENDING_PAYMENT:['Waiting for payment','bg-sky-100 text-sky-800'],ACTIVE:['Active','bg-green-100 text-green-800'],EXPIRED:['Expired','bg-stone-200 text-stone-700'],REVOKED:['Revoked','bg-red-100 text-red-800']}
const PAY={NOT_PAID:'not paid yet',PENDING_VERIFICATION:'waiting for your approval',SUCCESS:'paid',REJECTED:'payment rejected',CANCELLED:'cancelled',EXPIRED:'payment window closed',FAILED:'not completed'}
const todayIso=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}

export function PlansPanel({courses,flash}){
  const [cid,setCid]=useState(''), [topics,setTopics]=useState([]), [plans,setPlans]=useState(null)
  const [email,setEmail]=useState(''), [pick,setPick]=useState([]), [mode,setMode]=useState('days'), [days,setDays]=useState('5')
  const [from,setFrom]=useState(todayIso()), [to,setTo]=useState(''), [fee,setFee]=useState(''), [busy,setBusy]=useState(false)
  const [extendId,setExtendId]=useState(null), [extendTo,setExtendTo]=useState('')

  const load=()=>{ if(!cid) return; api.get(`/staff/courses/${cid}/plans`).then(r=>setPlans(r.data)).catch(e=>flash(msg(e),true)) }
  useEffect(()=>{ if(!cid&&courses[0]) setCid(String(courses[0].id)) },[courses])
  useEffect(()=>{
    if(!cid) return
    setPick([]); setPlans(null)
    api.get(`/courses/${cid}/topics`).then(r=>setTopics(r.data||[])).catch(()=>setTopics([]))
    load()
  },[cid])

  const assign=async e=>{
    e.preventDefault(); setBusy(true)
    const body={studentEmail:email.trim(),topicIds:pick,fee:Number(fee)}
    if(mode==='days') body.days=Number(days); else { body.startsOn=from; body.endsOn=to }
    try{
      await api.post(`/staff/courses/${cid}/plans`,body)
      flash('Plan assigned. The student has been emailed and can pay for it from their dashboard.')
      setEmail(''); setPick([]); setFee(''); load()
    }catch(x){ flash(msg(x),true) }
    finally{ setBusy(false) }
  }
  const extend=async p=>{
    try{ await api.put(`/staff/plans/${p.id}`,{endsOn:extendTo}); flash('Plan extended.'); setExtendId(null); load() }
    catch(x){ flash(msg(x),true) }
  }
  const revoke=async p=>{
    if(!confirm(`End ${p.studentName}'s plan now? They lose access straight away.`)) return
    try{ await api.post(`/staff/plans/${p.id}/revoke`); flash('Plan ended.'); load() }
    catch(x){ flash(msg(x),true) }
  }
  const dates=p=>p.startsOn?`${p.startsOn} to ${p.endsOn}`:(p.days?`${p.days} days (starts when paid)`:'—')
  const toggleTopic=id=>setPick(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])

  return <section aria-labelledby="plans-h" className="grid gap-6">
    <div><h2 id="plans-h" className="text-2xl text-navy">Course plans</h2>
      <p className="text-sm opacity-75">Give a student only the topics they need, for a set number of days or between two dates, at a fee you choose.</p></div>

    <form onSubmit={assign} className="box grid gap-4" aria-label="Assign a plan">
      <div className="grid gap-3 md:grid-cols-2">
        <div><label htmlFor="pc">Course</label>
          <select id="pc" className="inp" value={cid} onChange={e=>setCid(e.target.value)}>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label htmlFor="pe">Student email</label>
          <input id="pe" type="email" required className="inp" placeholder="student@example.com" value={email} onChange={e=>setEmail(e.target.value)} autoCapitalize="none"/></div>
      </div>
      <fieldset className="grid gap-2"><legend className="text-sm font-semibold">Topics this student can open</legend>
        {topics.length===0?<p className="text-sm opacity-70">This course has no topics yet. Add topics in Courses first.</p>
          :<div className="grid gap-2 sm:grid-cols-2">{topics.map(t=><label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200/80 px-3 py-2 text-sm"><input type="checkbox" checked={pick.includes(t.id)} onChange={()=>toggleTopic(t.id)}/>{t.title}</label>)}</div>}
      </fieldset>
      <fieldset className="grid gap-3"><legend className="text-sm font-semibold">Duration</legend>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Duration type">
          <button type="button" aria-pressed={mode==='days'} className={`btn2 !min-h-[38px] ${mode==='days'?'!bg-teal/15 !border-teal':''}`} onClick={()=>setMode('days')}>Number of days</button>
          <button type="button" aria-pressed={mode==='dates'} className={`btn2 !min-h-[38px] ${mode==='dates'?'!bg-teal/15 !border-teal':''}`} onClick={()=>setMode('dates')}>Start and end dates</button>
        </div>
        {mode==='days'
          ? <div className="max-w-xs"><label htmlFor="pd">Days (counted from the day the payment is approved)</label><input id="pd" type="number" min={1} max={365} required className="inp" value={days} onChange={e=>setDays(e.target.value)}/></div>
          : <div className="grid gap-3 md:grid-cols-2"><div><label htmlFor="pf">Start date</label><input id="pf" type="date" required className="inp" value={from} min={todayIso()} onChange={e=>setFrom(e.target.value)}/></div>
              <div><label htmlFor="pt">End date</label><input id="pt" type="date" required className="inp" value={to} min={from||todayIso()} onChange={e=>setTo(e.target.value)}/></div></div>}
      </fieldset>
      <div className="max-w-xs"><label htmlFor="pfee">Fee for this plan (₹)</label><input id="pfee" type="number" min={1} max={1000000} required className="inp" value={fee} onChange={e=>setFee(e.target.value)}/>
        <p className="mt-1 text-xs opacity-70">You set the fee. The student pays it through the usual payment methods.</p></div>
      <div><button className="btn" disabled={busy||pick.length===0||!cid}>{busy?'Assigning…':'Assign plan'}</button>
        {pick.length===0&&<span className="ml-3 text-xs opacity-70">Choose at least one topic.</span>}</div>
    </form>

    <div className="box overflow-x-auto">
      <h3 className="mb-3 text-lg text-navy">Plans for this course</h3>
      {plans===null?<div className="skel h-24"/>:plans.length===0?<p className="py-6 text-center text-sm opacity-70">No plans yet for this course.</p>:
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead><tr className="opacity-70"><th className="py-1 pr-3">Student</th><th className="pr-3">Topics</th><th className="pr-3">Dates</th><th className="pr-3">Fee</th><th className="pr-3">Status</th><th className="pr-3">Payment</th><th>Actions</th></tr></thead>
        <tbody>{plans.map(p=>{const [sl,sc]=STATUS[p.status]||[p.status,'']; return <tr key={p.id} className="border-t border-slate-200/70 align-top">
          <td className="py-2 pr-3">{p.studentName}<div className="text-xs opacity-60">{p.studentEmail}</div></td>
          <td className="pr-3">{p.topics.map(t=>t.title).join(', ')||'—'}</td>
          <td className="pr-3 whitespace-nowrap">{dates(p)}</td>
          <td className="pr-3 font-semibold">{inr(p.fee)}</td>
          <td className="pr-3"><span className={`whitespace-nowrap rounded-full px-2 text-xs ${sc}`}>{sl}</span></td>
          <td className="pr-3"><span className="text-xs">{PAY[p.paymentStatus]||p.paymentStatus}</span>{p.transactionId&&<div className="font-mono text-[11px]">ID {p.transactionId}</div>}{p.paymentReference&&<div className="font-mono text-[11px] opacity-60">ref {p.paymentReference}</div>}</td>
          <td className="min-w-[160px]">{(p.status==='ACTIVE'||p.status==='EXPIRED')&&(extendId===p.id
            ? <div className="grid gap-1.5"><label className="text-xs font-semibold" htmlFor={'ext'+p.id}>New end date (later than {p.endsOn})</label>
                <input id={'ext'+p.id} type="date" className="inp !py-1 text-sm" min={p.endsOn||todayIso()} value={extendTo} onChange={e=>setExtendTo(e.target.value)}/>
                <div className="flex gap-1"><button type="button" className="btn2 !min-h-[32px] !px-2 text-xs" disabled={!extendTo} onClick={()=>extend(p)}>Save</button><button type="button" className="btn2 !min-h-[32px] !px-2 text-xs" onClick={()=>setExtendId(null)}>Cancel</button></div></div>
            : <button type="button" className="btn2 !min-h-[34px] !px-3 !py-1 text-sm" onClick={()=>{setExtendId(p.id);setExtendTo(p.endsOn||'')}}>Extend</button>)}
            {(p.status==='ACTIVE'||p.status==='EXPIRED'||p.status==='PENDING_PAYMENT')&&<button type="button" className="mt-1 block text-xs font-semibold text-rose-700 underline" onClick={()=>revoke(p)}>{p.status==='PENDING_PAYMENT'?'Cancel plan':'End plan now'}</button>}
          </td></tr>})}</tbody></table>}
    </div>
  </section>
}
