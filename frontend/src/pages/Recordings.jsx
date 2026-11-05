import {useEffect,useRef,useState} from 'react'
import api,{msg,authUrl} from '../api'
import {useAuth} from '../App'

/* Phase 12: class recordings.
   VideoPlayer: a custom player (speed, seek, volume, full screen, resume, keyboard shortcuts, retry on error).
   RecordingsLibrary: the library for teachers (own courses), admins (everything) and students (published, enrolled courses).
   Every request goes to the server, which checks the role and enrolment each time. Nothing is public. */

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
export const clock = s => {
  s = Math.max(0, Math.floor(Number(s) || 0))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(x).padStart(2, '0')
}
export const bytes = b => {
  b = Number(b) || 0
  if (b < 1048576) return (b / 1024).toFixed(0) + ' KB'
  if (b < 1073741824) return (b / 1048576).toFixed(b < 10485760 ? 1 : 0) + ' MB'
  return (b / 1073741824).toFixed(2) + ' GB'
}
const posKey = id => 'nmed-rec-pos-' + id
const readPos = id => { try { return Number(localStorage.getItem(posKey(id))) || 0 } catch (e) { return 0 } }
const savePos = (id, t) => { try { localStorage.setItem(posKey(id), String(Math.floor(t))) } catch (e) { /* private mode: resume just won't be remembered */ } }
const clearPos = id => { try { localStorage.removeItem(posKey(id)) } catch (e) { /* ignore */ } }
const when = s => s ? new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
const STATUS = { READY: ['Ready', 'tag-ok'], UPLOADING: ['Processing', 'tag-wait'], FAILED: ['Failed', 'tag-bad'] }

/* ---------- video player ----------
   Plays saved classes smoothly: a stall watchdog reloads the file at the current position when playback stops making
   progress (dropped range request, seek into data that has not arrived yet), a few automatic retries before an error,
   buffered progress on the seek bar, and the length saved by the server is used as the duration. */
export function VideoPlayer({ id, title, src, poster, downloadHref, hint, protect = false, watermark = '' }) {
  const v = useRef(null), box = useRef(null), last = useRef(0), stallT = useRef(0), startAt = useRef(0), wantPlay = useRef(false), tries = useRef(0)
  const [s, setS] = useState({ play: false, t: 0, d: 0, b: 0, vol: 1, mute: false, rate: 1, buf: true, err: '', fs: false, resumed: 0 })
  const [gen, setGen] = useState(0), [speeds, setSpeeds] = useState(false)
  const up = p => setS(x => ({ ...x, ...p }))
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    if (!protect) return
    // Students: hide the picture when the tab or window is in the background, and clear the clipboard on PrintScreen.
    // Browsers cannot see other apps' screen recorders, so this deters casual capture; it does not prevent it.
    const pause = () => { if (v.current && !v.current.paused) v.current.pause() }
    const hide = () => { setHidden(true); pause() }
    const show = () => setHidden(document.visibilityState === 'hidden' || !document.hasFocus())
    const key = e => { if (e.key === 'PrintScreen') { try { navigator.clipboard?.writeText('') } catch (x) { /* ignore */ } hide() } }
    const onVis = () => (document.visibilityState === 'hidden' ? hide() : show())
    document.addEventListener('visibilitychange', onVis)
    addEventListener('blur', hide); addEventListener('focus', show); addEventListener('keyup', key)
    return () => { document.removeEventListener('visibilitychange', onVis); removeEventListener('blur', hide); removeEventListener('focus', show); removeEventListener('keyup', key) }
  }, [protect])
  const D = s.d > 0 ? s.d : (hint || 0)
  const clearStall = () => clearTimeout(stallT.current)
  const reload = () => {
    const e = v.current; if (!e) return
    tries.current += 1
    if (tries.current > 4) return up({ buf: false, err: 'This recording could not be played. Check your connection, then try again.' })
    startAt.current = e.currentTime || startAt.current
    wantPlay.current = wantPlay.current || !e.paused
    up({ buf: true, err: '' }); setGen(g => g + 1)
  }
  const armStall = () => { clearStall(); stallT.current = setTimeout(reload, 9000) }

  useEffect(() => {
    const f = () => up({ fs: document.fullscreenElement === box.current })
    document.addEventListener('fullscreenchange', f)
    return () => { document.removeEventListener('fullscreenchange', f); clearStall() }
  }, [])

  const toggle = () => { const e = v.current; if (!e) return; if (e.paused) e.play().catch(() => {}); else e.pause() }
  const seek = t => { const e = v.current; if (!e) return; const max = D || e.duration || Infinity; const to = Math.max(0, Math.min(max, t)); e.currentTime = to; up({ t: to }) }
  const skip = n => seek((v.current?.currentTime || 0) + n)
  const setVol = x => { const e = v.current; if (!e) return; e.volume = x; e.muted = x === 0 }
  const setRate = x => { if (v.current) v.current.playbackRate = x; up({ rate: x }); setSpeeds(false) }
  const fullscreen = () => {
    const el = box.current
    if (document.fullscreenElement) { document.exitFullscreen?.(); return }
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => v.current?.webkitEnterFullscreen?.())
    else v.current?.webkitEnterFullscreen?.()
  }
  const onKey = e => {
    if (e.target !== box.current) return          // range sliders and buttons keep their own keys
    const k = e.key
    if (k === ' ' || k === 'k' || k === 'K') { e.preventDefault(); toggle() }
    else if (k === 'ArrowRight') { e.preventDefault(); skip(5) }
    else if (k === 'ArrowLeft') { e.preventDefault(); skip(-5) }
    else if (k === 'l' || k === 'L') skip(10)
    else if (k === 'j' || k === 'J') skip(-10)
    else if (k === 'm' || k === 'M') { if (v.current) v.current.muted = !v.current.muted }
    else if (k === 'f' || k === 'F') fullscreen()
  }
  /* Recorder files carry no length in their header, so the browser reports Infinity until it has read the end.
     The saved length is used when we have it; otherwise jump to the end once to make the browser work the length out. */
  const fixDuration = el => {
    const once = () => { el.removeEventListener('timeupdate', once); el.currentTime = startAt.current || 0; if (isFinite(el.duration)) up({ d: el.duration }) }
    el.addEventListener('timeupdate', once); el.currentTime = 1e101
  }
  const onMeta = () => {
    const e = v.current; if (!e) return
    if (isFinite(e.duration) && e.duration > 0) up({ d: e.duration })
    else if (!hint) fixDuration(e)
    if (startAt.current > 0) { e.currentTime = startAt.current; startAt.current = 0 }
    else { const saved = readPos(id); if (saved > 5 && D && saved < D - 10) { e.currentTime = saved; up({ resumed: saved }) } }
    if (wantPlay.current) { wantPlay.current = false; e.play().catch(() => {}) }
  }
  const restart = () => { seek(0); clearPos(id); up({ resumed: 0 }) }
  const pct = D ? Math.min(100, s.t / D * 100) : 0
  const bpct = D ? Math.min(100, s.b / D * 100) : 0

  return <div ref={box} tabIndex={0} role="region" aria-label={`Video player: ${title}`} onKeyDown={onKey}
    className="vp relative overflow-hidden rounded-2xl bg-black text-white shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-teal">
    <video key={gen} ref={v} src={src} poster={poster} preload="auto" playsInline className={`block aspect-video w-full bg-black ${protect && hidden ? 'blur-2xl' : ''} transition duration-300`} onClick={toggle}
      {...(protect ? { controlsList: 'nodownload noremoteplayback', disablePictureInPicture: true, onContextMenu: e => e.preventDefault() } : {})}
      onLoadedMetadata={onMeta} onDurationChange={e => { if (isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0) up({ d: e.currentTarget.duration }) }}
      onProgress={e => { const b = e.currentTarget.buffered; if (b.length) up({ b: b.end(b.length - 1) }) }}
      onTimeUpdate={e => { const t = e.currentTarget.currentTime; up({ t }); clearStall(); const n = Date.now(); if (n - last.current > 3000) { last.current = n; savePos(id, t) } }}
      onPlay={() => up({ play: true })} onPause={() => up({ play: false })}
      onPlaying={() => { clearStall(); tries.current = 0; up({ buf: false, err: '', play: true }) }}
      onWaiting={() => { up({ buf: true }); armStall() }} onStalled={() => armStall()} onCanPlay={() => up({ buf: false })}
      onSeeking={() => { up({ buf: true }); armStall() }} onSeeked={() => { clearStall(); up({ buf: false }) }}
      onEnded={() => { clearPos(id); clearStall(); up({ play: false }) }}
      onVolumeChange={e => up({ vol: e.currentTarget.volume, mute: e.currentTarget.muted })}
      onRateChange={e => up({ rate: e.currentTarget.playbackRate })}
      onError={() => { clearStall(); if (tries.current < 4) setTimeout(reload, 700); else up({ buf: false, err: 'This recording could not be played. Check your connection, then try again.' }) }} />

    {protect && watermark && <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none overflow-hidden text-[11px] font-semibold text-white/25" style={{ textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>
      {[0, 1, 2, 3].map(k => <span key={k} className="absolute whitespace-nowrap" style={{ top: `${12 + k * 24}%`, left: `${(k % 2) * 18 + 6}%`, transform: 'rotate(-12deg)' }}>{watermark}</span>)}</div>}
    {protect && hidden && <div role="status" className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center text-sm">Paused while this window is in the background. Come back to this tab, then press play.</div>}
    {s.buf && !s.err && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/10">
      <span role="status" aria-label="Loading video" className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" /></div>}
    {s.err && <div className="absolute inset-0 grid place-items-center bg-black/85 p-6 text-center">
      <div className="grid justify-items-center gap-3"><p className="max-w-sm text-sm" role="alert">{s.err}</p>
        <button type="button" className="btn" onClick={() => { tries.current = 0; up({ err: '', buf: true }); setGen(g => g + 1) }}>↻ Try again</button></div></div>}
    {!s.play && !s.err && !s.buf && <button type="button" onClick={toggle} aria-label="Play"
      className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-2xl text-navy shadow-xl transition duration-300 hover:scale-110 hover:shadow-teal/40">▶</button>}
    {s.resumed > 0 && <div role="status" className="absolute left-3 top-3 animate-fadeUp rounded-full bg-black/70 px-3 py-1 text-xs sm:text-sm">
      Resumed at {clock(s.resumed)} · <button type="button" className="font-semibold underline" onClick={restart}>Start from the beginning</button></div>}

    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-3 pb-2 pt-10">
      <input type="range" className="vp-range w-full" min={0} max={D || 0} step="0.1" value={Math.min(s.t, D || 0)} aria-label="Seek"
        aria-valuetext={`${clock(s.t)} of ${clock(D)}`} onChange={e => seek(+e.target.value)} style={{ '--p': pct + '%', '--b': bpct + '%' }} />
      <div className="mt-1 flex flex-wrap items-center gap-1 sm:gap-2">
        <button type="button" className="vp-btn" onClick={toggle} aria-label={s.play ? 'Pause' : 'Play'}>{s.play ? '❚❚' : '▶'}</button>
        <button type="button" className="vp-btn" onClick={() => skip(-10)} aria-label="Back 10 seconds">↺10</button>
        <button type="button" className="vp-btn" onClick={() => skip(10)} aria-label="Forward 10 seconds">10↻</button>
        <button type="button" className="vp-btn" onClick={() => { if (v.current) v.current.muted = !v.current.muted }} aria-label={s.mute || s.vol === 0 ? 'Unmute' : 'Mute'}>{s.mute || s.vol === 0 ? '🔇' : s.vol < 0.5 ? '🔉' : '🔊'}</button>
        <input type="range" className="vp-range hidden w-20 sm:block" min={0} max={1} step="0.05" value={s.mute ? 0 : s.vol} aria-label="Volume" onChange={e => setVol(+e.target.value)} />
        <span className="ml-1 tabular-nums text-xs sm:text-sm">{clock(s.t)} / {clock(D)}</span>
        <span className="flex-1" />
        <div className="relative">
          <button type="button" className="vp-btn tabular-nums" aria-haspopup="true" aria-expanded={speeds} onClick={() => setSpeeds(o => !o)} aria-label={`Playback speed ${s.rate}x`}>{s.rate}x</button>
          {speeds && <div role="group" aria-label="Playback speed" className="absolute bottom-full right-0 mb-2 grid min-w-[90px] animate-fadeUp gap-0.5 rounded-xl bg-black/95 p-1 shadow-xl">
            {SPEEDS.map(x => <button key={x} type="button" aria-pressed={s.rate === x} onClick={() => setRate(x)}
              className={`rounded-lg px-3 py-1.5 text-left text-sm transition duration-200 ${s.rate === x ? 'bg-teal text-white' : 'hover:bg-white/10'}`}>{x}x{x === 1 ? ' (normal)' : ''}</button>)}</div>}
        </div>
        {downloadHref && <a className="vp-btn no-underline" href={downloadHref} aria-label="Download this recording">⬇</a>}
        <button type="button" className="vp-btn" onClick={fullscreen} aria-label={s.fs ? 'Exit full screen' : 'Full screen'}>{s.fs ? '🗗' : '⛶'}</button>
      </div>
    </div>
  </div>
}

/* ---------- small pieces ---------- */
function Dialog({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', k)
    const o = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { removeEventListener('keydown', k); document.body.style.overflow = o }
  }, [])
  return <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/60 p-3 sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <div role="dialog" aria-modal="true" aria-label={title} className={`box w-full min-w-0 ${wide ? 'max-w-4xl' : 'max-w-md'} max-h-[92vh] overflow-y-auto !p-4 sm:!p-5`}>
      <div className="mb-3 flex items-start gap-3"><h2 className="min-w-0 flex-1 break-words text-xl text-navy">{title}</h2>
        <button type="button" className="btn2 !min-h-[36px] !px-3 !py-1" onClick={onClose} aria-label="Close">✕</button></div>
      {children}</div></div>
}

function StorageMeter({ store }) {
  const pct = store.quotaBytes ? Math.min(100, store.usedBytes / store.quotaBytes * 100) : 0
  const admin = store.scope === 'all'
  const stat = (label, n) => <div className="rounded-xl bg-slate-100/70 px-3 py-2 dark:bg-white/5"><dt className="text-xs opacity-70">{label}</dt><dd className="font-serif text-xl font-bold text-navy">{n}</dd></div>
  return <section className="box grid min-w-0 gap-3" aria-labelledby="st-h">
    <div className="flex flex-wrap items-end justify-between gap-2"><div className="min-w-0"><h2 id="st-h" className="text-xl text-navy">Storage</h2>
      <p className="text-sm opacity-70">{admin ? 'All class recordings on this server' : 'Your class recordings'}</p></div>
      <p className="text-sm"><b className="text-navy">{bytes(store.usedBytes)}</b> of {bytes(store.quotaBytes)} used</p></div>
    <div className="h-3 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10" role="progressbar" aria-label="Storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div className={`h-full rounded-full transition-all duration-700 ${pct > 85 ? 'bg-rose-500' : 'bg-gradient-to-r from-teal to-brand2'}`} style={{ width: pct + '%' }} /></div>
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">{stat('Recordings', store.count)}{stat('Ready', store.ready)}{stat('Processing', store.processing)}{stat('Failed', store.failed)}</dl>
    {admin && <p className="break-words text-xs opacity-70">Stored in <span className="font-mono">{store.storageDir}</span> · free on disk: {store.diskFreeBytes == null ? 'unknown' : bytes(store.diskFreeBytes)}</p>}
  </section>
}

function RecCard({ r, scope, busy, onPlay, onRename, onPublish, onDelete, onAllowDownload }) {
  const [label, cls] = STATUS[r.status] || [r.status, 'tag-wait']
  const ready = r.status === 'READY', manage = !!r.canManage && scope !== 'student', admin = scope === 'admin'
  return <li className="box flex min-w-0 flex-col !p-0 overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:shadow-xl">
    <button type="button" onClick={() => ready && onPlay(r)} disabled={!ready} aria-label={ready ? `Play ${r.title}` : r.title}
      className="group relative block aspect-video w-full bg-gradient-to-br from-navy via-brand2 to-teal disabled:cursor-default">
      {r.hasThumb && <img src={authUrl(r.thumbUrl)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
        onError={e => { e.currentTarget.style.display = 'none' }} />}
      <span className="absolute inset-0 grid place-items-center text-white" aria-hidden="true">
        {ready ? <span className="grid h-14 w-14 place-items-center rounded-full bg-surface/90 text-xl text-navy shadow-lg transition group-hover:scale-110">▶</span>
          : <span className="rounded-full bg-black/50 px-3 py-1 text-sm">{r.status === 'UPLOADING' ? '⏺ Processing' : '⚠️ Not available'}</span>}</span>
      {r.durationSec > 0 && <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white">{clock(r.durationSec)}</span>}
    </button>
    <div className="grid min-w-0 flex-1 content-start gap-1.5 p-4">
      <div className="flex flex-wrap items-center gap-1.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
        {r.published && <span className="chip">Published</span>}</div>
      <h3 className="break-words text-base font-bold text-navy">{r.title}</h3>
      <p className="break-words text-sm opacity-80">{r.courseName}</p>
      <p className="break-words text-xs opacity-65">{r.teacherName} · {when(r.createdAt)}</p>
      <p className="break-words text-xs opacity-65">{ready ? `${clock(r.durationSec)} · ${bytes(r.sizeBytes)}`
        : r.status === 'UPLOADING' ? `Recording or uploading · ${bytes(r.sizeBytes)} received so far` : (r.failure || 'This recording could not be saved.')}</p>
      {manage && <div className="mt-2 flex flex-wrap gap-1.5">
        {manage && ready && <button type="button" className="btn2 !min-h-[36px] !px-3 !py-1 text-sm" disabled={busy} onClick={() => onPublish(r)}>{r.published ? 'Unpublish' : 'Publish to students'}</button>}
        {manage && <button type="button" className="btn2 !min-h-[36px] !px-3 !py-1 text-sm" disabled={busy} onClick={() => onRename(r)} aria-label={`Rename ${r.title}`}>✏️ Rename</button>}
        {ready && <a className="btn2 !min-h-[36px] !px-3 !py-1 text-sm no-underline" href={authUrl(r.videoUrl + '?download=1')} aria-label={`Download ${r.title}`}>⬇ Download</a>}
        {manage && <button type="button" className="btn2 !min-h-[36px] !px-3 !py-1 text-sm !border-rose-300 !text-rose-700 hover:!bg-rose-50" disabled={busy} onClick={() => onDelete(r)} aria-label={`Delete ${r.title}`}>🗑 Delete</button>}
      </div>}
    </div></li>
}

/* ---------- library ---------- */
/** scope: 'teacher' (own courses), 'admin' (everything) or 'student' (published recordings of one enrolled course). */
export function RecordingsLibrary({ scope = 'teacher', courseId }) {
  const { user: me } = useAuth()
  const manage = scope !== 'student'
  const [courses, setCourses] = useState([]), [store, setStore] = useState(null)
  const [q, setQ] = useState(''), [dq, setDq] = useState(''), [cid, setCid] = useState(courseId ? String(courseId) : '')
  const [st, setSt] = useState('ALL'), [sort, setSort] = useState('newest'), [page, setPage] = useState(0)
  const [data, setData] = useState(null), [err, setErr] = useState(''), [tick, setTick] = useState(0)
  const [note, setNote] = useState(''), [bad, setBad] = useState(false), [busy, setBusy] = useState(false)
  const [playing, setPlaying] = useState(null), [ren, setRen] = useState(null), [del, setDel] = useState(null)
  const flash = (m, b) => { setNote(m); setBad(!!b); setTimeout(() => setNote(''), b ? 7000 : 4000) }
  const refresh = () => setTick(x => x + 1)
  const reset = setter => e => { setter(e.target.value); setPage(0) }

  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(0) }, 300); return () => clearTimeout(t) }, [q])
  useEffect(() => { if (manage) api.get('/staff/courses').then(r => setCourses(r.data)).catch(() => {}) }, [manage])
  useEffect(() => { if (manage) api.get('/recordings/storage').then(r => setStore(r.data)).catch(() => {}) }, [manage, tick])
  useEffect(() => {
    let live = true
    const params = { q: dq, status: st, sort, page, size: 12 }
    if (cid) params.courseId = cid
    api.get('/recordings', { params }).then(r => { if (live) { setData(r.data); setErr('') } }).catch(x => { if (live) setErr(msg(x)) })
    return () => { live = false }
  }, [dq, cid, st, sort, page, tick])

  // Keep the list fresh while a recording is still being saved.
  const processing = !!data?.items?.some(r => r.status === 'UPLOADING')
  useEffect(() => { if (!processing) return; const t = setTimeout(refresh, 4000); return () => clearTimeout(t) }, [processing, data])

  const patch = async (r, body, ok) => {
    setBusy(true)
    try { await api.patch(`/recordings/${r.id}`, body); flash(ok); refresh(); return true }
    catch (x) { flash(msg(x), true); return false } finally { setBusy(false) }
  }
  const publish = r => patch(r, { published: !r.published }, r.published ? 'Recording hidden from students.' : 'Recording published. Enrolled students can watch it now.')
  const allowDl = r => patch(r, { allowDownload: !r.allowDownload }, r.allowDownload ? 'Downloads are off for this recording.' : 'Downloads are allowed for this recording.')
  const saveName = async e => {
    e.preventDefault(); const t = ren.text.trim(); if (!t) return
    if (await patch(ren.r, { title: t }, 'Recording renamed.')) setRen(null)
  }
  const remove = async () => {
    setBusy(true)
    try { await api.delete(`/recordings/${del.id}`); if (playing?.id === del.id) setPlaying(null); setDel(null); flash('Recording deleted.'); refresh() }
    catch (x) { flash(msg(x), true) } finally { setBusy(false) }
  }

  const items = data?.items || []
  return <div className="grid min-w-0 gap-5">
    {manage && store && <StorageMeter store={store} />}

    <div className="box grid min-w-0 gap-3">
      <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_repeat(3,auto)]">
        <label className="grid min-w-0 gap-1 text-sm font-semibold text-navy">Search<input type="search" className="inp" value={q} onChange={e => setQ(e.target.value)} maxLength={100} placeholder="Title or course" /></label>
        {manage && <label className="grid gap-1 text-sm font-semibold text-navy">Course<select className="inp min-w-[160px]" value={cid} onChange={reset(setCid)}>
          <option value="">All courses</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
        {manage && <label className="grid gap-1 text-sm font-semibold text-navy">Status<select className="inp" value={st} onChange={reset(setSt)}>
          <option value="ALL">All</option><option value="READY">Ready</option><option value="UPLOADING">Processing</option><option value="FAILED">Failed</option></select></label>}
        <label className="grid gap-1 text-sm font-semibold text-navy">Sort<select className="inp" value={sort} onChange={reset(setSort)}>
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="longest">Longest first</option><option value="title">Title A–Z</option></select></label>
      </div>
      <p role="status" className="text-xs opacity-70">{data ? `${data.total||0} recording${(data.total||0) === 1 ? "" : "s"}${dq ? ` matching "${dq}"` : ''}` : 'Loading…'}</p>
      <p role="status" aria-live="polite" className={`${note ? '' : 'hidden'} rounded-xl px-3 py-2 text-sm font-medium ${bad ? 'bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'}`}>{note}</p>
    </div>

    {err && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p>}
    {data === null && !err ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="skel h-72 rounded-2xl" />)}</div>
      : items.length === 0 ? <div className="box grid place-items-center gap-2 py-12 text-center">
        <span className="text-5xl" aria-hidden="true">🎬</span>
        <p className="font-semibold text-navy">{dq || st !== 'ALL' ? 'No recordings match these filters.' : manage ? 'No class recordings yet.' : 'No recordings for this course yet.'}</p>
        {manage && !dq && st === 'ALL' && <p className="max-w-md text-sm opacity-70">Start a live class and press Record. The recording appears here as soon as it is saved.</p>}
      </div>
      : <ul className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map(r => <RecCard key={r.id} r={r} scope={scope} busy={busy}
          onPlay={setPlaying} onRename={x => setRen({ r: x, text: x.title })} onPublish={publish} onDelete={setDel} onAllowDownload={allowDl} />)}</ul>}

    {data && data.pages > 1 && <nav aria-label="Recording pages" className="flex items-center justify-between gap-3">
      <button type="button" className="btn2" disabled={page <= 0} onClick={() => setPage(p => p - 1)}>← Previous</button>
      <span className="text-sm">Page {page + 1} of {data.pages}</span>
      <button type="button" className="btn2" disabled={page >= data.pages - 1} onClick={() => setPage(p => p + 1)}>Next →</button></nav>}

    {playing && <Dialog title={playing.title} wide onClose={() => setPlaying(null)}>
      <VideoPlayer id={playing.id} title={playing.title} hint={playing.durationSec} src={authUrl(playing.videoUrl)} poster={playing.hasThumb ? authUrl(playing.thumbUrl) : undefined}
        downloadHref={playing.canManage ? authUrl(playing.videoUrl + '?download=1') : undefined}
        protect={!playing.canManage} watermark={`${me?.name || ''} · NLMed Study`} />
      <p className="mt-2 break-words text-sm opacity-75">{playing.courseName} · {playing.teacherName} · {when(playing.createdAt)} · {clock(playing.durationSec)}</p>
    </Dialog>}

    {ren && <Dialog title="Rename recording" onClose={() => setRen(null)}>
      <form className="grid gap-3" onSubmit={saveName}>
        <label className="grid gap-1 text-sm font-semibold text-navy">Title<input className="inp" value={ren.text} maxLength={150} required autoFocus onChange={e => setRen({ ...ren, text: e.target.value })} /></label>
        <div className="flex justify-end gap-2"><button type="button" className="btn2" onClick={() => setRen(null)}>Cancel</button><button className="btn" disabled={busy || !ren.text.trim()}>{busy ? 'Saving…' : 'Save title'}</button></div>
      </form></Dialog>}

    {del && <Dialog title="Delete this recording?" onClose={() => setDel(null)}>
      <p className="text-sm">“{del.title}” and its video will be permanently removed. Students will no longer be able to watch it. This cannot be undone.</p>
      <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" className="btn2" onClick={() => setDel(null)} autoFocus>Keep recording</button>
        <button type="button" className="btn2 !border-rose-300 !text-rose-700 hover:!bg-rose-50" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Yes, delete permanently'}</button></div>
    </Dialog>}
  </div>
}

/** Course view for enrolled students: published recordings only (the server filters the list). */
export function StudentRecordings({ courseId }) {
  return <section className="grid min-w-0 gap-4" aria-labelledby="stu-rec-h">
    <div><h2 id="stu-rec-h" className="text-2xl text-navy">Class recordings</h2>
      <p className="text-sm opacity-75">Watch past classes any time. Your teacher publishes each recording when it is ready.</p></div>
    <RecordingsLibrary scope="student" courseId={courseId} />
  </section>
}
