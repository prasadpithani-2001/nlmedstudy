import {useEffect,useRef,useState} from 'react'
import {Link,Navigate,useParams,useSearchParams} from 'react-router-dom'
import api,{msg} from '../api'
import {useAuth} from '../App'
import {confetti,Reveal,SuccessMark} from '../fx'
import {inr,useGet} from './Public'
import {Receipt} from './Receipt'
import {QrImg} from '../qr'
import {ProofForm} from './Proof'

/* Checkout. Nothing about WHO gets paid is written here: the server looks up the course owner (admin / teacher) and sends
   their own UPI ID, QR image or card payment link. Methods the owner switched off are not shown. */
export const METHODS=[
 {k:'QR',name:'Pay via QR',sub:'Scan with any UPI app',badge:'bg-teal text-white',mark:'QR'},
 {k:'UPI',name:'Pay via UPI app',sub:'PhonePe, GPay, Paytm, BHIM or any UPI app',badge:'bg-[#5f259f] text-white',mark:'UPI'},
 {k:'CARD',name:'Pay via Card',sub:'Debit or credit card',badge:'bg-navy text-white',mark:'💳'}]
export const methodName=k=>METHODS.find(m=>m.k===k)?.name?.replace('Pay via ','')||({COUPON:'Free coupon'}[k])||k
const digits=s=>(s||'').replace(/\D/g,'')
const mmss=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')
const Shell=({title,sub,children})=><div className="mx-auto max-w-3xl"><p className="font-hand text-3xl text-teal">{sub}</p><h1 className="mb-4 text-3xl font-bold text-navy">{title}</h1>{children}</div>

/* Pay by UPI, QR or card to the course owner, then press "I have paid". That only sends the payment for checking.
   The course unlocks when the owner approves it. Nothing on this page marks a payment as paid. */
function PayFlow({id, coupon, method, onBack, planId}) {
  const [ord, setOrd] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [left, setLeft] = useState(0), [sent, setSent] = useState(false), [txn, setTxn] = useState('')
  const txnOk = /^[A-Za-z0-9_-]{6,40}$/.test(txn.trim())
  const endAt = useRef(0)
  const [mailState, setMailState] = useState(null), [mailBusy, setMailBusy] = useState(false)
  const resendLink = async () => { setMailBusy(true); try { const r = (await api.post(`/payments/${ord.reference}/resend-upload-link`)).data; setMailState({sent: r.sent, problem: r.problem}) } catch (x) { setMailState({sent: false, problem: msg(x)}) } finally { setMailBusy(false) } }
  const [proofMode, setProofMode] = useState(null), [proof, setProof] = useState(null), [proofMsg, setProofMsg] = useState(''), [proofBusy, setProofBusy] = useState(false)
  const [link, setLink] = useState(null), [linkLeft, setLinkLeft] = useState(0), baseAt = useRef(null)
  useEffect(() => { if (!ord) return; api.get(`/payments/${ord.reference}`).then(r => setProof(r.data)).catch(() => {}) }, [ord?.reference])
  useEffect(() => { if (!link) return
    const t = setInterval(() => setLinkLeft(Math.max(0, Math.round((new Date(link.expiresAt) - Date.now()) / 1000))), 1000)
    return () => clearInterval(t) }, [link])
  useEffect(() => { if (!link || proofMode !== 'scan' || !ord) return
    const t = setInterval(async () => { try { const r = (await api.get(`/payments/${ord.reference}`)).data
      if (r.proofAt && r.proofAt !== baseAt.current) { setProof(r); setProofMode(null); setLink(null); setProofMsg('Screenshot received from your phone. Press I have paid to send it for verification.') } } catch {} }, 3000)
    return () => clearInterval(t) }, [link, proofMode, ord?.reference])
  const uploadDevice = async file => {
    setProofBusy(true); setProofMsg('')
    try { const fd = new FormData(); fd.append('file', file); const r = (await api.post(`/payments/${ord.reference}/proof`, fd)).data
      setProof(r); setProofMode(null); setProofMsg('Screenshot saved. Press I have paid to send it for verification.') }
    catch (x) { setProofMsg(msg(x)) } finally { setProofBusy(false) }
  }
  const startScan = async () => {
    setProofMsg(''); setProofBusy(true)
    try { const r = (await api.post(`/payments/${ord.reference}/proof-link`)).data
      baseAt.current = proof?.proofAt || null; setLink(r); setLinkLeft(Math.max(0, Math.round((new Date(r.expiresAt) - Date.now()) / 1000))); setProofMode('scan') }
    catch (x) { setProofMsg(msg(x)) } finally { setProofBusy(false) }
  }
  const title = method === 'CARD' ? 'Pay by card' : method === 'UPI' ? 'Pay by UPI app' : 'Pay by QR code'
  const create = async () => { setErr(''); setOrd(null); try { const o = (await api.post(`/courses/${id}/pay-order`, {coupon, method, planId})).data; setOrd(o); setMailState({sent: o.emailSent, problem: o.emailProblem}) } catch (x) { setErr(msg(x)) } }
  useEffect(() => { create() }, [])
  useEffect(() => { if (ord?.status !== 'AWAITING' || ord.secondsLeft == null) return
    endAt.current = Date.now() + ord.secondsLeft * 1000; setLeft(ord.secondsLeft)
    const t = setInterval(() => { const l = Math.max(0, Math.round((endAt.current - Date.now()) / 1000)); setLeft(l); if (l === 0) clearInterval(t) }, 1000)
    return () => clearInterval(t) }, [ord?.reference, ord?.status])
  const sendForCheck = async () => {
    setErr(''); setBusy(true)
    try { await api.post(`/payments/${ord.reference}/submit`, {transactionId: txn.trim()}); setSent(true) }
    catch (x) { setErr(msg(x)); setBusy(false) }
  }
  const cancel = async () => { try { if (ord?.status === 'AWAITING') await api.post(`/payments/${ord.reference}/cancel`) } catch {} onBack() }

  if (!ord && !err) return <Shell title={title} sub="one moment"><div className="box text-center" role="status"><div className="mx-auto my-4 h-12 w-12 animate-spin rounded-full border-4 border-teal/20 border-t-teal"/>Preparing your payment…</div></Shell>
  if (!ord) return <Shell title={title} sub="one moment"><div className="box"><p role="alert" className="font-semibold text-amber-700">{err}</p><div className="mt-3 flex flex-wrap gap-2"><button className="btn2" onClick={create}>Try again</button><button className="btn2" onClick={onBack}>← Choose another method</button></div></div></Shell>
  if (sent || ord.status !== 'AWAITING') return <Navigate to={`/payment/${ord.reference}`}/>

  const urgent = left < 120
  return <Shell title={title} sub="secure payment"><div className="grid gap-5 md:grid-cols-[300px_1fr]">
    <div className="box text-center md:text-left"><p className="text-sm opacity-70">You are paying</p><p className="font-serif text-2xl text-navy">{ord.payTo}</p>
      <p className="mt-2 text-sm opacity-70">For</p><p className="font-semibold">{ord.course}</p>
      <p className="mt-2 text-sm opacity-70">Amount</p><p className="font-serif text-4xl font-bold text-navy">{inr(ord.amount)}</p>
      <p className={`mt-2 text-sm font-semibold ${urgent ? 'text-amber-700' : 'opacity-80'}`} role="timer">{left > 0 ? `Valid for ${mmss(left)}` : 'Time is up. Start again to get a fresh payment.'}</p></div>
    <div className="box grid content-start gap-3">
      <ol className="grid gap-2 text-sm">
        <li>① Pay exactly <b>{inr(ord.amount)}</b> to <b>{ord.payTo}</b>{method === 'CARD' ? ' on the card page below.' : ' using the method below.'}</li>
        <li>② In the payment note or remark, type your reference <span className="font-mono font-semibold">{ord.reference}</span>.</li>
        <li>③ Copy the <b>transaction ID</b> (for UPI, the 12-digit UTR) from your payment app and type it below. Then press <b>I have paid</b>.</li>
      </ol>
      {method === 'QR' && <div className="grid justify-items-center gap-2">
        {ord.qrImage ? <img src={ord.qrImage} alt="Payment QR code" className="h-56 w-56 rounded bg-surface object-contain p-2"/>
          : ord.upiLink ? <QrImg text={ord.upiLink} size={224} label="Payment QR code"/>
          : <p className="text-sm opacity-70">The QR code is not set up yet. Please contact us.</p>}
        <p className="text-xs opacity-70">Scan with any UPI app (GPay, PhonePe, Paytm, BHIM)</p></div>}
      {method === 'UPI' && <div className="grid gap-2">
        {ord.upiLink ? <a className="btn" href={ord.upiLink}>Open UPI app to pay {inr(ord.amount)}</a> : <p className="text-sm">UPI payment is not set up yet. Please contact us.</p>}
        {ord.upiId && <p className="text-sm">Or pay to UPI ID: <span className="font-mono font-semibold">{ord.upiId}</span></p>}</div>}
      {method === 'CARD' && <div className="grid gap-2">
        {ord.cardLink ? <a className="btn" href={ord.cardLink} target="_blank" rel="noopener noreferrer">Open card payment page</a> : <p className="text-sm">Card payment is not set up yet. Please contact us.</p>}
        {ord.cardProvider && <p className="text-xs opacity-70">Card payments via {ord.cardProvider}. Come back here after paying.</p>}</div>}
      {ord.note && <p className="text-sm opacity-80">{ord.note}</p>}
      {mailState && !mailState.sent && <div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><b>We could not email your upload link.</b> {mailState.problem} <button type="button" className="btn2 mt-2 block" disabled={mailBusy} onClick={resendLink}>{mailBusy ? 'Sending…' : 'Send the link again'}</button></div>}
      {mailState && mailState.sent && <p className="text-xs text-green-800">✓ We emailed your upload link to your registered email address.</p>}
      {err && <p role="alert" className="font-semibold text-amber-700">{err}</p>}
      <label className="grid gap-1 text-sm font-semibold" htmlFor="txnid">Transaction ID (UTR)
        <input id="txnid" className="inp font-mono" maxLength={40} autoCapitalize="characters" placeholder="e.g. 412345678901" value={txn} onChange={e => setTxn(e.target.value)} aria-describedby="txnhelp"/></label>
      <p id="txnhelp" className="text-xs opacity-70">Find it in your payment app's history after you pay. It is 6 to 40 letters or digits.</p>
      <div className="grid gap-2 rounded-xl border border-stone-300 p-3">
        <p className="text-sm font-semibold">Payment screenshot (speeds up checking)</p>
        {proof?.hasProof && <p role="status" className="text-sm text-green-800">✓ Screenshot uploaded{proof.proofSource === 'PHONE' ? ' from your phone' : ''}. Status: {proof.status === 'PENDING_VERIFICATION' ? 'pending verification' : 'awaiting payment'}.</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn2" disabled={proofBusy} onClick={() => setProofMode(proofMode === 'device' ? null : 'device')}>⬆ Upload Screenshot</button>
          <button type="button" className="btn2" disabled={proofBusy} onClick={startScan}>📱 Scan to Upload Screenshot</button>
        </div>
        {proofMode === 'device' && <ProofForm onSubmit={uploadDevice} busy={proofBusy} submitLabel="Upload screenshot"/>}
        {proofMode === 'scan' && link && <div className="grid justify-items-center gap-2 text-center">
          {linkLeft > 0 ? <>
            <QrImg text={link.url} size={200} label="Screenshot upload QR code"/>
            <p className="text-xs opacity-80">Scan with your phone camera to upload your payment screenshot. This code is only for uploading proof. It is not a payment code.</p>
            <p className="text-xs opacity-70">Expires in {mmss(linkLeft)}. Waiting for your phone…</p>
            {!link.reachable && <p role="alert" className="text-xs text-amber-700">This site runs on an address your phone cannot open. The site owner needs to set the public address (APP_BASE_URL).</p>}
          </> : <p className="text-sm text-amber-700">This QR code has expired.</p>}
          <button type="button" className="btn2" onClick={startScan}>New QR code</button></div>}
        {proofMsg && <p role="status" aria-live="polite" className="text-sm">{proofMsg}</p>}
        {proof?.hasProof && <Link className="text-sm font-semibold text-teal underline" to={`/payment/${ord.reference}`}>View payment status →</Link>}
      </div>
      <button className="btn w-full" disabled={busy || left === 0 || !proof?.hasProof || (txn.trim() !== '' && !txnOk)} onClick={sendForCheck}>{busy ? 'Sending…' : '✓ I have paid'}</button>
      <p className="text-xs opacity-70">Press this only after you have paid. It sends the payment and transaction ID to the team for checking. It does not unlock the course by itself.</p>
      <div className="flex justify-between text-sm"><button type="button" className="underline" onClick={cancel}>← Cancel and go back</button><span className="opacity-70">Ref <span className="font-mono">{ord.reference}</span></span></div>
    </div></div></Shell>
}

export function Checkout(){
 const {id}=useParams(),{user}=useAuth(),all=useGet('/courses')
 const [sp]=useSearchParams(), planParam=sp.get('plan'), [plan,setPlan]=useState(null)
 useEffect(()=>{ if(!planParam||!user) return
   api.get('/my/plans').then(r=>setPlan((r.data||[]).find(x=>String(x.id)===String(planParam)&&String(x.courseId)===String(id)&&x.status==='PENDING_PAYMENT')||null)).catch(()=>setPlan(null))
 },[planParam,user,id])
 const [opts,setOpts]=useState(null),[optErr,setOptErr]=useState(''),[pick,setPick]=useState(null),[code,setCode]=useState(''),[cp,setCp]=useState(null),[phase,setPhase]=useState('form'),[res,setRes]=useState(null),[mine,setMine]=useState([]),[receipt,setReceipt]=useState(false)
 useEffect(()=>{if(!user)return
  api.get('/my/coupons').then(r=>setMine(r.data)).catch(()=>{})
  api.get(`/courses/${id}/payment-options`).then(r=>setOpts(r.data)).catch(x=>setOptErr(msg(x)))
  // an unpaid / pending payment for this course? go straight back to it
  api.get('/my/payments').then(r=>{const done=r.data.find(p=>String(p.courseId)===String(id)&&p.status==='SUCCESS');if(done){setRes({course:done.courseName,paid:done.amount,txn:done.utr,to:done.ownerName,detail:done.detail,reference:done.reference,method:done.method,message:'',free:false,reviewedAt:done.reviewedAt,at:done.at,revisit:true});setPhase('success');return}const o=r.data.find(p=>String(p.courseId)===String(id)&&['AWAITING','PENDING_VERIFICATION'].includes(p.status));if(o){setPick(['QR','UPI','CARD'].includes(o.method)?o.method:'QR');setPhase('pay')}}).catch(()=>{})},[id])
 if(!user)return <Navigate to="/login"/>
 if(all===null)return <p>Loading…</p>
 const c=all.find(x=>String(x.id)===String(id))
 if(!c)return <div className="box"><p>We could not find that course.</p><Link className="btn mt-2" to="/courses">Browse courses</Link></div>
 const total=plan?plan.fee:(cp?.valid?cp.total:c.price)
 const freeCourse=!plan&&c.price===0   // a course priced at 0 needs no payment at all
  const avail=freeCourse?[]:METHODS.filter(m=>opts?.methods?.[m.k])
 const method=pick&&(phase==='pay'||opts?.methods?.[pick])?pick:avail[0]?.k
 const apply=async c2=>{const cc=typeof c2==='string'?c2:code;try{setCp((await api.get('/coupon',{params:{courseId:id,code:cc}})).data)}catch(x){setCp({valid:false,message:msg(x)})}}
 const free=freeCourse||!!(cp?.valid&&(cp.free||cp.total===0))
 const redeem=async()=>{try{const r=(await api.post(freeCourse?`/courses/${id}/enroll`:`/courses/${id}/redeem`,freeCourse?{}:{coupon:code})).data;setRes({message:r.message||'Welcome to the course!',txn:r.utr,course:r.course||c.name,paid:0,method:'COUPON',detail:r.detail,reference:r.reference,to:r.payTo,free:true});setPhase('success');confetti()}catch(x){setCp({valid:false,message:msg(x)})}}

 if(phase==='pay'&&method&&!free)return <PayFlow key={method} id={id} planId={plan?.id} coupon={plan?'':(cp?.valid?code:'')} method={method} onBack={()=>setPhase('form')} onDone={r=>{setRes({message:r.message,txn:r.utr,course:r.course,paid:r.amount,method:r.method,detail:r.detail+' · ID '+r.utr,reference:r.reference,to:r.payTo});setPhase('success');confetti()}}/>

 if(phase==='success')return <div className="box mx-auto max-w-lg overflow-hidden text-center !p-0">{receipt&&<Receipt p={{courseName:res.course,amount:res.paid,ownerName:res.to,detail:res.detail,method:res.method,utr:res.txn,reference:res.reference,at:res.at,reviewedAt:res.reviewedAt,status:'SUCCESS'}} onClose={()=>setReceipt(false)}/>}
  <div className="bg-gradient-to-br from-teal to-brand2 px-6 pb-8 pt-8 text-white"><div className="flex justify-center"><SuccessMark/></div>
   <h1 className="mt-2 text-3xl font-extrabold text-white">{res.free?'✓ Enrolled for free':res.revisit?'✓ Payment confirmed':'✓ Payment Successful'}</h1><p role="status" className="mt-1 text-white/90">Congratulations! You have successfully enrolled in:</p></div>
  <div className="p-6"><h2 className="text-2xl text-navy">{res.course}</h2>
  <dl className="mx-auto my-4 grid max-w-sm grid-cols-2 gap-x-4 gap-y-1.5 text-left text-sm"><dt className="opacity-70">Amount Paid</dt><dd className="font-bold">{inr(res.paid)}</dd><dt className="opacity-70">Transaction ID</dt><dd className="break-all font-mono">{res.txn||res.reference}</dd><dt className="opacity-70">Paid to</dt><dd>{res.to}</dd><dt className="opacity-70">Method</dt><dd>{res.detail}</dd><dt className="opacity-70">Reference</dt><dd className="font-mono">{res.reference}</dd></dl>
  <p className="text-xs opacity-70">A confirmation email has been sent to your registered email address.</p>
  <div className="mt-4 flex flex-wrap justify-center gap-2"><Link className="btn" to="/dashboard">Go to My Courses</Link><Link className="btn2" to={`/learn/${id}`}>Start learning</Link><button className="btn2" onClick={()=>setReceipt(true)}>🧾 View receipt</button></div></div></div>

 return <><p className="text-sm font-bold uppercase tracking-wider text-teal">One last step</p><h1 className="mb-4 text-3xl font-bold text-navy">Checkout</h1>
  <form onSubmit={e=>{e.preventDefault();if(free)redeem();else if(method)setPhase('pay')}} className="grid gap-5 lg:grid-cols-[1fr_340px]">
   <div className="grid gap-4"><fieldset><legend className="mb-2 font-serif text-xl text-navy">{freeCourse?'Free course':'Choose how to pay'}</legend>
    {freeCourse&&<p className="text-sm">Click <b>Enroll free</b> to join this course. You will not be asked for any payment details.</p>}
     {opts===null&&!optErr&&!freeCourse&&<p role="status">Loading payment options…</p>}
    {optErr&&<p role="alert" className="font-semibold text-amber-700">{optErr}</p>}
    {opts&&!freeCourse&&<p className="mb-3 rounded-lg bg-teal/10 p-3 text-sm">{opts.payTo?<>You are paying <b>{opts.payTo.name}</b> for <b>{c.name}</b>.</>:<>Payments are not set up for this course yet.</>}</p>}
    {opts&&!freeCourse&&avail.length===0&&<div className="box" role="alert"><p className="font-semibold">No payment method is available for this course right now.</p><p className="mt-1 text-sm opacity-70">The instructor has not switched on a payment method yet. Please contact us and we will help you enrol.</p><Link className="btn mt-3" to="/contact">Contact us</Link></div>}
    <div className="grid gap-3 sm:grid-cols-2">{avail.map((m,i)=><Reveal key={m.k} delay={i*60}><label className="paytile box shine flex h-full cursor-pointer items-center gap-3 !p-4"><input type="radio" className="sr-only" name="method" value={m.k} checked={method===m.k} onChange={()=>setPick(m.k)}/>
     <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-bold ${m.badge}`} aria-hidden="true">{m.mark}</span><span><b className="block">{m.name}</b><span className="text-sm opacity-70">{m.sub}</span></span></label></Reveal>)}</div></fieldset>
    {method&&<div key={method} className="box animate-fadeUp text-sm">
     {method==='QR'&&<><p className="font-semibold">Scan a QR code with any UPI app</p><p className="mt-1 opacity-70">Next screen shows {opts.payTo?.name}'s QR code with the exact amount. After paying, send the transaction ID and your course unlocks once it is verified.</p></>}
     {method==='UPI'&&<><p className="font-semibold">Pay with any UPI app</p><p className="mt-1 opacity-70">Next screen shows {opts.payTo?.name}'s UPI ID and buttons to open your app with the amount filled in.</p></>}
     {method==='CARD'&&<><p className="font-semibold">Pay with your debit or credit card</p><p className="mt-1 opacity-70">You will be sent to {opts.cardProvider||'the secure payment page'} to enter your card. We never see or store your card number or CVV.</p></>}</div>}
    {opts?.note&&<p className="text-sm opacity-80">ℹ️ {opts.note}</p>}</div>

   <aside className="order-first lg:order-last"><div className="box lg:sticky lg:top-20"><h2 className="font-serif text-xl text-navy">Order summary</h2>
    <p className="mt-1 font-semibold">{c.name}</p><p className="text-sm opacity-70">{c.teacher} · {c.liveClasses} live classes · {c.notes} notes</p>
    {opts?.payTo&&<p className="mt-1 text-sm">Paid to: <b>{opts.payTo.name}</b></p>}
     {!freeCourse&&<div className="my-3 flex gap-2"><input className="inp" aria-label="Coupon code" placeholder="Coupon code" value={code} onChange={e=>{setCode(e.target.value);setCp(null)}}/><button type="button" className="btn2" onClick={()=>apply()} disabled={!code.trim()}>Apply</button></div>}
    {mine.length>0&&<div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs"><span className="opacity-70">Your coupons:</span>{mine.filter(k=>!k.courseId||String(k.courseId)===String(id)).map(k=><button type="button" key={k.id} className="chip" onClick={()=>{setCode(k.code);apply(k.code)}}>{k.code} · {k.percent>=100?'FREE':k.percent+'% off'}</button>)}</div>}
    <p role="status" className={`text-sm ${cp?.valid?'text-teal':'text-amber-700'}`}>{cp?.message}</p>
    {free&&<p className="mt-1 rounded-lg bg-teal/10 p-2 text-sm">{freeCourse?'This course is free. No payment is needed.':'🎉 100% off. No payment is needed for this course.'}</p>}
    <div className="mt-2 flex justify-between"><span>Price</span><span>{inr(c.price)}</span></div>
    {cp?.valid&&<div className="flex justify-between text-teal"><span>Coupon ({cp.percent}% off)</span><span>− {inr(cp.discount)}</span></div>}
    {plan&&<div className="mt-2 rounded-lg bg-teal/10 p-3 text-sm"><b>Assigned plan</b>: {plan.topics.map(t=>t.title).join(', ')||'selected topics'}<br/>{plan.days?`${plan.days} days from the day your payment is approved`:`${plan.startsOn} to ${plan.endsOn}`}</div>}
    <div className="mt-2 flex justify-between border-t border-stone-300 pt-2 font-serif text-2xl"><span>Total</span><b>{inr(total)}</b></div>
    <button className="btn mt-4 w-full" disabled={!method&&!free}>{free?(freeCourse?'Enroll free':'🎉 Enroll free with coupon'):method==='CARD'?`Continue to card payment · ${inr(total)}`:method==='UPI'?`Show UPI details · ${inr(total)}`:`Show QR to pay ${inr(total)}`}</button>
    <p className="mt-2 text-xs opacity-70">🔒 We never store your card number or CVV. By paying you agree to the course terms.</p>
    <Link className="mt-2 inline-block text-sm underline" to={`/course/${id}`}>← Back to course</Link></div></aside></form></>}
