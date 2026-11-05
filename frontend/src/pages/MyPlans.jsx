import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import api,{msg} from '../api'
import {inr} from './Public'

/* Student: the topics a teacher has assigned to you, the dates they are open, and what is still to pay.
   Only plans from the server are shown; access itself is checked on the server too. */
export function MyPlans(){
  const [plans,setPlans]=useState(null)
  useEffect(()=>{ api.get('/my/plans').then(r=>setPlans(r.data||[])).catch(()=>setPlans([])) },[])
  if(!plans||plans.length===0) return null
  return <section aria-labelledby="my-plans-h" className="box mb-6">
    <h2 id="my-plans-h" className="text-xl text-navy">Your assigned study plans</h2>
    <p className="mb-3 text-sm opacity-70">Each plan opens only the topics your teacher chose, and only for its dates.</p>
    <ul className="grid gap-3">{plans.map(p=>{
      const topics=p.topics.map(t=>t.title).join(', ')||'Topics to be confirmed'
      const span=p.startsOn?`${p.startsOn} to ${p.endsOn}`:`${p.days} days, starting when your payment is approved`
      return <li key={p.id} className="rounded-xl border border-slate-200/80 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0"><b className="block text-navy">{p.course}</b><span className="text-sm">{topics}</span>
            <p className="text-xs opacity-70">{span} · fee {inr(p.fee)}</p></div>
          <div className="text-right text-sm">
            {p.status==='PENDING_PAYMENT'&&(p.paymentStatus==='PENDING_VERIFICATION'
              ? <span className="font-semibold text-violet-800">Payment received, waiting for approval</span>
              : <Link className="btn !min-h-[38px] !py-1.5" to={`/checkout/${p.courseId}?plan=${p.id}`}>Pay {inr(p.fee)}</Link>)}
            {p.status==='ACTIVE'&&<Link className="btn !min-h-[38px] !py-1.5" to={`/learn/${p.courseId}`}>Open my topics</Link>}
            {p.status==='EXPIRED'&&<span className="font-semibold text-stone-700">Ended on {p.endsOn}. Ask your teacher to extend it.</span>}
            {p.status==='REVOKED'&&<span className="font-semibold text-rose-800">Ended by your teacher.</span>}
          </div>
        </div></li>})}</ul>
  </section>
}
