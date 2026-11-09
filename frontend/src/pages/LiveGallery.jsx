import {useEffect,useRef} from 'react'

/* Students' microphones play through these hidden audio elements, so the teacher can hear the class. */
export function AudioSink({feeds}){
 const ids=Object.keys(feeds||{})
 return <div aria-hidden="true" style={{position:'absolute',width:0,height:0,overflow:'hidden'}}>
  {ids.map(id=><Sink key={id} id={id} stream={feeds[id]}/>)}
 </div>}
function Sink({id,stream}){const a=useRef(null)
 useEffect(()=>{const el=a.current;if(!el)return;el.srcObject=stream;el.muted=false;const p=el.play&&el.play();if(p&&p.catch)p.catch(()=>{})},[stream])
 return <audio ref={a} autoPlay data-live={id}/>}

/* Browsers block sound until the page is clicked. This button starts every student audio again. */
export function unlockSound(){
 document.querySelectorAll('audio[data-live]').forEach(el=>{el.muted=false;const p=el.play&&el.play();if(p&&p.catch)p.catch(()=>{})})}

function Tile({name,stream,on=true,mic,hand,mirror,muted=true}){
 const v=useRef(null)
 useEffect(()=>{if(v.current&&stream){v.current.srcObject=stream;const p=v.current.play&&v.current.play();if(p&&p.catch)p.catch(()=>{})}},[stream])
 const live=!!stream&&on
 return <div className="relative grid min-h-[140px] place-items-center overflow-hidden rounded-2xl bg-slate-800 ring-1 ring-white/10">
  {stream&&<video ref={v} autoPlay playsInline muted={muted} className={`absolute inset-0 h-full w-full object-cover ${live?'':'invisible'}`} style={mirror?{transform:'scaleX(-1)'}:undefined}/>}
  {!live&&<span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-teal to-brand2 text-2xl font-bold text-white" aria-hidden="true">{(name||'?').slice(0,1).toUpperCase()}</span>}
  <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 text-xs font-semibold text-white">
   <span className="truncate">{name}</span>
   {hand&&<span title="Hand raised" aria-label="Hand raised">✋</span>}
   <span className="ml-auto" aria-label={mic===false?'Mic off':'Mic on'}>{mic===false?'🔇':'🎙️'}</span>
  </div>
 </div>}

/* "View all": every participant in one grid, like Teams. Opens over the class; the board stays underneath. */
export function Gallery({host,selfStream,teacherName,teacherStream,peers,feeds,media,hands,onClose}){
 const students=peers.filter(p=>p.role==='STUDENT')
 const count=students.length+1
 const cols=count<=1?1:count<=4?2:count<=9?3:4
 const raised=id=>(hands||[]).some(h=>h.id===id)
 return <div role="region" aria-label="All participants" className="absolute inset-0 z-[70] flex flex-col overflow-hidden rounded-2xl bg-slate-950/95 p-3 text-white backdrop-blur-sm">
  <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
   <b className="text-base">All participants</b>
   <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">{count}</span>
   <button type="button" className="ml-auto rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600" onClick={unlockSound}>🔊 Turn on sound</button>
   <button type="button" className="rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold hover:bg-white/25" onClick={onClose}>✕ Close</button>
  </div>
  <div className="grid min-h-0 flex-1 auto-rows-fr gap-2 overflow-auto" style={{gridTemplateColumns:`repeat(${cols},minmax(0,1fr))`}}>
   {host
     ?<Tile name={`${teacherName||'You'} (you)`} stream={selfStream} mirror muted/>
     :<Tile name={teacherName||'Teacher'} stream={teacherStream} muted={false}/>}
   {students.map(s=><Tile key={s.id} name={s.name} stream={feeds[s.id]} on={media[s.id]?media[s.id].cam:true} mic={media[s.id]?media[s.id].mic:undefined} hand={raised(s.id)} muted/>)}
  </div>
 </div>}