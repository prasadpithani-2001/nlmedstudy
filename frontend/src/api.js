import axios from 'axios'
const api=axios.create({baseURL:'/api'})
api.interceptors.request.use(c=>{const u=JSON.parse(localStorage.getItem('ms_user')||'null');if(u)c.headers.Authorization='Bearer '+u.token;return c})
export const msg=e=>e?.response?.data?.message||e?.response?.data?.error||'Something went wrong. Please try again.'
export async function openFile(id){const r=await api.get(`/materials/${id}/file`,{responseType:'blob'});window.open(URL.createObjectURL(r.data),'_blank')}
export default api
export const isFile=u=>u.startsWith('/api/')||/\.(mp4|webm)$/.test(u)
export const vsrc=u=>u.startsWith('/api/')?u+'?token='+JSON.parse(localStorage.getItem('ms_user')||'{}').token:u
/* Phase 9: URLs for <img>/<iframe>/<video> (they cannot send headers, so the session token rides in the query string) */
const tok=()=>JSON.parse(localStorage.getItem('ms_user')||'{}').token||''
export const fileUrl=(id,download)=>`/api/materials/${id}/file?token=${encodeURIComponent(tok())}${download?'&download=1':''}`
export const authUrl=u=>u+(u.includes('?')?'&':'?')+'token='+encodeURIComponent(tok())

/* teacher's default live-class settings (saved on this device) */
export const livePrefs=()=>{try{return{mode:'tablet',bg:'plain',...JSON.parse(localStorage.getItem('ms_live_prefs')||'{}')}}catch(e){return{mode:'tablet',bg:'plain'}}}
