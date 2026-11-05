// End-to-end check of the live-class client against a mock server that mirrors LiveSocket.java's protocol.
// The mock is NOT the Spring backend: it exists to exercise the React client in a real browser.
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const { chromium } = require('/opt/npm-tools/node_modules/playwright');

const STATIC = process.argv[2];
const ENDED = 'This live class has ended. Thank you for attending!';
const TOK = {
  'tok-teacher': { id: 1, name: 'Dr Teacher', role: 'TEACHER' },
  'tok-s1': { id: 2, name: 'Asha Student', role: 'STUDENT' },
};
const rooms = new Map(), endedCourses = new Set(), log = [];
let seq = 0;
const getRoom = k => { if (!rooms.has(k)) rooms.set(k, { peers: new Map(), waiting: new Map(), letIn: new Set(), startedAt: 0, ended: false, teacher: null }); return rooms.get(k); };
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

function roster(R) {
  const list = [...R.peers.values()].filter(p => p.role !== 'TEACHER').map(p => ({ id: p.id, name: p.name, joinedAt: p.joinedAt, mic: p.mic, cam: p.cam, hand: false }));
  for (const p of R.peers.values()) send(p.ws, { type: 'roster', list });
}
function waitingList(R) {
  const list = [...R.waiting.values()].map(w => ({ id: w.id, name: w.name, since: w.since }));
  if (R.teacher) send(R.teacher, { type: 'waiting_list', list });
}
function admit(R, ws) {
  ws.admitted = true; R.waiting.delete(ws.id); R.letIn.add(ws.user.id);
  const peers = [...R.peers.values()].map(p => ({ id: p.id, name: p.name, role: p.role }));
  send(ws, { type: 'hands', list: [] });
  send(ws, { type: 'welcome', id: ws.id, bg: 'plain', mode: 'tablet', peers, startedAt: R.startedAt, now: Date.now(), recording: false });
  R.peers.set(ws.id, { id: ws.id, ws, name: ws.user.name, role: ws.user.role, mic: false, cam: false, joinedAt: Date.now() });
  if (ws.user.role === 'TEACHER') R.teacher = ws;
  for (const p of R.peers.values()) if (p.ws !== ws) send(p.ws, { type: 'join', id: ws.id, name: ws.user.name, role: ws.user.role, startedAt: R.startedAt, now: Date.now() });
  log.push(`admitted ${ws.user.name}`);
  roster(R); waitingList(R);
}
function endRoom(room, R) {
  R.ended = true; endedCourses.add(room); rooms.delete(room);
  const everyone = [...R.peers.values()].map(p => p.ws).concat([...R.waiting.values()].map(w => w.ws));
  for (const ws of everyone) { send(ws, { type: 'class_ended', message: ENDED }); ws.close(1000); }
  log.push('class ended, session row ENDED');
}

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.startsWith('/api/')) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{}'); }
  if (p === '/') p = '/index.html';
  const f = path.join(STATIC, p);
  if (!f.startsWith(STATIC) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const type = f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream';
  res.writeHead(200, { 'content-type': type }); fs.createReadStream(f).pipe(res);
});

const wss = new WebSocketServer({ server, path: '/ws/live' });
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const room = url.searchParams.get('room'), u = TOK[url.searchParams.get('token')];
  if (!u || !room) return ws.close(1008);
  const R = getRoom(room);
  ws.id = 'p' + (++seq); ws.user = u; ws.room = room;
  if (u.role === 'TEACHER') {
    if (!R.startedAt) { R.startedAt = Date.now(); endedCourses.delete(room); log.push('session row LIVE'); }
    admit(R, ws);
  } else if (!(R.startedAt > 0 && !R.ended) && endedCourses.has(room)) {
    send(ws, { type: 'class_ended', message: ENDED }); return ws.close(1000);
  } else if (!R.letIn.has(u.id)) {
    R.waiting.set(ws.id, { id: ws.id, ws, name: u.name, since: Date.now() });
    send(ws, { type: 'waiting', teacher: !!R.teacher }); waitingList(R);
  } else admit(R, ws);
  ws.on('message', raw => {
    const m = JSON.parse(raw), host = u.role === 'TEACHER';
    if (!host && !ws.admitted) return;
    switch (m.type) {
      case 'media': if (!host) { const p = R.peers.get(ws.id); if (p) { p.mic = !!m.mic; p.cam = !!m.cam; } roster(R); } break;
      case 'admit': if (host) { const w = R.waiting.get(m.to); if (w) admit(R, w.ws); waitingList(R); } break;
      case 'admit_all': if (host) { for (const w of [...R.waiting.values()]) admit(R, w.ws); waitingList(R); } break;
      case 'deny': if (host) { const w = R.waiting.get(m.to); R.waiting.delete(m.to); if (w) { send(w.ws, { type: 'denied' }); w.ws.close(1000); } waitingList(R); } break;
      case 'end': if (host) endRoom(room, R); break;
      case 'offer': case 'answer': case 'ice': { const t = R.peers.get(m.to); if (t) send(t.ws, { ...m, from: ws.id }); break; }
      default: break;
    }
  });
  ws.on('close', () => {
    if (R.ended) return;
    if (!ws.admitted) { if (R.waiting.delete(ws.id)) waitingList(R); return; }
    R.peers.delete(ws.id);
    if (u.role === 'TEACHER') R.teacher = null;
    for (const p of R.peers.values()) send(p.ws, { type: 'leave', id: ws.id });
    roster(R);
  });
});

const results = [];
const check = (name, ok, extra = '') => { results.push([ok, name, extra]); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  — ' + extra : '')); };
const waitFor = async (fn, ms = 8000, step = 100) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch (e) {} await new Promise(r => setTimeout(r, step)); } return false; };

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port, base = `http://127.0.0.1:${port}`;

  // Teacher is a plain WebSocket client: it speaks the same protocol the teacher's browser does.
  const tmsgs = []; let teacher = null;
  const connectTeacher = () => new Promise(res => {
    teacher = new WebSocket(`ws://127.0.0.1:${port}/ws/live?room=1&token=tok-teacher`);
    teacher.on('message', d => tmsgs.push(JSON.parse(d)));
    teacher.on('open', () => res());
  });
  await connectTeacher();
  const lastOf = type => [...tmsgs].reverse().find(m => m.type === type);

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('ms_user', JSON.stringify({ token: 'tok-s1', role: 'STUDENT', name: 'Asha Student', id: 2, email: 'asha@example.com' }));
    window.__tracks = [];
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async c => { const s = await orig(c); s.getTracks().forEach(t => window.__tracks.push(t)); return s; };
  });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e && e.message || e)));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) pageErrors.push('console: ' + m.text()); });

  await page.goto(base + '/#/live/1');
  await page.getByRole('button', { name: 'Join class' }).click();

  // 1. Waiting room
  check('student waits at the door while the teacher is present',
    await waitFor(() => page.getByText('Your teacher will let you in in a moment…').isVisible()));
  check('teacher is told the student is waiting',
    await waitFor(() => { const w = lastOf('waiting_list'); return w && w.list.some(x => x.name === 'Asha Student'); }));
  const waitingId = lastOf('waiting_list').list.find(x => x.name === 'Asha Student').id;

  // 2. Admit
  teacher.send(JSON.stringify({ type: 'admit', to: waitingId }));
  check('admitted student leaves the waiting room',
    await waitFor(async () => !(await page.getByText('Your teacher will let you in in a moment…').isVisible())));

  // 3. Student microphone and camera (real tracks, synced to roster)
  const micBtn = page.locator('button[aria-label="Unmute microphone"]');
  check('student toolbar has a microphone button', await waitFor(() => micBtn.isVisible()));
  await micBtn.click();
  check('mic on reaches teacher roster',
    await waitFor(() => { const r = lastOf('roster'); return r && r.list.some(x => x.name === 'Asha Student' && x.mic === true); }));
  const micLive = await page.evaluate(() => window.__tracks.filter(t => t.kind === 'audio').some(t => t.readyState === 'live'));
  check('mic is a live audio track', micLive);

  await page.locator('button[aria-label="Turn camera on"]').click();
  check('camera on reaches teacher roster',
    await waitFor(() => { const r = lastOf('roster'); return r && r.list.some(x => x.name === 'Asha Student' && x.cam === true); }));
  check('camera is a live video track', await page.evaluate(() => window.__tracks.some(t => t.kind === 'video' && t.readyState === 'live')));

  await page.locator('button[aria-label="Turn camera off"]').click();
  check('camera off reaches teacher roster',
    await waitFor(() => { const r = lastOf('roster'); return r && r.list.some(x => x.name === 'Asha Student' && x.cam === false); }));
  check('camera off stops the video track (device released)',
    await page.evaluate(() => window.__tracks.filter(t => t.kind === 'video').every(t => t.readyState === 'ended')));

  await page.locator('button[aria-label="Mute microphone"]').click();
  check('mic off stops the audio track',
    await page.evaluate(() => window.__tracks.filter(t => t.kind === 'audio').every(t => t.readyState === 'ended')));

  // 4. Teacher unexpectedly disconnects: student is told, not left on a stale "start" screen
  teacher.close();
  check('student sees that the teacher disconnected',
    await waitFor(() => page.getByText('Your teacher has disconnected. Waiting for them to come back…').isVisible()));

  // 5. Teacher comes back, then ends the class
  await new Promise(r => setTimeout(r, 300));
  tmsgs.length = 0; await connectTeacher();
  check('student is back in the class when the teacher returns',
    await waitFor(async () => !(await page.getByText('Your teacher has disconnected. Waiting for them to come back…').isVisible())));
  teacher.send(JSON.stringify({ type: 'end' }));
  check('ended screen shows the required message',
    await waitFor(() => page.getByText(ENDED).isVisible()));
  check('ended screen offers a way back to the dashboard',
    await page.getByRole('link', { name: 'Return to dashboard' }).isVisible());
  check('no End Call / call controls remain on the ended screen',
    (await page.getByText(/End Call/i).count()) === 0 && (await page.locator('button[aria-label="Unmute microphone"],button[aria-label="Mute microphone"]').count()) === 0);
  check('student media tracks are stopped after the class ends',
    await page.evaluate(() => window.__tracks.every(t => t.readyState === 'ended')));

  // 6. Reconnect after the class ended is refused
  const again = new WebSocket(`ws://127.0.0.1:${port}/ws/live?room=1&token=tok-s1`);
  const firstMsg = await new Promise(res => { again.on('message', d => res(JSON.parse(d))); again.on('close', () => res(null)); setTimeout(() => res(null), 4000); });
  check('reconnect to the ended class is refused', firstMsg && firstMsg.type === 'class_ended', firstMsg ? firstMsg.type : 'no message');

  check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  await browser.close(); server.close(); wss.close();
  const failed = results.filter(r => !r[0]).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  console.log('mock log:', log.join(' > '));
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('TEST CRASHED', e); process.exit(2); });
