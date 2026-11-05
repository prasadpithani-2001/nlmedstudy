import {useEffect,useRef,useState} from 'react'
import {Link,useParams} from 'react-router-dom'
import api,{msg} from '../api'
import {inr} from './Public'
import {SuccessMark,confetti} from '../fx'

/* Where the student lands after pressing "I have paid". The page reads the payment from the server.
   Only the owner's approval (decided on the server) can change a payment to SUCCESS. */
const METHOD={QR:'UPI QR code',UPI:'UPI app',CARD:'Debit or credit card'}
const Wrap=({children})=><div className="mx-auto max-w-2xl py-6">{children}</div>
const Row=({k,v,mono})=><div className="flex justify-between gap-4 border-t border-slate-200/70 py-1.5 text-sm"><dt className="opacity-70">{k}</dt><dd className={mono?'break-all font-mono':'font-semibold'}>{v}</dd></div>

export function PaymentResult(){
  const {ref}=useParams(), [p,setP]=useState(null), [err,setErr]=useState(''), [checked,setChecked]=useState(null), fired=useRef(false)
  useEffect(()=>{
    let stop=false
    const load=async()=>{
      if(stop) return
      try{
        const r=(await api.get(`/payments/${ref}`)).data
        if(stop) return
        setP(r); setChecked(new Date())
        if(r.status==='SUCCESS'&&!fired.current){ fired.current=true; confetti() }
        if(r.status==='PENDING_VERIFICATION') setTimeout(load,30000)   // the owner may take a while: check every 30 s
      }catch(x){ if(!stop) setErr(msg(x)) }
    }
    load()
    return()=>{stop=true}
  },[ref])

  const [resendBusy,setResendBusy]=useState(false), [resendMsg,setResendMsg]=useState('')
  const resend=async()=>{ setResendBusy(true); setResendMsg(''); try{ const r=(await api.post(`/payments/${ref}/resend-upload-link`)).data; setResendMsg(r.sent?'We emailed you a new upload link.':r.problem) }catch(x){ setResendMsg(msg(x)) } finally{ setResendBusy(false) } }
  if(err) return <Wrap><div className="box" role="alert"><p className="font-semibold text-amber-700">{err}</p><Link className="btn2 mt-3" to="/my-payments">My payments</Link></div></Wrap>
  if(!p) return <Wrap><div className="box text-center" role="status">Loading your payment…</div></Wrap>

  if(p.status==='SUCCESS') return <Wrap><div className="box text-center" role="status" aria-live="polite">
    <div className="flex justify-center"><SuccessMark/></div>
    <h1 className="mt-3 font-serif text-3xl text-navy">Payment approved</h1>
    <p className="mt-2">Welcome to <b>{p.course}</b>. Your course is unlocked.</p>
    <dl className="mx-auto mt-4 max-w-sm text-left"><Row k="Amount" v={inr(p.amount)}/><Row k="Paid with" v={METHOD[p.method]||p.method}/>{p.utr&&<Row k="Transaction ID" v={p.utr} mono/>}<Row k="Reference" v={p.reference} mono/></dl>
    <p className="mt-3 text-xs opacity-70">A confirmation email has been sent to you.</p>
    <div className="mt-5 flex flex-wrap justify-center gap-2"><Link className="btn" to="/dashboard">Start learning</Link><Link className="btn2" to="/my-payments">My payments</Link></div>
  </div></Wrap>

  if(p.status==='PENDING_VERIFICATION') return <Wrap><div className="box text-center" role="status" aria-live="polite">
    <div className="mx-auto my-2 grid h-14 w-14 place-items-center rounded-full bg-violet-100 text-2xl" aria-hidden="true">⏳</div>
    <h1 className="font-serif text-2xl text-navy">Payment details submitted successfully!</h1>
    <p className="mt-2 text-sm font-semibold text-violet-900">Status: SUBMITTED – AWAITING APPROVAL</p>
    <p className="mt-2 text-sm">Your payment is awaiting teacher/admin approval. Your course will become available once your payment is approved.</p>
    {p.utr&&<p className="mt-2 text-sm">Transaction ID: <span className="font-mono font-semibold">{p.utr}</span></p>}<p className="mt-2 text-xs opacity-70">Reference <span className="font-mono">{p.reference}</span>{checked&&` · last checked ${checked.toLocaleTimeString()}`}. Please do not pay again.</p>
    <div className="mt-4 flex flex-wrap justify-center gap-2"><Link className="btn2" to="/my-payments">My payments</Link></div>
  </div></Wrap>

  if(p.status==='AWAITING') return <Wrap><div className="box" role="status">
    <h1 className="font-serif text-2xl text-navy">Payment not confirmed yet</h1>
    <p className="mt-2 text-sm">Go back to the payment page, pay the amount, then press <b>I have paid</b>. Your course unlocks after the team checks the payment.</p>
    <p className="mt-1 text-xs opacity-70">Reference <span className="font-mono">{p.reference}</span></p>
    <div className="mt-4 flex flex-wrap gap-2"><Link className="btn" to={`/checkout/${p.courseId}`}>Go to payment</Link><Link className="btn2" to="/contact">Contact us</Link></div>
  </div></Wrap>

  if(p.status==='REJECTED') return <Wrap><div className="box" role="alert">
    <h1 className="font-serif text-2xl text-navy">Payment not approved</h1>
    <p className="mt-2"><b>Reason:</b> {p.reason||'Please check the payment and send a clearer screenshot.'}</p>
    <p className="mt-2 text-sm">Your course stays locked. You can send a corrected screenshot and press I Have Paid again.</p>
    <p className="mt-1 text-xs opacity-70">Reference <span className="font-mono">{p.reference}</span></p>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" className="btn" disabled={resendBusy} onClick={resend}>{resendBusy?'Sending…':'Email me the upload link'}</button>
      <Link className="btn2" to="/contact">Contact us</Link></div>
    {resendMsg&&<p role="status" className="mt-3 text-sm">{resendMsg}</p>}
  </div></Wrap>
  const title=p.status==='REJECTED'?'Payment not approved':p.status==='EXPIRED'?'This payment window has closed':'Payment not completed'
  return <Wrap><div className="box" role="alert">
    <h1 className="font-serif text-2xl text-navy">{title}</h1>
    <p className="mt-2">{p.reason||'No course was unlocked.'}</p>
    <p className="mt-1 text-xs opacity-70">Reference <span className="font-mono">{p.reference}</span>. If money was deducted, keep this reference and contact us.</p>
    <div className="mt-4 flex flex-wrap gap-2"><Link className="btn" to={`/checkout/${p.courseId}`}>Start again</Link><Link className="btn2" to="/contact">Contact us</Link></div>
  </div></Wrap>
}
