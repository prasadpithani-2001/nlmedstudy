
import axios from 'axios';

// Production: Vercel environment variable
// Local development: Vite proxy
const API_BASE_URL = (
  import.meta.env.VITE_API_URL || '/api'
).replace(/\/$/, '');

const API_ORIGIN = API_BASE_URL.replace(/\/api$/, '');

const api = axios.create({
  baseURL: API_BASE_URL
});

// Read logged-in user token
const tok = () => {
  try {
    return JSON.parse(
      localStorage.getItem('ms_user') || '{}'
    ).token || '';
  } catch {
    return '';
  }
};

// Attach token to API requests
api.interceptors.request.use(config => {
  const token = tok();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const msg = e =>
  e?.response?.data?.message ||
  e?.response?.data?.error ||
  'Something went wrong. Please try again.';

// Convert local API paths into production backend URLs
const backendUrl = url => {
  if (/^https?:\/\//i.test(url)) return url;

  if (url.startsWith('/api/')) {
    return API_ORIGIN + url;
  }

  return url;
};

// Open protected files
export async function openFile(id) {
  const r = await api.get(
    `/materials/${id}/file`,
    { responseType: 'blob' }
  );

  const blobUrl = URL.createObjectURL(r.data);
  window.open(blobUrl, '_blank');
}

export default api;

// File and video URL helpers
export const isFile = u =>
  u.startsWith('/api/') ||
  /\.(mp4|webm)$/i.test(u);

export const vsrc = u => {
  const url = backendUrl(u);

  if (u.startsWith('/api/')) {
    return url + (url.includes('?') ? '&' : '?') +
      'token=' + encodeURIComponent(tok());
  }

  return url;
};

/* URLs for images, iframes and videos */

export const fileUrl = (id, download) =>
  `${API_BASE_URL}/materials/${id}/file?token=${encodeURIComponent(tok())}${download ? '&download=1' : ''}`;

export const authUrl = u => {
  const url = backendUrl(u);

  return url +
    (url.includes('?') ? '&' : '?') +
    'token=' + encodeURIComponent(tok());
};

/* Teacher's default live-class settings */

export const livePrefs = () => {
  try {
    return {
      mode: 'tablet',
      bg: 'plain',
      ...JSON.parse(
        localStorage.getItem('ms_live_prefs') || '{}'
      )
    };
  } catch (e) {
    return { mode: 'tablet', bg: 'plain' };
  }
};
