import {useCallback,useEffect,useMemo,useState} from 'react'
import api,{msg,authUrl} from '../api'
import {BackBar,PageHeader} from '../ui'

/* Reports and student complaints (Phase 14).
   - ReportsBoard: admin and teacher view. Admin sees every report; a teacher sees reports about their own courses (the server decides).
   - MyReports: the student's own reports with their threads, where they can reply.
   - Both share the same thread, status and screenshot display. */

export const STATUS = {
  OPEN: ['Open', 'bg-amber-100 text-amber-800'],
  IN_PROGRESS: ['In progress', 'bg-sky-100 text-sky-800'],
  RESOLVED: ['Resolved', 'bg-emerald-100 text-emerald-800'],
}
export const CATEGORIES = ['Payment', 'Video / Lesson', 'Notes / Resources', 'Login / Account', 'Recording', 'Other']

const when = s => s ? new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''

function StatusPill({ status }) {
  const [label, cls] = STATUS[status] || [status, 'bg-slate-100 text-slate-700']
  return <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${cls}`}>{label}</span>
}

function Thread({ issue }) {
  if (!issue.replies?.length) return <p className="text-sm opacity-60">No replies yet.</p>
  return <ol className="grid gap-2" aria-label="Replies">{issue.replies.map(r => (
    <li key={r.id} className={`rounded-xl px-3 py-2 text-sm ${r.role === 'STUDENT' ? 'bg-slate-100 dark:bg-white/5' : 'bg-teal/10'}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs opacity-70"><b>{r.authorName}</b><span>{r.role === 'STUDENT' ? 'student' : 'staff'}</span><span>· {when(r.at)}</span></div>
      <p className="mt-1 whitespace-pre-wrap break-words">{r.message}</p>
    </li>))}</ol>
}

function ReplyBox({ issue, onSent, endpoint, label = 'Reply' }) {
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const send = async e => {
    e.preventDefault(); setBusy(true); setErr('')
    try { const r = await api.post(endpoint(issue.id), { message: text }); setText(''); onSent(r.data) }
    catch (x) { setErr(msg(x)) } finally { setBusy(false) }
  }
  return <form onSubmit={send} className="mt-2 grid gap-2">
    <label className="text-sm font-semibold" htmlFor={`reply-${issue.id}`}>{label}</label>
    <textarea id={`reply-${issue.id}`} className="inp" rows={2} maxLength={2000} value={text} onChange={e => setText(e.target.value)} placeholder="Write a reply" />
    <div className="flex flex-wrap items-center gap-2"><button className="btn !py-1.5 text-sm" disabled={busy || !text.trim()}>{busy ? 'Sending…' : 'Send reply'}</button>
      <p role="alert" className="text-sm text-rose-700">{err}</p></div>
  </form>
}

/** Admin or teacher: filterable list with status changes and replies. */
export function ReportsBoard({ scope = 'teacher' }) {
  const [list, setList] = useState(null), [err, setErr] = useState(''), [note, setNote] = useState('')
  const [status, setStatus] = useState('ALL'), [cat, setCat] = useState('ALL'), [q, setQ] = useState('')
  const load = useCallback(() => api.get('/staff/issues').then(r => { setList(r.data); setErr('') }).catch(x => setErr(msg(x))), [])
  useEffect(() => { load() }, [load])
  const patch = (i, row) => setList(l => l.map(x => x.id === i.id ? row : x))
  const setStatusOf = async (i, s) => {
    try { const r = await api.put(`/staff/issues/${i.id}/status`, { status: s }); patch(i, r.data); setNote(`Marked ${STATUS[s][0].toLowerCase()}.`) }
    catch (x) { setNote(msg(x)) }
  }
  const shown = useMemo(() => (list || []).filter(i =>
    (status === 'ALL' || i.status === status) && (cat === 'ALL' || i.category === cat) &&
    (!q.trim() || `${i.message} ${i.userName} ${i.courseName || ''}`.toLowerCase().includes(q.trim().toLowerCase()))), [list, status, cat, q])
  const counts = useMemo(() => Object.fromEntries(Object.keys(STATUS).map(k => [k, (list || []).filter(i => i.status === k).length])), [list])

  return <section className="box" aria-label={scope === 'admin' ? 'Reported problems' : 'Student complaints'}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-xl text-navy">{scope === 'admin' ? 'Reports and student complaints' : 'Student complaints'}</h2>
        <p className="text-sm opacity-70">{scope === 'admin' ? 'Every report from students and teachers.' : 'Reports about your courses. Replies go to the student.'}</p></div>
      <div className="flex flex-wrap gap-2 text-sm"><span className="chip">Open {counts.OPEN}</span><span className="chip">In progress {counts.IN_PROGRESS}</span><span className="chip">Resolved {counts.RESOLVED}</span></div>
    </div>
    <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
      <input className="inp" aria-label="Search reports" placeholder="Search message, name or course" value={q} onChange={e => setQ(e.target.value)} />
      <select className="inp" aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">All statuses</option>{Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
      <select className="inp" aria-label="Filter by category" value={cat} onChange={e => setCat(e.target.value)}><option value="ALL">All categories</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
    </div>
    <p role="status" className="mb-2 text-sm text-teal">{note}</p>
    {err && <p role="alert" className="mb-2 text-sm text-rose-700">{err}</p>}
    {list === null && !err && <div className="grid gap-3" aria-label="Loading reports">{[0, 1].map(k => <div key={k} className="skel h-24 rounded-xl" />)}</div>}
    {list && shown.length === 0 && <p className="py-6 text-center opacity-70">{list.length ? 'No reports match these filters.' : 'No reports yet. 🎉'}</p>}
    <ul className="grid gap-3">{shown.map(i => <li key={i.id} className="rounded-xl border border-slate-200/70 p-4 transition duration-300 hover:shadow-md dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2"><StatusPill status={i.status} /><b className="text-navy">{i.category}</b>
        {i.courseName && <span className="chip">{i.courseName}</span>}</div>
      <p className="mt-1 text-sm opacity-70 break-words">{i.userName} ({(i.role || '').toLowerCase()}) · {when(i.at)}{i.updatedAt && i.updatedAt !== i.at ? ` · updated ${when(i.updatedAt)}` : ''}</p>
      <p className="my-2 whitespace-pre-wrap break-words text-[15px]">{i.message}</p>
      {i.hasScreenshot && <a className="btn2 !min-h-[36px] !py-1 text-sm no-underline" href={authUrl(`/api/issues/${i.id}/screenshot`)} target="_blank" rel="noreferrer">🖼 View screenshot</a>}
      <div className="mt-3"><Thread issue={i} /></div>
      <ReplyBox issue={i} endpoint={id => `/staff/issues/${id}/reply`} onSent={row => { patch(i, row); setNote('Reply sent.') }} />
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Set status of report ${i.id}`}>{Object.keys(STATUS).map(s =>
        <button key={s} type="button" className="btn2 !min-h-[36px] !py-1 text-sm" aria-pressed={i.status === s} disabled={i.status === s} onClick={() => setStatusOf(i, s)}>{STATUS[s][0]}</button>)}</div>
    </li>)}</ul>
  </section>
}

/** Student: their own reports, with replies from staff. */
export function MyReports() {
  const [list, setList] = useState(null), [err, setErr] = useState('')
  const load = useCallback(() => api.get('/my/issues').then(r => { setList(r.data); setErr('') }).catch(x => setErr(msg(x))), [])
  useEffect(() => { load() }, [load])
  if (err) return <p role="alert" className="text-rose-700">{err}</p>
  if (list === null) return <div className="grid gap-3" aria-label="Loading your reports">{[0, 1].map(k => <div key={k} className="skel h-24 rounded-xl" />)}</div>
  if (!list.length) return <p className="py-8 text-center opacity-70">You have not reported anything. Use “Report a problem” at the bottom right if something is wrong.</p>
  return <ul className="grid gap-4">{list.map(i => <li key={i.id} className="box transition duration-300 hover:-translate-y-0.5">
    <div className="flex flex-wrap items-center gap-2"><StatusPill status={i.status} /><b className="text-navy">{i.category}</b>{i.courseName && <span className="chip">{i.courseName}</span>}</div>
    <p className="mt-1 text-sm opacity-70">Sent {when(i.at)}</p>
    <p className="my-2 whitespace-pre-wrap break-words">{i.message}</p>
    {i.hasScreenshot && <a className="btn2 !min-h-[36px] !py-1 text-sm no-underline" href={authUrl(`/api/issues/${i.id}/screenshot`)} target="_blank" rel="noreferrer">🖼 View your screenshot</a>}
    <div className="mt-3"><Thread issue={i} /></div>
    <ReplyBox issue={i} label={i.status === 'RESOLVED' ? 'Reply and reopen' : 'Add a reply'} endpoint={id => `/my/issues/${id}/reply`} onSent={row => setList(l => l.map(x => x.id === i.id ? row : x))} />
  </li>)}</ul>
}

/** Route wrapper for students: header, their reports, and Back. */
export function MyReportsPage() {
  return <div className="grid gap-4">
    <PageHeader eyebrow="Your voice matters" title="My reports" sub="Problems you reported and the replies from your teacher or the admin." />
    <MyReports />
    <BackBar to="/dashboard" label="Back to my learning" />
  </div>
}
