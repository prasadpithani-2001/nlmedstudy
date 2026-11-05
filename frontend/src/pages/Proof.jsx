import {useEffect,useRef,useState} from 'react'

/* Payment screenshot helpers: the same rules on the computer and on the phone. The server checks the real file type again. */
export const PROOF_TYPES=['image/jpeg','image/png','image/webp']
export const PROOF_MAX=5*1024*1024
export function checkImage(f){
  if(!f) return 'Choose a screenshot first'
  if(!PROOF_TYPES.includes(f.type)) return 'Use a JPG, PNG or WEBP screenshot. On an iPhone, set the camera format to "Most Compatible" or take a screenshot instead.'
  if(f.size>PROOF_MAX) return 'That image is larger than 5 MB. Take a smaller screenshot.'
  return ''
}

/* Pick, preview, replace, then submit. Used inside checkout (computer) and on the phone upload page. */
export function ProofForm({onSubmit,busy,submitLabel='Upload screenshot',camera=false}){
  const [file,setFile]=useState(null), [url,setUrl]=useState(''), [err,setErr]=useState(''), cam=useRef(null), gal=useRef(null)
  useEffect(()=>()=>{ if(url) URL.revokeObjectURL(url) },[url])
  const pick=e=>{
    const f=e.target.files&&e.target.files[0]; e.target.value=''
    if(!f) return
    const problem=checkImage(f)
    if(problem){ setErr(problem); return }
    setErr(''); setFile(f); setUrl(URL.createObjectURL(f))
  }
  return <div className="grid gap-3">
    <div className="flex flex-wrap gap-2">
      {camera&&<button type="button" className="btn2" disabled={busy} onClick={()=>cam.current&&cam.current.click()}>📷 Take a photo</button>}
      <button type="button" className="btn2" disabled={busy} onClick={()=>gal.current&&gal.current.click()}>{url?'🔁 Replace screenshot':'🖼 Choose from gallery or files'}</button>
    </div>
    {camera&&<input ref={cam} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={pick}/>}
    <input ref={gal} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={pick}/>
    {err&&<p role="alert" className="text-sm text-amber-700">{err}</p>}
    {url&&<figure className="grid gap-1">
      <img src={url} alt="Preview of the payment screenshot you selected" className="mx-auto max-h-80 w-auto rounded-lg border border-stone-300 bg-surface object-contain"/>
      <figcaption className="text-center text-xs opacity-70">Check that the amount, date and reference can be read before you upload.</figcaption></figure>}
    {file&&<button type="button" className="btn w-full" disabled={busy} onClick={()=>onSubmit(file)}>{busy?'Uploading…':submitLabel}</button>}
  </div>
}
