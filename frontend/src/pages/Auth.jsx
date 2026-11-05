import {BrandMark} from '../brand'
import {useEffect,useState} from 'react'
import {Link,Navigate,useNavigate,useSearchParams} from 'react-router-dom'
import {homeFor} from '../ui'
import api,{msg} from '../api'
import {useAuth} from '../App'

const Shell=({title,sub,children,foot})=><div className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border border-slate-200/70 bg-surface/80 shadow-2xl shadow-teal/10 backdrop-blur-xl md:grid-cols-[1fr_1.1fr] dark:bg-slate-900/60">
 <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-teal to-brand2 p-8 text-white md:flex"><div className="hero-blob -right-10 -top-10 h-56 w-56 bg-white"/>
  <div className="relative flex items-center gap-2.5 text-xl font-extrabold"><span className="rounded-2xl bg-white/15 p-1"><BrandMark size={40}/></span>NLMed Study</div>
  <div className="relative"><p className="text-3xl font-extrabold leading-tight">Learn Better.<br/>Study Smarter.<br/>Achieve More.</p><p className="mt-3 text-white/80">Expert courses, live sessions and focused learning in one place.</p></div>
  <ul className="relative grid gap-1.5 text-sm text-white/90"><li>✓ Live interactive classes</li><li>✓ Notes, tests and doubt support</li><li>✓ Certificates on completion</li></ul></aside>
 <div className="p-6 sm:p-10"><h1 className="text-2xl text-navy">{title}</h1>{sub&&<p className="mt-1 text-sm opacity-75">{sub}</p>}<div className="mt-5">{children}</div>{foot&&<p className="mt-5 text-center text-sm">{foot}</p>}</div></div>

const Field=({id,label,children})=><div className="grid gap-1"><label htmlFor={id} className="text-sm font-semibold text-navy">{label}</label>{children}</div>
const Alert=({children})=>children?<p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{children}</p>:null

export function PasswordInput({id,name,autoComplete,minLength,value,onChange,placeholder}){const [show,setShow]=useState(false)
 return <div className="relative"><input id={id} name={name} type={show?'text':'password'} className="inp pr-16" autoComplete={autoComplete} minLength={minLength} required value={value} onChange={onChange} placeholder={placeholder}/>
  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-teal hover:bg-teal/10" onClick={()=>setShow(!show)} aria-pressed={show}>{show?'Hide':'Show'}</button></div>}

const strength=p=>{let s=0;if(p.length>=8)s++;if(p.length>=12)s++;if(/[A-Z]/.test(p)&&/[a-z]/.test(p))s++;if(/\d/.test(p))s++;if(/[^A-Za-z0-9]/.test(p))s++;return Math.min(s,4)}
export const Meter=({p})=>{if(!p)return null;const s=strength(p),lab=['Too weak','Weak','Okay','Strong','Very strong'][s],col=['bg-rose-500','bg-rose-500','bg-amber-500','bg-emerald-500','bg-emerald-600'][s]
 return <div aria-live="polite"><div className="flex gap-1">{[0,1,2,3].map(i=><span key={i} className={`h-1.5 flex-1 rounded-full ${i<s?col:'bg-slate-200'}`}/>)}</div><p className="mt-1 text-xs opacity-70">Password strength: {lab}</p></div>}

function AuthForm({reg}){const {setUser}=useAuth(),go=useNavigate(),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[pw,setPw]=useState('')
 const submit=async e=>{e.preventDefault();setErr('')
  const f=Object.fromEntries(new FormData(e.target));if(reg&&f.password.length<8){setErr('Password must be at least 8 characters.');return}
  setBusy(true);try{const r=await api.post(reg?'/auth/register':'/auth/login',f);localStorage.setItem('ms_user',JSON.stringify(r.data));setUser(r.data);go({TEACHER:'/teacher',ADMIN:'/admin'}[r.data.role]||'/dashboard')}catch(x){setErr(msg(x))}setBusy(false)}
 return <Shell title={reg?'Create your account':'Welcome back 👋'} sub={reg?'Join NLMed Study and start learning today.':'Log in to continue your learning.'}
  foot={reg?<>Already have an account? <Link className="font-semibold text-teal hover:underline" to="/login">Log in</Link></>:<>New to NLMed Study? <Link className="font-semibold text-teal hover:underline" to="/register">Create an account</Link></>}>
  <form onSubmit={submit} className="grid gap-4" noValidate={false}>
   {reg&&<Field id="n" label="Full name"><input id="n" className="inp" name="name" autoComplete="name" required/></Field>}
   <Field id="e" label="Email"><input id="e" className="inp" name="email" type="email" autoComplete="email" placeholder="you@example.com" required/></Field>
   <Field id="p" label="Password"><PasswordInput id="p" name="password" autoComplete={reg?'new-password':'current-password'} minLength={reg?8:1} value={pw} onChange={e=>setPw(e.target.value)}/></Field>
   {reg?<Meter p={pw}/>:<div className="-mt-2 text-right text-sm"><Link className="font-semibold text-teal hover:underline" to="/forgot-password">Forgot Password?</Link></div>}
   <Alert>{err}</Alert><button className="btn !py-3" disabled={busy}>{busy?'Please wait…':reg?'Sign up':'Login'}</button></form></Shell>}
/* A signed-in person who opens the sign-in or sign-up page is sent to their home instead of seeing the form. */
export const Login=()=>{const {user}=useAuth();return user?<Navigate to={homeFor(user)} replace/>:<AuthForm/>}
export const Register=()=>{const {user}=useAuth();return user?<Navigate to={homeFor(user)} replace/>:<AuthForm reg/>}

export function Forgot(){const [email,setEmail]=useState(''),[err,setErr]=useState(''),[done,setDone]=useState(''),[busy,setBusy]=useState(false)
 const submit=async e=>{e.preventDefault();setErr('');setBusy(true);try{setDone((await api.post('/auth/forgot',{email})).data.message)}catch(x){setErr(msg(x))}setBusy(false)}
 return <Shell title="Forgot your password?" sub="Enter your registered email and we will send you a secure reset link." foot={<Link className="font-semibold text-teal hover:underline" to="/login">← Back to login</Link>}>
  {done?<div role="status" className="grid gap-3 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl">📧</div><h2 className="text-xl text-navy">Check your email</h2><p className="text-sm opacity-80">{done}</p><p className="text-xs opacity-60">Didn't get it? Check your spam folder, or try again in a minute.</p><button className="btn2" onClick={()=>setDone('')}>Use a different email</button></div>
  :<form onSubmit={submit} className="grid gap-4"><Field id="fe" label="Enter your registered email"><input id="fe" className="inp" type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={e=>setEmail(e.target.value)}/></Field>
   <Alert>{err}</Alert><button className="btn !py-3" disabled={busy}>{busy?'Sending…':'Send Reset Link'}</button></form>}</Shell>}

export function Reset(){const [sp]=useSearchParams(),token=sp.get('token')||'',[state,setState]=useState('checking'),[pw,setPw]=useState(''),[pw2,setPw2]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{if(!token){setState('bad');return}api.get('/auth/reset/validate',{params:{token}}).then(()=>setState('form')).catch(()=>setState('bad'))},[token])
 const submit=async e=>{e.preventDefault();setErr('')
  if(pw.length<8){setErr('Password must be at least 8 characters.');return}if(pw!==pw2){setErr('The two passwords do not match.');return}
  setBusy(true);try{await api.post('/auth/reset',{token,password:pw,confirm:pw2});localStorage.removeItem('ms_user');setState('done')}catch(x){setErr(msg(x))}setBusy(false)}
 return <Shell title={state==='done'?'All set!':'Create a new password'} sub={state==='form'?'Choose a strong password you have not used before.':undefined}>
  {state==='checking'&&<div className="skel h-40"/>}
  {state==='bad'&&<div role="alert" className="grid gap-3 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-rose-100 text-3xl">⏰</div><h2 className="text-xl text-navy">This link has expired</h2><p className="text-sm opacity-80">Reset links work once and expire after 30 minutes. Please request a new one.</p><Link className="btn" to="/forgot-password">Request a new link</Link></div>}
  {state==='form'&&<form onSubmit={submit} className="grid gap-4"><Field id="np" label="New Password"><PasswordInput id="np" name="password" autoComplete="new-password" minLength={8} value={pw} onChange={e=>setPw(e.target.value)}/></Field><Meter p={pw}/>
   <Field id="cp" label="Confirm New Password"><PasswordInput id="cp" name="confirm" autoComplete="new-password" minLength={8} value={pw2} onChange={e=>setPw2(e.target.value)}/></Field>
   {pw2&&pw!==pw2&&<p className="-mt-2 text-xs text-rose-700">Passwords do not match yet.</p>}<Alert>{err}</Alert><button className="btn !py-3" disabled={busy}>{busy?'Saving…':'Reset Password'}</button></form>}
  {state==='done'&&<div role="status" className="grid gap-3 text-center"><svg className="check mx-auto" width="84" height="84" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="25" fill="none" stroke="rgb(var(--accent))" strokeWidth="2.5"/><path fill="none" stroke="rgb(var(--accent))" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" d="M14 27l8 8 16-17"/></svg>
   <h2 className="text-xl text-navy">Password reset successfully!</h2><p className="text-sm opacity-80">You can now log in with your new password. For your safety you were signed out on all devices.</p><Link className="btn !py-3" to="/login">Login Now</Link></div>}</Shell>}
