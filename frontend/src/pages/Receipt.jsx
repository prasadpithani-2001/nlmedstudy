import {useEffect} from 'react'
import {inr} from './Public'

/* Payment receipt: one card the student can keep, print or save as a PDF. Used from My Payments and after checkout. */
const METHOD={QR:'UPI QR',UPI:'UPI app',CARD:'Card'}
const when=t=>t?new Date(t).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'

export function Receipt({p,onClose}){
 useEffect(()=>{if(!onClose)return;const k=e=>{if(e.key==='Escape')onClose()};addEventListener('keydown',k);return()=>removeEventListener('keydown',k)},[onClose])
 const rows=[['Course',p.courseName||p.course||'—'],['Amount paid',inr(p.amount??p.paid??0)],['Paid to',p.ownerName||p.to||'—'],
  ['Payment method',p.detail||METHOD[p.method]||p.method||'—'],['Transaction ID (UTR)',p.utr||p.txn||'—'],['Reference',p.reference||'—'],
  ['Payment date',when(p.reviewedAt||p.at)],['Status',p.status==='SUCCESS'||!p.status?'Confirmed':p.status]]
 return <div role="dialog" aria-modal="true" aria-labelledby="rc-h" className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:p-6"
   onMouseDown={e=>{if(onClose&&e.target===e.currentTarget)onClose()}}>
  <article className="receipt-print box w-full max-w-md animate-pop !p-0 overflow-hidden">
   <div className="relative overflow-hidden bg-gradient-to-br from-teal to-brand2 p-5 text-white">
    <span className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" aria-hidden="true"/>
    <p className="text-xs font-bold uppercase tracking-widest opacity-90">NLMed Study · Payment receipt</p>
    <h2 id="rc-h" className="mt-1 font-serif text-2xl font-extrabold">✓ Payment confirmed</h2>
    <p className="mt-1 text-sm opacity-90">Thank you. Your course access is active.</p></div>
   <dl className="grid gap-0 px-5 py-2 text-sm">{rows.map(([k,v])=><div key={k} className="flex justify-between gap-4 border-b border-slate-200/70 py-2.5 last:border-0"><dt className="opacity-70">{k}</dt><dd className="break-all text-right font-semibold">{v}</dd></div>)}</dl>
   <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200/70 p-4 print:hidden">
    <button type="button" className="btn2" onClick={()=>window.print()}>🖨 Print / save PDF</button>
    {onClose&&<button type="button" className="btn" onClick={onClose}>Close</button>}</div>
  </article></div>
}

/** Builds the receipt data from a payment row (My Payments) or from a checkout result. */
export const receiptFromPayment=p=>({courseName:p.courseName,amount:p.amount,ownerName:p.ownerName,detail:p.detail,method:p.method,utr:p.utr,reference:p.reference,at:p.at,reviewedAt:p.reviewedAt,status:p.status})
