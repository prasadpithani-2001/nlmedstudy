import {useEffect,useState} from 'react'
import api,{msg} from '../api'
import {Reveal} from '../fx'
import {useGet} from './Public'

const info=c=>(c&&!Array.isArray(c)?c:{})
const Card=({icon,title,delay=0,children})=><Reveal delay={delay} className="h-full"><div className="box h-full"><div className="mb-1 inline-block text-3xl animate-float" aria-hidden="true">{icon}</div><h2 className="font-serif text-lg text-navy">{title}</h2>{children}</div></Reveal>

export function Contact(){
 const i=info(useGet('/contact-info')),[ok,setOk]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false)
 const tel=(i.phone||'').replace(/[^+\d]/g,'')
 const send=async e=>{e.preventDefault();const form=e.target,f=Object.fromEntries(new FormData(form));setErr('');setOk('');setBusy(true)
  try{setOk((await api.post('/contact',f)).data.message);form.reset()}catch(x){setErr(msg(x))}setBusy(false)}
 return <>
  <p className="font-hand text-3xl text-teal">we'd love to hear from you</p>
  <h1 className="mb-1 text-4xl font-bold text-navy">Contact us</h1>
  <p className="mb-6 max-w-xl">Questions about a course, the free demo, fees or payments? Call, message on WhatsApp, email, or use the form below.</p>
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
   {i.phone&&<Card icon="📞" title="Call us"><p><a className="underline" href={`tel:${tel}`}>{i.phone}</a></p><p className="text-sm opacity-70">{i.hours}</p></Card>}
   {i.whatsapp&&<Card icon="💬" title="WhatsApp" delay={80}><p>Chat with us for quick answers.</p><a className="btn mt-2" target="_blank" rel="noreferrer" href={`https://wa.me/${i.whatsapp}?text=${encodeURIComponent('Hi, I would like to know more about your courses.')}`}>Open WhatsApp</a></Card>}
   {i.email&&<Card icon="✉️" title="Email" delay={160}><p><a className="break-all underline" href={`mailto:${i.email}`}>{i.email}</a></p><p className="text-sm opacity-70">We reply within one working day.</p></Card>}
   {i.address&&<Card icon="📍" title="Visit us" delay={240}><p>{i.address}</p><a className="mt-1 inline-block underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(i.address)}`}>Open in Maps</a></Card>}
   {i.hours&&<Card icon="🕒" title="Support hours" delay={320}><p>{i.hours}</p></Card>}
   {(i.instagram||i.youtube)&&<Card icon="🌐" title="Follow us" delay={400}><p className="flex flex-wrap gap-3">{i.instagram&&<a className="underline" target="_blank" rel="noreferrer" href={i.instagram}>Instagram</a>}{i.youtube&&<a className="underline" target="_blank" rel="noreferrer" href={i.youtube}>YouTube</a>}</p></Card>}
  </div>
  <Reveal className="mt-8"><form onSubmit={send} className="box mx-auto grid max-w-2xl gap-3"><h2 className="font-serif text-2xl text-navy">Send us a message</h2>
   <div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="cn">Your name</label><input id="cn" name="name" className="inp" required maxLength={100} autoComplete="name"/></div>
    <div><label htmlFor="cm">Mobile (optional)</label><input id="cm" name="mobile" className="inp" inputMode="tel" autoComplete="tel"/></div></div>
   <div><label htmlFor="ce">Email</label><input id="ce" name="email" type="email" className="inp" required autoComplete="email"/></div>
   <div><label htmlFor="cg">Message</label><textarea id="cg" name="message" rows={5} maxLength={2000} className="inp" required/></div>
   <p role="alert" className="text-amber-700">{err}</p><p role="status" className="font-semibold text-teal">{ok}</p>
   <button className="btn" disabled={busy}>{busy?'Sending…':'Send message'}</button></form></Reveal></>}

/** Staff-only: edit the public contact details (Teacher and Admin dashboards). */
export function ContactEditor(){
 const c=info(useGet('/contact-info')),[note,setNote]=useState(''),[err,setErr]=useState('')
 const save=async e=>{e.preventDefault();setErr('');setNote('');try{await api.put('/admin/contact-info',Object.fromEntries(new FormData(e.target)));setNote('Contact details saved. The Contact page and footer are updated.')}catch(x){setErr(msg(x))}}
 const F=(k,label,type='text',ph='')=><div key={k}><label htmlFor={'ce-'+k}>{label}</label><input id={'ce-'+k} name={k} type={type} className="inp" defaultValue={c[k]||''} placeholder={ph}/></div>
 if(!c.phone&&!c.email)return null
 return <form onSubmit={save} className="box mt-6 grid gap-3 md:grid-cols-2"><h2 className="font-serif text-xl md:col-span-2">Contact details (shown on the Contact page and footer)</h2>
  {F('phone','Phone','text','+91 98765 43210')}{F('whatsapp','WhatsApp number (digits with country code)','text','919876543210')}
  {F('email','Email','email')}{F('hours','Support hours')}
  <div className="md:col-span-2">{F('address','Address')}</div>
  {F('instagram','Instagram link (https://…)')}{F('youtube','YouTube link (https://…)')}
  <p role="alert" className="text-amber-700 md:col-span-2">{err}</p><p role="status" className="font-semibold text-teal md:col-span-2">{note}</p>
  <button className="btn md:col-span-2 md:w-fit">Save contact details</button></form>}

/** Staff-only: messages sent from the public Contact form (Teacher and Admin dashboards). */
export function Inbox(){
 const [ms,setMs]=useState(null),[err,setErr]=useState('')
 const load=()=>api.get('/admin/contact-messages').then(r=>setMs(r.data)).catch(x=>setErr(msg(x)))
 useEffect(()=>{load()},[])
 const flip=m=>api.put(`/admin/contact-messages/${m.id}/status`,{status:m.status==='NEW'?'DONE':'NEW'}).then(load).catch(x=>setErr(msg(x)))
 const n=(ms||[]).filter(m=>m.status==='NEW').length
 return <><h2 className="mt-6 font-serif text-xl">Contact messages{n>0?` (${n} new)`:''}</h2><p role="alert" className="text-amber-700">{err}</p>
  <div className="box">{(ms||[]).map(m=><div key={m.id} className="border-b py-3"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 text-sm ${m.status==='NEW'?'bg-amber-100 text-amber-800':'bg-green-100 text-green-800'}`}>{m.status}</span><b>{m.name}</b>
   <a className="underline" href={`mailto:${m.email}`}>{m.email}</a>{m.mobile&&<span>{m.mobile}</span>}<span className="text-sm text-stone-500">{new Date(m.at).toLocaleString()}</span></div>
   <p className="my-1 whitespace-pre-wrap">{m.message}</p><button className="btn2" onClick={()=>flip(m)}>{m.status==='NEW'?'Mark done':'Reopen'}</button></div>)}
   {ms&&ms.length===0&&<p>No messages yet.</p>}</div></>}
