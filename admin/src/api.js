const TOKEN_KEY = 'pi_admin_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) headers.Authorization = `Bearer ${getToken()}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }

  if (!res.ok) {
    const message = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  login: (secret) => request('/api/admin/login', { method: 'POST', body: { secret } }),
  changeSecret: (current, next) =>
    request('/api/admin/secret', { method: 'POST', body: { current, next }, auth: true }),

  listMedia: () => request('/api/admin/media', { auth: true }),
  saveMedia: (media) => request('/api/admin/media', { method: 'POST', body: media, auth: true }),
  deleteMedia: (id) => request(`/api/admin/media/${id}`, { method: 'DELETE', auth: true }),

  mediaDetail: (id) => request(`/api/media/${id}`),
  saveEpisode: (episode) => request('/api/admin/episode', { method: 'POST', body: episode, auth: true }),
  deleteEpisode: (id) => request(`/api/admin/episode/${id}`, { method: 'DELETE', auth: true }),

  getSettings: () => request('/api/admin/settings', { auth: true }),
  saveSettings: (patch) => request('/api/admin/settings', { method: 'POST', body: patch, auth: true }),

  publicSettings: () => request('/api/settings'),
};
