const TOKEN_KEY = 'pi_admin_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function query(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) headers.Authorization = `Bearer ${getToken()}`;

  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });

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
    err.payload = data;
    throw err;
  }
  return data;
}

export const api = {
  login: (secret) => request('/api/admin/login', { method: 'POST', body: { secret } }),
  changeSecret: (current, next) =>
    request('/api/admin/secret', { method: 'POST', body: { current, next }, auth: true }),

  stats: () => request('/api/admin/stats', { auth: true }),
  activity: () => request('/api/admin/activity', { auth: true }),
  exportAll: () => request('/api/admin/export', { auth: true }),

  devices: () => request('/api/admin/devices', { auth: true }),
  banDevice: (id, banned) =>
    request(`/api/admin/devices/${id}/ban`, { method: 'POST', body: { banned }, auth: true }),
  deleteDevice: (id) => request(`/api/admin/devices/${id}`, { method: 'DELETE', auth: true }),

  listMedia: (params) => request(`/api/admin/media${query(params)}`, { auth: true }),
  saveMedia: (media) => request('/api/admin/media', { method: 'POST', body: media, auth: true }),
  deleteMedia: (id) => request(`/api/admin/media/${id}`, { method: 'DELETE', auth: true }),
  bulkDelete: (ids) => request('/api/admin/media/bulk-delete', { method: 'POST', body: { ids }, auth: true }),

  mediaDetail: (id) => request(`/api/media/${id}`),
  saveEpisode: (episode) => request('/api/admin/episode', { method: 'POST', body: episode, auth: true }),
  deleteEpisode: (id) => request(`/api/admin/episode/${id}`, { method: 'DELETE', auth: true }),

  getSettings: () => request('/api/admin/settings', { auth: true }),
  saveSettings: (patch) => request('/api/admin/settings', { method: 'POST', body: patch, auth: true }),

  iptvSources: () => request('/api/admin/iptv/sources', { auth: true }),
  iptvImport: (payload) => request('/api/admin/iptv/import', { method: 'POST', body: payload, auth: true }),
  iptvDeleteSource: (url) =>
    request('/api/admin/iptv/delete-source', { method: 'POST', body: { url }, auth: true }),

  publicSettings: () => request('/api/settings'),
};
