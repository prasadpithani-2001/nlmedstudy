import {useEffect,useState} from 'react'
import {Link,useNavigate} from 'react-router-dom'
import api,{msg} from '../api'
import {useAuth} from '../App'
import {initials} from './Public'
import {PasswordInput,Meter} from './Auth'
import {ACCENTS,BGS,applyAccent} from '../fx'
import {animateTheme} from '../appearance'
import {BackBar,PageHeader} from '../ui'

/* Student profile (Phase 10): view and update personal details, change the password, send a reset link,
   and manage account settings. Uses the existing /api/me, /api/me/password and /api/auth/forgot endpoints.
   Appearance settings are saved on this device, the same way the 🎨 Style menu saves them. */

const Note=({n})=>n?<p role="status" aria-live="polite" className={`rounded-xl px-3 py-2 text-sm font-medium ${n.bad?'bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200':'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'}`}>{n.text}</p>:null

const Section=({id,icon,title,sub,children,className=''})=><section aria-labelledby={id} className={`box grid content-start gap-4 ${className}`}>
 <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal/15 to-brand2/15 text-xl" aria-hidden="true">{icon}</span>
  <div className="min-w-0"><h2 id={id} className="text-xl text-navy">{title}</h2>{sub&&<p className="text-sm opacity-70">{sub}</p>}</div></div>{children}</section>

export function StudentProfile(){
 const {user,setUser}=useAuth(),go=useNavigate()
 const [saved,setSaved]=useState({name:user?.name||'',email:user?.email||''})
 const [name,setName]=useState(user?.name||'')
 const [cur,setCur]=useState(''),[nx,setNx]=useState(''),[nx2,setNx2]=useState('')
 const [busy,setBusy]=useState(''),[notes,setNotes]=useState({})
 const [dark,setDark]=useState(()=>document.documentElement.classList.contains('dark'))
 const [acc,setAcc]=useState(()=>localStorage.getItem('ms_accent')||'indigo')
 const [bg,setBg]=useState(()=>localStorage.getItem('ms_bg')||'aurora')
 const [auto,setAuto]=useState(()=>localStorage.getItem('ms_bg_auto')==='1')

 const say=(k,text,bad)=>setNotes(n=>({...n,[k]:{text,bad}}))
 useEffect(()=>{api.get('/me').then(r=>{setSaved({name:r.data.name,email:r.data.email});setName(r.data.name)}).catch(()=>{})},[])

 const saveName=async e=>{e.preventDefault();setBusy('name')
  try{const r=await api.put('/me',{name:name.trim()});const u={...JSON.parse(localStorage.getItem('ms_user')||'{}'),name:r.data.name};localStorage.setItem('ms_user',JSON.stringify(u));setUser(u);setSaved({name:r.data.name,email:r.data.email});setName(r.data.name);say('details','Your details are saved.')}
  catch(x){say('details',msg(x),true)}setBusy('')}

 const savePw=async e=>{e.preventDefault()
  if(nx!==nx2)return say('pw','The two new passwords do not match.',true)
  if(nx===cur)return say('pw','Choose a password that is different from your current one.',true)
  setBusy('pw');try{await api.put('/me/password',{current:cur,next:nx});setCur('');setNx('');setNx2('');say('pw','Password changed. Use the new password the next time you log in.')}
  catch(x){say('pw',msg(x),true)}setBusy('')}

 const sendReset=async()=>{setBusy('reset');try{const r=await api.post('/auth/forgot',{email:saved.email});say('reset',r.data.message)}catch(x){say('reset',msg(x),true)}setBusy('')}

 const setTheme=d=>{animateTheme();document.documentElement.classList.toggle('dark',d);localStorage.setItem('ms_theme_v2',d?'dark':'light');setDark(d)}
 const pickAccent=a=>{localStorage.setItem('ms_accent',a);setAcc(a);applyAccent(a);dispatchEvent(new Event('ms-accent'))}
 const pickBg=(style,a)=>{localStorage.setItem('ms_bg',style);localStorage.setItem('ms_bg_auto',a?'1':'0');setBg(style);setAuto(a);dispatchEvent(new CustomEvent('ms-bg',{detail:{style,auto:a}}))}
 const logout=()=>{localStorage.removeItem('ms_user');setUser(null);go('/')}

 const pill=(on)=>`rounded-xl border px-3 py-2 text-sm font-semibold transition ${on?'border-transparent bg-gradient-to-r from-teal to-brand2 text-white shadow-md shadow-teal/20':'border-slate-300 hover:border-teal hover:text-teal'}`

 return <>
  <PageHeader eyebrow="Your account" title="My Profile" sub="Keep your details up to date, protect your password and set how NLMed Study looks on this device."/>
  <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
   <aside className="grid content-start gap-4">
    <div className="box text-center">
     <span className="avatar mx-auto h-24 w-24 text-3xl" aria-hidden="true">{initials(saved.name)}</span>
     <h2 className="mt-3 break-words text-xl text-navy">{saved.name||'Your name'}</h2>
     <p className="mt-0.5 break-all text-sm opacity-70">{saved.email}</p>
     <span className="chip mt-3">Student account</span>
    </div>
    <nav aria-label="Quick links" className="box grid gap-1 !p-2">
     {[['/dashboard','📚','My learning'],['/my-payments','🧾','My payments'],['/focus','⏱️','Focus session'],['/exams','📝','Entrance exam']].map(([to,i,l])=><Link key={to} to={to} className="tnav"><span aria-hidden="true">{i}</span>{l}<span className="ml-auto opacity-40" aria-hidden="true">→</span></Link>)}
    </nav>
   </aside>

   <div className="grid content-start gap-6">
    <Section id="sec-details" icon="🪪" title="Personal details" sub="Your name is shown to your teachers and on your certificates.">
     <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveName}>
      <div className="grid gap-1"><label htmlFor="pf-name" className="text-sm font-semibold text-navy">Full name</label><input id="pf-name" className="inp" value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={80} autoComplete="name"/></div>
      <div className="grid gap-1"><label htmlFor="pf-email" className="text-sm font-semibold text-navy">Registered email</label><input id="pf-email" className="inp bg-slate-100/70 dark:bg-white/5" value={saved.email} readOnly aria-readonly="true" aria-describedby="pf-email-hint"/><p id="pf-email-hint" className="text-xs opacity-60">Your login email. To change it, contact support.</p></div>
      <div className="grid gap-3 sm:col-span-2"><Note n={notes.details}/><div><button className="btn" disabled={busy==='name'||name.trim()===saved.name}>{busy==='name'?'Saving…':'Save details'}</button></div></div>
     </form>
    </Section>

    <div className="grid gap-6 xl:grid-cols-2">
     <Section id="sec-pw" icon="🔐" title="Change password" sub="Use at least 8 characters. Mixing letters, numbers and symbols makes it stronger.">
      <form className="grid gap-4" onSubmit={savePw}>
       <div className="grid gap-1"><label htmlFor="pw-cur" className="text-sm font-semibold text-navy">Current password</label><PasswordInput id="pw-cur" name="current" autoComplete="current-password" value={cur} onChange={e=>setCur(e.target.value)}/></div>
       <div className="grid gap-1"><label htmlFor="pw-new" className="text-sm font-semibold text-navy">New password</label><PasswordInput id="pw-new" name="next" autoComplete="new-password" minLength={8} value={nx} onChange={e=>setNx(e.target.value)}/><Meter p={nx}/></div>
       <div className="grid gap-1"><label htmlFor="pw-new2" className="text-sm font-semibold text-navy">Repeat new password</label><PasswordInput id="pw-new2" name="confirm" autoComplete="new-password" minLength={8} value={nx2} onChange={e=>setNx2(e.target.value)}/>
        {nx2&&nx!==nx2&&<p className="text-xs text-rose-700">Passwords do not match yet.</p>}</div>
       <Note n={notes.pw}/>
       <div><button className="btn" disabled={busy==='pw'||!cur||nx.length<8||nx!==nx2}>{busy==='pw'?'Changing…':'Change password'}</button></div>
      </form>
     </Section>

     <Section id="sec-reset" icon="📧" title="Forgot or want to reset?" sub="We email you a secure link. It works once and expires after 30 minutes.">
      <div className="grid gap-4">
       <p className="text-sm">Reset link will be sent to <b className="break-all text-navy">{saved.email}</b>.</p>
       <Note n={notes.reset}/>
       <div><button className="btn2" onClick={sendReset} disabled={busy==='reset'||!saved.email}>{busy==='reset'?'Sending…':'✉️ Email me a reset link'}</button></div>
       <p className="text-xs opacity-65">You can request a new link at most once a minute. The reset also signs you out on every device.</p>
      </div>
     </Section>
    </div>

    <Section id="sec-settings" icon="⚙️" title="Account settings" sub="Appearance is remembered on this device only.">
     <div className="grid gap-5 md:grid-cols-2">
      <div className="grid gap-2"><h3 className="text-sm font-bold text-navy">Theme</h3>
       <div className="flex gap-2" role="group" aria-label="Theme">{[[false,'☀️ Light'],[true,'🌙 Dark']].map(([d,l])=><button key={l} type="button" aria-pressed={dark===d} className={pill(dark===d)} onClick={()=>setTheme(d)}>{l}</button>)}</div></div>
      <div className="grid gap-2"><h3 className="text-sm font-bold text-navy">Accent colour</h3>
       <div className="flex gap-3" role="group" aria-label="Accent colour">{ACCENTS.map(([k,c,l])=><button key={k} type="button" aria-label={l} aria-pressed={acc===k} title={l} onClick={()=>pickAccent(k)} className={`h-9 w-9 rounded-full border-2 transition hover:scale-110 ${acc===k?'border-navy ring-2 ring-teal ring-offset-2':'border-white'}`} style={{background:c}}/>)}</div></div>
      <div className="grid gap-2 md:col-span-2"><h3 className="text-sm font-bold text-navy">Background</h3>
       <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Background style">{BGS.map(([k,l,e])=><button key={k} type="button" aria-pressed={bg===k} onClick={()=>pickBg(k,auto)} className={`${pill(bg===k)} text-left`}><span aria-hidden="true">{e}</span> {l}</button>)}</div>
       <label className="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" checked={auto} onChange={e=>pickBg(bg,e.target.checked)}/> Change the background automatically every 20 seconds</label></div>
     </div>
     <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-4">
      <div><h3 className="text-sm font-bold text-navy">Sign out on this device</h3><p className="text-xs opacity-65">You will need your email and password to come back.</p></div>
      <button type="button" className="btn2 !border-rose-300 !text-rose-700 hover:!bg-rose-50" onClick={logout}>⎋ Sign out</button>
     </div>
    </Section>
   </div>
  </div>
  <BackBar to="/dashboard" label="Back to my learning"/>
 </>}
