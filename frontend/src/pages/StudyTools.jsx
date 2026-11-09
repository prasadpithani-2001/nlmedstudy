import {useEffect,useState} from 'react'
import api,{msg,fileUrl} from '../api'
import {Empty,Skeletons,theme} from './Public'
import {FilePreview,cat} from './Materials'
import {useRef} from 'react'

/* Flashcards and notes. Flashcards are grouped by subject: each subject is one box, and the box holds that subject's summary cards. */

/* Card faces use inline styles on purpose: no backdrop-blur or overflow on the 3D parent, so the back face shows after the flip. */
const FACE={position:'absolute',inset:0,borderRadius:24,backfaceVisibility:'hidden',WebkitBackfaceVisibility:'hidden'}

export function StudentFlashcards(){
 const [cards,setCards]=useState(null),[err,setErr]=useState(''),[subj,setSubj]=useState(null),[i,setI]=useState(0),[flip,setFlip]=useState(false)
 useEffect(()=>{api.get('/my/flashcards').then(r=>setCards(Array.isArray(r.data)?r.data:[])).catch(e=>{setErr(msg(e));setCards([])})},[])
 if(cards===null) return <Skeletons n={1} h="h-40"/>
 if(err) return <p role="alert" className="text-amber-700">{err}</p>
 if(cards.length===0) return <Empty icon="🃏" title="No flashcards yet">Your teachers have not added summary cards for your courses yet.</Empty>

 const groups={}; cards.forEach(c=>{(groups[c.subject]=groups[c.subject]||[]).push(c)})
 const names=Object.keys(groups)
 const open=n=>{setSubj(n);setI(0);setFlip(false)}

 /* Subject boxes */
 if(!subj||!groups[subj]) return <section aria-label="Flashcard subjects" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {names.map(n=>{const [g,e]=theme(n),list=groups[n]
   return <button key={n} type="button" onClick={()=>open(n)} className="group relative overflow-hidden rounded-3xl text-left shadow-xl ring-1 ring-slate-900/10 transition duration-300 hover:-translate-y-1.5 hover:shadow-2xl">
    <span className={`absolute inset-0 bg-gradient-to-br ${g}`} aria-hidden="true"/>
    <span className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15" aria-hidden="true"/>
    <span className="relative flex flex-col gap-3 p-5 text-white">
     <span className="flex items-center justify-between"><span className="text-4xl drop-shadow" aria-hidden="true">{e}</span><span className="rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-bold">{list.length} card{list.length===1?'':'s'}</span></span>
     <b className="text-xl leading-tight">{n}</b>
     <span className="line-clamp-2 text-sm text-white/85">{list.slice(0,2).map(c=>c.front).join(' · ')}</span>
     <span className="mt-1 text-xs font-bold uppercase tracking-wider">Study now →</span>
    </span>
   </button>})}
 </section>

 /* One subject: the flip card */
 const list=groups[subj],n=list.length,idx=Math.min(i,n-1),cur=list[idx],[g,e]=theme(subj)
 const go=d=>{setFlip(false);setI(x=>(x+d+n)%n)}
 const toggle=()=>setFlip(f=>!f)
 const onKey=ev=>{
   if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();toggle()}
   else if(ev.key==='ArrowRight'&&n>1){go(1)}
   else if(ev.key==='ArrowLeft'&&n>1){go(-1)}}

 return <section aria-label={`Flashcards for ${subj}`} className="grid gap-5">
  <div className="flex flex-wrap items-center gap-3">
   <button className="btn2 !min-h-[36px] !py-1 text-sm" onClick={()=>setSubj(null)}>← All subjects</button>
   <span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${g} text-lg`} aria-hidden="true">{e}</span>
   <h3 className="text-lg text-navy">{subj}</h3>
   <span className="ml-auto text-sm font-semibold opacity-70">{idx+1} / {n}</span>
  </div>

  <div className="flex justify-center gap-1.5" aria-hidden="true">{list.map((_,k)=><span key={k} className={`h-1.5 rounded-full transition-all duration-300 ${k===idx?`w-6 bg-gradient-to-r ${g}`:'w-1.5 bg-slate-300 dark:bg-white/20'}`}/>)}</div>

  <div style={{perspective:'1200px'}} className="mx-auto w-full max-w-2xl">
   <div role="button" tabIndex={0} aria-label={flip?'Showing the summary. Press to see the question.':'Showing the question. Press to see the summary.'} onClick={toggle} onKeyDown={onKey}
     className="relative h-72 w-full cursor-pointer select-none rounded-3xl outline-none focus-visible:ring-4 focus-visible:ring-teal/50 sm:h-80"
     style={{transformStyle:'preserve-3d',WebkitTransformStyle:'preserve-3d',transition:'transform .7s cubic-bezier(.2,.8,.2,1)',transform:flip?'rotateY(180deg)':'rotateY(0deg)'}}>

    {/* front: question */}
    <div style={FACE} className={`flex flex-col items-center justify-center bg-gradient-to-br ${g} p-8 text-center text-white shadow-2xl`}>
     <span className="mb-4 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest">Question</span>
     <p className="max-h-full w-full overflow-auto text-xl font-bold leading-snug sm:text-2xl">{cur.front}</p>
     <span className="absolute bottom-4 left-0 right-0 text-xs font-semibold text-white/85">Tap or press Enter to reveal the summary ↻</span>
    </div>

    {/* back: summary */}
    <div style={{...FACE,transform:'rotateY(180deg)'}} className="flex flex-col bg-white p-6 text-slate-800 shadow-2xl ring-1 ring-slate-900/10 dark:bg-slate-900 dark:text-slate-100 sm:p-8">
     <div className="mb-3 flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${g}`}/><span className="text-[11px] font-bold uppercase tracking-widest text-teal">Summary · {cur.front}</span></div>
     <div className="min-h-0 flex-1 overflow-auto whitespace-pre-line pr-1 text-base leading-relaxed sm:text-lg">{cur.back}</div>
     <span className="mt-3 text-xs font-semibold opacity-60">Tap to go back to the question ↺</span>
    </div>
   </div>
  </div>

  <div className="flex items-center justify-between gap-3">
   <button className="btn2" onClick={()=>go(-1)} disabled={n<2}>← Previous</button>
   <button className="btn2 !px-4" onClick={toggle}>{flip?'↺ Show question':'↻ Show summary'}</button>
   <button className="btn" onClick={()=>go(1)} disabled={n<2}>Next →</button>
  </div>
 </section>
}

export function StudentNotes({courses}){
 const [rows,setRows]=useState(null),[open,setOpen]=useState(null),[err,setErr]=useState('')
 const key=(courses||[]).map(c=>c.courseId).join(',')
 useEffect(()=>{
   let live=true
   const list=courses||[]
   if(!courses) return
   if(list.length===0){setRows([]);return}
   Promise.all(list.map(c=>
     api.get(`/courses/${c.courseId}/materials`)
       .then(r=>(Array.isArray(r.data)?r.data:[])
         .filter(m=>String(m.kind||'').toUpperCase()==='NOTE')
         .map(m=>({...m,course:c.name})))
       .catch(e=>{ if(live) setErr(msg(e)); return [] })
   )).then(a=>{ if(live) setRows(a.flat()) })
   return()=>{live=false}
 },[key])
 if(courses===undefined||courses===null) return <Skeletons n={1} h="h-40"/>
 if(rows===null) return <Skeletons n={1} h="h-40"/>
 if(err) return <p role="alert" className="text-amber-700">{err}</p>
 if(rows.length===0) return <Empty icon="📝" title="No notes yet">Notes your teachers upload for your courses appear here.</Empty>
 return <section aria-label="Notes" className="grid gap-3">
  {rows.map(m=><div key={m.id} className="box flex flex-wrap items-center gap-3">
   <span className="text-2xl" aria-hidden="true">{cat(m.category)[0]}</span>
   <div className="min-w-0 flex-1"><b className="block truncate text-navy">{m.title}</b><span className="text-xs opacity-65">{m.course}{m.topic?' · '+m.topic:''}</span></div>
   <button className="btn2 !min-h-[36px] !px-3 !py-1 text-sm" onClick={()=>setOpen(m)}>👁 View</button>
   <a className="btn2 !min-h-[36px] !px-3 !py-1 text-sm" href={fileUrl(m.id,true)} aria-label={`Download ${m.title}`}>⬇</a>
  </div>)}
  <FilePreview m={open} onClose={()=>setOpen(null)}/>
 </section>
}

/* Teacher and admin: add and delete summary flashcards. The summary can be typed, or loaded from a .txt / .md file. */
export function FlashcardEditor({courses,flash}){
 const [cid,setCid]=useState(''),[cards,setCards]=useState(null),[front,setFront]=useState(''),[back,setBack]=useState(''),[busy,setBusy]=useState(false),[fileName,setFileName]=useState(''),file=useRef(null)
 useEffect(()=>{if(!cid&&courses.length)setCid(String(courses[0].id))},[courses,cid])
 const course=courses.find(c=>String(c.id)===String(cid))
 const subject=course?course.subject:''
 const load=()=>{if(!cid)return;setCards(null);api.get(`/courses/${cid}/flashcards`).then(r=>setCards(r.data)).catch(e=>{setCards([]);flash(msg(e),true)})}
 useEffect(()=>{load()},[cid])
 const pickFile=e=>{
   const f=e.target.files&&e.target.files[0]
   e.target.value=''
   if(!f) return
   if(!/\.(txt|md)$/i.test(f.name)) return flash('Use a .txt or .md file for the summary.',true)
   if(f.size>100*1024) return flash('That file is too large. Keep it under 100 KB.',true)
   const r=new FileReader()
   r.onload=()=>{setBack(String(r.result||'').trim());setFileName(f.name);flash('Summary loaded from file. Check it, then press Add card.')}
   r.onerror=()=>flash('Could not read that file.',true)
   r.readAsText(f)}
 const add=async e=>{
   e.preventDefault()
   if(back.length>1000) return flash('Summary is longer than 1000 characters. Shorten it or split it into two cards.',true)
   setBusy(true)
   try{await api.post(`/admin/courses/${cid}/flashcards`,{front:front.trim(),back:back.trim()});setFront('');setBack('');setFileName('');flash(`Card added. Students can see it in the ${subject} box now.`);load()}
   catch(x){flash(msg(x),true)} finally{setBusy(false)}}
 const del=async c=>{if(!confirm('Delete this flashcard?'))return
   try{await api.delete(`/admin/flashcards/${c.id}`);flash('Flashcard deleted.');load()}catch(x){flash(msg(x),true)}}
 if(courses.length===0) return <Empty icon="🃏" title="Create a course first">Flashcards belong to a course. Add a course in the Courses section.</Empty>
 return <section className="grid gap-4" aria-label="Flashcards">
  <div className="box flex flex-wrap items-end gap-3">
   <label className="grid min-w-[240px] flex-1 gap-1 text-sm font-semibold">Course<select className="inp" value={cid} onChange={e=>setCid(e.target.value)}>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <div className="text-sm"><span className="opacity-70">Subject box: </span><b className="text-navy">{subject||'—'}</b><span className="ml-3 opacity-70">{cards?`${cards.length} card${cards.length===1?'':'s'}`:'Loading…'}</span></div>
  </div>
  <form className="box grid gap-3" onSubmit={add}><h2 className="text-lg text-navy">Add a summary card</h2>
   <div className="grid gap-3 md:grid-cols-2">
    <div><label htmlFor="fq">Topic / question</label><textarea id="fq" className="inp" rows={3} maxLength={300} value={front} onChange={e=>setFront(e.target.value)} required placeholder="e.g. Cardiac cycle"/></div>
    <div>
     <div className="flex items-center justify-between"><label htmlFor="fa">Summary points</label><span className={`text-xs ${back.length>1000?'text-rose-600':'opacity-60'}`}>{back.length}/1000</span></div>
     <textarea id="fa" className="inp" rows={5} value={back} onChange={e=>setBack(e.target.value)} required placeholder={'e.g.\n- Atrial systole\n- Isovolumetric contraction\n- Ventricular ejection'}/>
    </div>
   </div>
   <div className="flex flex-wrap items-center gap-3">
    <button type="button" className="btn2" onClick={()=>file.current?.click()}>📄 Upload summary file (.txt / .md)</button>
    <input ref={file} type="file" accept=".txt,.md,text/plain" className="sr-only" aria-label="Upload summary file" tabIndex={-1} onChange={pickFile}/>
    {fileName&&<span className="chip">{fileName}</span>}
    <span className="text-xs opacity-65">File content textarea lo load avutundi. Edit cheyyochu.</span>
   </div>
   <div><button className="btn" disabled={busy||!cid||!front.trim()||!back.trim()||back.length>1000}>{busy?'Adding…':'+ Add card'}</button></div>
  </form>
  <div className="box"><h2 className="mb-3 text-lg text-navy">Cards in this course</h2>
   {cards===null?<Skeletons n={1} h="h-24"/>:cards.length===0?<p className="py-6 text-center text-sm opacity-70">No cards yet. Add the first one above.</p>
   :<ul className="grid gap-2 md:grid-cols-2">{cards.map(c=><li key={c.id} className="flex items-start gap-3 rounded-xl border border-slate-200/70 p-3">
     <div className="min-w-0 flex-1"><p className="break-words font-semibold text-navy">{c.front}</p><p className="mt-1 whitespace-pre-line break-words text-sm opacity-75">{c.back}</p><span className="chip mt-2">{c.subject}</span></div>
     <button className="btn2 !min-h-[34px] !px-2.5 !py-1 text-sm !text-rose-600" onClick={()=>del(c)} aria-label="Delete flashcard">🗑</button>
   </li>)}</ul>}
  </div>
 </section>
}

/* Teacher and admin: upload notes for a course. Every uploaded note appears in the student's Notes tab. */
export function NotesEditor({courses,topics,cid,setCid,flash}){
 const [list,setList]=useState(null),[files,setFiles]=useState([]),[topic,setTopic]=useState(''),[busy,setBusy]=useState(false),[prog,setProg]=useState(null)
 const load=()=>{if(!cid)return;setList(null);api.get(`/courses/${cid}/materials`).then(r=>setList((r.data||[]).filter(m=>m.kind==='NOTE'))).catch(e=>{setList([]);flash(msg(e),true)})}
 useEffect(()=>{load()},[cid])
 const upload=async e=>{e.preventDefault();if(!cid)return flash('Choose a course first.',true);if(!files.length)return flash('Choose at least one file.',true)
   setBusy(true);let ok=0
   for(let i=0;i<files.length;i++){const fd=new FormData();fd.append('courseId',cid);fd.append('kind','NOTE');if(topic)fd.append('topicId',topic);fd.append('file',files[i])
     try{setProg({i:i+1,n:files.length,p:0});await api.post('/admin/materials',fd,{onUploadProgress:p=>setProg({i:i+1,n:files.length,p:Math.round(p.loaded*100/(p.total||1))})});ok++}
     catch(x){flash(`${files[i].name}: ${msg(x)}`,true)}}
   setBusy(false);setProg(null);setFiles([]);if(ok){flash(ok===1?'Note uploaded. Students can see it now.':`${ok} notes uploaded. Students can see them now.`);load()}}
 const del=async m=>{if(!confirm(`Delete “${m.title}”? Students will no longer see it.`))return
   try{await api.delete(`/admin/materials/${m.id}`);flash('Note deleted.');load()}catch(x){flash(msg(x),true)}}
 if(courses.length===0) return <Empty icon="📝" title="Create a course first">Notes belong to a course. Add a course in the Courses section.</Empty>
 return <section className="grid gap-4" aria-label="Notes">
  <div className="box flex flex-wrap items-end gap-3">
   <label className="grid min-w-[240px] flex-1 gap-1 text-sm font-semibold">Course<select className="inp" value={cid} onChange={e=>setCid(e.target.value)}>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <div className="text-sm opacity-70">{list?`${list.length} note${list.length===1?'':'s'} in this course`:'Loading…'}</div>
  </div>
  <form className="box grid gap-3" onSubmit={upload}><h2 className="text-lg text-navy">Upload notes</h2>
   <div className="grid gap-3 md:grid-cols-[1fr_auto]">
    <div><label htmlFor="nf">Files (PDF, Word, PowerPoint, images)</label><input id="nf" type="file" multiple className="inp" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp" onChange={e=>setFiles([...e.target.files])}/></div>
    <div><label htmlFor="nt">Module / topic</label><select id="nt" className="inp" value={topic} onChange={e=>setTopic(e.target.value)}><option value="">General</option>{(topics||[]).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></div>
   </div>
   {files.length>0&&<p className="text-sm opacity-75">{files.length} file{files.length>1?'s':''} selected</p>}
   {prog&&<div><div className="pbar"><i style={{width:prog.p+'%'}}/></div><p className="mt-1 text-sm">Uploading file {prog.i} of {prog.n}… {prog.p}%</p></div>}
   <div><button className="btn" disabled={busy||!files.length}>{busy?'Uploading…':'⬆ Upload notes'}</button></div>
  </form>
  <div className="box"><h2 className="mb-3 text-lg text-navy">Notes in this course</h2>
   {list===null?<Skeletons n={1} h="h-24"/>:list.length===0?<p className="py-6 text-center text-sm opacity-70">No notes yet. Upload the first one above.</p>
   :<ul className="grid gap-2">{list.map(m=><li key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/70 p-3">
     <span className="text-2xl" aria-hidden="true">{cat(m.category)[0]}</span>
     <div className="min-w-0 flex-1"><b className="block truncate text-navy">{m.title}</b><span className="text-xs opacity-65">{m.topic||'General'}</span></div>
     <a className="btn2 !min-h-[34px] !px-3 !py-1 text-sm" href={fileUrl(m.id,true)}>⬇ Download</a>
     <button className="btn2 !min-h-[34px] !px-2.5 !py-1 text-sm !text-rose-600" onClick={()=>del(m)} aria-label={`Delete ${m.title}`}>🗑</button>
   </li>)}</ul>}
  </div>
 </section>
}