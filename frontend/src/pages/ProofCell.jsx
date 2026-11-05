import {useEffect,useState} from 'react'
import api from '../api'

/* The screenshot the student uploaded. Images cannot send the login header, so the file is fetched through the API
   (with the teacher's login) and shown from a local copy. Shows a clear message if it is missing or cannot be loaded. */
export function ProofCell({p, staff=false}){
  const [url,setUrl]=useState(null), [state,setState]=useState(p.proofFile?'loading':'none')
  useEffect(()=>{
    if(!p.proofFile){ setState('none'); return }
    let live=true, obj=null
    setState('loading')
    api.get(staff?`/staff/payments/${p.reference}/proof`:`/payments/${p.reference}/proof`,{responseType:'blob'})
      .then(r=>{ if(!live) return; obj=URL.createObjectURL(r.data); setUrl(obj); setState('ok') })
      .catch(()=>{ if(live) setState('missing') })
    return()=>{ live=false; if(obj) URL.revokeObjectURL(obj) }
  },[p.reference,p.proofFile])
  if(state==='none') return <div className="mt-1 text-xs opacity-60">No screenshot uploaded yet</div>
  if(state==='loading') return <div className="mt-1 text-xs opacity-60">Loading screenshot…</div>
  if(state==='missing') return <div className="mt-1 text-xs text-amber-700">Screenshot could not be loaded. Ask the student to upload it again.</div>
  return <div className="mt-2 grid gap-1">
    <a href={url} target="_blank" rel="noreferrer" aria-label={`View screenshot for payment ${p.reference}`}>
      <img src={url} alt={`Payment screenshot for ${p.reference}`} className="h-20 w-auto rounded border border-stone-300 bg-surface object-contain"/></a>
    <div className="flex flex-wrap gap-3 text-xs">
      <a className="font-semibold text-teal underline" href={url} target="_blank" rel="noreferrer">View full image</a>
      <a className="font-semibold text-teal underline" href={url} download={`payment-${p.reference}.${p.proofType||'jpg'}`}>Download</a></div>
    {p.proofAt&&<div className="text-[11px] opacity-60">Uploaded {new Date(p.proofAt).toLocaleString()}</div>}
  </div>
}
