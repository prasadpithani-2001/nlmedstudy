import {useEffect,useRef,useState} from 'react'
import api,{msg} from '../api'

/* Proctoring for entrance exams and course assessments.
   ProctorGate: before the test. Full-screen mode and the camera are checked from the student's own click.
   ProctorMonitor: during the test. Camera snapshots about every 15 s, warnings recorded, and a cover over the test
   until full screen and the camera are back. Warnings are shown to the student and kept for the teacher.
   ProctorPanel / ProctorReview: teacher and admin. The warnings and snapshots for one student's test. */

const LABEL={tab_hidden:'Switched to another tab',window_blur:'Clicked outside the test',fullscreen_exit:'Left full-screen mode',copy_paste:'Copy or paste attempted',right_click:'Right-click attempted',screenshot_key:'Print Screen key pressed',camera_off:'Camera turned off or blocked',offline:'Internet connection lost',gate_ready:'Started the test (camera and full screen checked)',camera_on:'Camera turned back on'}

/* Before the test: the student agrees, then full screen and the camera are checked. */
export function ProctorGate({title,onReady}){
  const [err,setErr]=useState(''), [busy,setBusy]=useState(false)
  const begin=async()=>{
    setErr(''); setBusy(true)
    const fsRequest=document.documentElement.requestFullscreen?.()   // must start straight from the click
    try{ if(fsRequest) await fsRequest }catch{}
    try{
      const s=await navigator.mediaDevices.getUserMedia({video:true,audio:false})
      s.getTracks().forEach(t=>t.stop())
    }catch{
      setErr('We need your camera for this test. Allow camera access in your browser (the camera or padlock icon near the address bar), then press the button again.')
      setBusy(false); return
    }
    if(!document.fullscreenElement){ setErr('Please allow full-screen mode, then press the button again.'); setBusy(false); return }
    onReady()
  }
  return <div className="mx-auto grid max-w-xl gap-4"><div className="box text-center">
    <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full bg-teal/15 text-2xl" aria-hidden="true">🎓</div>
    <h1 className="font-serif text-2xl text-navy">{title}</h1>
    <p className="mt-2 text-sm">This test is supervised. Before you start, please note:</p>
    <ul className="mx-auto mt-3 grid max-w-md gap-1.5 text-left text-sm">
      <li>• Your camera will take a photo about every 15 seconds. Please keep your face clearly in view.</li>
      <li>• The test runs in full-screen mode. Leaving full screen, switching tabs, copying, pasting or right-clicking are recorded.</li>
      <li>• Please work alone, in a quiet place, without notes or outside help.</li>
      <li>• Your teacher can review these records. Thank you for taking the test honestly.</li>
    </ul>
    {err&&<p role="alert" className="mt-3 text-sm text-amber-800">{err}</p>}
    <button type="button" className="btn mt-4" disabled={busy} onClick={begin}>{busy?'Checking camera…':'I understand, start the test'}</button>
  </div></div>
}

/* During the test: snapshots, warnings, and a cover until full screen and the camera are back. */
export function ProctorMonitor({scope}){
  const video=useRef(null), canvas=useRef(null), reattach=useRef(null)
  const [violations,setViolations]=useState(0), [fs,setFs]=useState(!!document.fullscreenElement), [cam,setCam]=useState(false)
  useEffect(()=>{
    let alive=true, stream=null, timer=null
    const last={}
    const send=(kind,detail='')=>{
      const now=Date.now(); if(last[kind]&&now-last[kind]<2000) return; last[kind]=now
      if(!['gate_ready','camera_on'].includes(kind)) setViolations(v=>v+1)
      api.post(`/proctor/${scope}/event`,{kind,detail}).catch(()=>{})
    }
    const snap=()=>{
      const v=video.current, c=canvas.current
      if(!alive||!v||!c||!v.videoWidth) return
      c.width=320; c.height=Math.round(320*v.videoHeight/v.videoWidth)
      c.getContext('2d').drawImage(v,0,0,c.width,c.height)
      c.toBlob(b=>{ if(!b||!alive) return; const fd=new FormData(); fd.append('file',b,'snapshot.jpg'); api.post(`/proctor/${scope}/snapshot`,fd).catch(()=>{}) },'image/jpeg',0.6)
    }
    const camOff=()=>{ if(!alive) return; send('camera_off'); setCam(false) }
    const attach=async()=>{
      try{
        if(stream) stream.getTracks().forEach(t=>t.stop())
        stream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480},audio:false})
      }catch{ camOff(); return }
      if(!alive){ stream.getTracks().forEach(t=>t.stop()); return }
      if(video.current){ video.current.srcObject=stream; await video.current.play().catch(()=>{}) }
      stream.getVideoTracks().forEach(t=>{ t.onended=camOff })
      setCam(true); send('camera_on')
      if(!timer) timer=setInterval(snap,15000)
      setTimeout(snap,1500)
    }
    reattach.current=attach
    const onVis=()=>{ if(document.hidden) send('tab_hidden') }
    const onBlur=()=>send('window_blur')
    const onFsChange=()=>{ const on=!!document.fullscreenElement; setFs(on); if(!on) send('fullscreen_exit') }
    const onBlock=e=>{ e.preventDefault(); send(e.type==='contextmenu'?'right_click':'copy_paste') }
    const onKey=e=>{ if(e.key==='PrintScreen') send('screenshot_key') }
    const onOffline=()=>send('offline')
    const blockTypes=['copy','cut','paste','contextmenu']
    document.addEventListener('visibilitychange',onVis); window.addEventListener('blur',onBlur)
    document.addEventListener('fullscreenchange',onFsChange)
    blockTypes.forEach(t=>document.addEventListener(t,onBlock))
    document.addEventListener('keyup',onKey); window.addEventListener('offline',onOffline)
    attach()
    return()=>{
      alive=false; clearInterval(timer)
      if(stream) stream.getTracks().forEach(t=>t.stop())
      document.removeEventListener('visibilitychange',onVis); window.removeEventListener('blur',onBlur)
      document.removeEventListener('fullscreenchange',onFsChange)
      blockTypes.forEach(t=>document.removeEventListener(t,onBlock))
      document.removeEventListener('keyup',onKey); window.removeEventListener('offline',onOffline)
    }
  },[scope])

  return <>
    {(!fs||!cam)&&<div role="alertdialog" aria-modal="true" aria-live="assertive" className="fixed inset-0 z-[100] grid place-items-center bg-navy/95 p-6 text-center text-white">
      <div className="max-w-md">
        <h2 className="font-serif text-2xl">{!cam?'Your camera is off':'Full-screen mode is off'}</h2>
        <p className="mt-2 text-sm opacity-90">{!cam?'Please turn your camera on to continue the test. Your teacher can see when the camera was off.':'Please return to full-screen mode to continue. Leaving full screen has been recorded.'}</p>
        {!cam
          ? <button type="button" className="btn mt-4" onClick={()=>reattach.current&&reattach.current()}>Turn camera on</button>
          : <button type="button" className="btn mt-4" onClick={()=>document.documentElement.requestFullscreen?.().catch(()=>{})}>Return to full screen</button>}
      </div></div>}
    <div className="fixed bottom-3 right-3 z-[90] w-40 overflow-hidden rounded-xl border border-white/40 bg-black shadow-lg">
      <video ref={video} muted playsInline className="h-24 w-full object-cover" style={{transform:'scaleX(-1)'}}/>
      <div className="flex items-center justify-between bg-black/75 px-2 py-1 text-[11px] text-white">
        <span className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${cam?'animate-pulse bg-red-500':'bg-stone-400'}`} aria-hidden="true"/>{cam?'Recording':'Camera off'}</span>
        <span title="Warnings recorded so far">⚠ {violations}</span></div>
      <canvas ref={canvas} className="hidden" aria-hidden="true"/>
    </div>
  </>
}

/* Teacher / admin: one student's warnings and snapshots, for one test. */
export function ProctorPanel({examId,attempts}){
  const [sel,setSel]=useState('')
  const list=attempts||[]
  if(list.length===0) return null
  const pick=list.find(a=>String(a.userId)===sel)
  return <div className="box mt-3">
    <h3 className="font-semibold text-navy">Proctoring review</h3>
    <p className="text-sm opacity-75">See the camera snapshots and any warnings recorded for one attempt.</p>
    <label htmlFor="proctor-pick" className="mt-2 block text-sm">Student</label>
    <select id="proctor-pick" className="inp mt-1 max-w-sm" value={sel} onChange={e=>setSel(e.target.value)}>
      <option value="">Choose an attempt…</option>
      {list.map(a=><option key={a.id} value={a.userId}>{a.student} ({a.email})</option>)}
    </select>
    {pick&&<ProctorReview scope={`exam-${examId}`} userId={pick.userId}/>}
  </div>
}

export function ProctorReview({scope,userId}){
  const [d,setD]=useState(null), [err,setErr]=useState('')
  useEffect(()=>{ setD(null); setErr(''); api.get(`/staff/proctor/${scope}/${userId}`).then(r=>setD(r.data)).catch(x=>setErr(msg(x))) },[scope,userId])
  if(err) return <p role="alert" className="mt-3 text-sm text-amber-800">{err}</p>
  if(!d) return <div className="skel mt-3 h-24"/>
  return <div className="mt-3 grid gap-3">
    <p className="text-sm"><b>{d.student}</b> · {d.violations} warning{d.violations===1?'':'s'} · {d.snapshots.length} snapshot{d.snapshots.length===1?'':'s'}</p>
    {d.violations===0&&<p className="text-sm text-green-800">No warnings were recorded during this test.</p>}
    {d.events.length>0&&<ol className="grid max-h-60 gap-1 overflow-y-auto text-sm">{d.events.map((e,i)=><li key={i} className="flex flex-wrap gap-2 border-b border-stone-200 py-1"><span className="font-mono text-xs opacity-70">{new Date(e.at).toLocaleTimeString()}</span><span>{LABEL[e.kind]||e.kind}</span>{e.detail&&<span className="opacity-70">{e.detail}</span>}</li>)}</ol>}
    {d.snapshots.length>0
      ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{d.snapshots.map(s=><figure key={s.id} className="grid gap-1"><SnapImg id={s.id}/><figcaption className="text-[11px] opacity-70">{new Date(s.at).toLocaleTimeString()}</figcaption></figure>)}</div>
      : <p className="text-sm text-amber-800">No camera snapshots were saved for this attempt.</p>}
  </div>
}

function SnapImg({id}){
  const [url,setUrl]=useState(null), [bad,setBad]=useState(false)
  useEffect(()=>{
    let obj=null, live=true
    api.get(`/staff/proctor/snapshots/${id}`,{responseType:'blob'})
      .then(r=>{ if(!live) return; obj=URL.createObjectURL(r.data); setUrl(obj) })
      .catch(()=>{ if(live) setBad(true) })
    return()=>{ live=false; if(obj) URL.revokeObjectURL(obj) }
  },[id])
  if(bad) return <div className="grid h-24 place-items-center rounded bg-stone-100 text-xs text-amber-800">Could not load</div>
  if(!url) return <div className="skel h-24"/>
  return <a href={url} target="_blank" rel="noreferrer" aria-label="Open snapshot full size"><img src={url} alt="Camera snapshot" className="h-24 w-full rounded object-cover"/></a>
}
