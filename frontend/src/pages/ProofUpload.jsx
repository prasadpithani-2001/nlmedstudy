import {useEffect,useState} from 'react'
import {useParams} from 'react-router-dom'
import api,{msg} from '../api'
import {inr} from './Public'
import {ProofForm} from './Proof'

/* Opened from the upload link in the student's email (or the phone QR). No login: the one-time link identifies the payment.
   Step 1: upload a screenshot. Step 2: press I Have Paid, which sends the payment for verification.
   A screenshot alone never confirms a payment. */
export function ProofUpload(){
  const {token}=useParams(), [info,setInfo]=useState(null), [err,setErr]=useState(''), [note,setNote]=useState(''), [busy,setBusy]=useState(false)
  const load=()=>api.get(`/proof-session/${token}`).then(r=>{setInfo(r.data);setErr('')}).catch(e=>setErr(msg(e)))
  useEffect(()=>{ load() },[token])
  const send=async file=>{
    setBusy(true); setErr(''); setNote('')
    const fd=new FormData(); fd.append('file',file)
    try{ await api.post(`/proof-session/${token}/upload`,fd); setNote('Screenshot saved. Now press I Have Paid.'); load() }
    catch(x){ setErr(msg(x)) }
    finally{ setBusy(false) }
  }
  const paid=async()=>{
    setBusy(true); setErr(''); setNote('')
    try{ const r=await api.post(`/proof-session/${token}/paid`); setNote(r.data.message||'Thank you. Your payment is now pending verification.'); load() }
    catch(x){ setErr(msg(x)) }
    finally{ setBusy(false) }
  }
  const card=children=><div className="mx-auto max-w-md py-6"><div className="box grid gap-4">{children}</div></div>
  if(err&&!info) return card(<><h1 className="text-xl text-navy">Upload link</h1><p role="alert" className="text-amber-700">{err}</p></>)
  if(!info) return card(<p role="status">Loading…</p>)
  if(info.status==='PENDING_VERIFICATION') return card(<div className="text-center">
    <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full bg-violet-100 text-2xl" aria-hidden="true">⏳</div>
    <h1 className="text-xl text-navy" role="status">Pending verification</h1>
    <p className="mt-2 text-sm">Your payment of {inr(info.amount)} for <b>{info.course}</b> was sent for checking. We will email you when it is confirmed. You can close this page.</p>
    <p className="mt-2 text-xs opacity-70">Reference <span className="font-mono">{info.reference}</span></p></div>)
  if(info.status==='SUCCESS') return card(<div className="text-center">
    <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full bg-green-100 text-2xl" aria-hidden="true">✓</div>
    <h1 className="text-xl text-navy" role="status">Payment confirmed</h1>
    <p className="mt-2 text-sm">Your payment for <b>{info.course}</b> is confirmed. Open NLMed Study to start learning.</p></div>)
  const closed=['EXPIRED','CANCELLED'].includes(info.status)
  return card(<>
    <div>
      <p className="text-sm opacity-70">Payment screenshot for</p>
      <h1 className="text-xl text-navy">{info.course}</h1>
      <p className="mt-1 text-sm">Amount <b>{inr(info.amount)}</b> · Reference <span className="font-mono">{info.reference}</span></p>
      <p className="mt-1 text-xs opacity-70">Link expires in about {Math.max(1,Math.round(info.secondsLeft/60))} min</p>
    </div>
    {note&&<p role="status" className="text-sm text-green-800">{note}</p>}
    {info.status==='REJECTED'&&<div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><b>This payment proof was not approved.</b>{info.reason?` Reason: ${info.reason}.`:''} Upload a clearer screenshot and press I Have Paid again.</div>}
    {err&&<p role="alert" className="text-sm text-amber-700">{err}</p>}
    {closed
      ? <p className="text-sm">This payment is no longer open for a screenshot.</p>
      : <>
        <ol className="grid gap-1 text-sm"><li>1. Upload a screenshot that shows the amount, date and reference.</li><li>2. Press <b>I Have Paid</b>.</li></ol>
        <ProofForm camera onSubmit={send} busy={busy} submitLabel={info.hasProof?'Replace screenshot':'Upload screenshot'}/>
        {info.hasProof&&<p className="text-sm text-green-800">✓ Screenshot saved</p>}
        <button type="button" className="btn w-full" disabled={busy||!info.hasProof} onClick={paid}>{busy?'Sending…':'✓ I Have Paid'}</button>
        {!info.hasProof&&<p className="text-xs opacity-70">I Have Paid turns on after your screenshot is saved.</p>}
      </>}
    <p className="text-xs opacity-70">JPG, PNG or WEBP, up to 5 MB. A screenshot alone does not unlock the course; the payment is checked first.</p>
  </>)
}
