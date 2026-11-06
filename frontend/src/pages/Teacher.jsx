import {useCallback,useEffect,useMemo,useState} from 'react'
import {Link,useNavigate,useSearchParams} from 'react-router-dom'
import api,{msg,livePrefs} from '../api'
import {useAuth} from '../App'
import {inr,theme,Empty,Skeletons,initials} from './Public'
import {ContactEditor,Inbox} from './Contact'
import {AppearanceSettings} from './AppearanceSettings'
import {TeacherHome} from './TeacherHome'
import {StudentDirectory} from './Students'
import {RecordingsLibrary} from './Recordings'
import {ReportsBoard} from './Reports'
import {CouponsExams} from './Coupons'
import {ResourceLibrary} from './Materials'
import {ThemeButton} from '../fx'
import {BackBar,PageHeader,Seg} from '../ui'
import {PlansPanel} from './Plans'

/* Teacher / Admin workspace. Everything here is scoped by the server: a teacher sees only their own courses, students and doubts;
   the admin sees all. Tabs keep the page calm instead of one very long scroll. */
/* Sidebar (desktop) / drawer (phones). kind 'tab' = section of this page, 'link' = another page. */
const NAV=[
 ['Teach',[['overview','📊','Dashboard'],['courses','📚','Courses'],['students','👥','My Students'],['resources','🗂️','Resources'],['live','🔴','Live Sessions'],['recordings','🎬','Recordings'],['demos','🎥','Demo Sessions'],['plans','🧩','Course plans']]],
 ['Money',[['/payments','💳','Payment verification','link'],['/payments#settings','🏦','Payment Settings','link'],['/emails','✉️','Emails','link']]],
 ['Account',[['complaints','🚩','Reports'],['messages','💬','Messages'],['profile','👤','Profile'],['settings','⚙️','Settings']]]]
const TITLES={overview:'Teacher Dashboard',courses:'Courses',coupons:'Coupons & exams',students:'My Students',resources:'Resources',live:'Live Sessions',recordings:'Recordings',demos:'Demo Sessions',plans:'Course plans',messages:'Messages',doubts:'Student doubts',complaints:'Reports & complaints',profile:'Profile',settings:'Settings'}
const GROUP={coupons:'courses',doubts:'messages',complaints:'messages'}
const csvCell=v=>{let s=String(v??'');if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
const intOk=s=>s!==''&&Number.isInteger(Number(s))&&Number(s)>=0

function CourseRow({c,run}){
  const orig=[String(c.price),c.listPrice?String(c.listPrice):''],[price,setPrice]=useState(orig[0]),[list,setList]=useState(orig[1])
  const [editing,setEditing]=useState(false),[name,setName]=useState(c.name),[subject,setSubject]=useState(c.subject),[teacher,setTeacher]=useState(c.teacher||'')
  const dirty=price!==orig[0]||list!==orig[1],valid=intOk(price)&&(list===''||intOk(list)),[g,e]=theme(c.subject)
  const pct=valid&&list!==''&&Number(list)>Number(price)?Math.round((Number(list)-Number(price))*100/Number(list)):0
  const detailsOk=name.trim().length>=2&&name.trim().length<=120&&subject.trim().length>0&&subject.trim().length<=60&&teacher.trim().length<=120
  const detailsDirty=name!==c.name||subject!==c.subject||teacher!==(c.teacher||'')
  const startEdit=()=>{setName(c.name);setSubject(c.subject);setTeacher(c.teacher||'');setEditing(true)}
  const cancelEdit=()=>setEditing(false)
  const saveDetails=()=>run(()=>api.put(`/admin/courses/${c.id}/details`,{name:name.trim(),subject:subject.trim(),teacher:teacher.trim()}),'Course details saved. Students see it right away.')
  const remove=()=>{if(!window.confirm(`Delete "${c.name}"? This cannot be undone.`))return;run(()=>api.delete(`/admin/courses/${c.id}`),'Course deleted.')}
  return <tr className="border-t border-slate-200/60 align-middle">
    <td className="py-3 pr-3">{editing?<div className="grid max-w-[300px] gap-2">
        <input aria-label="Course name" className="inp !min-h-[40px]" value={name} maxLength={120} onChange={ev=>setName(ev.target.value)}/>
        <input aria-label="Subject" className="inp !min-h-[40px]" value={subject} maxLength={60} onChange={ev=>setSubject(ev.target.value)}/>
        <input aria-label="Instructor name" className="inp !min-h-[40px]" value={teacher} maxLength={120} placeholder="Instructor name" onChange={ev=>setTeacher(ev.target.value)}/>
      </div>
      :<div className="flex items-center gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${g} text-xl`} aria-hidden="true">{e}</span><div><b className="block text-navy">{c.name}</b><span className="block text-xs opacity-60">{c.subject}{c.teacher?` · ${c.teacher}`:''}</span></div></div>}</td>
    <td className="pr-3"><input aria-label={`Price for ${c.name}`} className="inp !min-h-[40px] max-w-[130px]" inputMode="numeric" value={price} onChange={ev=>setPrice(ev.target.value.replace(/\D/g,''))}/></td>
    <td className="pr-3"><input aria-label={`Original price for ${c.name} (optional)`} className="inp !min-h-[40px] max-w-[130px]" inputMode="numeric" placeholder="optional" value={list} onChange={ev=>setList(ev.target.value.replace(/\D/g,''))}/>{pct>0&&<div className="mt-0.5 text-xs font-semibold text-teal">{pct}% off shown</div>}</td>
    <td className="whitespace-nowrap">{editing
      ?<div className="flex flex-wrap gap-1.5">
         <button className="btn !min-h-[40px] !py-1.5" disabled={!detailsDirty||!detailsOk} onClick={saveDetails}>Save details</button>
         <button className="btn2 !min-h-[40px] !py-1.5" onClick={cancelEdit}>Cancel</button>
       </div>
      :<div className="flex flex-wrap gap-1.5">
         <button className="btn !min-h-[40px] !py-1.5" disabled={!dirty||!valid} onClick={()=>run(()=>api.put(`/admin/courses/${c.id}/price`,{price:Number(price),listPrice:list===''?null:Number(list)}),'Price saved. Students see it right away.')}>Save price</button>
         <button className="btn2 !min-h-[40px] !py-1.5" onClick={startEdit}>Edit</button>
         <button className="btn2 !min-h-[40px] !py-1.5 !text-rose-600" onClick={remove}>Delete</button>
       </div>}</td>
  </tr>}
function LiveRow({c,admin}){const [st,setSt]=useState(null),[g,e]=theme(c.subject)
 useEffect(()=>{const f=()=>api.get(`/live/${c.id}`).then(r=>setSt(r.data)).catch(()=>{});f();const t=setInterval(f,10000);return()=>clearInterval(t)},[c.id])
 return <li className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/70 px-3 py-3"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${g} text-xl`} aria-hidden="true">{e}</span>
  <div className="min-w-0 flex-1"><b className="block truncate text-navy">{c.name}</b><span className="text-xs opacity-65">{st?.live?`🔴 Live now · ${st.viewers} connected`:'Not live'}</span></div>
  {admin?<span className="text-xs opacity-60">Teachers host live classes</span>:<Link className="btn !bg-none !bg-red-600" to={`/live/${c.id}`}>{st?.live?'↩ Rejoin class':'🔴 Start live class'}</Link>}</li>}

function Profile({flash}){const {user,setUser}=useAuth(),[name,setName]=useState(user?.name||''),[em,setEm]=useState(''),[cur,setCur]=useState(''),[nx,setNx]=useState(''),[nx2,setNx2]=useState('')
 useEffect(()=>{api.get('/me').then(r=>{setName(r.data.name);setEm(r.data.email)}).catch(()=>{})},[])
 const saveName=async e=>{e.preventDefault();try{const r=await api.put('/me',{name});const u={...JSON.parse(localStorage.getItem('ms_user')||'{}'),name:r.data.name};localStorage.setItem('ms_user',JSON.stringify(u));setUser(u);flash('Profile updated.')}catch(x){flash(msg(x),true)}}
 const savePw=async e=>{e.preventDefault();if(nx!==nx2)return flash('The new passwords do not match.',true);try{await api.put('/me/password',{current:cur,next:nx});setCur('');setNx('');setNx2('');flash('Password changed.')}catch(x){flash(msg(x),true)}}
 return <div className="grid gap-4 lg:grid-cols-2"><form className="box grid content-start gap-3" onSubmit={saveName}><div className="flex items-center gap-3"><span className="avatar h-14 w-14 text-xl" aria-hidden="true">{initials(name)}</span><div><h2 className="text-xl text-navy">Your profile</h2><p className="text-sm opacity-70">{String(user?.role||'').toLowerCase()}</p></div></div>
  <div><label htmlFor="pn">Full name</label><input id="pn" className="inp" value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={80}/><p className="mt-1 text-xs opacity-60">Shown to students as the instructor on new courses and in live classes.</p></div>
  <div><label htmlFor="pe">Email</label><input id="pe" className="inp" value={em} readOnly aria-readonly="true"/></div><button className="btn justify-self-start">Save profile</button></form>
  <form className="box grid content-start gap-3" onSubmit={savePw}><h2 className="text-xl text-navy">Change password</h2>
   <div><label htmlFor="p1">Current password</label><input id="p1" className="inp" type="password" autoComplete="current-password" value={cur} onChange={e=>setCur(e.target.value)} required/></div>
   <div><label htmlFor="p2">New password (8+ characters)</label><input id="p2" className="inp" type="password" autoComplete="new-password" minLength={8} value={nx} onChange={e=>setNx(e.target.value)} required/></div>
   <div><label htmlFor="p3">Repeat new password</label><input id="p3" className="inp" type="password" autoComplete="new-password" minLength={8} value={nx2} onChange={e=>setNx2(e.target.value)} required/></div><button className="btn justify-self-start">Change password</button></form></div>}

function SettingsTab({flash}){const [p,setP]=useState(livePrefs),set=(k,v)=>{const n={...p,[k]:v};setP(n);localStorage.setItem('ms_live_prefs',JSON.stringify(n));flash('Saved on this device.')}
 return <div className="grid gap-4"><div className="grid gap-4 lg:grid-cols-2"><section className="box grid content-start gap-3"><h2 className="text-xl text-navy">Live class defaults</h2>
  <div><label htmlFor="sm">Start classes in</label><select id="sm" className="inp" value={p.mode} onChange={e=>set('mode',e.target.value)}><option value="tablet">✍️ Tablet (digital whiteboard)</option><option value="board">📋 Board (camera on a physical board)</option></select></div>
  <div><label htmlFor="sb">Whiteboard background</label><select id="sb" className="inp" value={p.bg} onChange={e=>set('bg',e.target.value)}>{['plain','ruled','grid','board'].map(b=><option key={b} value={b}>{b}</option>)}</select></div>
  <p className="text-xs opacity-60">Remembered on this device only. You can still change them during a class.</p></section>
  <section className="box grid content-start gap-3"><h2 className="text-xl text-navy">Appearance</h2><div className="flex items-center gap-3"><ThemeButton/><span className="text-sm">Switch between light and dark mode.</span></div><p className="text-sm opacity-70">Accent colour and background style: use the 🎨 style picker in the top bar.</p></section></div><AppearanceSettings/><ContactEditor/></div>}

export function Teacher(){
  const {user,setUser}=useAuth(),admin=user?.role==='ADMIN',go=useNavigate(),[sp,setSp]=useSearchParams(),[drawer,setDrawer]=useState(false)
  const tab=TITLES[sp.get('tab')]?sp.get('tab'):'overview',setTab=k=>{setSp({tab:k});setDrawer(false)}
  const [stats,setStats]=useState(null),[courses,setCourses]=useState(null),[students,setStudents]=useState(null),[doubts,setDoubts]=useState(null),[demos,setDemos]=useState(null)
  const [topics,setTopics]=useState([]),[cid,setCid]=useState(''),[note,setNote]=useState(''),[bad,setBad]=useState(false),[up,setUp]=useState(0),[q,setQ]=useState(''),[fc,setFc]=useState('')
  const flash=useCallback((m,isErr)=>{setNote(m);setBad(!!isErr);setTimeout(()=>setNote(''),isErr?7000:4000)},[])
  const logout=()=>{localStorage.removeItem('ms_user');setUser(null);go('/')}
  useEffect(()=>{if(!drawer)return;const k=e=>e.key==='Escape'&&setDrawer(false),o=document.body.style.overflow;document.body.style.overflow='hidden';addEventListener('keydown',k);return()=>{removeEventListener('keydown',k);document.body.style.overflow=o}},[drawer])
  const load=useCallback(()=>{
    api.get('/admin/stats').then(r=>setStats(r.data)).catch(()=>setStats({}))
    api.get('/staff/courses').then(r=>{setCourses(r.data);setCid(p=>p||(r.data[0]?String(r.data[0].id):''))}).catch(e=>{setCourses([]);flash(msg(e),true)})
    api.get('/staff/students').then(r=>setStudents(r.data)).catch(()=>setStudents([]))
    api.get('/admin/doubts').then(r=>setDoubts(r.data)).catch(()=>setDoubts([]))
    api.get('/demos').then(r=>setDemos(r.data)).catch(()=>setDemos([]))},[])
  const loadTopics=useCallback(()=>{if(cid)api.get(`/courses/${cid}/topics`).then(r=>setTopics(r.data)).catch(()=>setTopics([]))},[cid])
  useEffect(()=>{load()},[load]);useEffect(()=>{loadTopics()},[loadTopics])
  const run=async(fn,ok)=>{try{await fn();flash(ok);load();loadTopics()}catch(e){flash(msg(e),true)}}
  const form=e=>Object.fromEntries(new FormData(e.target))
  const list=useMemo(()=>(students||[]).filter(s=>(!fc||String(s.courseId)===fc)&&(s.student+' '+s.email+' '+s.course).toLowerCase().includes(q.trim().toLowerCase())),[students,q,fc])
  const exportCsv=()=>{const rows=[['Student','Email','Course','Enrolled on','Amount paid (INR)','Progress %'],...list.map(s=>[s.student,s.email,s.course,(s.since||'').slice(0,10),s.paid,s.percent])]
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.map(r=>r.map(csvCell).join(',')).join('\n')],{type:'text/csv'}));a.download='students.csv';a.click();URL.revokeObjectURL(a.href)}
  const pendingDoubts=(doubts||[]).filter(d=>d.status==='PENDING').length
  const Sel=<select className="inp" aria-label="Course" value={cid} onChange={e=>setCid(e.target.value)}>{(courses||[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>

  const cur=GROUP[tab]||tab
  const Item=([k,i,l,kind])=>{const inner=<><span className="grid h-6 w-6 shrink-0 place-items-center text-lg" aria-hidden="true">{i}</span><span className="min-w-0 flex-1 truncate">{l}</span>{k==='messages'&&pendingDoubts>0&&<span className="rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">{pendingDoubts}</span>}</>
   return kind==='link'?<Link key={k} to={k} className="tnav" onClick={()=>setDrawer(false)}>{inner}</Link>:<button key={k} type="button" className="tnav" aria-current={cur===k?'page':undefined} onClick={()=>setTab(k)}>{inner}</button>}
  const Nav=<nav aria-label="Teacher menu" className="grid gap-4">{NAV.map(([g,items])=><div key={g}><p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-widest opacity-50">{g}</p><div className="grid gap-0.5">{items.filter(x=>!(admin&&x[0]==='live')).map(Item)}</div></div>)}
   {admin&&<Link to="/admin" className="tnav" onClick={()=>setDrawer(false)}><span className="grid h-6 w-6 place-items-center text-lg" aria-hidden="true">🛡️</span>Admin panel</Link>}
   <button type="button" className="tnav border-t border-slate-200/70 !text-rose-600 hover:!bg-rose-500/10" onClick={logout}><span className="grid h-6 w-6 place-items-center text-lg" aria-hidden="true">⎋</span>Logout</button></nav>
  return <div className="lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-6">
   <aside className="hidden lg:block"><div className="box sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto !p-3"><div className="mb-3 flex items-center gap-3 border-b border-slate-200/70 px-2 pb-3"><span className="avatar h-10 w-10 text-sm" aria-hidden="true">{initials(user?.name)}</span><div className="min-w-0"><b className="block truncate text-navy">{user?.name}</b><span className="text-xs uppercase tracking-wider opacity-60">{admin?'Admin':'Teacher'}</span></div></div>{Nav}</div></aside>
   <div className="min-w-0">
   <div className="sticky top-16 z-20 -mx-4 mb-4 flex items-center gap-3 border-b border-slate-200/70 bg-surface/85 px-4 py-2 backdrop-blur-xl dark:bg-[#0b1020]/85 lg:hidden"><button className="btn2 !min-h-[40px] !px-3" aria-label="Open teacher menu" aria-expanded={drawer} onClick={()=>setDrawer(true)}>☰</button><b className="truncate text-navy">{TITLES[tab]}</b></div>
   {drawer&&<div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Teacher menu"><div className="absolute inset-0 animate-fadeIn bg-black/55" onClick={()=>setDrawer(false)}/><div className="drawer-in absolute inset-y-0 left-0 w-[280px] max-w-[85vw] overflow-y-auto bg-surface p-3 shadow-2xl dark:bg-[#0f1726]"><div className="mb-3 flex items-center gap-3 border-b border-slate-200/70 px-2 pb-3"><span className="avatar h-10 w-10 text-sm" aria-hidden="true">{initials(user?.name)}</span><div className="min-w-0 flex-1"><b className="block truncate text-navy">{user?.name}</b><span className="text-xs uppercase tracking-wider opacity-60">{admin?'Admin':'Teacher'}</span></div><button className="btn2 !min-h-[36px] !px-2.5" aria-label="Close menu" onClick={()=>setDrawer(false)}>✕</button></div>{Nav}</div></div>}
   <PageHeader className="hidden lg:flex" eyebrow={admin?'Admin workspace':'Teacher workspace'} title={TITLES[tab]}/>
   <p role="status" aria-live="polite" className={`${note?'':'hidden'} fixed bottom-20 left-4 z-[60] max-w-sm animate-fadeUp rounded-xl px-4 py-2 text-white shadow-lg ${bad?'bg-rose-700':'bg-navy'}`}>{note}</p>
   {tab==='overview'&&<TeacherHome/>}

   {(tab==='courses'||tab==='coupons')&&<Seg value={tab} set={setTab} items={[['courses','Courses & prices'],['coupons','Coupons & exams']]}/>}
   {tab==='courses'&&<><section className="box overflow-x-auto"><h2 className="mb-1 text-xl text-navy">Courses & prices</h2><p className="mb-3 text-sm opacity-70">Set the selling price. Add an original price to show a struck-through discount on the course card.</p>
     {courses===null?<div className="skel h-32"/>:courses.length===0?<p className="py-6 text-center text-sm opacity-70">No courses yet. Create your first one below.</p>
     :<table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="text-xs uppercase tracking-wide opacity-60"><th className="pb-2">Course</th><th>Price ₹</th><th>Original price ₹</th><th/></tr></thead><tbody>{courses.map(c=><CourseRow key={`${c.id}-${c.name}-${c.subject}-${c.teacher}-${c.price}-${c.listPrice}`} c={c} run={run}/>)}</tbody></table>}</section>
    <form className="box mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr_140px_auto]" onSubmit={e=>{e.preventDefault();const f=form(e),el=e.target;run(async()=>{await api.post('/admin/courses',f);el.reset()},'Course created. It is paid to your own payment account.')}}>
     <h2 className="text-xl text-navy md:col-span-4">Create a course</h2>
     <div><label htmlFor="cn1">Course name</label><input id="cn1" className="inp" name="name" required maxLength={120}/></div><div><label htmlFor="cs1">Subject</label><input id="cs1" className="inp" name="subject" required maxLength={60} placeholder="Anatomy"/></div>
     <div><label htmlFor="cp1">Price ₹</label><input id="cp1" className="inp" name="price" type="number" min="0" step="1" required/></div><button className="btn self-end">Create course</button></form></>}

   {tab==='students'&&<div className="grid gap-6"><StudentDirectory/><section className="box"><div className="mb-3 flex flex-wrap items-center gap-2"><div className="mr-auto"><h2 className="text-xl text-navy">Students & progress</h2><p className="text-sm opacity-70">{students?`${list.length} enrolment${list.length===1?'':'s'} in your courses`:'Loading…'}</p></div>
     <input className="inp max-w-[220px]" type="search" aria-label="Search students" placeholder="Search name, email, course" value={q} onChange={e=>setQ(e.target.value)}/>
     <select className="inp max-w-[200px]" aria-label="Filter by course" value={fc} onChange={e=>setFc(e.target.value)}><option value="">All courses</option>{(courses||[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
     <button className="btn2" onClick={exportCsv} disabled={!list.length}>⬇ Export CSV</button></div>
     {students===null?<div className="skel h-40"/>:list.length===0?<p className="py-8 text-center text-sm opacity-70">{students.length===0?'No students have enrolled yet. They appear here after their payment is confirmed.':'No students match your search.'}</p>
     :<div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="text-xs uppercase tracking-wide opacity-60"><th className="pb-2">Student</th><th>Course</th><th>Enrolled</th><th>Paid</th><th className="min-w-[160px]">Progress</th></tr></thead>
      <tbody>{list.map(s=><tr key={s.id} className="border-t border-slate-200/60 align-middle"><td className="py-2.5 pr-3"><div className="flex items-center gap-3"><span className="avatar h-9 w-9 text-xs" aria-hidden="true">{initials(s.student)}</span><div><b className="block text-navy">{s.student}</b><span className="text-xs opacity-60">{s.email}</span></div></div></td><td className="pr-3">{s.course}</td>
       <td className="whitespace-nowrap pr-3">{s.since?new Date(s.since).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'—'}</td><td className="pr-3 font-semibold">{inr(s.paid)}</td>
       <td><div className="flex items-center gap-2"><div className="pbar flex-1"><i style={{width:s.percent+'%'}}/></div><b className="w-10 text-right text-xs">{s.percent}%</b></div><div className="text-xs opacity-60">{s.done}/{s.total} lessons</div></td></tr>)}</tbody></table></div>}</section></div>}

   {tab==='resources'&&<section className="grid gap-4">
    {courses!==null&&courses.length===0?<Empty icon="📚" title="Create a course first">Add a course in the “Courses” section, then come back to upload content.</Empty>:<>
    <ResourceLibrary courses={courses||[]} cid={cid} setCid={setCid} topics={topics} flash={flash}/>
    <form className="box flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();const f=form(e),el=e.target;run(async()=>{await api.post(`/admin/courses/${cid}/topics`,f);el.reset()},'Topic added.')}}><h2 className="w-full text-lg text-navy">Topics</h2><input className="inp min-w-[200px] flex-1" name="title" placeholder="New topic title" aria-label="New topic title" required/><button className="btn">Add topic</button>
     <div className="flex w-full flex-wrap gap-1.5">{topics.map(t=><span key={t.id} className="chip">{t.title}</span>)}</div></form>
    <form className="box grid gap-2 md:grid-cols-4" onSubmit={e=>{e.preventDefault();const f={...form(e),courseId:cid},el=e.target;run(async()=>{await api.post('/admin/lessons',f);el.reset()},'Lesson added.')}}><h2 className="text-lg text-navy md:col-span-4">Video lesson (link)</h2>
     <select className="inp" name="topicId" aria-label="Topic" required defaultValue=""><option value="" disabled>{topics.length?'Select topic':'Add a topic first'}</option>{topics.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select><input className="inp" name="title" placeholder="Lesson title" aria-label="Lesson title" required/><input className="inp" name="videoUrl" placeholder="Video embed URL or .mp4 link" aria-label="Video URL" required/><button className="btn">Add lesson</button></form>
    <form className="box grid gap-2 md:grid-cols-5" onSubmit={e=>{e.preventDefault();const fd=new FormData(e.target),el=e.target;fd.append('courseId',cid);run(async()=>{await api.post('/admin/lessons/upload',fd,{onUploadProgress:p=>setUp(Math.round(p.loaded*100/(p.total||1)))});el.reset();setUp(0)},'Video lesson uploaded.')}}><h2 className="text-lg text-navy md:col-span-5">Video lesson (upload a file)</h2>
     <select className="inp" name="topicId" aria-label="Topic" required defaultValue=""><option value="" disabled>{topics.length?'Select topic':'Add a topic first'}</option>{topics.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select><input className="inp" name="title" placeholder="Video lesson title" aria-label="Video lesson title" required/><input className="inp md:col-span-2" name="file" type="file" aria-label="Video file" accept="video/mp4,video/webm,.mov,.m4v" required/><button className="btn">Upload video</button>
     {up>0&&up<100&&<div className="md:col-span-5"><div className="pbar"><i style={{width:up+'%'}}/></div><p className="mt-1 text-sm">Uploading… {up}%</p></div>}</form></>}</section>}

   {tab==='plans'&&<PlansPanel courses={courses||[]} flash={flash}/>}
  {tab==='demos'&&<div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
    <form className="box grid content-start gap-3" onSubmit={e=>{e.preventDefault();const f=form(e),el=e.target;run(async()=>{await api.post('/admin/demos',f);el.reset()},'Demo session created. It is now visible on the Demo Sessions page.')}}><h2 className="text-xl text-navy">Schedule a free demo</h2>
     <div><label htmlFor="dt">Topic</label><input id="dt" className="inp" name="topic" required maxLength={150} placeholder="Cardiovascular System: Introduction"/></div>
     <div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="dd">Date & time</label><input id="dd" className="inp" name="startsAt" type="datetime-local" required/></div><div><label htmlFor="ds">Seats</label><input id="ds" className="inp" name="maxSeats" type="number" min="1" max="1000" defaultValue="50" required/></div></div>
     <div><label htmlFor="dl">Join link (Meet / Zoom / in-site live)</label><input id="dl" className="inp" name="meetingLink" type="url" placeholder="https://meet.google.com/…"/></div><button className="btn">Create demo session</button></form>
    <section className="box"><h2 className="mb-3 text-xl text-navy">Scheduled demos</h2>{demos===null?<div className="skel h-32"/>:demos.length===0?<p className="py-6 text-center text-sm opacity-70">No demo sessions yet.</p>:<ul className="grid gap-2">{[...demos].sort((a,b)=>new Date(a.startsAt)-new Date(b.startsAt)).map(d=>{const t=new Date(d.startsAt);return <li key={d.id} className="flex items-center gap-3 rounded-xl border border-slate-200/70 px-3 py-2.5"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal to-brand2 text-center text-white"><div><div className="font-extrabold leading-none">{t.getDate()}</div><div className="text-[10px] uppercase">{t.toLocaleString('en-IN',{month:'short'})}</div></div></div><div className="min-w-0 flex-1"><b className="block truncate text-navy">{d.topic}</b><span className="text-xs opacity-60">{t.toLocaleString('en-IN',{weekday:'short',hour:'2-digit',minute:'2-digit'})}</span></div><span className="chip">{d.seatsTaken}/{d.maxSeats} seats</span></li>})}</ul>}</section></div>}

   {(tab==='messages'||tab==='doubts'||tab==='complaints')&&<Seg value={tab} set={setTab} items={[['messages','Contact messages'],['doubts',`Student doubts${pendingDoubts?` (${pendingDoubts})`:''}`],['complaints','Reports & complaints']]}/>}
  {tab==='complaints'&&<ReportsBoard scope="teacher"/>}
   {tab==='live'&&<section className="box"><h2 className="mb-1 text-xl text-navy">Live Sessions</h2><p className="mb-3 text-sm opacity-70">Teach in the browser with camera, whiteboard, pictures, files and chat. Students join from their dashboard.</p>{courses===null?<div className="skel h-24"/>:courses.length===0?<p className="py-6 text-center text-sm opacity-70">Create a course first.</p>:<ul className="grid gap-2">{courses.map(c=><LiveRow key={c.id} c={c} admin={admin}/>)}</ul>}</section>}
   {tab==='recordings'&&<section className="grid min-w-0 gap-4"><div><h2 className="text-2xl text-navy">Class recordings</h2><p className="text-sm opacity-75">Play, rename, publish or delete your recorded classes. Published recordings appear inside the course for enrolled students.</p></div><RecordingsLibrary scope={admin?'admin':'teacher'}/></section>}
  {tab==='profile'&&<Profile flash={flash}/>}
   {tab==='settings'&&<SettingsTab flash={flash}/>}
   {tab==='doubts'&&<section className="box"><h2 className="mb-3 text-xl text-navy">Student doubts</h2>{doubts===null?<div className="skel h-32"/>:doubts.length===0?<p className="py-6 text-center text-sm opacity-70">No doubts yet. 🎉</p>
     :<ul className="grid gap-2">{[...doubts].sort((a,b)=>(b.status==='PENDING')-(a.status==='PENDING')||b.id-a.id).map(d=><li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/70 px-3 py-2.5"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="text-navy">{d.userName||'Student'}</b><span className="chip">{d.category}</span><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${d.status==='ANSWERED'?'tag-ok':d.status==='IMPORTANT'?'tag-bad':'tag-wait'}`}>{d.status.toLowerCase()}</span></div><p className="mt-1 text-[15px]">{d.text}</p></div>
      <div className="flex gap-1">{['ANSWERED','IMPORTANT'].map(s=><button key={s} className="btn2 !min-h-[36px] !py-1 text-sm" disabled={d.status===s} onClick={()=>run(()=>api.put(`/admin/doubts/${d.id}/status`,{status:s}),'Doubt marked '+s.toLowerCase()+'.')}>{s.toLowerCase()}</button>)}</div></li>)}</ul>}</section>}

   {tab==='coupons'&&<CouponsExams courses={courses||[]} flash={flash}/>}
   {tab==='messages'&&<Inbox/>}<BackBar to="/" label="Back" hint={admin?'Admin workspace':'Teacher workspace'}/></div></div>}
