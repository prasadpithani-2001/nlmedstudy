import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import api,{msg} from '../api'
import {inr,initials} from './Public'
import {ContactEditor,Inbox} from './Contact'
import {AppearanceSettings} from './AppearanceSettings'
import {StaffOverview} from './Dash'
import {RecentPayments} from './RecentPayments'
import {StudentDirectory} from './Students'
import {RecordingsLibrary} from './Recordings'
import {ReportsBoard} from './Reports'
import {BackBar,PageHeader,Seg,StatTile} from '../ui'

/* Admin dashboard (Phase 10): same actions as before, now organised into tabs with a clear header, KPI tiles and a Back button.
   The server checks every call (admin only). */
const tone={OPEN:'bg-red-100 text-red-800',IN_PROGRESS:'bg-amber-100 text-amber-800',RESOLVED:'bg-green-100 text-green-800'}
const TABS=[['overview','Overview'],['students','Students'],['recordings','Recordings'],['issues','Reports & complaints'],['doubts','Student doubts'],['people','Users & owners'],['messages','Contact'],['appearance','Font & appearance']]
const Empty=({children})=><p className="py-8 text-center text-sm opacity-70">{children}</p>

export function Admin(){
 const [users,setU]=useState([]),[pay,setP]=useState([]),[iss,setI]=useState([]),[dbt,setD]=useState([]),[crs,setC]=useState([])
 const [tab,setTab]=useState('overview'),[f,setF]=useState('ALL'),[note,setN]=useState(''),[bad,setBad]=useState(false)
 const load=()=>{
  api.get('/admin/users').then(r=>setU(r.data)).catch(()=>{});api.get('/admin/payments').then(r=>setP(r.data)).catch(()=>{});api.get('/admin/issues').then(r=>setI(r.data)).catch(()=>{})
  api.get('/admin/all-doubts').then(r=>setD(r.data)).catch(()=>{});api.get('/courses').then(r=>setC(r.data)).catch(()=>{})}
 useEffect(load,[])
 const flash=(m,isBad)=>{setN(m);setBad(!!isBad);setTimeout(()=>setN(''),isBad?7000:4500)}
 const act=async(fn,ok)=>{try{await fn();flash(ok);load()}catch(e){flash(msg(e),true)}}
 const shown=iss.filter(i=>f==='ALL'||i.status===f).sort((a,b)=>b.id-a.id),open=iss.filter(i=>i.status==='OPEN').length
 const pending=dbt.filter(d=>d.status==='PENDING').length

 return <>
  <PageHeader eyebrow="Admin workspace" title="Admin dashboard"
   sub="Users, payments, reported problems and student doubts in one place. Courses and content are managed in Manage courses."
   actions={<><Link className="btn2" to="/teacher">📚 Manage courses</Link><Link className="btn" to="/payments">💳 Payments</Link><Link className="btn2" to="/emails">✉️ Emails</Link></>}/>

  <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
   <StatTile icon="👥" label="Users" value={users.length} hint="Students, teachers and admins"/>
   <StatTile icon="🧾" label="Enrollments" value={pay.length} hint={`${inr(pay.reduce((s,p)=>s+(p.paid||0),0))} collected`}/>
   <StatTile icon="🛠️" label="Open issues" value={open} hint={open?'Needs attention':'All clear'}/>
   <StatTile icon="❓" label="Pending doubts" value={pending} hint={dbt.length?`${dbt.length} in total`:'No doubts yet'}/>
  </div>

  <p role="status" aria-live="polite" className={`${note?'':'hidden'} mb-3 rounded-xl px-4 py-2 text-sm font-medium ${bad?'bg-rose-50 text-rose-800':'bg-emerald-50 text-emerald-800'}`}>{note}</p>
  <Seg value={tab} set={setTab} items={TABS}/>

  {tab==='overview'&&<div className="grid gap-6">
   <StaffOverview/>
    <RecentPayments/>
    <a href="#/emails" className="box flex items-center justify-between gap-3 no-underline"><span><b className="text-lg text-navy">Emails sent</b><br/><span className="text-sm opacity-70">See every email the system tried to send</span></span><span aria-hidden="true">→</span></a>
   <div className="grid gap-4 md:grid-cols-2">
    <Link to="/teacher" className="box flex items-center justify-between gap-3 no-underline"><span><b className="text-lg text-navy">Courses, students & content</b><br/><span className="text-sm opacity-70">Create courses, set prices and discounts, see students and progress, upload notes and videos.</span></span><span className="btn shrink-0">Open →</span></Link>
    <Link to="/payments" className="box flex items-center justify-between gap-3 no-underline"><span><b className="text-lg text-navy">Payments</b><br/><span className="text-sm opacity-70">Verified payments are recorded automatically. See them, export CSV and manage your own payment settings.</span></span><span className="btn shrink-0">Open →</span></Link>
   </div>
  </div>}

  {tab==='issues'&&<ReportsBoard scope="admin"/>}

  {tab==='doubts'&&<section className="box" aria-label="Student doubts"><h2 className="mb-3 text-xl text-navy">All student doubts</h2>
   {dbt.length===0?<Empty>No doubts yet.</Empty>:<ul className="divide-y divide-slate-200/60">{dbt.map(d=><li key={d.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
    <div className="min-w-0 flex-1"><b className="text-navy">{d.userName||'Student'}</b> <span className="chip">{d.category}</span><p className="mt-1 text-[15px]">{d.text}</p></div>
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${d.status==='ANSWERED'?'tag-ok':d.status==='IMPORTANT'?'tag-bad':'tag-wait'}`}>{String(d.status).toLowerCase()}</span></li>)}</ul>}
  </section>}

  {tab==='people'&&<div className="grid gap-6 xl:grid-cols-2">
   <section className="box" aria-label="Users"><h2 className="mb-3 text-xl text-navy">Users</h2>
    {users.length===0?<Empty>No users yet.</Empty>:<ul className="divide-y divide-slate-200/60">{users.map(u=><li key={u.id} className="flex flex-wrap items-center gap-3 py-2.5">
     <span className="avatar h-9 w-9 shrink-0 text-xs" aria-hidden="true">{initials(u.name)}</span><div className="min-w-0 flex-1"><b className="block truncate text-navy">{u.name}</b><span className="block truncate text-xs opacity-65">{u.email}</span></div>
     <select aria-label={`Role for ${u.name}`} className="inp max-w-[140px] !min-h-[40px]" value={u.role} onChange={e=>act(()=>api.put(`/admin/users/${u.id}/role`,{role:e.target.value}),'Role updated.')}><option>STUDENT</option><option>TEACHER</option><option>ADMIN</option></select></li>)}</ul>}
   </section>
   <section className="box" aria-label="Course owners"><h2 className="text-xl text-navy">Course owners</h2><p className="mb-3 text-sm opacity-70">The owner receives the payment for that course.</p>
    {crs.length===0?<Empty>No courses yet.</Empty>:<ul className="divide-y divide-slate-200/60">{crs.map(c=><li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5"><span className="min-w-0 flex-1 truncate font-medium text-navy">{c.name}</span>
     <select aria-label={`Owner of ${c.name}`} className="inp max-w-[260px] !min-h-[40px]" value={c.ownerId||''} onChange={e=>act(()=>api.put(`/admin/courses/${c.id}/owner`,{ownerId:e.target.value}),'Course owner updated. Students now pay this account.')}><option value="" disabled>Not set (first teacher)</option>{users.filter(u=>u.role==='TEACHER'||u.role==='ADMIN').map(u=><option key={u.id} value={u.id}>{u.name} ({u.role.toLowerCase()})</option>)}</select></li>)}</ul>}
   </section>
  </div>}

  {tab==='students'&&<StudentDirectory title="Registered students"/>}
  {tab==='recordings'&&<RecordingsLibrary scope="admin"/>}
  {tab==='appearance'&&<AppearanceSettings/>}
  {tab==='messages'&&<div className="grid gap-6"><Inbox/><ContactEditor/></div>}
  <BackBar to="/teacher" label="Back" hint="Admin dashboard"/>
 </>}
