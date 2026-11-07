import {useCallback,useEffect,useRef,useState} from 'react'
import {useParams,Link} from 'react-router-dom'
import api,{msg,authUrl,livePrefs} from '../api'
import {useAuth} from '../App'
import {FilePreview,cat} from './Materials'
import {ClassRecorder,recordingSupported} from '../recorder'
import '../live-theme.css'
const ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'}]}
const COLORS=['#1c2a6b','#111111','#c0392b','#0f766e','#d97706','#7c3aed','#ffffff']
const BG={plain:{background:'#fffef6'},ruled:{background:'repeating-linear-gradient(transparent 0 39px,#cfe0ea 39px 40px) #fffef6'},
 grid:{backgroundColor:'#fffef6',backgroundImage:'linear-gradient(#dfe8ee 1px,transparent 1px),linear-gradient(90deg,#dfe8ee 1px,transparent 1px)',backgroundSize:'40px 40px'},board:{background:'#17352f'}}
const MODES={tablet:{icon:'✍️',label:'Tablet class',hint:'Your teacher is writing on a digital tablet. Notes appear live on the board.'},board:{icon:'📋',label:'Board class',hint:'Your teacher is teaching on a physical board. Watch the camera view.'}}
const IMG_OK=['jpg','jpeg','png','webp'],IMG_MAX=5*1048576
const clock=s=>s==null?'--:--':(s>=3600?Math.floor(s/3600)+':':'')+String(Math.floor(s%3600/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')
const rid=()=>'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)
const fsEl=()=>document.fullscreenElement||document.webkitFullscreenElement

/* ---- small pieces of the Live Session Tools panel ---- */
function Tile({icon,label,on,off,badge,onClick,disabled}){
 return <button type="button" className={`ltile ${off?'off':''}`} aria-pressed={on===undefined?undefined:!!on} disabled={disabled} onClick={onClick}><span className="text-2xl leading-none" aria-hidden="true">{icon}</span><span>{label}</span>{badge>0&&<span className="ltile-badge">{badge>9?'9+':badge}</span>}</button>}

function AttendanceTable({rows}){
  const byUser={}
  rows.forEach(r=>{ const k=String(r.userId); if(!byUser[k]) byUser[k]={name:r.userName,visits:0,minutes:0,first:r.joinedAt}; byUser[k].visits++; byUser[k].minutes+=(r.minutes||0); if(r.joinedAt&&r.joinedAt<byUser[k].first) byUser[k].first=r.joinedAt })
  const list=Object.values(byUser).sort((a,b)=>String(a.name).localeCompare(String(b.name)))
  return <div className="mt-2 grid gap-2">
    <p className="text-xs opacity-70">{rows.length} visit{rows.length===1?'':'s'} recorded across all live classes for this course.</p>
    {list.length===0?<p className="text-sm">No attendance has been recorded for this course yet.</p>:
    <div className="overflow-x-auto"><table className="w-full text-left text-xs">
      <thead><tr className="opacity-70"><th className="py-1 pr-2">Student</th><th className="pr-2">Visits</th><th className="pr-2">Total time</th><th>First joined</th></tr></thead>
      <tbody>{list.map((u,i)=><tr key={i} className="border-t border-slate-200/70"><td className="py-1 pr-2">{u.name}</td><td className="pr-2">{u.visits}</td><td className="pr-2">{Math.round(u.minutes)} min</td><td>{u.first?new Date(u.first).toLocaleString():'—'}</td></tr>)}</tbody></table></div>}
  </div>
}

function PeoplePane({roster,waitList,hands,allow,id,send}){
  const [report,setReport]=useState(null), [busy,setBusy]=useState(false), [err,setErr]=useState(''), [now,setNow]=useState(Date.now())
  useEffect(()=>{ const t=setInterval(()=>setNow(Date.now()),30000); return()=>clearInterval(t) },[])
  const since=t=>{ const m=Math.max(0,Math.round((now-t)/60000)); return m<60?m+' min':Math.floor(m/60)+' h '+(m%60)+' min' }
  const openReport=async()=>{ setBusy(true); setErr(''); try{ setReport((await api.get(`/staff/live/${id}/attendance`)).data) }catch(x){ setErr(msg(x)) } finally{ setBusy(false) } }
  const pill=on=>`rounded-full px-2 py-0.5 text-xs ${on?'bg-green-100 text-green-800':'bg-stone-200 text-stone-700'}`
  const btn='btn2 !py-0.5 !px-2 text-xs'
  return <div className="grid gap-3">
    {waitList.length>0&&<div className="grid gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-400/40 dark:bg-amber-400/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Waiting to be let in: {waitList.length}</h3>
        <button type="button" className={btn} onClick={()=>send({type:'admit_all'})}>Admit all</button>
      </div>
      <ul className="grid gap-2">{waitList.map(w=><li key={w.id} className="flex flex-wrap items-center gap-2">
        <b>{w.name}</b><span className="text-xs opacity-70">waiting {since(w.since)}</span>
        <span className="ml-auto flex gap-1"><button type="button" className={btn} onClick={()=>send({type:'admit',to:w.id})}>Admit</button><button type="button" className={btn} onClick={()=>send({type:'deny',to:w.id})}>Deny</button></span>
      </li>)}</ul>
    </div>}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">Students present: {roster.length}</h3>
      <button type="button" className={btn} disabled={roster.length===0} onClick={()=>send({type:'mute_all'})}>Mute all</button>
    </div>
    <fieldset className="flex flex-wrap gap-4 text-xs"><legend className="sr-only">Classroom permissions</legend>
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={allow.mic} onChange={e=>send({type:'perm',mic:e.target.checked,cam:allow.cam})}/> Students may unmute</label>
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={allow.cam} onChange={e=>send({type:'perm',mic:allow.mic,cam:e.target.checked})}/> Students may turn on camera</label>
    </fieldset>
    {roster.length===0?<p className="text-sm opacity-70">No students are in the class yet.</p>:
    <ul className="grid gap-2">{roster.map(s=>{ const raised=hands.some(h=>h.id===s.id); return <li key={s.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-teal/20 text-xs font-bold" aria-hidden="true">{(s.name||'?').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()}</span>
        <b>{s.name}</b><span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Connected</span>
        {raised&&<span className="text-xs" title="Hand raised">✋ hand raised</span>}
        <span className="ml-auto text-xs opacity-70">joined {new Date(s.joinedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} · {since(s.joinedAt)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={pill(s.mic)}>{s.mic?'Mic on':'Mic off'}</span>
        <span className={pill(s.cam)}>{s.cam?'Camera on':'Camera off'}</span>
        <span className="ml-auto flex flex-wrap gap-1">
          {s.mic?<button type="button" className={btn} onClick={()=>send({type:'mute',to:s.id})}>Mute</button>
            :<button type="button" className={btn} disabled={!allow.mic} title={allow.mic?'':'Students may not unmute right now'} onClick={()=>send({type:'request_unmute',to:s.id})}>Ask to unmute</button>}
          {s.cam?<button type="button" className={btn} onClick={()=>send({type:'disable_cam',to:s.id})}>Turn camera off</button>
            :<button type="button" className={btn} disabled={!allow.cam} title={allow.cam?'':'Students may not turn on the camera right now'} onClick={()=>send({type:'request_cam',to:s.id})}>Ask to turn camera on</button>}
        </span>
      </div>
    </li> })}</ul>}
    <div className="border-t border-slate-200/70 pt-3">
      <button type="button" className={btn} onClick={openReport} disabled={busy}>{busy?'Loading…':'Attendance report'}</button>
      {err&&<p role="alert" className="mt-2 text-xs text-rose-700">{err}</p>}
      {report&&<AttendanceTable rows={report}/>}
    </div>
  </div>
}

function HandsPane({hands,ack,lower}){
  return <div>
    <h3 className="mb-1 font-semibold">Raised hands</h3>
    <p className="mb-2 text-xs opacity-70">Students who want to ask something. Acknowledge a hand so they know you have seen it, then lower it when you are done.</p>
    {hands.length===0?<p className="text-sm opacity-70">No hands raised.</p>:
    <ul className="grid gap-2">{hands.map((h,i)=><li key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:bg-amber-900/20">
      <span className="flex items-center gap-2"><span aria-hidden="true">✋</span><b>{i+1}. {h.name}</b>{h.acked&&<span className="text-xs text-green-800">acknowledged</span>}</span>
      <span className="flex gap-1">{!h.acked&&<button type="button" className="btn2 !min-h-[30px] !px-2 !py-0.5 text-xs" onClick={()=>ack(h.id)}>Acknowledge</button>}
        <button type="button" className="btn2 !min-h-[30px] !px-2 !py-0.5 text-xs" onClick={()=>lower(h.id)}>Lower hand</button></span></li>)}</ul>}
  </div>
}

function Doubts({id,host}){const [list,setL]=useState([]),[t,setT]=useState(''),[cat,setCat]=useState('Concept'),[n,setN]=useState('')
 const load=()=>{if(host)api.get('/admin/doubts').then(r=>setL(r.data.filter(d=>String(d.courseId)===String(id)))).catch(()=>{})}
 useEffect(()=>{load();const i=setInterval(load,8000);return()=>clearInterval(i)},[])
 const ask=async e=>{e.preventDefault();try{await api.post('/doubts',{courseId:id,category:cat,text:t});setT('');setN('Doubt sent to your teacher.')}catch(x){setN(msg(x))}}
 const mark=(d,s)=>api.put(`/admin/doubts/${d.id}/status`,{status:s}).then(load)
 return <div><h3 className="mb-2 font-semibold">{host?'Student doubts':'Ask your doubt'}</h3>
  {host?<div>{list.map(d=><div key={d.id} className="border-b border-white/10 py-2 text-sm"><b>{d.userName||'Student'}</b> <span className="text-xs opacity-70">[{d.category}] {d.status}</span><p className="break-words">{d.text}</p>
   <div className="mt-1 flex gap-1"><button className="btn2 !min-h-[34px] !py-1 text-sm" onClick={()=>mark(d,'ANSWERED')}>Answered</button><button className="btn2 !min-h-[34px] !py-1 text-sm" onClick={()=>mark(d,'IMPORTANT')}>Important</button></div></div>)}{!list.length&&<p className="text-sm opacity-70">No doubts yet.</p>}</div>
  :<form onSubmit={ask} className="grid gap-2"><label htmlFor="lc">Category</label><select id="lc" className="inp" value={cat} onChange={e=>setCat(e.target.value)}>{['Concept','Clinical','MCQ','Notes','Other'].map(c=><option key={c}>{c}</option>)}</select>
   <label htmlFor="lq">Your question</label><textarea id="lq" className="inp" rows={3} value={t} onChange={e=>setT(e.target.value)} required/><button className="btn">Submit Doubt</button></form>}
  <p role="status" className="mt-2 text-sm text-teal">{n}</p></div>}

function Chat({msgs,me,send}){const [t,setT]=useState(''),box=useRef(null)
 useEffect(()=>{if(box.current)box.current.scrollTop=box.current.scrollHeight},[msgs.length])
 const go=e=>{e.preventDefault();const x=t.trim();if(!x)return;send(x);setT('')}
 return <div className="flex h-full min-h-[200px] flex-col"><div ref={box} role="log" aria-live="polite" aria-label="Class chat" className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
  {msgs.length===0&&<p className="py-6 text-center text-sm opacity-70">No messages yet. Say hello 👋</p>}
  {msgs.map((m,i)=><div key={m.ts+'-'+i} className={`rounded-xl px-3 py-1.5 text-sm ${m.from===me?'bg-teal/30':'bg-white/10'}`}><b className="mr-1">{m.name}</b>{m.role==='TEACHER'&&<span className="mr-1 rounded bg-amber-500 px-1 text-[10px] font-bold text-white">TEACHER</span>}<span className="break-words">{m.text}</span></div>)}</div>
  <form onSubmit={go} className="mt-2 flex gap-2"><input className="inp !min-h-[40px]" value={t} onChange={e=>setT(e.target.value)} maxLength={300} placeholder="Message the class" aria-label="Chat message"/><button className="btn !min-h-[40px] !px-4" aria-label="Send message">➤</button></form></div>}

function FilesPane({host,courseId,shared,share,unshare,open}){
 const [list,setL]=useState(null)
 useEffect(()=>{if(host&&courseId!=='0')api.get(`/courses/${courseId}/materials`).then(r=>setL(r.data)).catch(()=>setL([]))},[host,courseId])
 const isSh=id=>shared.some(s=>s.mid===id)
 const row=(key,c,title,right)=><li key={key} className="flex items-center gap-2 rounded-xl bg-white/10 px-2.5 py-2 text-sm"><span aria-hidden="true">{cat(c)[0]}</span><span className="min-w-0 flex-1 truncate" title={title}>{title}</span>{right}</li>
 if(!host)return <div><h3 className="mb-2 font-semibold">Shared by your teacher</h3>{shared.length===0?<p className="text-sm opacity-70">Nothing shared yet. Files your teacher shares during class appear here.</p>
  :<ul className="grid gap-1.5">{shared.map(s=>row(s.mid,s.category,s.title,<button className="btn2 !min-h-[34px] !px-3 !py-1 text-sm" onClick={()=>open({id:s.mid,title:s.title,category:s.category,fileName:s.title})}>Open</button>))}</ul>}</div>
 return <div><h3 className="mb-1 font-semibold">Share a course file</h3><UploadBox courseId={courseId} onDone={async m=>{ const l=(await api.get(`/courses/${courseId}/materials`)).data; setL(l); const mm=(m&&l.find(x=>x.id===m.id))||l[0]; if(mm) share(mm) }}/><p className="mb-2 text-xs opacity-70">Students see shared files here and can open them during class.</p>
  {list===null?<div className="skel h-16"/>:list.length===0?<p className="text-sm opacity-70">No files in this course yet. Upload some under Teacher → Resources.</p>
  :<ul className="grid gap-1.5">{list.map(m=>row(m.id,m.category,m.title,<><button className="btn2 !min-h-[34px] !px-2.5 !py-1 text-sm" onClick={()=>open(m)} aria-label={`View ${m.title}`}>👁</button>{isSh(m.id)?<button className="btn2 !min-h-[34px] !px-2.5 !py-1 text-sm" onClick={()=>unshare(m.id)}>Stop</button>:<button className="btn !min-h-[34px] !px-3 !py-1 text-sm" onClick={()=>share(m)}>Share</button>}</>))}</ul>}</div>}

/* The teacher's own preview (camera box): where it sits, as fractions of the board. Kept between visits on this device. */
const CAM_DEF={x:.72,y:.70,w:.26}
const camH=w=>w*1.04
const clampTo=(v,lo,hi)=>Math.max(lo,Math.min(hi,v))
const loadCam=()=>{try{const v=JSON.parse(localStorage.getItem('ms_cam_pos')||'null');return v&&typeof v.x==='number'&&typeof v.w==='number'?v:CAM_DEF}catch{return CAM_DEF}}
const camBox=p=>({left:p.x*100+'%',top:p.y*100+'%',width:p.w*100+'%',height:camH(p.w)*100+'%'})

/* Drag the teacher's preview anywhere; drop it to snap to a corner; drag the corner to resize; Reset returns it to the default place. */
function CamHandle({pos,setPos,stageRef}){
  const drag=useRef(null)
  useEffect(()=>{ try{ localStorage.setItem('ms_cam_pos',JSON.stringify(pos)) }catch{} },[pos])
  const down=mode=>e=>{ e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture&&e.currentTarget.setPointerCapture(e.pointerId)
    drag.current={mode,sx:e.clientX,sy:e.clientY,r:stageRef.current.getBoundingClientRect(),start:pos} }
  const move=e=>{ const d=drag.current; if(!d) return
    const dx=(e.clientX-d.sx)/d.r.width, dy=(e.clientY-d.sy)/d.r.height
    if(d.mode==='move') setPos(p=>({...p,x:clampTo(d.start.x+dx,0,1-p.w),y:clampTo(d.start.y+dy,0,1-camH(p.w))}))
    else setPos(p=>({...p,w:clampTo(d.start.w+dx,.14,.45),x:clampTo(p.x,0,1-clampTo(d.start.w+dx,.14,.45))})) }
  const up=()=>{ if(drag.current&&drag.current.mode==='move') setPos(p=>{ const cx=p.x+p.w/2, cy=p.y+camH(p.w)/2
      return {...p,x:cx<.5?.02:1-p.w-.02,y:cy<.5?.1:1-camH(p.w)-.03} }); drag.current=null }
  return <div role="group" aria-label="Your camera preview. Drag to move, drag the corner to resize." className="absolute z-[6] cursor-move rounded-lg ring-2 ring-white/60 hover:ring-teal/80 focus-within:ring-teal" style={{...camBox(pos),touchAction:'none'}}
    onPointerDown={down('move')} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
    <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">Drag to move</span>
    <button type="button" className="absolute right-1 top-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white hover:bg-black/75" onPointerDown={e=>e.stopPropagation()} onClick={()=>setPos(CAM_DEF)}>Reset</button>
    <span role="slider" aria-label="Resize your camera preview" aria-valuenow={Math.round(pos.w*100)} tabIndex={0} className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize rounded-tl bg-surface/80" style={{touchAction:'none'}}
      onPointerDown={down('resize')}/>
  </div>
}

/* The teacher sees each student who has turned their camera on. When a camera is off, the student's initial is shown instead. */
function StudentCams({feeds,peers,media}){
  const ids=Object.keys(feeds)
  if(ids.length===0) return null
  return <div className="absolute bottom-3 left-3 z-[5] flex max-w-[55%] flex-wrap gap-2" aria-label="Students' cameras">
    {ids.map(id=>{ const p=peers.find(x=>x.id===id); const on=media[id]?media[id].cam:true
      return <StudentCam key={id} stream={feeds[id]} name={p?p.name:'Student'} on={on}/> })}
  </div>
}
function StudentCam({stream,name,on}){
  const v=useRef(null)
  useEffect(()=>{ if(v.current) v.current.srcObject=stream },[stream])
  return <div className="relative h-20 w-28 overflow-hidden rounded-lg border border-white/40 bg-slate-800 shadow">
    <video ref={v} autoPlay playsInline className={`h-full w-full object-cover ${on?'':'invisible'}`} style={{transform:'scaleX(-1)'}}/>
    {!on&&<div className="absolute inset-0 grid place-items-center bg-slate-700 text-2xl font-bold text-white" aria-label="Camera off">{(name||'?').slice(0,1).toUpperCase()}</div>}
    <span className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 text-[10px] text-white">{name}</span>
  </div>
}

/* Upload a file from the live room. It is saved as course material (same checks as Resources) and shared with the class straight away. */
function UploadBox({courseId,onDone}){
  const [up,setUp]=useState(null)
  const pick=async e=>{
    const f=e.target.files&&e.target.files[0]; e.target.value=''
    if(!f) return
    setUp({name:f.name,pct:0})
    const fd=new FormData(); fd.append('courseId',courseId); fd.append('kind','RESOURCE'); fd.append('title',f.name.replace(/\.[^.]+$/,'').slice(0,120)); fd.append('file',f)
    try{
      const r=await api.post('/admin/materials',fd,{onUploadProgress:ev=>setUp(u=>u&&{...u,pct:Math.round(ev.loaded*100/(ev.total||ev.loaded||1))})})
      setUp({name:f.name,done:true,pct:100})
      await onDone(r.data)
    }catch(x){ setUp({name:f.name,err:msg(x)}) }
  }
  return <div className="mb-3 grid gap-2 rounded-xl border border-dashed border-teal/50 p-3">
    <label className="btn !min-h-[38px] w-fit cursor-pointer text-sm">Upload a file<input type="file" className="sr-only" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,.mov" onChange={pick}/></label>
    <p className="text-xs opacity-70">PDF, Word, PowerPoint, Excel, text, images or video. Up to the limits shown in Resources. The file is shared with the class when it finishes.</p>
    {up&&!up.err&&!up.done&&<div className="grid gap-1" role="status"><span className="text-xs">Uploading {up.name}… {up.pct}%</span><div className="h-2 overflow-hidden rounded bg-white/20"><div className="h-full bg-teal transition-all" style={{width:up.pct+'%'}}/></div></div>}
    {up&&up.done&&<p role="status" className="text-xs text-green-300">✓ {up.name} uploaded and shared with the class.</p>}
    {up&&up.err&&<p role="alert" className="text-xs text-amber-300">{up.name}: {up.err}</p>}
  </div>
}

export function Live(){
 const {id}=useParams(),{user}=useAuth(),host=user.role==='TEACHER',prefs=livePrefs()
 const cv=useRef(null),ws=useRef(null),pcs=useRef({}),pend=useRef({}),roles=useRef({}),local=useRef(null),out=useRef(null),shareS=useRef(null),vid=useRef(null),remote=useRef(null),frame=useRef(null),stage=useRef(null),room=useRef(null),imgIn=useRef(null)
 const strokes=useRef(new Map()),order=useRef([]),cur=useRef(null),buf=useRef([]),last=useRef(0),drag=useRef(null),myId=useRef(''),hideT=useRef(null),over=useRef(false),toastT=useRef(null),flags=useRef({open:false,sec:'draw'}),waitN=useRef(0),upT=useRef(null),retry=useRef(0),stoppedRef=useRef(false)
 const [phase,setPhase]=useState('lobby'),[bg,setBg]=useState(prefs.bg),[tool,setTool]=useState('pen'),[color,setColor]=useState(COLORS[0]),[size,setSize]=useState(4)
 const [roster,setRoster]=useState([]),[allow,setAllow]=useState({mic:true,cam:true}),[notice,setNotice]=useState(''),[req,setReq]=useState(null),[hands,setHands]=useState([]),[myHand,setMyHand]=useState(false),[feeds,setFeeds]=useState({}),[media,setMedia]=useState({}),[camPos,setCamPos]=useState(loadCam),[mic,setMic]=useState(host),[cam,setCam]=useState(host),[peers,setPeers]=useState([]),[err,setErr]=useState(''),[tin,setTin]=useState(false),[sharing,setSh]=useState(false),[big,setBig]=useState(false),[mode,setMode]=useState(prefs.mode==='board'?'board':'tablet'),[waitList,setWaitList]=useState([]),[wait,setWait]=useState(null),[tGone,setTGone]=useState(false),[endNote,setEndNote]=useState(''),[endRep,setEndRep]=useState(null)
 const [open,setOpen]=useState(false),[sec,setSec]=useState(host?'draw':'chat'),[rfs,setRfs]=useState(false),[pfs,setPfs]=useState(false),[ui,setUi]=useState(true),[autoHide,setAutoHide]=useState(true)
 const [imgs,setImgs]=useState([]),[sel,setSel]=useState(null),[busy,setBusy]=useState(false),[msgs,setMsgs]=useState([]),[unread,setUnread]=useState({chat:0,files:0}),[shared,setShared]=useState([]),[prev,setPrev]=useState(null),[toast,setToast]=useState(''),[t0,setT0]=useState(null),[now,setNow]=useState(Date.now())
 const fsOn=rfs||pfs,showUi=!autoHide||ui||open
 flags.current={open,sec}
 const [ltheme,setLtheme]=useState(()=>localStorage.getItem('ms_live_theme')||'studio')
 const [rec,setRec]=useState('idle'),[ri,setRi]=useState(null),[askRec,setAskRec]=useState(false),[consent,setConsent]=useState(false),[recTitle,setRecTitle]=useState(''),[recOn,setRecOn]=useState(null)
 const recRef=useRef(null),recBg=useRef('#fffef6'),recMode=useRef(mode)
 recBg.current=mode==='board'?'#0b1512':bg==='board'?'#17352f':'#fffef6'
 recMode.current=mode
 const note=useCallback(m=>{setToast(m);clearTimeout(toastT.current);toastT.current=setTimeout(()=>setToast(''),4500)},[])
 const send=o=>{if(ws.current&&ws.current.readyState===1)ws.current.send(JSON.stringify(o))}

 /* ---------- whiteboard drawing ---------- */
 const draw=(s,from)=>{const c=cv.current;if(!c||!s.pts.length)return;const x=c.getContext('2d'),W=c.width,H=c.height,p=s.pts
  x.save();x.lineCap='round';x.lineJoin='round';x.strokeStyle=s.color;x.fillStyle=s.color;x.lineWidth=s.tool==='pen'?s.size:s.size*4
  if(s.tool==='eraser')x.globalCompositeOperation='destination-out';if(s.tool==='hl')x.globalAlpha=.35
  const a=Math.max(from-1,0);x.beginPath();x.moveTo(p[a][0]*W,p[a][1]*H)
  if(p.length===1){x.arc(p[0][0]*W,p[0][1]*H,x.lineWidth/2,0,7);x.fill()}else{for(let i=a+1;i<p.length;i++)x.lineTo(p[i][0]*W,p[i][1]*H);x.stroke()}x.restore()}
 const stroke=m=>{let s=strokes.current.get(m.sid);if(!s){s={tool:m.tool,color:m.color,size:m.size,pts:[]};strokes.current.set(m.sid,s);order.current.push(m.sid)}const from=s.pts.length;s.pts.push(...m.pts);draw(s,from)}
 const wipe=()=>{const c=cv.current;if(c)c.getContext('2d').clearRect(0,0,c.width,c.height)}
 const redraw=()=>{wipe();order.current.forEach(k=>draw(strokes.current.get(k),0))}

 /* ---------- WebRTC + messages from the server ---------- */
 const makePc=pid=>{if(pcs.current[pid])pcs.current[pid].close();const pc=new RTCPeerConnection(ICE);pcs.current[pid]=pc;pc.onicecandidate=e=>{if(e.candidate)send({type:'ice',to:pid,cand:e.candidate})}
  // If the network path breaks, the teacher sends a fresh offer so the student can connect again.
  pc.oniceconnectionstatechange=()=>{if(pc.iceConnectionState==='failed'&&host&&!stoppedRef.current)call(pid)}
  if(host)out.current.getTracks().forEach(t=>pc.addTrack(t,out.current));else pc.ontrack=e=>{remote.current=e.streams[0];if(vid.current)vid.current.srcObject=remote.current;setTin(true)};return pc}
 const flushIce=pid=>{const pc=pcs.current[pid];(pend.current[pid]||[]).forEach(c=>pc.addIceCandidate(c).catch(()=>{}));pend.current[pid]=[]}
 const call=async pid=>{const pc=makePc(pid);await pc.setLocalDescription(await pc.createOffer());send({type:'offer',to:pid,sdp:pc.localDescription})}
 const callUp=async tid=>{ const key='up:'+tid; if(pcs.current[key]||!local.current) return
    const pc=new RTCPeerConnection(ICE); pcs.current[key]=pc
    local.current.getTracks().forEach(t=>pc.addTrack(t,local.current))
    pc.onicecandidate=e=>{if(e.candidate)send({type:'ice',to:tid,kind:'up',cand:e.candidate})}
    await pc.setLocalDescription(await pc.createOffer()); send({type:'offer',to:tid,kind:'up',sdp:pc.localDescription}) }
  // A student's camera or microphone is requested only when they press its button, and released when it is turned off.
  const refreshUp=()=>{ clearTimeout(upT.current); upT.current=setTimeout(()=>{ Object.keys(roles.current).forEach(pid=>{ if(roles.current[pid]!=='TEACHER'||!local.current) return; const k='up:'+pid; if(pcs.current[k]){ pcs.current[k].close(); delete pcs.current[k] } callUp(pid) }) },250) }
  const acquire=async kind=>{
    if(local.current&&local.current.getTracks().some(t=>t.kind===kind)) return true
    let s
    try{ s=await navigator.mediaDevices.getUserMedia(kind==='video'?{video:true}:{audio:true}) }
    catch(e){ const dev=kind==='video'?'camera':'microphone'
      setNotice(e&&e.name==='NotAllowedError'?`Your ${dev} is blocked. Allow access in your browser settings, then try again.`:e&&e.name==='NotFoundError'?`No ${dev} was found on this device.`:`Could not start your ${dev}. Check that no other app is using it.`)
      return false }
    if(!local.current) local.current=new MediaStream()
    s.getTracks().forEach(t=>{ t.enabled=true; local.current.addTrack(t) })
    refreshUp(); return true }
  const release=kind=>{ if(!local.current) return; let changed=false
    local.current.getTracks().filter(t=>t.kind===kind).forEach(t=>{ t.stop(); local.current.removeTrack(t); changed=true })
    if(changed) refreshUp() }
  // the teacher accepts a student's camera connection and shows the student's picture
  const acceptUp=async m=>{ const key='up:'+m.from; if(pcs.current[key]) pcs.current[key].close()
    const pc=new RTCPeerConnection(ICE); pcs.current[key]=pc
    pc.onicecandidate=e=>{if(e.candidate)send({type:'ice',to:m.from,kind:'up',cand:e.candidate})}
    pc.ontrack=e=>{ const st=e.streams[0]||new MediaStream([e.track]); setFeeds(f=>({...f,[m.from]:st})) }
    await pc.setRemoteDescription(m.sdp)
    ;(pend.current[key]||[]).forEach(c=>pc.addIceCandidate(c).catch(()=>{})); pend.current[key]=[]
    await pc.setLocalDescription(await pc.createAnswer()); send({type:'answer',to:m.from,kind:'up',sdp:pc.localDescription}) }
  const clockFrom=m=>{if(m.startedAt>0&&m.now>0)setT0(m.startedAt+(Date.now()-m.now))}   // server clock -> this device's clock
 const onMsg=async m=>{switch(m.type){
  case 'welcome':setWait(null);myId.current=m.id;if(!host){setBg(m.bg)}clockFrom(m);setPeers(m.peers);m.peers.forEach(p=>{roles.current[p.id]=p.role;if(host&&p.role==='STUDENT')call(p.id)});if(m.peers.some(p=>p.role==='TEACHER')){setTin(true);setTGone(false)}if(m.recording&&!host){setRecOn({on:true,paused:false});note('🔴 This class is being recorded. Recordings are shared only with students of this course.')}break
  case 'join':roles.current[m.id]=m.role;if(!host&&m.role==='TEACHER'&&local.current)callUp(m.id);setPeers(p=>[...p,m]);if(host&&m.role==='STUDENT')call(m.id);if(m.role==='TEACHER'){setTin(true);setTGone(false);clockFrom(m)}break
  case 'leave':setFeeds(f=>{const c={...f};delete c[m.id];return c});setMedia(x=>{const c={...x};delete c[m.id];return c});if(pcs.current['up:'+m.id]){pcs.current['up:'+m.id].close();delete pcs.current['up:'+m.id]}setPeers(p=>p.filter(x=>x.id!==m.id));if(pcs.current[m.id]){pcs.current[m.id].close();delete pcs.current[m.id]}if(roles.current[m.id]==='TEACHER'){setTin(false);setTGone(true);if(vid.current)vid.current.srcObject=null};break
  case 'media':if(host)setMedia(x=>({...x,[m.from]:{cam:!!m.cam,mic:!!m.mic}}));break
  case 'stroke':stroke(m);break
  case 'undo':{const k=order.current.pop();strokes.current.delete(k);redraw();break}
  case 'clear':strokes.current.clear();order.current=[];wipe();break
  case 'bg':setBg(m.bg);break
  case 'rec':if(!host){setRecOn(m.on?{on:true,paused:!!m.paused}:null);note(m.on?(m.paused?'Recording paused.':'🔴 Your teacher is recording this class.'):'Recording stopped.')}break
  case 'mode':setMode(m.mode==='board'?'board':'tablet');break
  case 'img':{const n={iid:m.iid,url:m.url,x:m.x,y:m.y,w:m.w,ar:m.ar};setImgs(l=>l.some(i=>i.iid===n.iid)?l.map(i=>i.iid===n.iid?n:i):[...l,n]);break}
  case 'imgmove':setImgs(l=>l.map(i=>i.iid===m.iid?{...i,x:m.x??i.x,y:m.y??i.y,w:m.w??i.w}:i));break
  case 'imgdel':setImgs(l=>l.filter(i=>i.iid!==m.iid));setSel(s=>s===m.iid?null:s);break
  case 'chat':{setMsgs(l=>[...l.slice(-199),m]);const f=flags.current;if(m.from!==myId.current&&!(f.open&&f.sec==='chat'))setUnread(u=>({...u,chat:u.chat+1}));break}
  case 'waiting':setWait({teacher:!!m.teacher});break
  case 'waiting_list':{const list=m.list||[];if(host&&list.length>waitN.current){const n=list[list.length-1];note('🙋 '+(n?n.name:'A student')+' is waiting to be let in')}waitN.current=list.length;setWaitList(list);break}
  case 'denied':setWait(null);setErr('Your teacher did not let you into this class.');break
  case 'class_ended':setEndNote(m.message||'This live class has ended. Thank you for attending!');stop();setPhase('ended');break
  case 'roster':setRoster(m.list||[]);break;
  case 'perm':setAllow({mic:m.mic!==false,cam:m.cam!==false});
    if(!host&&m.mic===false){ release('audio'); setMic(false) }
    if(!host&&m.cam===false){ release('video'); setCam(false) }
    break;
  case 'mute':if(!host){ release('audio'); setMic(false); setReq(null); setNotice('Your teacher muted your microphone.') } break;
  case 'disable_cam':if(!host){ release('video'); setCam(false); setNotice('Your teacher turned off your camera.') } break;
  case 'request':if(!host){ setReq({what:m.what}); setNotice(m.what==='mic'?'Your teacher asks you to unmute your microphone.':'Your teacher asks you to turn on your camera.') } break;
  case 'hands':setHands(m.list||[]);break;
  case 'hand':setHands(l=>m.on?[...l.filter(h=>h.id!==m.id),{id:m.id,name:m.name,acked:false}]:l.filter(h=>h.id!==m.id));if(m.id===myId.current)setMyHand(!!m.on);break;
  case 'hand_ack':setHands(l=>l.map(h=>h.id===m.id?{...h,acked:true}:h));break;
  case 'share':{const it={mid:m.mid,title:m.title,category:m.category};setShared(l=>[...l.filter(x=>x.mid!==it.mid),it]);if(!host){const f=flags.current;if(!(f.open&&f.sec==='files'))setUnread(u=>({...u,files:u.files+1}));note('📄 Your teacher shared: '+m.title)}break}
  case 'unshare':setShared(l=>l.filter(x=>x.mid!==m.mid));break
  case 'offer':{if(m.kind==='up'){await acceptUp(m);break}const pc=makePc(m.from);await pc.setRemoteDescription(m.sdp);flushIce(m.from);await pc.setLocalDescription(await pc.createAnswer());send({type:'answer',to:m.from,sdp:pc.localDescription});break}
  case 'answer':{const k=m.kind==='up'?'up:'+m.from:m.from;const pc=pcs.current[k];if(pc){await pc.setRemoteDescription(m.sdp);flushIce(k)}break}
  case 'ice':{const k=m.kind==='up'?'up:'+m.from:m.from;const pc=pcs.current[k];if(pc&&pc.remoteDescription)pc.addIceCandidate(m.cand).catch(()=>{});else(pend.current[k]=pend.current[k]||[]).push(m.cand);break}
  default:}}
 useEffect(()=>{ if(!host) send({type:'media',cam,mic}) },[cam,mic])

 /* Start or reconnect. again=true is a silent reconnect: chat, board and files stay as they were. */
 const start=async(again)=>{stoppedRef.current=false;setErr('')
  if(!again){retry.current=0;setWait(null);setWaitList([]);waitN.current=0;strokes.current.clear();order.current=[];setImgs([]);setMsgs([]);setShared([]);setUnread({chat:0,files:0});setT0(null)}
  try{if(host&&!local.current){let s;try{s=await navigator.mediaDevices.getUserMedia({video:true,audio:true})}catch(e){s=await navigator.mediaDevices.getUserMedia({audio:true})}local.current=s;out.current=s;vid.current.srcObject=s}
   const u=JSON.parse(localStorage.getItem('ms_user')),w=new WebSocket(`${(import.meta.env.VITE_WS_URL||((location.protocol==='https:'?'wss':'ws')+'://'+location.host)).replace(/\/$/,'')}/ws/live?room=${id}&token=${u.token}`)
   let opened=false
   ws.current=w
   w.onopen=()=>{opened=true;retry.current=0;setPhase('live');if(host){w.send(JSON.stringify({type:'mode',mode}));if(bg!=='plain')w.send(JSON.stringify({type:'bg',bg}))}}
   w.onmessage=e=>onMsg(JSON.parse(e.data))
   w.onclose=()=>{
     if(stoppedRef.current)return                       // the class was ended on purpose: never reconnect
     if(recRef.current){note('Connection to the class was lost. The recording continues and is saved when you stop it.');return}
     if(!host&&retry.current<8){                        // students retry with growing delays (covers Render waking up)
       retry.current++
       note('Connection lost. Reconnecting…')
       setTimeout(()=>{if(!stoppedRef.current)start(true)},Math.min(1000*2**retry.current,15000))
       return}
     if(!opened){setErr('Could not reach the class server. If the site was idle, wait 30-60 seconds and press Join again.');return}
     setPhase('ended')}
  }catch(e){setErr('Could not start. Allow camera and microphone access in your browser, then try again.')}}
 const stop=()=>{stoppedRef.current=true;clearTimeout(upT.current);if(ws.current)ws.current.close();[local.current,shareS.current].forEach(s=>s&&s.getTracks().forEach(t=>t.stop()));Object.values(pcs.current).forEach(p=>p.close())}
 useEffect(()=>()=>{if(recRef.current)recRef.current.stop();stop()},[])
 useEffect(()=>{if(rec!=='recording'&&rec!=='paused'&&rec!=='saving')return;const h=e=>{e.preventDefault();e.returnValue=''};addEventListener('beforeunload',h);return()=>removeEventListener('beforeunload',h)},[rec])
 useEffect(()=>{if(phase!=='live'||!vid.current)return;const s=host?out.current:remote.current;if(s&&vid.current.srcObject!==s)vid.current.srcObject=s},[phase])
 useEffect(()=>{if(phase!=='live')return;const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[phase])

 /* ---------- camera / mic / screen ---------- */
 const flipCam=async()=>{try{const c=local.current.getVideoTracks()[0],face=c?.getSettings().facingMode==='environment'?'user':'environment'
   const t=(await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:face}}})).getVideoTracks()[0];if(c){local.current.removeTrack(c);c.stop()}local.current.addTrack(t);setErr('');if(!shareS.current||!sharing)swapVideo(t)}catch(e){note('Could not switch the camera.')}}
 const swapVideo=t=>{out.current=new MediaStream([t,...local.current.getAudioTracks()]);Object.values(pcs.current).forEach(pc=>{const s=pc.getSenders().find(x=>x.track&&x.track.kind==='video');if(s)s.replaceTrack(t)});vid.current.srcObject=out.current}
 const endShare=()=>{if(shareS.current)shareS.current.getTracks().forEach(t=>t.stop());const c=local.current.getVideoTracks()[0];if(c)swapVideo(c);setSh(false)}
 const share=async()=>{if(sharing)return endShare();try{const s=await navigator.mediaDevices.getDisplayMedia({video:true});shareS.current=s;const t=s.getVideoTracks()[0];t.onended=endShare;swapVideo(t);setSh(true)}catch(e){}}
 const toggle=async(kind,on,set)=>{if(!host&&!on&&((kind==='audio'&&!allow.mic)||(kind==='video'&&!allow.cam))){ setNotice('Your teacher has turned off '+(kind==='audio'?'microphone':'camera')+' access for students.'); return }
  if(host){local.current.getTracks().filter(t=>t.kind===kind).forEach(t=>{t.enabled=!on});set(!on);return}
  if(on){release(kind);set(false);return}
  if(await acquire(kind))set(true)}

 /* ---------- drawing pointer handlers ---------- */
 const pt=e=>{const r=cv.current.getBoundingClientRect();return[Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),Math.min(1,Math.max(0,(e.clientY-r.top)/r.height))]}
 const flush=()=>{if(cur.current&&buf.current.length){send({type:'stroke',...cur.current,pts:buf.current});buf.current=[]}}
 const down=e=>{if(!host||tool==='move')return;cv.current.setPointerCapture(e.pointerId);const p=pt(e);cur.current={sid:Date.now().toString(36)+Math.random().toString(36).slice(2,6),tool,color,size};stroke({...cur.current,pts:[p]});buf.current=[p];flush();last.current=Date.now()}
 const move=e=>{if(!cur.current)return;const p=pt(e);stroke({...cur.current,pts:[p]});buf.current.push(p);if(Date.now()-last.current>50){flush();last.current=Date.now()}}
 const up=()=>{flush();cur.current=null}
 const act=(type,extra={})=>{send({type,...extra});onMsg({type,...extra})}

 /* ---------- pictures on the board: insert, move, resize, remove ---------- */
 const pickImage=()=>{setSec('image');imgIn.current?.click()}
 const onImageFile=async e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return
  const ext=(f.name.split('.').pop()||'').toLowerCase()
  if(!IMG_OK.includes(ext)||(f.type&&!/^image\/(jpeg|png|webp)$/.test(f.type)))return note('Choose a JPG, PNG or WEBP image.')
  if(f.size===0)return note('That image file is empty.')
  if(f.size>IMG_MAX)return note(`That image is ${(f.size/1048576).toFixed(1)} MB. The limit is 5 MB.`)
  if(imgs.length>=30)return note('The board already has 30 images. Remove one first.')
  setBusy(true)
  try{const el=await new Promise((ok,no)=>{const u=URL.createObjectURL(f),i=new Image();i.onload=()=>{URL.revokeObjectURL(u);ok(i)};i.onerror=()=>{URL.revokeObjectURL(u);no(new Error('bad'))};i.src=u})
   const fd=new FormData();fd.append('file',f);const r=await api.post(`/live/${id}/image`,fd)
   const ar=(el.naturalWidth/el.naturalHeight)||1.5,w=Math.min(.4,.6*ar*9/16),h=w*(16/9)/ar,iid=rid()
   act('img',{iid,url:r.data.url,x:(1-w)/2,y:Math.max(.02,(1-h)/2),w,ar});setSel(iid);setTool('move');note('Image added. Drag it to move, pull the corner dot to resize.')
  }catch(x){note(x?.response?msg(x):'That file could not be read as an image.')}finally{setBusy(false)}}
 const imgDown=(e,im,m)=>{if(!host||tool!=='move')return;e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);const r=stage.current.getBoundingClientRect();drag.current={iid:im.iid,m,sx:e.clientX,sy:e.clientY,ox:im.x,oy:im.y,ow:im.w,W:r.width,H:r.height,t:0,patch:{}};setSel(im.iid)}
 const imgMove=e=>{const d=drag.current;if(!d)return;e.stopPropagation();const dx=(e.clientX-d.sx)/d.W,dy=(e.clientY-d.sy)/d.H
  const p=d.m==='move'?{x:Math.min(1.1,Math.max(-.4,d.ox+dx)),y:Math.min(1.1,Math.max(-.4,d.oy+dy))}:{w:Math.min(1.5,Math.max(.05,d.ow+dx))}
  d.patch={...d.patch,...p};setImgs(l=>l.map(i=>i.iid===d.iid?{...i,...p}:i));if(Date.now()-d.t>40){d.t=Date.now();send({type:'imgmove',iid:d.iid,...d.patch})}}
 const imgUp=e=>{const d=drag.current;if(!d)return;e.stopPropagation();send({type:'imgmove',iid:d.iid,...d.patch});drag.current=null}
 const delImg=iid=>act('imgdel',{iid})

 /* ---------- chat + shared files ---------- */
 const say=t=>send({type:'chat',text:t})
 const sendRaw=o=>{if(ws.current&&ws.current.readyState===1)ws.current.send(JSON.stringify(o))}
 const raiseHand=on=>sendRaw({type:'hand',on})
 const ackHand=id=>sendRaw({type:'hand_ack',to:id})
 const lowerHand=id=>sendRaw({type:'hand_lower',to:id})
 const shareFile=m=>act('share',{mid:m.id,title:m.title,category:m.category})
 const unshare=mid=>act('unshare',{mid})

 /* ---------- full screen: the WHOLE classroom goes full screen (not just the board), so every control stays available ---------- */
 const toggleFs=()=>{if(fsOn){if(fsEl()){(document.exitFullscreen||document.webkitExitFullscreen).call(document)}setPfs(false);return}
  const el=room.current,rq=el&&(el.requestFullscreen||el.webkitRequestFullscreen)
  if(rq){try{const r=rq.call(el);if(r&&r.catch)r.catch(()=>setPfs(true))}catch(e){setPfs(true)}}else setPfs(true)}   // iPhone/old browsers: fill the window instead
 useEffect(()=>{const f=()=>setRfs(!!fsEl()&&fsEl()===room.current);document.addEventListener('fullscreenchange',f);document.addEventListener('webkitfullscreenchange',f);return()=>{document.removeEventListener('fullscreenchange',f);document.removeEventListener('webkitfullscreenchange',f)}},[phase])
 const poke=useCallback(()=>{setUi(true);clearTimeout(hideT.current);hideT.current=setTimeout(()=>{if(!over.current&&!flags.current.open)setUi(false)},3000)},[])
 useEffect(()=>{if(autoHide)poke();else{clearTimeout(hideT.current);setUi(true)}return()=>clearTimeout(hideT.current)},[autoHide,open,poke])
 useEffect(()=>{if(phase!=='live')return;const k=e=>{const t=e.target&&e.target.tagName;if(e.key==='Escape'&&pfs){setPfs(false);return}
   if(/INPUT|TEXTAREA|SELECT/.test(t||'')||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='f'||e.key==='F')toggleFs();if((e.key==='t'||e.key==='T')&&host)setOpen(o=>!o);if((e.key==='m'||e.key==='M')&&host)toggle('audio',mic,setMic)};addEventListener('keydown',k);return()=>removeEventListener('keydown',k)})
 const openSec=s=>{setSec(s);if(s==='chat'||s==='files')setUnread(u=>({...u,[s]:0}))}
 const togglePanel=()=>{setOpen(o=>!o);if(sec==='chat'||sec==='files')setUnread(u=>({...u,[sec]:0}))}
 const openPanel=sx=>{setSec(sx);setOpen(true);if(sx==='chat'||sx==='files')setUnread(u=>({...u,[sx]:0}))}
 const downloadBlob=(b,n)=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}
 /* Class recording (teacher). The board, pictures, the teacher's camera and microphone are recorded in this browser and
    uploaded in numbered parts while the class runs. Students are told when recording starts; the recording stays private
    to this course until the teacher publishes it. */
 const paintFrame=(x,W,H)=>{x.fillStyle=recBg.current;x.fillRect(0,0,W,H)
  if(cv.current)x.drawImage(cv.current,0,0,W,H)
  const st=stage.current;if(st){const sr=st.getBoundingClientRect()
   document.querySelectorAll('.bimg img').forEach(im=>{if(!im.complete||!im.naturalWidth)return;const r=im.getBoundingClientRect(),ar=im.naturalWidth/im.naturalHeight;let w=r.width,h=w/ar;if(h>r.height){h=r.height;w=h*ar}
    x.drawImage(im,((r.left+(r.width-w)/2)-sr.left)/sr.width*W,((r.top+(r.height-h)/2)-sr.top)/sr.height*H,w/sr.width*W,h/sr.height*H)})}
  const v=vid.current
  if(v&&v.readyState>=2&&v.videoWidth){if(recMode.current==='board')x.drawImage(v,0,0,W,H)
   else{const dx=W*.72,dy=H*.7,dw=W*.26,dh=H*.27;let sw=v.videoWidth,sh=v.videoHeight;const ar=sw/sh,bar=dw/dh;if(ar>bar)sw=sh*bar;else sh=sw/bar
    x.save();x.beginPath();x.rect(dx,dy,dw,dh);x.clip();x.drawImage(v,(v.videoWidth-sw)/2,(v.videoHeight-sh)/2,sw,sh,dx,dy,dw,dh);x.restore()}}}
 const openConsent=()=>{if(!recordingSupported()||!local.current){note('This browser cannot record. Try Chrome, Edge or Firefox.');return}setConsent(false);setAskRec(true)}
 const beginRec=async()=>{if(!consent||recRef.current)return;setAskRec(false)
  let info;try{info=(await api.post('/recordings/sessions',{courseId:id,title:recTitle.trim(),consent:true})).data}catch(x){note(msg(x));return}
  const r=new ClassRecorder({id:info.id,stream:local.current,draw:paintFrame,onChange:s=>{setRi(s)
   if(s.status==='recording'||s.status==='paused')setRec(s.status)
   if(s.status==='failed'&&recRef.current===r){note('Recording stopped: '+(s.lastError||'unknown problem')+' Saving what was recorded.');stopRecording()}}})
  recRef.current=r;setRi(r.snapshot())
  try{r.start()}catch(e){recRef.current=null;r.destroy();api.post(`/recordings/${info.id}/abort`,{reason:e.message}).catch(()=>{});return note(e.message)}
  setRec('recording');send({type:'rec',on:true,paused:false});note('Recording started. Students have been told the class is recorded.')}
 const togglePause=()=>{const r=recRef.current;if(!r)return
  if(r.status==='paused'){r.resume();send({type:'rec',on:true,paused:false});note('Recording resumed.')}
  else{r.pause();send({type:'rec',on:true,paused:true});note('Recording paused. Nothing is recorded until you resume.')}}
 const stopRecording=async()=>{const r=recRef.current;if(!r)return;recRef.current=null;send({type:'rec',on:false});setRec('saving');note('Saving the recording. Keep this tab open until it is saved.')
  const res=await r.stop(),v=res.view
  if(res.ok&&v&&v.status==='READY')note(res.interrupted?'Recording saved, but it stopped early: '+res.message:'Recording saved. Find it under Recordings in your teacher dashboard.')
  else{const b=r.unsavedBlob();if(b&&b.size>1024){downloadBlob(b,'class-recording-backup.webm');note('The recording could not be saved on the server, so a copy was downloaded to your device.')}else note(res.message||'The recording could not be saved.')}
  setRec('idle');setRi(r.snapshot())}
 const toolKey=e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;const items=[...e.currentTarget.querySelectorAll('[data-tb]:not([disabled])')],i=items.indexOf(document.activeElement);if(i<0)return;e.preventDefault()
  let n=e.key==='ArrowRight'?i+1:e.key==='ArrowLeft'?i-1:e.key==='Home'?0:items.length-1;items[(n+items.length)%items.length].focus()}
 const endClass=async()=>{if(host&&!confirm(recRef.current?'End the live class for everyone? The recording will be saved.':'End the live class for everyone?'))return;if(recRef.current)await stopRecording();if(fsEl())(document.exitFullscreen||document.webkitExitFullscreen).call(document);setPfs(false);if(host)send({type:'end'});stop();setPhase('ended')}

 const T=({k,children})=><button className={`btn2 !min-h-[40px] ${tool===k?'bg-teal/20 !border-teal':''}`} aria-pressed={tool===k} onClick={()=>setTool(k)}>{children}</button>
 const students=peers.filter(p=>p.role==='STUDENT').length+(host?0:1)
 const secs=t0?Math.max(0,Math.floor((now-t0)/1000)):null

 if(phase==='lobby'||phase==='ended')return <div className="box mx-auto max-w-lg text-center"><p className="font-hand text-2xl text-teal">{host?'ready when you are':'your live classroom'}</p><h1 className="text-3xl text-navy">{phase==='ended'?'Class ended':host?'Start live class':'Join live class'}</h1>
  <p className="my-2">{phase==='ended'?(endNote||'The class has ended, or you need to enroll to join.'):host?'Your camera and microphone will be used. Students join from their dashboard, no Zoom or Meet needed.':'Your teacher lets you in from a waiting room. Video, voice and the whiteboard appear here once you are in.'}</p>
  {phase==='lobby'&&host&&<div className="mx-auto my-4 grid max-w-sm grid-cols-2 gap-2">{Object.entries(MODES).map(([k,md])=><button key={k} type="button" aria-pressed={mode===k} className={`btn2 ${mode===k?'bg-teal/20 !border-teal':''}`} onClick={()=>setMode(k)}>{md.icon} {md.label}</button>)}</div>}
  <p role="alert" className="text-amber-700">{err}</p>{phase==='lobby'&&<button className="btn" onClick={()=>start()}>{host?'🔴 Go live':'Join class'}</button>}<Link className="btn2 ml-2" to={host?'/teacher?tab=live':'/dashboard'}>{host?'Back':'Return to dashboard'}</Link>
  {host&&phase==='ended'&&<div className="mt-4 text-left">{endRep?<AttendanceTable rows={endRep}/>:<button type="button" className="btn2" onClick={async()=>{try{setEndRep((await api.get(`/staff/live/${id}/attendance`)).data)}catch(x){setErr(msg(x))}}}>View attendance</button>}</div>}
  <video ref={vid} className="hidden"/></div>

 const boardish=mode==='board'||big,cvZ=boardish?3:2,imZ=boardish?2:1
 const secBody=<>
  {sec==='draw'&&host&&<div className="grid gap-3"><div className="flex flex-wrap gap-1.5"><T k="pen">✏️ Pen</T><T k="hl">🖍 Highlight</T><T k="eraser">🧽 Eraser</T><T k="move">✋ Move images</T></div>
   <div className="flex flex-wrap items-center gap-1.5">{COLORS.map(c=><button key={c} aria-label={`Colour ${c}`} aria-pressed={color===c} onClick={()=>{setColor(c);if(tool==='eraser'||tool==='move')setTool('pen')}} className={`h-8 w-8 rounded-full border-2 ${color===c?'border-teal ring-2 ring-teal/40':'border-white/40'}`} style={{background:c}}/>)}
    <input type="color" aria-label="Custom colour" value={color} onChange={e=>setColor(e.target.value)} className="h-9 w-9 rounded bg-transparent"/></div>
   <label className="flex items-center gap-2 text-sm">Size<input className="flex-1" type="range" min="1" max="20" value={size} onChange={e=>setSize(+e.target.value)}/></label>
   <div className="flex gap-1.5"><button className="btn2 !min-h-[40px]" onClick={()=>act('undo')}>↶ Undo</button><button className="btn2 !min-h-[40px]" onClick={()=>act('clear')}>🗑 Clear</button></div></div>}
  {sec==='image'&&host&&<div className="grid gap-2"><button className="btn" disabled={busy} onClick={()=>imgIn.current?.click()}>{busy?'Uploading…':'🖼️ Choose image…'}</button><p className="text-xs opacity-70">JPG, PNG or WEBP, up to 5 MB. After inserting, drag the picture to move it and pull the corner dot to resize. Pick ✏️ Pen again to write over it.</p>
   {imgs.length>0&&<><ul className="grid gap-1.5">{imgs.map((im,i)=><li key={im.iid} className={`flex items-center gap-2 rounded-xl bg-white/10 p-1.5 ${sel===im.iid?'ring-2 ring-teal':''}`}><img src={authUrl(im.url)} alt="" className="h-10 w-14 rounded object-cover"/><button className="min-w-0 flex-1 truncate text-left text-sm" onClick={()=>{setSel(im.iid);setTool('move')}}>Image {i+1}</button><button className="btn2 !min-h-[34px] !px-2.5 !py-1" onClick={()=>delImg(im.iid)} aria-label={`Remove image ${i+1}`}>🗑</button></li>)}</ul>
    <button className="btn2 !min-h-[36px]" onClick={()=>imgs.forEach(i=>delImg(i.iid))}>Remove all images</button></>}</div>}
  {sec==='files'&&<FilesPane host={host} courseId={id} shared={shared} share={shareFile} unshare={unshare} open={setPrev}/>}
  {sec==='chat'&&<Chat msgs={msgs} me={myId.current} send={say}/>}
  {sec==='people'&&<PeoplePane roster={roster} waitList={waitList} hands={hands} allow={allow} id={id} send={sendRaw}/>}
  {sec==='hands'&&<HandsPane hands={hands} ack={ackHand} lower={lowerHand}/>}
  {sec==='doubts'&&<Doubts id={id} host={host}/>}
  {sec==='settings'&&host&&<div className="grid gap-3">
   {mode==='tablet'&&<div><p className="mb-1 text-sm font-semibold">Board background</p><div className="flex flex-wrap gap-1.5">{Object.keys(BG).map(k=><button key={k} aria-pressed={bg===k} className={`btn2 !min-h-[36px] ${bg===k?'bg-teal/20 !border-teal':''}`} onClick={()=>act('bg',{bg:k})}>{k}</button>)}</div></div>}
   <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" role="switch" className="h-5 w-5 accent-teal" checked={autoHide} onChange={e=>setAutoHide(e.target.checked)}/>Auto-hide controls when idle</label>
   <p className="text-xs opacity-70">Shortcuts: <span className="kbd">T</span> tools · <span className="kbd">F</span> full screen · <span className="kbd">Esc</span> exit full screen</p></div>}</>

 const recActive=rec==='recording'||rec==='paused'
 return <div ref={room} className={`cr lt-${ltheme} ${fsOn?'cr-fs':''}`} data-ui={showUi?'on':'off'} onMouseMove={()=>autoHide&&poke()} onPointerDown={e=>autoHide&&e.pointerType!=='mouse'&&poke()} onTouchStart={()=>autoHide&&poke()} onKeyDown={()=>autoHide&&poke()}>
  {!host&&recOn?.on&&<div role="status" className="rec-banner"><span className="animate-pulse text-red-500" aria-hidden="true">●</span><span>{recOn.paused?'Recording is paused.':'This class is being recorded.'} Recordings are shared only with students of this course.</span></div>}
  <div className="cr-top" role="toolbar" aria-label="Class controls" onKeyDown={toolKey} onMouseEnter={()=>{over.current=true}} onMouseLeave={()=>{over.current=false}} onFocusCapture={()=>{over.current=true}} onBlurCapture={()=>{over.current=false}}>
   <span className="animate-pulse rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold">● LIVE</span>
   <span className="text-sm tabular-nums" title="Session time" aria-label={`Session time ${clock(secs)}`}>⏱ {clock(secs)}</span>
   <span className="hidden text-sm opacity-80 sm:inline" title="Students in class">👥 {students}</span>
   {host&&recActive&&<span role="status" className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${rec==='paused'?'bg-amber-500':'bg-red-600'}`}>{rec==='paused'?'❚❚ PAUSED':'● REC'} {clock(Math.floor((ri?.elapsedMs||0)/1000))}</span>}
   {host&&recActive&&ri&&(!ri.online||ri.attempt>0)&&<span className="rounded-full bg-slate-700 px-2.5 py-0.5 text-xs font-semibold">{!ri.online?'Offline · keeping the recording safe':`Reconnecting${ri.retryIn?` · retry in ${ri.retryIn}s`:'…'}`}</span>}
   {host&&rec==='saving'&&<span role="status" className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold">Saving recording{ri?.queued?` · ${ri.queued} part${ri.queued>1?'s':''} left`:''}</span>}
   <span className="flex-1"/>
   <button type="button" data-tb className="cb" title="Change look" aria-label={`Change look, current ${ltheme}`} onClick={()=>{const n=ltheme==='studio'?'classic':ltheme==='classic'?'night':'studio';localStorage.setItem('ms_live_theme',n);setLtheme(n)}}><span aria-hidden="true">🎨</span><span className="hidden md:inline">{ltheme}</span></button>
   <>
    <button type="button" data-tb className={`cb ${mic?'':'cb-off'}`} onClick={()=>toggle('audio',mic,setMic)} aria-pressed={!mic} aria-label={mic?'Mute microphone':'Unmute microphone'} title="Microphone (M)"><span aria-hidden="true">{mic?'🎙️':'🔇'}</span><span className="hidden md:inline">{mic?'Mic':'Muted'}</span></button>
    <button type="button" data-tb className={`cb ${cam?'':'cb-off'}`} onClick={()=>toggle('video',cam,setCam)} aria-pressed={!cam} aria-label={cam?'Turn camera off':'Turn camera on'} title="Camera"><span aria-hidden="true">{cam?'🎥':'📷'}</span><span className="hidden md:inline">{cam?'Camera':'Cam off'}</span></button></>
   {!host&&<button type="button" data-tb className={`cb ${myHand?'!bg-amber-400 !text-slate-900':''}`} aria-pressed={myHand} aria-label={myHand?'Lower your hand':'Raise your hand'} title={myHand?'Lower your hand':'Raise your hand to ask a question'} onClick={()=>raiseHand(!myHand)}><span aria-hidden="true">✋</span><span>{myHand?(hands.find(h=>h.id===myId.current&&h.acked)?'Acknowledged':'Hand raised'):'Raise hand'}</span></button>}
<button type="button" data-tb className="cb relative" aria-expanded={open&&sec==='chat'} aria-controls="live-tools" aria-label={`Chat${unread.chat?`, ${unread.chat} new`:''}`} onClick={()=>open&&sec==='chat'?setOpen(false):openPanel('chat')}><span aria-hidden="true">💬</span><span className="hidden sm:inline">Chat</span>{unread.chat>0&&<span className="ltile-badge !static">{unread.chat}</span>}</button>
   {host?<button type="button" data-tb className="cb relative" aria-expanded={open} aria-controls="live-tools" onClick={togglePanel}><span aria-hidden="true">🛠️</span><span>Tools</span>{unread.files>0&&<span className="ltile-badge !static">{unread.files}</span>}</button>
    :<button type="button" data-tb className="cb relative" aria-expanded={open} aria-controls="live-tools" onClick={togglePanel}><span aria-hidden="true">📚</span><span className="hidden sm:inline">Class panel</span>{unread.files>0&&<span className="ltile-badge !static">{unread.files}</span>}</button>}
   {host&&recActive&&<button type="button" data-tb className="cb" onClick={togglePause} aria-pressed={rec==='paused'} aria-label={rec==='paused'?'Resume recording':'Pause recording'} title="Pause or resume the recording"><span aria-hidden="true">{rec==='paused'?'▶':'⏸'}</span><span className="hidden lg:inline">{rec==='paused'?'Resume':'Pause'}</span></button>}
   {host&&<button type="button" data-tb className={`cb ${recActive?'cb-danger':''}`} disabled={rec==='saving'} onClick={()=>recActive?stopRecording():openConsent()} aria-label={recActive?'Stop recording and save':'Start recording'} aria-pressed={recActive} title="Record this class"><span aria-hidden="true">{recActive?'⏹':'⏺'}</span><span className="hidden lg:inline">{recActive?'Stop':'Record'}</span></button>}
   <button type="button" data-tb className="cb" onClick={toggleFs} aria-label={fsOn?'Exit full screen':'Full screen'} title="Full screen (F)"><span aria-hidden="true">{fsOn?'🗗':'⛶'}</span><span className="hidden sm:inline">{fsOn?'Exit full screen':'Full screen'}</span></button>
   {host?<button type="button" data-tb className="cb cb-danger" onClick={endClass}><span aria-hidden="true">⏹</span><span className="hidden sm:inline">End class</span></button>:<Link data-tb className="cb" to="/dashboard" onClick={()=>{if(fsEl())(document.exitFullscreen||document.webkitExitFullscreen).call(document)}}>Leave</Link>}</div>

  <div className="cr-wrap">
   <div ref={frame} className={`frame ${mode==='board'?'frame-board':'frame-tablet'}`}>
    <div ref={stage} className="stage" style={mode==='board'?{background:'#0b1512'}:BG[bg]} onPointerDown={e=>{if(e.target===e.currentTarget)setSel(null)}}>
     <canvas ref={cv} width={1280} height={720} role="img" aria-label="Live whiteboard" className="absolute inset-0 h-full w-full" style={{touchAction:'none',cursor:host&&tool!=='move'?'crosshair':'default',zIndex:cvZ,pointerEvents:host&&tool==='move'?'none':'auto'}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}/>
     <div className="absolute inset-0 overflow-hidden" style={{zIndex:imZ,pointerEvents:'none'}}>{imgs.map(im=>{const live=host&&tool==='move',h=im.w*(16/9)/im.ar,on=live&&sel===im.iid
      return <div key={im.iid} className={`bimg ${live?'bimg-live':''} ${on?'bimg-sel':''}`} style={{left:im.x*100+'%',top:im.y*100+'%',width:im.w*100+'%',height:h*100+'%'}} onPointerDown={e=>imgDown(e,im,'move')} onPointerMove={imgMove} onPointerUp={imgUp} onPointerCancel={imgUp}>
       <img src={authUrl(im.url)} alt="Image shared by the teacher" draggable={false} className="h-full w-full select-none object-contain" onError={e=>{e.currentTarget.style.opacity=.3}}/>
       {on&&<><button type="button" className="bimg-x" aria-label="Remove this image" onPointerDown={e=>e.stopPropagation()} onClick={()=>delImg(im.iid)}>✕</button><span className="bimg-h" role="slider" aria-label="Resize image" aria-valuenow={Math.round(im.w*100)} onPointerDown={e=>imgDown(e,im,'resize')} onPointerMove={imgMove} onPointerUp={imgUp} onPointerCancel={imgUp}/></>}</div>})}</div>
     <video ref={vid} autoPlay playsInline muted={host} className="absolute bg-black shadow-lg transition-all duration-500" style={boardish?{left:0,top:0,width:'100%',height:'100%',borderRadius:0,objectFit:'contain',zIndex:1}:{...(host?camBox(camPos):{left:'72%',top:'70%',width:'26%',height:'27%'}),borderRadius:'.5rem',objectFit:'cover',zIndex:4,pointerEvents:'none'}}/>{host&&!boardish&&<CamHandle pos={camPos} setPos={setCamPos} stageRef={stage}/>}
     {notice&&<div role="status" className="absolute left-1/2 top-3 z-[60] flex max-w-[92%] -translate-x-1/2 items-center gap-3 rounded-xl bg-slate-900/95 px-4 py-2 text-sm text-white shadow-lg">
       <span>{notice}</span>
       {req&&!host&&<button type="button" className="btn !min-h-[30px] !px-3 !py-1 text-xs" onClick={()=>{ const k=req.what==='mic'?'audio':'video'; toggle(k,false,req.what==='mic'?setMic:setCam); setReq(null); setNotice('') }}>{req.what==='mic'?'Unmute':'Turn camera on'}</button>}
       <button type="button" aria-label="Dismiss" className="text-white/70 hover:text-white" onClick={()=>{ setNotice(''); setReq(null) }}>✕</button></div>}
     {host&&<StudentCams feeds={feeds} peers={peers} media={media}/>}
     {mode==='board'&&<div className="chalk"/>}
     <div key={mode} className="absolute left-3 top-3 z-20 animate-pop rounded-full bg-black/60 px-3 py-1 text-sm text-white">{MODES[mode].icon} {MODES[mode].label}</div>
     {!host&&!tin&&<div className="absolute inset-0 z-30 grid place-items-center bg-black/50 px-6 text-center text-white"><p className="font-hand text-3xl">{tGone?'Your teacher has disconnected. Waiting for them to come back…':wait?(wait.teacher?'Your teacher will let you in in a moment…':'You are in the waiting room. Your teacher will let you in once the class starts.'):'Waiting for the teacher to start…'}</p></div>}</div></div>

   {open&&<div id="live-tools" className="tool-panel" role="dialog" aria-label={host?'Live Session Tools':'Class panel'}>
    <div className="mb-2 flex items-center gap-2"><b className="flex-1">{host?'🛠️ Live Session Tools':'💬 Class panel'}</b><button type="button" className="cb !min-h-[34px]" onClick={()=>setOpen(false)} aria-label="Close panel">✕</button></div>
    <div className="grid grid-cols-4 gap-2">
     {host&&<><Tile icon="🔄" label="Flip" onClick={flipCam}/><Tile icon="🖥️" label={sharing?'Stop share':'Screen'} on={sharing} onClick={share}/>
      <Tile icon="✏️" label="Draw" on={sec==='draw'} onClick={()=>{openSec('draw');if(tool==='move')setTool('pen')}}/><Tile icon="🖼️" label="Image" on={sec==='image'} disabled={busy} onClick={pickImage}/></>}
     <Tile icon="📄" label="Files" on={sec==='files'} badge={unread.files} onClick={()=>openSec('files')}/><Tile icon="💬" label="Chat" on={sec==='chat'} badge={unread.chat} onClick={()=>openSec('chat')}/>
     <Tile icon="❓" label="Doubts" on={sec==='doubts'} onClick={()=>openSec('doubts')}/>{host&&<Tile icon="✋" label="Hands" badge={hands.length} on={sec==='hands'} onClick={()=>openSec('hands')}/>}{host&&<Tile icon="👥" label="People" badge={waitList.length} on={sec==='people'} onClick={()=>openSec('people')}/>}
     {host&&<Tile icon="⚙️" label="Settings" on={sec==='settings'} onClick={()=>openSec('settings')}/>}
     
     <Tile icon={fsOn?'🗗':'⛶'} label={fsOn?'Exit full':'Full screen'} onClick={toggleFs}/></div>
    <div className="mt-3 min-h-0 flex-1 overflow-y-auto border-t border-white/10 pt-3">{secBody}</div></div>}

   {!showUi&&<button type="button" className="cr-reveal" aria-label={host?'Show controls and tools':'Show controls'} onClick={()=>{poke();setOpen(true)}}>{host?'🛠️':'💬'}</button>}</div>

  {!fsOn&&<p role="status" className="mt-2 text-sm opacity-80"><b>{MODES[mode].label}.</b> {host?(mode==='tablet'?'Your tablet writing appears on the board. Camera shows in the corner. Open 🛠️ Tools for pen, images, files and chat.':'Your camera fills the screen. Use the pen to point at the board. Open 🛠️ Tools when you need them.'):MODES[mode].hint}</p>}
  {err&&<p role="alert" className="text-amber-700">{err}</p>}
  {askRec&&host&&<div className="rec-modal" onKeyDown={e=>{if(e.key==='Escape')setAskRec(false)}}><div role="dialog" aria-modal="true" aria-labelledby="rec-h" className="rec-card">
   <p className="font-hand text-xl text-teal">before you record</p>
   <h2 id="rec-h" className="text-2xl text-navy">Record this class?</h2>
   <p className="text-sm opacity-80">Your camera, microphone, whiteboard and pictures are recorded from this browser. Students are told the class is being recorded, and the video stays private to this course until you publish it. Keep this tab open while recording.</p>
   <label className="grid gap-1 text-sm font-semibold">Recording title (optional)<input className="inp" value={recTitle} onChange={e=>setRecTitle(e.target.value)} maxLength={150} placeholder="e.g. Heart basics, lecture 3"/></label>
   <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-teal" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>My students know this class will be recorded, and I have their consent or am otherwise allowed to record it.</span></label>
   <div className="flex flex-wrap justify-end gap-2"><button type="button" className="btn2" onClick={()=>setAskRec(false)}>Cancel</button><button type="button" className="btn" disabled={!consent} onClick={beginRec}>● Start recording</button></div></div></div>}
  {toast&&<div className="cr-toast" role="status">{toast}</div>}
  {prev&&<FilePreview m={prev} onClose={()=>setPrev(null)}/>}
  {host&&<input ref={imgIn} type="file" className="sr-only" tabIndex={-1} aria-hidden="true" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={onImageFile}/>}</div>}