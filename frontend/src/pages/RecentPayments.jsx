import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import api,{msg} from '../api'
import {inr} from './Public'

/* Latest payments with the transaction ID, for the Admin and Teacher dashboards.
   Same data and scope as the Payments page: an admin sees every payment, a teacher only the payments made to them.
   Read from the database each time, so it is still there after a refresh or a new login. Refreshes every 30 s. */
const LABEL={NOT_SUBMITTED:'Not submitted',PENDING_VERIFICATION:'Submitted – awaiting approval',APPROVED:'Approved',COURSE_ACCESS_ACTIVE:'Approved – course access active',REJECTED:'Rejected',RESUBMISSION_REQUIRED:'Resubmission required',SUCCESS:'Approved',FAILED:'Failed',EXPIRED:'Expired',CANCELLED:'Cancelled',REFUNDED:'Refunded'}
const TONE={NOT_SUBMITTED:'bg-stone-200 text-stone-700',APPROVED:'bg-green-100 text-green-800',COURSE_ACCESS_ACTIVE:'bg-green-100 text-green-800',RESUBMISSION_REQUIRED:'bg-amber-100 text-amber-900',PENDING_VERIFICATION:'bg-violet-100 text-violet-900',SUCCESS:'bg-green-100 text-green-800',REJECTED:'bg-red-100 text-red-800',FAILED:'bg-red-100 text-red-800',EXPIRED:'bg-stone-200 text-stone-700',CANCELLED:'bg-stone-200 text-stone-700',REFUNDED:'bg-violet-100 text-violet-800'}
const METHOD={QR:'UPI QR',UPI:'UPI app',CARD:'Card',COUPON:'Free coupon'}
const when=p=>new Date(p.submittedAt||p.at).toLocaleString([],{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})

export function RecentPayments({limit=8}){
  const [rows,setRows]=useState(null), [err,setErr]=useState('')
  useEffect(()=>{
    let live=true
    const load=()=>api.get('/staff/payments').then(r=>{if(live){setRows(r.data||[]);setErr('')}}).catch(e=>{if(live)setErr(msg(e))})
    load(); const t=setInterval(load,30000)
    return()=>{live=false;clearInterval(t)}
  },[])
  const list=(rows||[]).filter(p=>p.status!=='AWAITING').slice(0,limit)
  return <section aria-labelledby="recent-pay-h" className="box mb-6">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 id="recent-pay-h" className="text-xl text-navy">Recent payments</h2>
      <Link to="/payments" className="text-sm font-semibold text-teal hover:underline">All payments →</Link></div>
    {err&&<p role="alert" className="mb-2 text-sm text-rose-800">{err}</p>}
    {rows===null?<div className="skel h-32"/>:list.length===0?<p className="py-6 text-center text-sm opacity-70">No payments yet. Each payment appears here with its transaction ID.</p>:
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
      <thead><tr className="opacity-70"><th className="py-1 pr-3">Date</th><th className="pr-3">Student</th><th className="pr-3">Course</th><th className="pr-3">Method</th><th className="pr-3">Amount</th><th className="pr-3">Transaction ID</th><th className="pr-3">Reference</th><th>Status</th></tr></thead>
      <tbody>{list.map(p=><tr key={p.id} className="border-t border-slate-200/70 align-top">
        <td className="whitespace-nowrap py-2 pr-3">{when(p)}</td>
        <td className="pr-3">{p.userName}<div className="text-xs opacity-60">{p.userEmail}</div></td>
        <td className="pr-3">{p.courseName}</td>
        <td className="pr-3">{METHOD[p.method]||p.method}<div className="text-xs opacity-60">{p.detail}</div></td>
        <td className="pr-3 font-semibold">{inr(p.amount)}</td>
        <td className="pr-3">{p.utr?<span className="font-mono text-xs font-semibold">{p.utr}</span>:<span className="text-xs font-semibold text-amber-700">not entered</span>}</td>
        <td className="pr-3 font-mono text-xs">{p.reference}</td>
        <td><span className={`whitespace-nowrap rounded-full px-2 text-xs ${TONE[p.displayStatus||p.status]||''}`}>{LABEL[p.displayStatus||p.status]||p.status}</span></td></tr>)}</tbody></table></div>}
  </section>
}
