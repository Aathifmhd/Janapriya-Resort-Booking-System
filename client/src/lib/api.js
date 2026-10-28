const TOKEN_KEY = 'jr_token';
const USER_KEY = 'jr_user';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setSession = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};
export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};
export const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
};

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function request(method, url, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (res.status === 401 && !opts.noRedirect && !url.includes('/auth/login')) {
    clearSession();
    if (window.location.pathname.startsWith('/admin') && !window.location.pathname.startsWith('/admin/login')) {
      window.location.href = '/admin/login';
    }
  }
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
  put: (url, body) => request('PUT', url, body),
  del: (url) => request('DELETE', url),
};

export function qs(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj || {})) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}
