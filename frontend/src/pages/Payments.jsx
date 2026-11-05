import {useCallback,useEffect,useRef,useState} from 'react'
import {useLocation} from 'react-router-dom'
import api,{msg} from '../api'
import {inr} from './Public'
import {methodName} from './Checkout'
import {QrImg} from '../qr'
import {ProofCell} from './ProofCell'
import {useAuth} from '../App'
import {BackBar,PageHeader} from '../ui'

/* Payments console. Only ADMIN and TEACHER can open this page (route guard + every API call is checked on the server). */
const TONE={NOT_SUBMITTED:'bg-stone-200 text-stone-700',APPROVED:'bg-green-100 text-green-800',COURSE_ACCESS_ACTIVE:'bg-green-100 text-green-800',RESUBMISSION_REQUIRED:'bg-amber-100 text-amber-900',PENDING_VERIFICATION:'bg-violet-100 text-violet-900',SUCCESS:'bg-green-100 text-green-800',PENDING:'bg-amber-100 text-amber-900',AWAITING:'bg-sky-100 text-sky-800',REJECTED:'bg-red-100 text-red-800',FAILED:'bg-red-100 text-red-800',CANCELLED:'bg-stone-200 text-stone-700',EXPIRED:'bg-stone-200 text-stone-700',REFUNDED:'bg-violet-100 text-violet-800'}
/* the four statuses staff see: Pending, Successful, Failed, Cancelled */
const LABEL={NOT_SUBMITTED:'Not submitted',PENDING_VERIFICATION:'Submitted – awaiting approval',APPROVED:'Approved',COURSE_ACCESS_ACTIVE:'Approved – course access active',REJECTED:'Rejected',RESUBMISSION_REQUIRED:'Resubmission required',SUCCESS:'Successful',PENDING:'Confirming',AWAITING:'Pending',FAILED:'Failed',CANCELLED:'Cancelled',EXPIRED:'Expired',REFUNDED:'Refunded'}
const SUB={PENDING_VERIFICATION:'waiting for your approval',AWAITING:'awaiting payment',SUCCESS:'verified automatically',FAILED:'not completed',EXPIRED:'window closed'}
const TABS=[['PENDING_VERIFICATION','Needs approval'],['ALL','All'],['SUCCESS','Successful'],['FAILED','Failed'],['CANCELLED','Cancelled'],['AWAITING','Awaiting payment']]
const ago=t=>{if(!t)return '';const m=Math.max(0,Math.round((Date.now()-new Date(t))/60000));return m<1?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':Math.round(m/1440)+' d ago'}

export function Payments(){
 const {user}=useAuth()
 const [sum,setSum]=useState(null),[rows,setRows]=useState(null),[tab,setTab]=useState('PENDING_VERIFICATION'),[q,setQ]=useState(''),[note,setNote]=useState(''),[rej,setRej]=useState(null),[why,setWhy]=useState(''),[busy,setBusy]=useState(null),[seen,setSeen]=useState(0),[upd,setUpd]=useState(null)
 const prev=useRef(null),[from,setFrom]=useState(''),[to,setTo]=useState(''),[cid,setCid]=useState(''),[cl,setCl]=useState([])
 useEffect(()=>{api.get('/catalog').then(r=>setCl(Array.isArray(r.data)?r.data:[])).catch(()=>{})},[])
 const load=useCallback(async()=>{
  try{const [a,b]=await Promise.all([api.get('/staff/payments/summary'),api.get('/staff/payments',{params:{status:tab,q,from:from||undefined,to:to||undefined,courseId:cid||undefined}})]);setSum(a.data);setRows(b.data);setUpd(new Date())
   if(prev.current!==null&&a.data.pending>prev.current)setSeen(a.data.pending-prev.current);prev.current=a.data.pending}catch(e){setNote(msg(e))}},[tab,q,from,to,cid])
 useEffect(()=>{const t=setTimeout(load,q?250:0);return()=>clearTimeout(t)},[load])
 useEffect(()=>{const t=setInterval(load,15000);return()=>clearInterval(t)},[load]) // live refresh
 useEffect(()=>{const old=document.title;if(sum?.pending>0)document.title=`(${sum.pending}) Payments · NLMed Study`;return()=>{document.title=old}},[sum?.pending])
 const flash=(m,ms=4500)=>{setNote(m);setTimeout(()=>setNote(''),ms)}
 const decide=async(p,act)=>{
   if(act==='approve'&&!confirm(`Approve ${inr(p.amount)} from ${p.userName} for ${p.courseName}?\n\nOnly approve if this money has reached your account. The student is enrolled and emailed straight away.`))return
   setBusy(p.reference)
   try{await api.post(`/staff/payments/${p.reference}/${act}`,act==='reject'?{reason:why.trim()}:{})
     flash(act==='approve'?`Approved. ${p.userName} is enrolled and has been emailed.`:`Rejected. ${p.userName} has been emailed the reason.`)
     setRej(null);setWhy('');load()}
   catch(e){flash(msg(e),6000)}finally{setBusy(null)}}
 const viewProof=async p=>{
   const w=window.open('','_blank')   // opened now, so the browser does not block it
   try{ const r=await api.get(`/staff/payments/${p.reference}/proof`,{responseType:'blob'}); const u=URL.createObjectURL(r.data)
     if(w) w.location.href=u; else window.open(u,'_blank'); setTimeout(()=>URL.revokeObjectURL(u),120000) }
   catch(e){ if(w) w.close(); flash(msg(e),true) } }
 const exportCsv=async()=>{try{const r=await api.get('/staff/payments/export',{responseType:'blob'});const a=document.createElement('a');a.href=URL.createObjectURL(r.data);a.download=`payments-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href)}catch(e){flash(msg(e))}}

 const cards=[['Needs approval',sum?.needsApproval,sum?.needsApproval>0,sum?.needsApproval>0?'waiting for your decision':'none waiting'],['Today',inr(sum?.today||0)],['This month',inr(sum?.month||0)],['All time',inr(sum?.total||0),false,`${sum?.success||0} paid`]]
 return <><PageHeader eyebrow="Money matters" title="Payment Received"/>
  <p className="mb-3 text-sm opacity-70">{sum?.scope==='all'?'Admin view: payments to every teacher and admin account. ':'Payments made to your own account only. '}{upd&&<>Updated {upd.toLocaleTimeString()} · refreshes every 15 s.</>}</p>
  <p role="status" aria-live="polite" className={`${note?'':'hidden'} fixed bottom-20 left-4 z-30 max-w-sm animate-fadeUp rounded-lg bg-navy px-4 py-2 text-white shadow-lg`}>{note}</p>
  {seen>0&&<button className="mb-3 w-full rounded-lg bg-amber-100 p-2 text-amber-900" onClick={()=>{setSeen(0);setTab('PENDING_VERIFICATION')}}>🔔 {seen} new payment{seen>1?'s':''} to review. Tap to open.</button>}
  <div className="my-4 grid grid-cols-2 gap-3 md:grid-cols-4">{cards.map(([k,v,hot,sub],i)=><div key={k} style={{animationDelay:i*70+'ms'}} className={`box animate-fadeUp ${hot?'ring-2 ring-amber-400':''}`}><div className="text-sm">{k}</div><div className="font-serif text-3xl">{v??'…'}</div>{sub&&<div className="text-xs opacity-70">{sub}</div>}</div>)}</div>

  <div className="mb-2 flex flex-wrap items-center gap-2"><div role="tablist" aria-label="Filter payments" className="flex flex-wrap gap-1">{TABS.map(([k,l])=><button key={k} role="tab" aria-selected={tab===k} onClick={()=>setTab(k)} className={`btn2 !min-h-0 !py-1.5 ${tab===k?'bg-teal/15':''}`}>{l}{k==='PENDING_VERIFICATION'&&sum?.needsApproval>0&&<span className="ml-1 rounded-full bg-violet-600 px-2 text-xs text-white">{sum.needsApproval}</span>}{k==='PENDING'&&sum?.pending>0&&<span className="ml-1 rounded-full bg-amber-500 px-2 text-xs text-white">{sum.pending}</span>}</button>)}</div>
   <input className="inp ml-auto max-w-[230px]" type="search" aria-label="Search payments" placeholder="Search name, course, ref, transaction ID" value={q} onChange={e=>setQ(e.target.value)}/><button className="btn2" onClick={exportCsv}>⬇ Export CSV</button></div>

  <div className="box mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr_auto]" role="group" aria-label="Date and course filters"><label className="grid gap-1 text-xs font-semibold">From<input type="date" className="inp" value={from} max={to||undefined} onChange={e=>setFrom(e.target.value)}/></label><label className="grid gap-1 text-xs font-semibold">To<input type="date" className="inp" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)}/></label>
   <label className="grid gap-1 text-xs font-semibold">Course<select className="inp" value={cid} onChange={e=>setCid(e.target.value)}><option value="">All courses</option>{cl.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <button type="button" className="btn2 self-end" disabled={!from&&!to&&!cid} onClick={()=>{setFrom('');setTo('');setCid('')}}>Clear filters</button></div>
  <div className="box overflow-x-auto">{rows===null?<p>Loading…</p>:rows.length===0?<p className="py-4 text-center">{tab==='PENDING_VERIFICATION'?'Nothing waiting for your approval. 🎉':'No payments match.'}</p>:
   <table className="w-full min-w-[860px] text-left text-sm"><thead><tr><th className="py-1 pr-3">Date</th><th className="pr-3">Student</th><th className="pr-3">Course / Class</th><th className="pr-3">Method</th><th className="pr-3">Amount</th><th className="pr-3">Transaction ID</th><th className="pr-3">Status</th><th>Action</th></tr></thead>
   <tbody>{rows.map(p=><tr key={p.id} className="border-t border-stone-300/60 align-top"><td className="py-2 pr-3 whitespace-nowrap">{new Date(p.submittedAt||p.at).toLocaleDateString()}<div className="text-xs opacity-60">{new Date(p.submittedAt||p.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} · {ago(p.submittedAt||p.at)}</div></td>
    <td className="pr-3">{p.userName}<div className="text-xs opacity-60">{p.userEmail}</div></td><td className="pr-3">{p.courseName}{p.planTopics&&<div className="text-xs font-semibold text-teal">Plan: {p.planTopics} · {p.planDates}</div>}{p.ownerName&&<div className="text-xs opacity-60">paid to {p.ownerName}</div>}</td><td className="pr-3">{methodName(p.method)}<div className="text-xs opacity-60">{p.detail}</div></td>
    <td className="pr-3 font-semibold">{inr(p.amount)}</td><td className="pr-3">{p.utr?<span className="font-mono text-xs font-semibold">{p.utr}</span>:<span className="text-xs font-semibold text-amber-700">not entered</span>}<div className="font-mono text-[10px] opacity-60">ref {p.reference}</div><ProofCell p={p} staff/>{p.hasProof&&<button type="button" className="mt-1 block text-xs font-semibold text-teal underline" onClick={()=>viewProof(p)}>View screenshot</button>}</td>
    <td className="pr-3"><span className={`whitespace-nowrap rounded-full px-2 ${TONE[p.displayStatus||p.status]||''}`}>{LABEL[p.displayStatus||p.status]||p.status}</span>{SUB[p.status]&&<div className="text-xs opacity-60">{SUB[p.status]}</div>}{p.reviewedBy&&<div className="text-xs opacity-60">by {p.reviewedBy}</div>}{p.rejectReason&&<div className="max-w-[160px] text-xs opacity-70">“{p.rejectReason}”</div>}</td>
    <td>{p.status==='PENDING_VERIFICATION'?<ApprovalActions p={p} busy={busy} rej={rej} why={why} setRej={setRej} setWhy={setWhy} decide={decide}/>:p.status==='SUCCESS'?<span className="text-xs text-green-800">✓ Approved</span>:p.status==='PENDING'?<span className="text-xs opacity-70">Waiting for you</span>:p.status==='AWAITING'?<span className="text-xs opacity-60">Student has not paid yet</span>:p.status==='FAILED'?<span className="text-xs opacity-60">{p.rejectReason||'Not completed'}</span>:<span className="opacity-40">—</span>}</td></tr>)}</tbody></table>}</div>
  <Settings flash={flash}/></>}

function ApprovalActions({p,busy,rej,why,setRej,setWhy,decide}){
 const open=rej===p.reference, mine=busy===p.reference
 return <div className="grid w-44 gap-1.5">
  <button type="button" className="btn !min-h-[34px] !px-3 !py-1 text-sm" disabled={mine} onClick={()=>decide(p,'approve')}>✓ Approve</button>
  {open?<><label htmlFor={'why'+p.id} className="text-xs font-semibold">Reason the student will see</label>
    <input id={'why'+p.id} className="inp !py-1 text-sm" maxLength={300} placeholder="e.g. amount did not match" value={why} onChange={e=>setWhy(e.target.value)}/>
    <div className="flex gap-1"><button type="button" className="btn2 !min-h-[32px] !px-2 text-xs" disabled={mine||why.trim().length<5} onClick={()=>decide(p,'reject')}>Confirm reject</button>
      <button type="button" className="btn2 !min-h-[32px] !px-2 text-xs" onClick={()=>{setRej(null);setWhy('')}}>Cancel</button></div></>
  :<button type="button" className="btn2 !min-h-[34px] !px-3 !py-1 text-sm" disabled={mine} onClick={()=>{setRej(p.reference);setWhy('')}}>Reject</button>}
 </div>}
const Toggle=({on,set,label})=><label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" role="switch" className="h-5 w-5 accent-teal" checked={!!on} onChange={e=>set(e.target.checked)}/>{label}</label>
const Live=({ok})=><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ok?'bg-green-100 text-green-800':'bg-stone-200 text-stone-700'}`}>{ok?'Visible to students':'Hidden (off or incomplete)'}</span>
/* Payment settings: each admin / teacher edits THEIR OWN account. Students buying one of your courses see exactly this. */
function Settings({flash}){
 const {user}=useAuth()
 const [f,setF]=useState(null),[busy,setBusy]=useState(false),loc=useLocation()
 useEffect(()=>{if(f&&loc.hash==='#settings')setTimeout(()=>document.getElementById('settings')?.scrollIntoView({behavior:'smooth'}),150)},[f,loc.hash])
 const load=()=>api.get('/staff/payment-settings').then(r=>setF(r.data)).catch(e=>flash(msg(e)))
 useEffect(()=>{load()},[])
 if(!f)return null
 const set=(k,v)=>setF(x=>({...x,[k]:v}))
 const save=async e=>{e.preventDefault();setBusy(true)
  try{const r=await api.put('/staff/payment-settings',{windowMinutes:Number(f.windowMinutes)||60,payee:f.payee,instructions:f.instructions,bankDetails:f.bankDetails,upiId:f.upiId,qrEnabled:f.qrEnabled,upiEnabled:f.upiEnabled,cardEnabled:f.cardEnabled,cardProvider:f.cardProvider,cardLink:f.cardLink,mobile:f.mobile||''});setF(r.data);flash('Payment settings saved. Students see the new details right away.')}catch(x){flash(msg(x),8000)}setBusy(false)}
 const pick=e=>{const file=e.target.files[0];if(!file)return;if(file.size>300*1024){flash('Image is too large. Keep it under 300 KB.',6000);e.target.value='';return}
  const r=new FileReader();r.onload=async()=>{try{await api.put('/staff/payment-qr',{dataUrl:r.result});flash('QR image saved.');load()}catch(x){flash(msg(x),8000)}};r.readAsDataURL(file);e.target.value=''}
 const drop=async()=>{if(!confirm('Remove the uploaded QR image?'))return;try{await api.delete('/staff/payment-qr');load()}catch(x){flash(msg(x))}}
 const link=f.upiId?`upi://pay?pa=${encodeURIComponent(f.upiId)}&pn=${encodeURIComponent(f.payee||f.owner||'NLMed Study')}&am=1.00&cu=INR&tn=Test`:''
 const av=f.available||{}
 return <><h2 id="settings" className="mt-8 scroll-mt-24 text-2xl text-navy">Payment Settings</h2>
  <p className="mb-2 text-sm opacity-70">Money for your courses goes to the details below ({f.owner}). Switch a method off to hide it from students. {f.role==='ADMIN'&&'Admin: courses are paid to the account of their owner; set owners under Admin > Course owners.'}</p>
  <form onSubmit={save} className="box grid gap-6">
   <div className="grid gap-3 md:grid-cols-2"><div><label htmlFor="pn">Name shown to students and in the UPI app</label><input id="pn" className="inp" maxLength={60} placeholder={f.owner} value={f.payee} onChange={e=>set('payee',e.target.value)}/></div>
    <div><label htmlFor="pw">Payment time limit (minutes)</label><input id="pw" type="number" min={15} max={360} step={1} className="inp" value={f.windowMinutes??60} onChange={e=>set('windowMinutes',e.target.value)} aria-describedby="pw-h"/><p id="pw-h" className="mt-1 text-xs opacity-70">How long a student has to pay after starting checkout (15–360 minutes). Default 60.</p></div><div><label htmlFor="pi">Note for students (optional)</label><input id="pi" className="inp" maxLength={300} placeholder="e.g. Approval takes 10–30 min, 9 AM–7 PM" value={f.instructions} onChange={e=>set('instructions',e.target.value)}/></div></div>

   <section className="grid gap-3 rounded-xl border border-stone-300 p-4 md:grid-cols-[1fr_220px]" aria-label="QR payment"><div className="grid content-start gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><Toggle on={f.qrEnabled} set={v=>set('qrEnabled',v)} label="Pay via QR"/><Live ok={av.QR&&f.qrEnabled}/></div>
    <p className="text-xs opacity-70">Students get a QR built from your UPI ID with the exact amount filled in. You can also upload your own QR (for example, your bank's QR); students can switch to it.</p>
    <div className="flex flex-wrap gap-2"><label className="btn2 cursor-pointer">{f.qrImage?'Replace QR image':'Upload QR image'}<input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={pick}/></label>{f.qrImage&&<button type="button" className="btn2" onClick={drop}>Remove image</button>}</div>
    <p className="text-xs opacity-70">PNG, JPG or WEBP, under 300 KB.</p></div>
    <div className="text-center">{f.qrImage?<><img src={f.qrImage} alt="Your uploaded payment QR" className="mx-auto h-40 w-40 rounded bg-surface object-contain p-1"/><p className="text-xs opacity-70">Your uploaded QR</p></>:link?<><QrImg text={link} size={150} label="Test UPI QR"/><p className="text-xs opacity-70">Preview (₹1). Scan with your own UPI app to check the payee name.</p></>:<p className="grid h-[150px] place-items-center rounded-xl border border-dashed border-stone-400 text-sm opacity-70">Add a UPI ID or upload a QR</p>}</div></section>

   <section className="grid gap-3 rounded-xl border border-stone-300 p-4" aria-label="UPI payment">
    <div className="flex flex-wrap items-center justify-between gap-2"><Toggle on={f.upiEnabled} set={v=>set('upiEnabled',v)} label="Pay via UPI"/><Live ok={av.UPI&&f.upiEnabled}/></div>
    <div className="grid gap-3 md:grid-cols-2"><div><label htmlFor="upi">UPI ID (where money arrives)</label><input id="upi" className="inp" placeholder="institute@okaxis" autoCapitalize="none" value={f.upiId} onChange={e=>set('upiId',e.target.value.trim())}/><p className="text-xs opacity-70">Also powers the QR and the “Open UPI app” buttons.</p></div></div>
    <div><label htmlFor="bank">Bank details (optional, shown to students)</label><textarea id="bank" rows={2} maxLength={400} className="inp" placeholder="Account name, bank, account number, IFSC" value={f.bankDetails} onChange={e=>set('bankDetails',e.target.value)}/></div></section>

   <section className="grid gap-3 rounded-xl border border-stone-300 p-4" aria-label="Card payment">
    <div className="flex flex-wrap items-center justify-between gap-2"><Toggle on={f.cardEnabled} set={v=>set('cardEnabled',v)} label="Pay via Card"/><Live ok={av.CARD&&f.cardEnabled}/></div>
    <div className="grid gap-3 md:grid-cols-[200px_1fr]"><div><label htmlFor="cprov">Card provider name (shown to students)</label><input id="cprov" className="inp" maxLength={40} placeholder="e.g. Razorpay" value={f.cardProvider} onChange={e=>set('cardProvider',e.target.value)}/></div>
     <div><label htmlFor="clink">Card payment link (https)</label><input id="clink" className="inp" type="url" placeholder="https://rzp.io/l/your-page" autoCapitalize="none" value={f.cardLink} onChange={e=>set('cardLink',e.target.value.trim())}/></div></div>
    <p className="text-xs opacity-70">You check card payments yourself and approve them under Payments. Students see the name and time limit set here while they pay.</p></section>

   <section className="grid gap-3 rounded-xl border border-stone-300 p-4" aria-label="Approval alerts"><p className="text-sm">Every payment is checked by you before the course unlocks. When a student presses “I have paid”, you get an email and an SMS. Check your UPI or card account for the amount and reference, then approve or reject it under Payments.</p><div className="max-w-xs"><label htmlFor="mob">Mobile number for SMS alerts</label><input id="mob" className="inp" inputMode="numeric" maxLength={14} placeholder="10-digit mobile number" value={f.mobile||''} onChange={e=>set('mobile',e.target.value)}/><p className="mt-1 text-xs opacity-70">Used only for payment alerts. Leave empty to get email only.</p></div></section>
   <button className="btn w-fit" disabled={busy}>{busy?'Saving…':'Save payment settings'}</button></form><BackBar to={user?.role==="ADMIN"?"/admin":"/teacher"} label="Back"/></>}
