import api,{msg} from './api'

/* Browser-side class recorder (Phase 12).
   The teacher's browser draws the whiteboard, pictures and camera into one canvas, records that canvas together with the
   teacher's microphone (MediaRecorder), and uploads the video to the server in numbered chunks while the class runs.
   - Chunks are numbered. The server accepts a repeated chunk (safe retry) and refuses gaps.
   - A failed upload (network drop, server 5xx) is retried with back-off; queued data is kept until the server confirms it.
   - Only unsent data is kept in memory. If the connection stays down past that limit, recording stops early and what
     is already queued is still uploaded.
   - Elapsed time excludes pauses, so the recording length matches what was taught. */

export const W = 960, H = 540
const CHUNK_BYTES = 4 * 1048576          // one upload request
const chunkLimit = () => { try { const k = Number(localStorage.getItem('nmed-rec-chunk-kb')); if (k > 0) return k * 1024 } catch (e) { /* ignore */ } return CHUNK_BYTES }   // test override: localStorage nmed-rec-chunk-kb
const MEM_CAP = 512 * 1048576            // unsent data allowed in memory before recording stops early
const SLICE_MS = 1000                    // MediaRecorder data interval
const FPS = 24
const MIME = ['video/webm;codecs=vp8,opus', 'video/webm']

export function recordingSupported() {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream
}

export class ClassRecorder {
  /**
   * @param {object} o
   * @param {number} o.id                 recording id created on the server
   * @param {MediaStream} o.stream        the teacher's stream (its audio tracks are recorded)
   * @param {(ctx:CanvasRenderingContext2D,w:number,h:number)=>void} o.draw   paints one frame
   * @param {(s:object)=>void} o.onChange  receives a status snapshot (every second and on every change)
   */
  constructor({ id, stream, draw, onChange }) {
    this.id = id; this.stream = stream; this.draw = draw; this.onChange = onChange || (() => {})
    this.canvas = document.createElement('canvas'); this.canvas.width = W; this.canvas.height = H
    this.ctx = this.canvas.getContext('2d')
    this.status = 'idle'            // idle | recording | paused | saving | saved | failed
    this.elapsed = 0; this.segStart = 0
    this.buf = []; this.bufBytes = 0
    this.index = 0                  // next chunk number
    this.queue = []                 // [{index, blob}] not yet confirmed by the server
    this.inFlight = false
    this.sentChunks = 0; this.sentBytes = 0
    this.attempt = 0; this.lastError = ''; this.retryAt = 0
    this.capHit = false             // true when recording stopped early because the connection stayed down
    this.thumbDone = false; this.stopping = false; this.destroyed = false
    this.rec = null; this.cap = null; this.mime = 'video/webm'; this.finished = null
    this.paintTimer = 0; this.tickTimer = 0; this.thumbTimer = 0; this.retryTimer = 0
    this.online = typeof navigator === 'undefined' || navigator.onLine !== false
    this.chunkLimit = chunkLimit()
    this.onOnline = () => { this.online = true; this.lastError = ''; this.attempt = 0; this.pump() }
    this.onOffline = () => { this.online = false; this.emit() }
  }

  get elapsedMs() { return this.elapsed + (this.status === 'recording' ? Date.now() - this.segStart : 0) }
  get unsentBytes() { return this.queue.reduce((s, q) => s + q.blob.size, 0) + this.bufBytes }

  snapshot() {
    return {
      status: this.status, elapsedMs: this.elapsedMs, paused: this.status === 'paused',
      sentChunks: this.sentChunks, sentBytes: this.sentBytes, queued: this.queue.length,
      unsentBytes: this.unsentBytes, online: this.online, inFlight: this.inFlight,
      attempt: this.attempt, lastError: this.lastError,
      retryIn: Math.max(0, Math.ceil((this.retryAt - Date.now()) / 1000)), capHit: this.capHit,
    }
  }
  emit() { try { this.onChange(this.snapshot()) } catch (e) { /* a UI error must not stop recording */ } }

  /** Start capturing. Call after the server has created the recording. */
  start() {
    if (!recordingSupported()) throw new Error('This browser cannot record. Try Chrome, Edge or Firefox.')
    const type = MIME.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t))
    this.mime = (type || 'video/webm').split(';')[0]
    this.paintTimer = setInterval(() => this.paint(), Math.round(1000 / FPS))
    this.paint()
    this.cap = this.canvas.captureStream(FPS)
    this.stream.getAudioTracks().forEach(t => this.cap.addTrack(t))
    this.rec = new MediaRecorder(this.cap, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 1200000, audioBitsPerSecond: 96000 })
    this.rec.ondataavailable = e => { if (e.data && e.data.size) this.ingest(e.data) }
    this.rec.onerror = e => this.fail('The browser stopped recording (' + (e.error?.name || 'recorder error') + ').')
    this.rec.start(SLICE_MS)
    this.status = 'recording'; this.segStart = Date.now()
    addEventListener('online', this.onOnline); addEventListener('offline', this.onOffline)
    this.tickTimer = setInterval(() => this.emit(), 1000)
    this.thumbTimer = setTimeout(() => this.thumbnail(), 4000)   // a picture of the class, once the camera has settled
    this.emit()
  }

  paint() {
    if (this.destroyed) return
    this.ctx.save()
    try { this.draw(this.ctx, W, H) } catch (e) { /* a bad frame is skipped */ }
    this.ctx.restore()
  }

  pause() {
    if (this.status !== 'recording' || this.stopping) return
    try { this.rec.pause() } catch (e) { return }
    this.elapsed += Date.now() - this.segStart; this.status = 'paused'; this.emit()
  }
  resume() {
    if (this.status !== 'paused' || this.stopping) return
    try { this.rec.resume() } catch (e) { return }
    this.segStart = Date.now(); this.status = 'recording'; this.emit()
  }

  ingest(blob) {
    this.buf.push(blob); this.bufBytes += blob.size
    if (this.bufBytes >= this.chunkLimit) this.cut()
  }

  /** Turn the buffered recorder data into the next numbered chunk and queue it for upload. */
  cut() {
    if (!this.bufBytes) return
    const blob = new Blob(this.buf, { type: this.mime })
    this.buf = []; this.bufBytes = 0
    this.queue.push({ index: this.index++, blob })
    if (!this.capHit && this.unsentBytes > MEM_CAP) {
      this.capHit = true
      this.lastError = 'The connection was down for too long, so recording stopped early. Everything recorded so far is kept.'
      this.stop()
    }
    this.pump()
  }

  pump() {
    if (this.destroyed || this.inFlight || this.status === 'failed') return
    if (!this.queue.length || !this.online) { this.emit(); return }
    if (Date.now() < this.retryAt) return
    const job = this.queue[0]
    this.inFlight = true; this.emit()
    api.put(`/recordings/${this.id}/chunks/${job.index}`, job.blob, { headers: { 'Content-Type': 'application/octet-stream' } })
      .then(() => {
        this.queue.shift(); this.sentChunks++; this.sentBytes += job.blob.size
        this.inFlight = false; this.attempt = 0; this.lastError = ''; this.retryAt = 0
        this.pump()
      })
      .catch(x => {
        this.inFlight = false
        const code = x?.response?.status
        // A refusal (not a network problem) means the server will not take more data for this recording.
        if (code && code >= 400 && code < 500 && code !== 408 && code !== 429) return this.fail(msg(x))
        this.attempt++
        this.lastError = msg(x) || 'Upload interrupted'
        const wait = Math.min(30000, 1000 * 2 ** Math.min(this.attempt, 5))
        this.retryAt = Date.now() + wait
        clearTimeout(this.retryTimer); this.retryTimer = setTimeout(() => this.pump(), wait)
        this.emit()
      })
  }

  /** A picture of the class for the library. Failure does not matter, so errors are ignored. */
  thumbnail() {
    if (this.thumbDone || this.destroyed) return Promise.resolve()
    return new Promise(res => {
      this.canvas.toBlob(b => {
        if (!b) return res()
        api.put(`/recordings/${this.id}/thumbnail`, b, { headers: { 'Content-Type': 'application/octet-stream' } })
          .then(() => { this.thumbDone = true; res() }).catch(() => res())
      }, 'image/jpeg', 0.85)
    })
  }

  /** Stop the MediaRecorder and wait for its last data. Elapsed time is settled here, before any status change. */
  stopRecorder() {
    clearInterval(this.paintTimer); clearInterval(this.tickTimer); clearTimeout(this.thumbTimer)
    if (this.status === 'recording') { const now = Date.now(); this.elapsed += now - this.segStart; this.segStart = now }
    if (!this.rec || this.rec.state === 'inactive') return Promise.resolve()
    return new Promise(done => {
      this.rec.addEventListener('stop', () => done(), { once: true })
      try { this.rec.stop() } catch (e) { done() }
    })
  }

  /** Save: stop, upload everything still queued, then finish the recording on the server. Safe to call twice. */
  stop(reasonIfEmpty) {
    if (!this.finished) this.finished = this._finish(reasonIfEmpty)
    return this.finished
  }

  async _finish(reasonIfEmpty) {
    const broken = this.status === 'failed'
    await this.stopRecorder()
    if (!broken) this.status = 'saving'
    this.cut()
    if (!broken) await this.drain()
    if (this.sentChunks === 0) {
      this.status = 'failed'; this.lastError = reasonIfEmpty || 'The recording was empty, so nothing was saved.'
      this.emit()
      await this.call('abort', { reason: this.lastError }).catch(() => {})
      this.destroy()
      return { ok: false, message: this.lastError }
    }
    const durationSec = Math.round(this.elapsedMs / 1000)
    try {
      if (!this.thumbDone) await this.thumbnail()
      const view = await this.call('finish', { durationSec })
      this.status = 'saved'
      this.emit(); this.destroy()
      return { ok: true, view, interrupted: broken || this.capHit, message: broken ? this.lastError : (this.capHit ? this.lastError : '') }
    } catch (x) {
      this.status = 'failed'; this.lastError = msg(x); this.emit(); this.destroy()
      return { ok: false, message: this.lastError }
    }
  }

  /** Resolves when the queue is empty. While offline, retries continue and the status keeps the teacher informed. */
  drain() {
    return new Promise(resolve => {
      const check = () => {
        if (this.destroyed || this.status === 'failed' || this.queue.length === 0) return resolve()
        this.pump(); setTimeout(check, 500)
      }
      check()
    })
  }

  call(kind, body) { return api.post(`/recordings/${this.id}/${kind}`, body || {}).then(r => r.data) }

  /** Something the server refused, or the browser could not continue: stop the recorder and remember why. */
  fail(text) {
    if (this.status === 'failed' || this.status === 'saved') return
    this.lastError = text || 'The recording failed.'
    this.stopRecorder()
    this.status = 'failed'
    this.emit()
  }

  /** Data the server never confirmed. Offered to the teacher as a local download as a last resort. */
  unsavedBlob() {
    const parts = this.queue.map(q => q.blob)
    if (this.bufBytes) parts.push(new Blob(this.buf, { type: this.mime }))
    return parts.length ? new Blob(parts, { type: this.mime }) : null
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    clearInterval(this.paintTimer); clearInterval(this.tickTimer); clearTimeout(this.thumbTimer); clearTimeout(this.retryTimer)
    removeEventListener('online', this.onOnline); removeEventListener('offline', this.onOffline)
    if (this.cap) this.cap.getTracks().forEach(t => t.stop())
  }
}
