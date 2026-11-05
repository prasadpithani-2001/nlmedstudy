import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import api,{msg,fileUrl} from '../api'

/* Course files: one library used by the teacher (upload, edit, delete) and the student (view, download). Data always comes from the server. */
export const CATS={PDF:['📄','PDF','from-rose-500 to-orange-400'],DOC:['📝','Document','from-sky-500 to-indigo-500'],SLIDES:['📑','Presentation','from-amber-500 to-red-500'],SHEET:['📊','Spreadsheet','from-emerald-500 to-teal-500'],IMAGE:['🖼️','Image','from-violet-500 to-fuchsia-500'],VIDEO:['🎥','Video','from-indigo-500 to-violet-500'],OTHER:['📎','File','from-slate-500 to-slate-400']}
export const cat=c=>CATS[c]||CATS.OTHER
export const EXT=['pdf','doc','docx','txt','ppt','pptx','xls','xlsx','png','jpg','jpeg','webp','gif','mp4','webm','mov','m4v']
const VIDEO_EXT=['mp4','webm','mov','m4v'],MB=1048576
export const ACCEPT=EXT.map(e=>'.'+e).join(',')
export const size=n=>n==null?'':n<1024?n+' B':n<MB?(n/1024).toFixed(0)+' KB':(n/MB).toFixed(1)+' MB'
export const day=d=>d?new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'—'
/** returns an error message or '' (the server checks again) */
export function checkFile(f){const ext=(f.name.split('.').pop()||'').toLowerCase()
 if(!EXT.includes(ext))return `“${f.name}” is not supported. Use PDF, Word, PowerPoint, Excel, TXT, images or videos.`
 if(f.size===0)return `“${f.name}” is empty.`
 const max=VIDEO_EXT.includes(ext)?600:50;if(f.size>max*MB)return `“${f.name}” is ${size(f.size)}. The limit is ${max} MB for ${max===600?'videos':'documents and images'}.`;return ''}

/** Preview window: images, PDFs and videos open here; other types offer a download. */
export function FilePreview({m,onClose}){
 /* Phase 10 fix: the preview is always mounted (closed = m is null). Lock page scrolling ONLY while a file is open,
    otherwise body overflow stays "hidden" and the Resources list cannot be scrolled. */
 const close=useRef(onClose);close.current=onClose
 const open=!!m
 useEffect(()=>{if(!open)return;const k=e=>e.key==='Escape'&&close.current();addEventListener('keydown',k);const o=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{removeEventListener('keydown',k);document.body.style.overflow=o}},[open])
 if(!m)return null;const [ic,label]=cat(m.category),u=fileUrl(m.id)
 return <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-3 animate-fadeIn" role="dialog" aria-modal="true" aria-label={`Preview of ${m.title}`} onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
  <div className="box flex max-h-[94vh] w-full max-w-5xl flex-col !bg-surface !p-3 dark:!bg-[#0f1726]">
   <div className="mb-2 flex items-center gap-2"><span className="text-2xl" aria-hidden="true">{ic}</span><div className="min-w-0 flex-1"><b className="block truncate text-navy">{m.title}</b><span className="text-xs opacity-60">{label} · {size(m.size)}</span></div>
    <a className="btn2 !min-h-[40px]" href={fileUrl(m.id,true)}>⬇ Download</a><button className="btn2 !min-h-[40px]" onClick={onClose} aria-label="Close preview">✕</button></div>
   <div className="min-h-[50vh] flex-1 overflow-auto rounded-xl bg-slate-100 dark:bg-black/40">
    {m.category==='IMAGE'?<img src={u} alt={m.title} className="mx-auto max-h-[78vh] max-w-full object-contain"/>
    :m.category==='PDF'?<iframe title={m.title} src={u} className="h-[78vh] w-full rounded-xl"/>
    :m.category==='VIDEO'?<video src={u} controls autoPlay className="mx-auto max-h-[78vh] w-full bg-black"/>
    :<div className="grid h-full min-h-[50vh] place-items-center p-6 text-center"><div><div className="text-6xl">{ic}</div><p className="mt-2 font-semibold text-navy">No preview for this file type</p><p className="text-sm opacity-70">Download it to open it on your device.</p><a className="btn mt-3" href={fileUrl(m.id,true)}>⬇ Download {m.fileName}</a></div></div>}</div></div></div>}

const KINDS={NOTE:'Handwritten note',RESOURCE:'Resource',RECORDING:'Class recording'}
function Card({m,staff,onOpen,onEdit,onDelete,extra}){const [ic,label,g]=cat(m.category)
 return <article className="ccard flex flex-col !overflow-visible">
  <button type="button" onClick={()=>onOpen(m)} className={`relative grid h-28 w-full place-items-center overflow-hidden rounded-t-2xl bg-gradient-to-br ${g}`} aria-label={`Open ${m.title}`}>
   {m.category==='IMAGE'?<img src={fileUrl(m.id)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover"/>:<span className="text-5xl drop-shadow" aria-hidden="true">{ic}</span>}
   <span className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-bold text-white">{label}</span></button>
  <div className="flex flex-1 flex-col gap-1 p-3"><b className="line-clamp-2 break-words text-navy">{m.title}</b>
   <div className="flex flex-wrap gap-1"><span className="chip">{KINDS[m.kind]||m.kind}</span>{m.topic&&<span className="chip">{m.topic}</span>}</div>
   <p className="text-xs opacity-65">{staff&&m.course?m.course+' · ':''}{day(m.uploadedAt)}{m.size?' · '+size(m.size):''}</p>
   <div className="mt-auto flex flex-wrap gap-1.5 pt-2"><button className="btn2 !min-h-[36px] !px-3 !py-1 text-sm" onClick={()=>onOpen(m)}>{m.previewable?'👁 View':'ℹ Details'}</button><a className="btn2 !min-h-[36px] !px-3 !py-1 text-sm" href={fileUrl(m.id,true)} aria-label={`Download ${m.title}`}>⬇</a>
    {extra&&extra(m)}{staff&&<><button className="btn2 !min-h-[36px] !px-3 !py-1 text-sm" onClick={()=>onEdit(m)} aria-label={`Edit ${m.title}`}>✏️</button><button className="btn2 !min-h-[36px] !px-3 !py-1 text-sm !text-rose-600" onClick={()=>onDelete(m)} aria-label={`Delete ${m.title}`}>🗑</button></>}</div></div></article>}

function Filters({list,f,setF,q,setQ}){const present=useMemo(()=>[...new Set(list.map(x=>x.category))],[list])
 return <div className="flex flex-wrap items-center gap-2"><input className="inp max-w-[240px]" type="search" placeholder="Search files" aria-label="Search files" value={q} onChange={e=>setQ(e.target.value)}/>
  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by type">{[['ALL','All'],['NOTE','Notes'],['REC','Recordings'],...present.map(c=>['C:'+c,cat(c)[0]+' '+cat(c)[1]])].map(([k,l])=><button key={k} aria-pressed={f===k} onClick={()=>setF(k)} className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${f===k?'border-transparent bg-gradient-to-r from-teal to-brand2 text-white':'border-slate-300 hover:border-teal hover:text-teal'}`}>{l}</button>)}</div></div>}
const pass=(m,f,q)=>(f==='ALL'||(f==='NOTE'?m.kind==='NOTE':f==='REC'?m.kind==='RECORDING':f==='C:'+m.category))&&(m.title+' '+m.fileName+' '+(m.topic||'')).toLowerCase().includes(q.trim().toLowerCase())

/** Student: Course Resources (the server only answers if the student is enrolled). */
export function StudentResources({courseId}){
 const [list,setList]=useState(null),[err,setErr]=useState(''),[f,setF]=useState('ALL'),[q,setQ]=useState(''),[open,setOpen]=useState(null)
 const load=useCallback(()=>api.get(`/courses/${courseId}/materials`).then(r=>{setList(r.data);setErr('')}).catch(e=>{setList([]);setErr(msg(e))}),[courseId])
 useEffect(()=>{load()},[load])
 if(list===null)return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div className="skel h-56"/><div className="skel h-56"/><div className="skel h-56"/></div>
 if(err)return <p role="alert" className="py-6 text-center text-amber-700">{err}</p>
 const shown=list.filter(m=>pass(m,f,q))
 return <section aria-label="Course resources"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl text-navy">📚 Course Resources <span className="text-sm font-normal opacity-60">({list.length})</span></h2><button className="btn2 !min-h-[36px]" onClick={load}>↻ Refresh</button></div>
  {list.length===0?<p className="py-8 text-center opacity-75">Your teacher has not uploaded any files yet. They will appear here as soon as they do.</p>:<><Filters list={list} f={f} setF={setF} q={q} setQ={setQ}/>
   <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shown.map(m=><Card key={m.id} m={m} onOpen={setOpen}/>)}</div>{shown.length===0&&<p className="py-6 text-center text-sm opacity-70">No files match.</p>}</>}
  <FilePreview m={open} onClose={()=>setOpen(null)}/></section>}

function EditDialog({m,topics,onSave,onClose}){const [t,setT]=useState(m.title),[k,setK]=useState(m.kind),[tp,setTp]=useState(m.topicId?String(m.topicId):''),[busy,setBusy]=useState(false)
 return <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-3 animate-fadeIn" role="dialog" aria-modal="true" aria-label="Edit file" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
  <form className="box grid w-full max-w-md gap-3 !bg-surface dark:!bg-[#0f1726]" onSubmit={async e=>{e.preventDefault();setBusy(true);await onSave(m,{title:t,kind:k,topicId:tp===''?null:Number(tp)});setBusy(false)}}>
   <h3 className="text-lg text-navy">Edit file</h3><div><label htmlFor="et">Title</label><input id="et" className="inp" value={t} onChange={e=>setT(e.target.value)} required maxLength={150}/></div>
   <div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="ek">Type</label><select id="ek" className="inp" value={k} onChange={e=>setK(e.target.value)}>{Object.entries(KINDS).map(([a,b])=><option key={a} value={a}>{b}</option>)}</select></div>
    <div><label htmlFor="ep">Module / topic</label><select id="ep" className="inp" value={tp} onChange={e=>setTp(e.target.value)}><option value="">General</option>{topics.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></div></div>
   <div className="flex justify-end gap-2"><button type="button" className="btn2" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy?'Saving…':'Save'}</button></div></form></div>}

/** Teacher: pick a course, upload files, see everything that is stored, edit or delete. */
export function ResourceLibrary({courses,cid,setCid,topics,flash}){
 const [list,setList]=useState(null),[f,setF]=useState('ALL'),[q,setQ]=useState(''),[open,setOpen]=useState(null),[edit,setEdit]=useState(null),[drag,setDrag]=useState(false)
 const [kind,setKind]=useState('RESOURCE'),[topic,setTopic]=useState(''),[title,setTitle]=useState(''),[files,setFiles]=useState([]),[prog,setProg]=useState(null),inp=useRef(null)
 const load=useCallback(()=>api.get('/staff/materials').then(r=>setList(r.data)).catch(e=>{setList([]);flash(msg(e),true)}),[flash])
 useEffect(()=>{load()},[load]);useEffect(()=>{setTopic('')},[cid])
 const mine=useMemo(()=>(list||[]).filter(m=>String(m.courseId)===String(cid)),[list,cid])
 const pick=fl=>{const arr=[...fl],bad=arr.map(checkFile).filter(Boolean);if(bad.length)flash(bad[0],true);setFiles(arr.filter(x=>!checkFile(x)))}
 const upload=async e=>{e.preventDefault();if(!cid)return flash('Choose a course first.',true);if(!files.length)return flash('Choose at least one file.',true)
  let ok=0;for(let i=0;i<files.length;i++){const fd=new FormData();fd.append('courseId',cid);fd.append('kind',kind);if(topic)fd.append('topicId',topic);if(title.trim()&&files.length===1)fd.append('title',title.trim());fd.append('file',files[i])
   try{setProg({i:i+1,n:files.length,p:0});await api.post('/admin/materials',fd,{onUploadProgress:p=>setProg({i:i+1,n:files.length,p:Math.round(p.loaded*100/(p.total||1))})});ok++}catch(x){flash(`${files[i].name}: ${msg(x)}`,true)}}
  setProg(null);if(ok){flash(ok===1?'Uploaded. Students of this course can see it now.':`${ok} files uploaded. Students can see them now.`);setFiles([]);setTitle('');if(inp.current)inp.current.value='';setF('ALL');setQ('')}await load()}
 const save=async(m,body)=>{try{await api.put(`/admin/materials/${m.id}`,body);flash('Saved.');setEdit(null);load()}catch(x){flash(msg(x),true)}}
 const del=async m=>{if(!confirm(`Delete “${m.title}”? Students will no longer see it.`))return;try{await api.delete(`/admin/materials/${m.id}`);flash('Deleted.');load()}catch(x){flash(msg(x),true)}}
 const shown=mine.filter(m=>pass(m,f,q))
 return <section className="grid gap-4" aria-label="Resources">
  <div className="box flex flex-wrap items-end gap-3"><label className="grid min-w-[240px] flex-1 gap-1 text-sm font-semibold">Course<select className="inp" value={cid} onChange={e=>setCid(e.target.value)}>{(courses||[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <div className="text-sm opacity-70">{list===null?'Loading…':`${mine.length} file${mine.length===1?'':'s'} in this course · ${(list||[]).length} in all your courses`}</div></div>
  <form className="box grid gap-3" onSubmit={upload}><h2 className="text-lg text-navy">Upload resources</h2>
   <div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);pick(e.dataTransfer.files)}} className={`grid place-items-center rounded-2xl border-2 border-dashed p-6 text-center transition ${drag?'border-teal bg-teal/10':'border-slate-300'}`}>
    <div><div className="text-4xl" aria-hidden="true">☁️</div><p className="font-semibold text-navy">Drag files here or <button type="button" className="text-teal underline" onClick={()=>inp.current?.click()}>browse</button></p>
     <p className="text-xs opacity-65">PDF, Word, PowerPoint, Excel, TXT, images · up to 50 MB · videos (MP4, WEBM, MOV) up to 600 MB</p>
     <input ref={inp} type="file" multiple className="sr-only" aria-label="Choose files" accept={ACCEPT} onChange={e=>pick(e.target.files)}/>
     {files.length>0&&<ul className="mt-2 flex flex-wrap justify-center gap-1.5">{files.map(x=><li key={x.name+x.size} className="chip">{x.name} · {size(x.size)}</li>)}</ul>}</div></div>
   <div className="grid gap-3 md:grid-cols-4"><div><label htmlFor="mt">Module / topic</label><select id="mt" className="inp" value={topic} onChange={e=>setTopic(e.target.value)}><option value="">General (no topic)</option>{topics.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></div>
    <div><label htmlFor="mk">Type</label><select id="mk" className="inp" value={kind} onChange={e=>setKind(e.target.value)}>{Object.entries(KINDS).map(([a,b])=><option key={a} value={a}>{b}</option>)}</select></div>
    <div><label htmlFor="mti">Title {files.length>1&&<span className="font-normal opacity-60">(file names are used)</span>}</label><input id="mti" className="inp" value={title} disabled={files.length>1} onChange={e=>setTitle(e.target.value)} maxLength={150} placeholder="Defaults to the file name"/></div>
    <button className="btn self-end" disabled={!!prog||!files.length||!cid}>{prog?'Uploading…':'⬆ Upload'}</button></div>
   {prog&&<div><div className="pbar"><i style={{width:prog.p+'%'}}/></div><p className="mt-1 text-sm">Uploading file {prog.i} of {prog.n}… {prog.p}%</p></div>}</form>
  <div className="box"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg text-navy">Uploaded files</h2><button className="btn2 !min-h-[36px]" onClick={load}>↻ Refresh</button></div>
   {list===null?<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><div className="skel h-52"/><div className="skel h-52"/><div className="skel h-52"/></div>
   :mine.length===0?<p className="py-8 text-center opacity-75">No files in this course yet. Upload one above and it appears here straight away.</p>
   :<><Filters list={mine} f={f} setF={setF} q={q} setQ={setQ}/><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{shown.map(m=><Card key={m.id} m={m} staff onOpen={setOpen} onEdit={setEdit} onDelete={del}/>)}</div>{shown.length===0&&<p className="py-6 text-center text-sm opacity-70">No files match.</p>}</>}</div>
  <FilePreview m={open} onClose={()=>setOpen(null)}/>{edit&&<EditDialog m={edit} topics={topics} onSave={save} onClose={()=>setEdit(null)}/>}</section>}
