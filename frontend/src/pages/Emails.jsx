import {useEffect,useMemo,useRef,useState} from 'react'
import api,{msg} from '../api'
import {useAuth} from '../App'

/* Emails for admins and teachers.
   Write: choose a recipient and an email type, edit the message in the editor (what you see is what is sent), and check the live preview.
   Placeholders such as {{studentName}} are filled from records or typed in. A detail the system cannot fill is asked for in the form.
   Admins can save the current message as a new email type, and delete saved types. */

const FILTERS=[['ALL','All'],['SENT','Sent'],['FAILED','Failed']]
const LABELS={studentName:'Recipient name',courseName:'Course name',courseLink:'Course link',amount:'Amount (Rs)',transactionId:'Transaction ID',
  reference:'Payment reference',paymentStatus:'Payment status',rejectReason:'Rejection reason',courseStartDate:'Course start date',teacherName:'Teacher name',
  siteUrl:'Site address',recipientName:'Recipient name',examTitle:'Exam title',examScore:'Exam score',classTitle:'Live class title',classStart:'Class date and time',
  couponCode:'Coupon code',meetingLink:'Meeting link',registrationDate:'Registration date',resetLink:'Reset link',announcement:'Announcement text',
  studentEmail:'Recipient email',platformName:'Platform name'}
const KNOWN=Object.keys(LABELS)
const phKeys=t=>[...new Set([...(t||'').matchAll(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g)].map(m=>m[1]))]
const initials=n=>(n||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()
const money=n=>'Rs '+n
const fmtDate=v=>v?new Date(v+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}):''

/* A small WYSIWYG toolbar. It uses the browser's own editing commands, so the text you see is the text that is sent. */
function Toolbar({exec,onInsert,onLink}){
  const b='rounded-lg border border-slate-300 bg-surface px-2.5 py-1 text-sm hover:bg-teal/10 dark:bg-white/5 dark:text-inherit'
  return <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Formatting">
    <button type="button" className={b+' font-bold'} onMouseDown={e=>e.preventDefault()} onClick={()=>exec('bold')} title="Bold">B</button>
    <button type="button" className={b+' italic'} onMouseDown={e=>e.preventDefault()} onClick={()=>exec('italic')} title="Italic">I</button>
    <button type="button" className={b+' underline'} onMouseDown={e=>e.preventDefault()} onClick={()=>exec('underline')} title="Underline">U</button>
    <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true"/>
    <button type="button" className={b+' font-bold'} onMouseDown={e=>e.preventDefault()} onClick={()=>exec('formatBlock','h2')} title="Heading">Heading</button>
    <button type="button" className={b} onMouseDown={e=>e.preventDefault()} onClick={()=>exec('insertUnorderedList')} title="Bullet list">• List</button>
    <button type="button" className={b} onMouseDown={e=>e.preventDefault()} onClick={()=>exec('insertOrderedList')} title="Numbered list">1. List</button>
    <button type="button" className={b} onMouseDown={e=>e.preventDefault()} onClick={onLink} title="Add a link">Link</button>
    <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true"/>
    <button type="button" className={b} onMouseDown={e=>e.preventDefault()} onClick={()=>exec('undo')} title="Undo">Undo</button>
    <button type="button" className={b} onMouseDown={e=>e.preventDefault()} onClick={()=>exec('removeFormat')} title="Clear formatting">Clear</button>
    <select aria-label="Insert a detail" className="ml-auto rounded-lg border border-slate-300 bg-surface px-2 py-1 text-sm dark:bg-white/5" value="" onChange={e=>{ if(e.target.value) onInsert(e.target.value) }}>
      <option value="">Insert a detail…</option>
      {KNOWN.map(k=><option key={k} value={k}>{LABELS[k]}</option>)}
    </select>
  </div>
}

function CustomEmail({sender,isAdmin}){
  const [people,setPeople]=useState([]), [templates,setTemplates]=useState([]), [courses,setCourses]=useState([])
  const [email,setEmail]=useState(''), [student,setStudent]=useState(null), [tkey,setTkey]=useState('CUSTOM')
  const [courseId,setCourseId]=useState(''), [subject,setSubject]=useState(''), [body,setBody]=useState(''), [pid,setPid]=useState(''), [typed,setTyped]=useState({})
  const [preview,setPreview]=useState(null), [updating,setUpdating]=useState(false), [note,setNote]=useState(null), [sending,setSending]=useState(false)
  const [saveOpen,setSaveOpen]=useState(false), [saveLabel,setSaveLabel]=useState(''), [saveAudience,setSaveAudience]=useState('ALL'), [saveNeedsPay,setSaveNeedsPay]=useState(false)
  const [ver,setVer]=useState(0)
  const ed=useRef(null)

  const loadTemplates=()=>api.get('/staff/email-templates').then(r=>setTemplates(r.data||[])).catch(()=>{})
  useEffect(()=>{
    api.get('/staff/email-recipients').then(r=>setPeople(r.data||[])).catch(()=>{})
    api.get('/staff/email-courses').then(r=>setCourses(r.data||[])).catch(()=>{})
    loadTemplates().then(()=>{})
  },[])
  // the first type loads once the list arrives
  useEffect(()=>{ const c=templates.find(t=>t.key==='CUSTOM'); if(c&&!body){ setSubject(c.subject); setBody(c.body); setVer(v=>v+1) } },[templates])
  // the editor shows the chosen message; typing does not reset it
  useEffect(()=>{ if(ed.current&&ed.current.innerHTML!==body) ed.current.innerHTML=body },[ver])

  useEffect(()=>{
    const addr=email.trim(); setPid('')
    if(!addr){ setStudent(null); return }
    const hit=people.find(p=>p.email.toLowerCase()===addr.toLowerCase())
    if(!hit){ setStudent({registered:false,email:addr}); return }
    api.get('/staff/email-student',{params:{email:hit.email}})
      .then(r=>{ setStudent({...r.data,registered:true}); setPid(r.data.payments&&r.data.payments[0]?String(r.data.payments[0].id):'') })
      .catch(x=>{ setStudent(null); setNote({ok:false,text:msg(x)}) })
  },[email,people])
  useEffect(()=>{ const p=student&&student.payments?student.payments.find(x=>String(x.id)===pid):null; if(p) setCourseId(String(p.courseId)) },[pid])

  const pickTemplate=k=>{
    setTkey(k); const t=templates.find(x=>x.key===k)
    if(t){ setSubject(t.subject); setBody(t.body); setVer(v=>v+1) }
    setNote(null)
  }
  const current=templates.find(t=>t.key===tkey)
  const isSaved=!!current&&!current.builtIn

  const used=useMemo(()=>[...new Set([...phKeys(subject),...phKeys(body)])],[subject,body])
  const unknown=used.filter(k=>!KNOWN.includes(k))
  const addrOk=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
  const external=!!(student&&student.registered===false)

  // the live preview updates shortly after the sender stops typing
  useEffect(()=>{
    if(!addrOk||!subject.trim()||!body.trim()){ setPreview(null); return }
    setUpdating(true)
    const t=setTimeout(()=>{
      api.post('/staff/email-preview',{studentEmail:email.trim(),template:tkey,subject:subject.trim(),message:body,paymentId:pid||undefined,courseId:courseId||undefined,vars:typed})
        .then(r=>{ setPreview(r.data); setNote(null) })
        .catch(x=>{ setPreview(null); setNote({ok:false,text:msg(x)}) })
        .finally(()=>setUpdating(false))
    },450)
    return()=>clearTimeout(t)
  },[email,tkey,subject,body,pid,courseId,typed,addrOk])

  const filled=preview?.filled||{}
  const missing=preview?.missing||[]
  const fields=used.filter(k=>KNOWN.includes(k)&&!(k==='recipientName'&&!external))
  const canSend=addrOk&&!!preview&&missing.length===0&&unknown.length===0&&!updating&&!sending

  const exec=(cmd,val)=>{ if(!ed.current) return; ed.current.focus(); document.execCommand(cmd,false,val); setBody(ed.current.innerHTML) }
  const onLink=()=>{ const u=window.prompt('Link address (starts with https://)','https://'); if(u&&/^https?:\/\/|^mailto:/.test(u)) exec('createLink',u) }
  const onInsert=k=>exec('insertText','{{'+k+'}}')

  const send=async()=>{
    if(!window.confirm(`Send this email to ${email.trim()}?`)) return
    setSending(true); setNote(null)
    try{
      const r=(await api.post('/staff/send-email',{studentEmail:email.trim(),template:tkey,subject:subject.trim(),message:body,paymentId:pid||undefined,courseId:courseId||undefined,vars:typed})).data
      setNote(r.sent?{ok:true,text:'Sent. It is now in the history below.'}:{ok:false,text:'Not sent: '+r.problem})
    }catch(x){ setNote({ok:false,text:msg(x)}) }
    finally{ setSending(false) }
  }

  // admins: save the message as an email type, or update or delete a saved one
  const saveType=async(asNew)=>{
    setNote(null)
    const payload={label:(asNew?saveLabel:current.label).trim(),audience:asNew?saveAudience:current.audience,needsPayment:asNew?saveNeedsPay:current.needsPayment,
      subject:subject.trim(),heading:asNew?(saveLabel.trim()||subject.trim()):current.heading,body}
    if(!asNew) payload.id=tkey.slice(1)
    try{
      const r=(await api.post('/admin/email-templates',payload)).data
      await loadTemplates(); setTkey(r.key); setSaveOpen(false); setSaveLabel('')
      setNote({ok:true,text:asNew?'Saved as a new email type. Everyone who can use it will see it in the list.':'Email type updated.'})
    }catch(x){ setNote({ok:false,text:msg(x)}) }
  }
  const deleteType=async()=>{
    if(!window.confirm(`Delete the email type "${current.label}"? Emails already sent are not affected.`)) return
    try{ await api.delete('/admin/email-templates/'+tkey.slice(1)); await loadTemplates(); pickTemplate('CUSTOM'); setNote({ok:true,text:'Email type deleted.'}) }
    catch(x){ setNote({ok:false,text:msg(x)}) }
  }

  const cardCls=k=>k===tkey?'border-teal bg-teal/10 ring-2 ring-teal/30':'border-slate-200 bg-surface hover:border-teal/50 dark:bg-white/5'

  return <section aria-labelledby="custom-h" className="box grid gap-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="custom-h" className="font-serif text-2xl text-navy">Send a custom email</h2>
        <p className="mt-1 text-sm opacity-75">Choose who gets it and what it says. The preview shows exactly what they will receive.</p></div>
      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-900 dark:bg-white/10 dark:text-indigo-100">Sent as {sender} via NLMed Study</span>
    </div>

    <div className="grid gap-2">
      <label htmlFor="ce-to" className="text-sm font-semibold">1 · Recipient</label>
      <input id="ce-to" type="email" list="ce-people" className="inp" placeholder="Type any email address…" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="off"/>
      <datalist id="ce-people">{people.map(p=><option key={p.id} value={p.email}>{p.name} · {p.role}</option>)}</datalist>
      {email.trim()&&student&&<div className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm ${student.registered?'bg-green-50 text-green-900':'bg-amber-50 text-amber-900'}`}>
        {student.registered
          ? <><span className="grid h-7 w-7 place-items-center rounded-full bg-green-600 text-xs font-bold text-white">{initials(student.name)}</span>
              <span><b>{student.name}</b> · {student.role?.toLowerCase()} · {student.courses.length} course{student.courses.length===1?'':'s'} · {student.payments.length} payment{student.payments.length===1?'':'s'}</span></>
          : <span>No account uses this address. Its details are typed in below.</span>}
      </div>}
      {email.trim()&&!addrOk&&<p className="text-xs text-rose-700">Enter a complete email address, for example name@example.com</p>}
    </div>

    <div className="grid gap-2">
      <span className="text-sm font-semibold">2 · Email type</span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="Email type">
        {templates.map(t=><button key={t.key} type="button" role="radio" aria-checked={t.key===tkey} onClick={()=>pickTemplate(t.key)}
          className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${cardCls(t.key)}`}>
          <span className="block font-semibold">{t.label}</span>
          <span className="text-xs opacity-60">{t.builtIn?'Built in':'Saved by an admin'}{t.needsPayment?' · uses payment details':''}</span>
        </button>)}
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-1">
        <label htmlFor="ce-course" className="text-sm font-semibold">Course</label>
        <select id="ce-course" className="inp" value={courseId} onChange={e=>setCourseId(e.target.value)}>
          <option value="">{student&&student.registered?'Use the course from the payment or enrolment':'Choose a course (optional)'}</option>
          {courses.map(c=><option key={c.id} value={c.id}>{c.name} · {money(c.price)}</option>)}
        </select>
      </div>
      {student&&student.registered&&student.payments.length>0&&<div className="grid gap-1">
        <label htmlFor="ce-pay" className="text-sm font-semibold">Payment record (fills amount, transaction ID and status)</label>
        <select id="ce-pay" className="inp" value={pid} onChange={e=>setPid(e.target.value)}>
          <option value="">No payment</option>
          {student.payments.map(p=><option key={p.id} value={p.id}>{p.courseName} · {money(p.amount)} · {p.status} · {p.reference}{p.at?' · '+p.at:''}</option>)}
        </select>
      </div>}
    </div>

    {fields.length>0&&<div className="grid gap-3">
      <span className="text-sm font-semibold">Details</span>
      <div className="grid gap-3 md:grid-cols-2">
        {fields.map(k=>{
          const auto=filled[k]!==undefined&&filled[k]!==null&&filled[k]!==''
          const value=typed[k]!==undefined?typed[k]:(auto?filled[k]:'')
          const have=auto||typed[k]
          return <div key={k} className={`rounded-xl border p-3 ${have?'border-green-300 bg-green-50/60 dark:bg-green-900/10':'border-amber-300 bg-amber-50/70 dark:bg-amber-900/10'}`}>
            <label htmlFor={'ce-v-'+k} className="flex items-center justify-between text-xs font-semibold">
              <span>{LABELS[k]||k}</span>
              <span className={have?'text-green-800':'text-amber-800'}>{typed[k]!==undefined?'entered':auto?'from records':'needed'}</span></label>
            {k==='courseStartDate'
              ? <input id={'ce-v-'+k} type="date" className="inp mt-1" value={typed.courseStartDateISO||''} onChange={e=>setTyped(t=>({...t,courseStartDateISO:e.target.value,[k]:fmtDate(e.target.value)}))}/>
              : k==='registrationDate'&&auto&&typed[k]===undefined
                ? <input id={'ce-v-'+k} className="inp mt-1" value={value} onChange={e=>setTyped(t=>({...t,[k]:e.target.value}))}/>
                : k==='paymentStatus'&&!pid
                  ? <select id={'ce-v-'+k} className="inp mt-1" value={typed[k]||''} onChange={e=>setTyped(t=>({...t,[k]:e.target.value}))}>
                      <option value="">Choose…</option><option value="Pending verification">Pending verification</option><option value="Rejected">Rejected</option></select>
                  : <input id={'ce-v-'+k} className="inp mt-1" value={value} readOnly={k==='paymentStatus'&&!!pid} placeholder={auto?'':'Type here'} onChange={e=>setTyped(t=>({...t,[k]:e.target.value}))}/>}
          </div>
        })}
      </div>
    </div>}

    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="grid content-start gap-3">
        <div className="grid gap-1">
          <label htmlFor="ce-subj" className="text-sm font-semibold">Subject</label>
          <input id="ce-subj" className="inp" maxLength={150} value={subject} onChange={e=>setSubject(e.target.value)}/>
        </div>
        <span className="text-sm font-semibold">Message</span>
        <div className="grid gap-2 rounded-xl border border-slate-200 p-2 dark:border-white/10">
          <Toolbar exec={exec} onLink={onLink} onInsert={onInsert}/>
          <div ref={ed} id="ce-body" role="textbox" aria-multiline="true" aria-label="Message" contentEditable suppressContentEditableWarning
            className="min-h-[300px] rounded-lg bg-surface p-4 text-[15px] leading-relaxed text-slate-800 outline-none focus:ring-2 focus:ring-teal/40"
            onInput={e=>setBody(e.currentTarget.innerHTML)}/>
        </div>
        <p className="text-xs opacity-70">Type normally and use the toolbar to format. Use "Insert a detail" to add a value that is filled in when the email is sent.</p>
        {unknown.length>0&&<p role="alert" className="rounded-lg bg-rose-50 p-2 text-sm text-rose-800">Unknown detail{unknown.length>1?'s':''}: {unknown.map(k=>'{{'+k+'}}').join(', ')}. Use "Insert a detail" so the name is spelled correctly.</p>}

        {isAdmin&&<div className="grid gap-2 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn2 !py-1" onClick={()=>setSaveOpen(o=>!o)}>{saveOpen?'Close':'Save as email type'}</button>
            {isSaved&&<><button type="button" className="btn2 !py-1" onClick={()=>saveType(false)}>Update “{current.label}”</button>
              <button type="button" className="btn2 !py-1 text-rose-700" onClick={deleteType}>Delete this type</button></>}
          </div>
          {saveOpen&&<div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
            <div><label htmlFor="ce-savename" className="text-xs font-semibold">Name of the new type</label>
              <input id="ce-savename" className="inp" maxLength={80} value={saveLabel} onChange={e=>setSaveLabel(e.target.value)} placeholder="e.g. Fee reminder"/></div>
            <div><label htmlFor="ce-saveaud" className="text-xs font-semibold">Who can use it</label>
              <select id="ce-saveaud" className="inp" value={saveAudience} onChange={e=>setSaveAudience(e.target.value)}>
                <option value="ALL">Admins and teachers</option><option value="ADMIN">Admins only</option></select></div>
            <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={saveNeedsPay} onChange={e=>setSaveNeedsPay(e.target.checked)}/> Uses payment details</label>
            <button type="button" className="btn" disabled={!saveLabel.trim()||!subject.trim()||!body.trim()} onClick={()=>saveType(true)}>Save type</button>
          </div>}
        </div>}
      </div>

      <div className="grid content-start gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold">Live preview</span>
          <span className={updating?'text-amber-700':'text-green-800'}>{updating?'Updating…':preview?'Up to date':'Start writing to see the email'}</span></div>
        {preview&&<p className="truncate text-sm"><b>Subject:</b> {preview.subject}</p>}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-white/10">
          {preview?.html
            ? <iframe title="Email preview" srcDoc={preview.html} className="h-[600px] w-full bg-surface"/>
            : <div className="grid h-[600px] place-items-center p-6 text-center text-sm opacity-60">Choose a recipient and type a message. Your email will appear here.</div>}
        </div>
      </div>
    </div>

    {fields.length>0&&<p className="text-xs opacity-60">Details marked “needed” must be filled before sending.</p>}
    <div className="flex flex-wrap items-center gap-3 border-t border-slate-200/70 pt-4">
      <span className={`text-sm ${canSend?'text-green-800':'text-amber-800'}`}>
        {!addrOk?'Enter the recipient’s email address.'
          :!subject.trim()||!body.trim()?'Write a subject and a message.'
          :unknown.length?'Fix the unknown detail names first.'
          :missing.length?`Fill in: ${missing.map(k=>LABELS[k]||k).join(', ')}.`
          :preview?'Ready to send.':'Checking…'}
      </span>
      <button type="button" className="btn ml-auto" disabled={!canSend} onClick={send}>{sending?'Sending…':'Send email'}</button>
    </div>
    {note&&<p role="status" className={`text-sm ${note.ok?'text-green-800':'text-rose-800'}`}>{note.text}</p>}
  </section>
}

export function Emails(){
  const {user}=useAuth(), isAdmin=user?.role==='ADMIN'
  const [rows,setRows]=useState(null), [err,setErr]=useState(''), [f,setF]=useState('ALL'), [q,setQ]=useState(''), [tick,setTick]=useState(0)
  useEffect(()=>{
    let live=true
    const load=()=>api.get('/staff/email-log').then(r=>{ if(live){ setRows(r.data||[]); setErr('') } }).catch(e=>{ if(live) setErr(msg(e)) })
    load(); const t=setInterval(load,30000)
    return()=>{ live=false; clearInterval(t) }
  },[tick])
  const shown=useMemo(()=>{
    const s=q.trim().toLowerCase()
    return (rows||[]).filter(r=>(f==='ALL'||r.status===f)&&(!s||(r.toAddress+' '+r.subject).toLowerCase().includes(s)))
  },[rows,f,q])
  return <section aria-labelledby="emails-h" className="grid gap-6">
    <div>
      <h1 id="emails-h" className="font-serif text-3xl text-navy">Emails</h1>
      <p className="mt-1 text-sm opacity-75">{isAdmin?'Every email the system tried to send, newest first.':'Emails sent to your address, and emails you have sent.'} "Sent" means the mail server accepted it.</p>
    </div>
    <CustomEmail sender={user?.name||'NLMed Study'} isAdmin={isAdmin} onSent={()=>setTick(t=>t+1)}/>
    <div className="flex flex-wrap items-center gap-3">
      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
        {FILTERS.map(([k,l])=><button key={k} type="button" aria-pressed={f===k} onClick={()=>setF(k)} className={`btn2 !min-h-[38px] !py-1 ${f===k?'!bg-teal/15 !border-teal':''}`}>{l}</button>)}
      </div>
      <div className="ml-auto w-full sm:w-72"><label htmlFor="email-q" className="sr-only">Search emails</label>
        <input id="email-q" className="inp" placeholder="Search address or subject…" value={q} onChange={e=>setQ(e.target.value)}/></div>
    </div>
    {err&&<p role="alert" className="text-sm text-rose-800">{err}</p>}
    <div className="box overflow-x-auto">
      {rows===null?<div className="skel h-32"/>:shown.length===0?<p className="py-8 text-center text-sm opacity-70">{rows.length===0?'No emails yet.':'No emails match this filter.'}</p>:
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead><tr className="opacity-70"><th className="py-1 pr-3">When</th><th className="pr-3">To</th><th className="pr-3">Subject</th><th className="pr-3">Type</th><th className="pr-3">Sent by</th><th className="pr-3">Status</th><th>Reason</th></tr></thead>
        <tbody>{shown.map(r=><tr key={r.id} className="border-t border-slate-200/70 align-top">
          <td className="whitespace-nowrap py-2 pr-3">{new Date(r.at).toLocaleString()}</td>
          <td className="pr-3">{r.toAddress}</td>
          <td className="pr-3">{r.subject}</td>
          <td className="pr-3 text-xs">{r.template||'—'}</td>
          <td className="pr-3 text-xs">{r.sender||'System'}</td>
          <td className="pr-3"><span className={`whitespace-nowrap rounded-full px-2 text-xs ${r.status==='SENT'?'bg-green-100 text-green-800':'bg-red-100 text-red-800'}`}>{r.status==='SENT'?'Sent':'Failed'}</span></td>
          <td className="text-xs opacity-80">{r.problem||'—'}</td></tr>)}</tbody></table>}
    </div>
  </section>
}
