/**
 * Play Infinity — API + admin panel host (Cloudflare Worker + D1)
 *
 * Public (no auth, the app has no login):
 *   GET  /api/health
 *   GET  /api/settings
 *   GET  /api/categories
 *   GET  /api/home?device_id=            -> category rows + continue watching
 *   GET  /api/media?type=&genre=&category=&q=&limit=
 *   GET  /api/media/:id
 *   GET  /api/continue?device_id=
 *   POST /api/analytics                  { device_id, media_id, progress_seconds }
 *   POST /api/request                    { device_id, title }
 *   POST /api/verify_license             { key, device_id }
 *
 * Admin (Bearer session token or Bearer admin secret):
 *   POST   /api/admin/login, /api/admin/secret
 *   GET    /api/admin/stats, /api/admin/activity, /api/admin/export
 *   GET/POST /api/admin/media, POST /api/admin/media/bulk-delete, DELETE /api/admin/media/:id
 *   POST   /api/admin/episode, DELETE /api/admin/episode/:id
 *   GET/POST /api/admin/settings
 *   GET/POST /api/admin/categories, DELETE /api/admin/categories/:id
 *   GET/POST /api/admin/licenses, DELETE /api/admin/licenses/:id
 *   GET    /api/admin/requests, POST /api/admin/requests/:id/fulfill
 *   GET    /api/admin/iptv/sources, POST /api/admin/iptv/import, /api/admin/iptv/delete-source
 *
 * Developed by Mohammad Fahad Mir
 */

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PLAYLIST_BYTES = 6 * 1024 * 1024;
const MAX_IMPORT = 2000;
const INSERT_CHUNK = 40;
const RATE_LIMIT = 60;
const ROW_LIMIT = 20;

const PUBLIC_SETTING_KEYS = [
  'maintenance',
  'maintenance_message',
  'live_tv_enabled',
  'downloads_enabled',
  'update_required',
  'update_message',
  'app_version',
  'privacy_policy',
  'terms_conditions',
  'developer_name',
  'developer_portfolio',
  'developer_instagram',
  'premium_enabled',
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function error(message, status = 400, extra = {}) {
  return json({ error: message, ...extra }, status);
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function pickString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function pickNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function flag(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

async function getSetting(db, key) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  return row ? row.value : null;
}

async function setSetting(db, key, value) {
  await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(key, String(value)).run();
}

async function adminSecretHash(db) {
  return (await getSetting(db, 'admin_secret_hash')) || (await sha256Hex('admin123'));
}

async function isAdmin(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  const hash = await adminSecretHash(env.DB);
  if (timingSafeEqual(await sha256Hex(token), hash)) return true;
  const session = await env.DB.prepare('SELECT token, expires_at FROM sessions WHERE token = ?').bind(token).first();
  return Boolean(session && session.expires_at > Date.now());
}

async function logActivity(db, action, detail) {
  try {
    await db.prepare('INSERT INTO activity (action, detail) VALUES (?, ?)').bind(action, detail).run();
  } catch {
    /* logging must never break a request */
  }
}

function normaliseMedia(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    cover_url: row.cover_url,
    backdrop_url: row.backdrop_url,
    type: row.type,
    release_year: row.release_year,
    genres: row.genres ? row.genres.split(',').map((g) => g.trim()).filter(Boolean) : [],
    rating: row.rating,
    video_url: row.video_url,
    format: row.format,
    featured: row.featured === 1,
    category_id: row.category_id || null,
    source: row.source || '',
    created_at: row.created_at,
  };
}

function normaliseCategory(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    is_premium: row.is_premium === 1,
    is_enabled: row.is_enabled === 1,
    sort_order: row.sort_order,
    media_count: row.media_count === undefined ? undefined : row.media_count,
  };
}

function normaliseEpisode(row) {
  return {
    id: row.id,
    media_id: row.media_id,
    season: row.season,
    episode_number: row.episode_number,
    title: row.title,
    video_url: row.video_url,
    format: row.format,
  };
}

function parsePlaylist(text) {
  const out = [];
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const attrs = {};
      const re = /([a-zA-Z0-9-]+)="([^"]*)"/g;
      let m;
      while ((m = re.exec(line)) !== null) attrs[m[1].toLowerCase()] = m[2];
      const comma = line.indexOf(',');
      cur = {
        name: comma >= 0 ? line.slice(comma + 1).trim() : '',
        logo: attrs['tvg-logo'] || '',
        group: attrs['group-title'] || '',
        url: null,
      };
    } else if (line.startsWith('#EXTGRP') && cur) {
      cur.group = line.slice(line.indexOf(':') + 1).trim();
    } else if (!line.startsWith('#') && cur && !cur.url) {
      cur.url = line;
      out.push(cur);
      cur = null;
    }
  }
  return out.filter((e) => e.url && /^https?:\/\//i.test(e.url) && e.name);
}

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]),
  );
}

/** Public share page: https://…/movie/{id} — clickable anywhere, opens the app. */
async function handleLanding(env, id) {
  const row = await env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(id).first();
  if (!row) {
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Not found</title>' +
        '<body style="background:#0B0B0F;color:#fff;font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0">' +
        '<div style="text-align:center"><h1 style="font-weight:800">Title not found</h1>' +
        '<p style="color:#A1A1AA">This link does not point at anything in the catalogue.</p></div></body>',
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  const m = normaliseMedia(row);
  const appLink = `playinfinity://movie/${m.id}`;
  const webLink = `/movie/${m.id}`;
  const poster = m.backdropUrl || m.coverUrl;
  const meta = [m.releaseYear || null, m.rating ? `★ ${m.rating.toFixed(1)}` : null, ...(m.genres || []).slice(0, 2)]
    .filter(Boolean)
    .join(' · ');

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(m.title)} — Play Infinity</title>
<meta property="og:title" content="${escapeHtml(m.title)} — Play Infinity">
<meta property="og:description" content="${escapeHtml((m.description || '').slice(0, 160))}">
${poster ? `<meta property="og:image" content="${escapeHtml(poster)}">` : ''}
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; background:#0B0B0F; color:#fff; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  .hero { position:relative; min-height:52vh; display:flex; align-items:flex-end; }
  .hero img.bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:.55; }
  .hero .scrim { position:absolute; inset:0; background:linear-gradient(180deg, rgba(11,11,15,.35) 0%, rgba(11,11,15,.85) 60%, #0B0B0F 100%); }
  .hero .inner { position:relative; padding:24px; width:100%; max-width:760px; margin:0 auto; }
  .brand { display:flex; align-items:center; gap:8px; font-weight:800; letter-spacing:.4px; margin-bottom:18px; }
  .brand span.mark { display:grid; place-items:center; width:28px; height:28px; border-radius:8px; background:#E50914; font-size:13px; }
  h1 { font-size:clamp(26px, 6vw, 44px); line-height:1.05; margin:0 0 8px; font-weight:900; letter-spacing:-.5px; }
  .meta { color:#A1A1AA; font-size:14px; margin-bottom:14px; }
  .desc { color:#D4D4D8; font-size:15px; line-height:1.6; max-width:60ch; }
  .actions { display:flex; flex-wrap:wrap; gap:12px; margin-top:22px; }
  a.btn { display:inline-flex; align-items:center; gap:8px; text-decoration:none; font-weight:700; font-size:15px; padding:13px 22px; border-radius:999px; }
  a.primary { background:#fff; color:#000; }
  a.ghost { border:1px solid rgba(255,255,255,.22); color:#fff; background:rgba(255,255,255,.06); }
  .hint { margin-top:18px; color:#71717A; font-size:13px; line-height:1.6; }
  .hint a { color:#A1A1AA; }
</style></head>
<body>
  <div class="hero">
    ${poster ? `<img class="bg" src="${escapeHtml(poster)}" alt="">` : ''}
    <div class="scrim"></div>
    <div class="inner">
      <div class="brand"><span class="mark">▶</span> Play Infinity</div>
      <h1>${escapeHtml(m.title)}</h1>
      ${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ''}
      <p class="desc">${escapeHtml((m.description || '').slice(0, 260))}</p>
      <div class="actions">
        <a class="btn primary" href="${appLink}" id="open">▶ Open in Play Infinity</a>
        <a class="btn ghost" href="https://github.com/mfm965204-cell/play-infinity">Get the app</a>
      </div>
      <p class="hint" id="hint">
        Tap <b>Open in Play Infinity</b>. If nothing happens, the app is not installed yet —
        grab the latest APK from <a href="https://github.com/mfm965204-cell/play-infinity/actions">GitHub Actions</a>.
        This page is ${escapeHtml(webLink)}.
      </p>
    </div>
  </div>
<script>
  (function () {
    var target = ${JSON.stringify(appLink)};
    var btn = document.getElementById('open');
    var hint = document.getElementById('hint');
    function attempt() {
      var started = Date.now();
      window.location.href = target;
      setTimeout(function () {
        if (Date.now() - started < 2200 && !document.hidden) {
          hint.innerHTML = 'The app did not open. Install Play Infinity, then tap the button again.';
        }
      }, 1800);
    }
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      attempt();
    });
  })();
</script>
</body></html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/** 60 requests / minute / IP, tracked in D1. */
async function rateLimit(env, request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const window = Math.floor(Date.now() / 60000);
  try {
    const row = await env.DB.prepare(
      `INSERT INTO rate_limit (ip, window, hits) VALUES (?, ?, 1)
       ON CONFLICT(ip, window) DO UPDATE SET hits = hits + 1 RETURNING hits`,
    )
      .bind(ip, window)
      .first();
    const hits = row ? row.hits : 1;
    if (window % 10 === 0) {
      await env.DB.prepare('DELETE FROM rate_limit WHERE window < ?').bind(window - 5).run();
    }
    if (hits > RATE_LIMIT) {
      return { limited: true, hits };
    }
  } catch {
    // if the limiter table is unavailable, fail open
  }
  return { limited: false };
}

function generateLicenseKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block = (n) => {
    const bytes = crypto.getRandomValues(new Uint8Array(n));
    return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
  };
  return `INFINITY-${block(4)}-${block(4)}`;
}

async function handlePublic(request, env, url) {
  const path = url.pathname;
  const db = env.DB;

  if (path === '/api/health') {
    const counts = await db.prepare('SELECT COUNT(*) AS total FROM media').first();
    return json({ ok: true, service: 'play-infinity', media: counts ? counts.total : 0 });
  }

  if (path === '/api/settings') {
    const { results } = await db.prepare('SELECT key, value FROM settings').all();
    const out = {};
    for (const row of results || []) if (PUBLIC_SETTING_KEYS.includes(row.key)) out[row.key] = row.value;
    return json(out);
  }

  if (path === '/api/categories') {
    const { results } = await db
      .prepare(
        `SELECT c.*, (SELECT COUNT(*) FROM media m WHERE m.category_id = c.id) AS media_count
         FROM categories c WHERE c.is_enabled = 1 ORDER BY c.sort_order ASC, c.id ASC`,
      )
      .all();
    return json({ items: (results || []).map(normaliseCategory) });
  }

  if (path === '/api/home') {
    const deviceId = url.searchParams.get('device_id') || '';
    const { results: cats } = await db
      .prepare('SELECT * FROM categories WHERE is_enabled = 1 ORDER BY sort_order ASC, id ASC')
      .all();

    const rows = [];
    for (const cat of cats || []) {
      let items = [];
      if (cat.slug === 'trending') {
        const { results } = await db
          .prepare("SELECT * FROM media WHERE type != 'live' ORDER BY featured DESC, id DESC LIMIT ?")
          .bind(ROW_LIMIT)
          .all();
        items = results || [];
      } else {
        const { results } = await db
          .prepare('SELECT * FROM media WHERE category_id = ? ORDER BY featured DESC, id DESC LIMIT ?')
          .bind(cat.id, ROW_LIMIT)
          .all();
        items = results || [];
      }
      if (items.length) {
        rows.push({ category: normaliseCategory(cat), items: items.map(normaliseMedia) });
      }
    }

    let continueWatching = [];
    if (deviceId) {
      const { results } = await db
        .prepare(
          `SELECT a.media_id, a.progress_seconds, a.last_updated,
                  m.title, m.cover_url, m.backdrop_url, m.type, m.video_url, m.format,
                  m.rating, m.release_year, m.genres, m.category_id, m.description, m.featured
           FROM analytics a JOIN media m ON m.id = a.media_id
           WHERE a.device_id = ? AND a.progress_seconds > 20
           ORDER BY a.last_updated DESC LIMIT 12`,
        )
        .bind(deviceId)
        .all();
      continueWatching = (results || []).map((row) => ({
        ...normaliseMedia(row),
        progress_seconds: row.progress_seconds,
        last_updated: row.last_updated,
      }));
    }

    return json({
      rows,
      continue_watching: continueWatching,
      premium: { enabled: (await getSetting(db, 'premium_enabled')) === '1' },
    });
  }

  if (path === '/api/continue') {
    const deviceId = url.searchParams.get('device_id') || '';
    if (!deviceId) return json({ items: [] });
    const { results } = await db
      .prepare(
        `SELECT a.media_id, a.progress_seconds, a.last_updated,
                m.title, m.cover_url, m.backdrop_url, m.type, m.video_url, m.format,
                m.rating, m.release_year, m.genres, m.category_id, m.description, m.featured
         FROM analytics a JOIN media m ON m.id = a.media_id
         WHERE a.device_id = ? AND a.progress_seconds > 20
         ORDER BY a.last_updated DESC LIMIT 12`,
      )
      .bind(deviceId)
      .all();
    return json({
      items: (results || []).map((row) => ({
        ...normaliseMedia(row),
        progress_seconds: row.progress_seconds,
        last_updated: row.last_updated,
      })),
    });
  }

  if (path === '/api/media') {
    const type = url.searchParams.get('type');
    const genre = url.searchParams.get('genre');
    const category = url.searchParams.get('category');
    const q = url.searchParams.get('q');
    const limit = Math.min(Math.max(pickNumber(url.searchParams.get('limit'), 60), 1), 400);

    const where = [];
    const params = [];
    if (type && ['movie', 'series', 'live'].includes(type)) {
      where.push('type = ?');
      params.push(type);
    }
    if (category) {
      where.push('category_id = (SELECT id FROM categories WHERE slug = ?)');
      params.push(category);
    }
    if (genre) {
      where.push('LOWER(genres) LIKE ?');
      params.push(`%${genre.toLowerCase()}%`);
    }
    if (q) {
      where.push('(LOWER(title) LIKE ? OR LOWER(description) LIKE ?)');
      params.push(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`);
    }
    const sql =
      'SELECT * FROM media' +
      (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
      ' ORDER BY featured DESC, id DESC LIMIT ?';
    const { results } = await db.prepare(sql).bind(...params, limit).all();
    return json({ items: (results || []).map(normaliseMedia) });
  }

  const mediaMatch = path.match(/^\/api\/media\/(\d+)$/);
  if (mediaMatch) {
    const row = await db.prepare('SELECT * FROM media WHERE id = ?').bind(Number(mediaMatch[1])).first();
    if (!row) return error('not_found', 404);
    const { results } = await db
      .prepare('SELECT * FROM episodes WHERE media_id = ? ORDER BY season ASC, episode_number ASC')
      .bind(Number(mediaMatch[1]))
      .all();
    const category = row.category_id
      ? await db.prepare('SELECT * FROM categories WHERE id = ?').bind(row.category_id).first()
      : null;
    return json({
      ...normaliseMedia(row),
      category: category ? normaliseCategory(category) : null,
      episodes: (results || []).map(normaliseEpisode),
    });
  }

  if (path === '/api/analytics' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return error('invalid_json');
    }
    const deviceId = pickString(body?.device_id);
    const mediaId = Math.trunc(pickNumber(body?.media_id, 0));
    const progress = Math.max(Math.trunc(pickNumber(body?.progress_seconds, 0)), 0);
    if (!deviceId || !mediaId) return error('device_and_media_required');
    await db
      .prepare(
        `INSERT INTO analytics (device_id, media_id, progress_seconds, last_updated)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(device_id, media_id) DO UPDATE SET
           progress_seconds = excluded.progress_seconds,
           last_updated = datetime('now')`,
      )
      .bind(deviceId, mediaId, progress)
      .run();
    return json({ ok: true });
  }

  if (path === '/api/request' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return error('invalid_json');
    }
    const title = pickString(body?.title);
    const deviceId = pickString(body?.device_id);
    if (!title) return error('title_required');
    await db
      .prepare('INSERT INTO requests (device_id, title, status) VALUES (?, ?, ?)')
      .bind(deviceId, title.slice(0, 200), 'pending')
      .run();
    return json({ ok: true });
  }

  if (path === '/api/verify_license' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return error('invalid_json');
    }
    const key = pickString(body?.key).toUpperCase();
    const deviceId = pickString(body?.device_id);
    if (!key) return error('key_required');
    if (!deviceId) return error('device_id_required');

    const row = await db.prepare('SELECT * FROM licenses WHERE key_string = ?').bind(key).first();
    if (!row) return error('invalid_key', 404, { message: 'That license key does not exist.' });

    const expiry = Date.parse(row.expiry_date);
    if (Number.isFinite(expiry) && expiry < Date.now()) {
      return error('expired', 403, { message: 'This license key has expired.' });
    }

    let devices = [];
    try {
      devices = JSON.parse(row.bound_devices || '[]');
    } catch {
      devices = [];
    }
    if (!Array.isArray(devices)) devices = [];

    if (devices.includes(deviceId)) {
      return json({ ok: true, already_bound: true, bound: devices.length, limit: row.device_limit, expiry: row.expiry_date });
    }
    if (devices.length >= row.device_limit) {
      return error('device_limit_reached', 403, { message: 'Device limit reached.' });
    }

    devices.push(deviceId);
    await db.prepare('UPDATE licenses SET bound_devices = ? WHERE id = ?').bind(JSON.stringify(devices), row.id).run();
    await logActivity(db, 'license.bind', `${key} bound to ${deviceId}`);
    return json({ ok: true, bound: devices.length, limit: row.device_limit, expiry: row.expiry_date });
  }

  return error('not_found', 404);
}

async function handleAdmin(request, env, url) {
  const path = url.pathname;
  const db = env.DB;

  if (path === '/api/admin/login' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return error('invalid_json');
    }
    const secret = pickString(body?.secret);
    if (!secret) return error('secret_required');
    const hash = await adminSecretHash(db);
    if (!timingSafeEqual(await sha256Hex(secret), hash)) return error('invalid_secret', 401);

    const token = randomToken();
    const now = Date.now();
    await db
      .prepare('INSERT INTO sessions (token, created_at, expires_at) VALUES (?, ?, ?)')
      .bind(token, now, now + SESSION_TTL_MS)
      .run();
    return json({ token, expires_at: now + SESSION_TTL_MS });
  }

  if (!(await isAdmin(request, env))) return error('unauthorized', 401);

  if (path === '/api/admin/stats') {
    const byType = await db.prepare('SELECT type, COUNT(*) AS n FROM media GROUP BY type').all();
    const episodes = await db.prepare('SELECT COUNT(*) AS n FROM episodes').first();
    const sources = await db.prepare('SELECT COUNT(*) AS n FROM sources').first();
    const users = await db.prepare('SELECT COUNT(DISTINCT device_id) AS n FROM analytics').first();
    const pending = await db.prepare("SELECT COUNT(*) AS n FROM requests WHERE status = 'pending'").first();
    const licenses = await db.prepare('SELECT COUNT(*) AS n FROM licenses').first();
    const activeLicenses = await db
      .prepare('SELECT COUNT(*) AS n FROM licenses WHERE expiry_date > ?')
      .bind(new Date().toISOString().slice(0, 10))
      .first();
    const apiCalls = await db.prepare('SELECT SUM(hits) AS n FROM rate_limit').first();
    const live = await db.prepare("SELECT genres FROM media WHERE type = 'live'").all();

    const categories = {};
    for (const row of live.results || []) {
      const parts = (row.genres || '').split(',').map((s) => s.trim());
      const cat = parts[1] || 'Other';
      categories[cat] = (categories[cat] || 0) + 1;
    }
    const counts = {};
    for (const row of byType.results || []) counts[row.type] = row.n;

    return json({
      counts,
      episodes: episodes ? episodes.n : 0,
      sources: sources ? sources.n : 0,
      live_categories: categories,
      users: users ? users.n : 0,
      pending_requests: pending ? pending.n : 0,
      licenses: licenses ? licenses.n : 0,
      active_licenses: activeLicenses ? activeLicenses.n : 0,
      api_calls: apiCalls && apiCalls.n ? apiCalls.n : 0,
    });
  }

  if (path === '/api/admin/activity') {
    const { results } = await db.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT 30').all();
    return json({ items: results || [] });
  }

  if (path === '/api/admin/export') {
    const media = await db.prepare('SELECT * FROM media ORDER BY id').all();
    const episodes = await db.prepare('SELECT * FROM episodes ORDER BY id').all();
    const categories = await db.prepare('SELECT * FROM categories ORDER BY id').all();
    const settings = await db.prepare("SELECT key, value FROM settings WHERE key != 'admin_secret_hash'").all();
    const settingsObject = {};
    for (const row of settings.results || []) settingsObject[row.key] = row.value;
    return json({
      exported_at: new Date().toISOString(),
      media: (media.results || []).map(normaliseMedia),
      episodes: (episodes.results || []).map(normaliseEpisode),
      categories: (categories.results || []).map(normaliseCategory),
      settings: settingsObject,
    });
  }

  if (path === '/api/admin/secret' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return error('invalid_json');
    }
    const next = pickString(body?.next);
    if (next.length < 6) return error('secret_too_short', 400, { hint: 'use at least 6 characters' });
    const current = pickString(body?.current);
    if (current) {
      const hash = await adminSecretHash(db);
      if (!timingSafeEqual(await sha256Hex(current), hash)) return error('invalid_current_secret', 401);
    }
    await setSetting(db, 'admin_secret_hash', await sha256Hex(next));
    await db.prepare('DELETE FROM sessions').run();
    await logActivity(db, 'secret', 'Admin secret rotated, all sessions signed out');
    return json({ ok: true, sessions_invalidated: true });
  }

  /* ---------------- categories ---------------- */

  if (path === '/api/admin/categories' && request.method === 'GET') {
    const { results } = await db
      .prepare(
        `SELECT c.*, (SELECT COUNT(*) FROM media m WHERE m.category_id = c.id) AS media_count
         FROM categories c ORDER BY c.sort_order ASC, c.id ASC`,
      )
      .all();
    return json({ items: (results || []).map(normaliseCategory) });
  }

  if (path === '/api/admin/categories' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return error('invalid_json');
    }
    const name = pickString(body?.name);
    if (!name) return error('name_required');
    const slug =
      pickString(body?.slug) ||
      name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const isPremium = flag(body?.is_premium) ? 1 : 0;
    const isEnabled = flag(body?.is_enabled, true) ? 1 : 0;
    const sortOrder = Math.trunc(pickNumber(body?.sort_order, 100));
    const id = Math.trunc(pickNumber(body?.id, 0));

    if (id > 0) {
      await db
        .prepare('UPDATE categories SET name = ?, slug = ?, is_premium = ?, is_enabled = ?, sort_order = ? WHERE id = ?')
        .bind(name, slug, isPremium, isEnabled, sortOrder, id)
        .run();
      await logActivity(db, 'category.update', `${name} (premium ${isPremium ? 'on' : 'off'})`);
      return json({ ok: true, id });
    }

    const inserted = await db
      .prepare(
        'INSERT INTO categories (name, slug, is_premium, is_enabled, sort_order) VALUES (?, ?, ?, ?, ?) RETURNING id',
      )
      .bind(name, slug, isPremium, isEnabled, sortOrder)
      .first();
    await logActivity(db, 'category.create', name);
    return json({ ok: true, id: inserted ? inserted.id : null });
  }

  const deleteCategory = path.match(/^\/api\/admin\/categories\/(\d+)$/);
  if (deleteCategory && request.method === 'DELETE') {
    const id = Number(deleteCategory[1]);
    await db.batch([
      db.prepare('UPDATE media SET category_id = NULL WHERE category_id = ?').bind(id),
      db.prepare('DELETE FROM categories WHERE id = ?').bind(id),
    ]);
    await logActivity(db, 'category.delete', `#${id}`);
    return json({ ok: true });
  }

  /* ---------------- licenses ---------------- */

  if (path === '/api/admin/licenses' && request.method === 'GET') {
    const { results } = await db.prepare('SELECT * FROM licenses ORDER BY id DESC').all();
    return json({
      items: (results || []).map((row) => {
        let devices = [];
        try {
          devices = JSON.parse(row.bound_devices || '[]');
        } catch {
          devices = [];
        }
        return {
          id: row.id,
          key_string: row.key_string,
          expiry_date: row.expiry_date,
          device_limit: row.device_limit,
          bound: Array.isArray(devices) ? devices.length : 0,
          devices: Array.isArray(devices) ? devices : [],
          note: row.note,
          created_at: row.created_at,
          expired: Date.parse(row.expiry_date) < Date.now(),
        };
      }),
    });
  }

  if (path === '/api/admin/licenses' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return error('invalid_json');
    }
    const days = Math.trunc(pickNumber(body?.days, 30));
    const expiry = pickString(body?.expiry_date) || new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    const deviceLimit = Math.max(Math.trunc(pickNumber(body?.device_limit, 1)), 1);
    const note = pickString(body?.note);

    let key = generateLicenseKey();
    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await db.prepare('SELECT id FROM licenses WHERE key_string = ?').bind(key).first();
      if (!exists) break;
      key = generateLicenseKey();
    }
    const inserted = await db
      .prepare('INSERT INTO licenses (key_string, expiry_date, device_limit, note) VALUES (?, ?, ?, ?) RETURNING id')
      .bind(key, expiry, deviceLimit, note)
      .first();
    await logActivity(db, 'license.create', `${key} (${deviceLimit} device(s), until ${expiry})`);
    return json({ ok: true, id: inserted ? inserted.id : null, key_string: key, expiry_date: expiry, device_limit: deviceLimit });
  }

  const deleteLicense = path.match(/^\/api\/admin\/licenses\/(\d+)$/);
  if (deleteLicense && request.method === 'DELETE') {
    await db.prepare('DELETE FROM licenses WHERE id = ?').bind(Number(deleteLicense[1])).run();
    await logActivity(db, 'license.delete', `#${deleteLicense[1]}`);
    return json({ ok: true });
  }

  /* ---------------- requests ---------------- */

  if (path === '/api/admin/requests' && request.method === 'GET') {
    const { results } = await db.prepare('SELECT * FROM requests ORDER BY id DESC LIMIT 200').all();
    return json({ items: results || [] });
  }

  const fulfillRequest = path.match(/^\/api\/admin\/requests\/(\d+)\/fulfill$/);
  if (fulfillRequest && request.method === 'POST') {
    await db.prepare("UPDATE requests SET status = 'fulfilled' WHERE id = ?").bind(Number(fulfillRequest[1])).run();
    await logActivity(db, 'request.fulfill', `#${fulfillRequest[1]}`);
    return json({ ok: true });
  }

  /* ---------------- media ---------------- */

  if (path === '/api/admin/media' && request.method === 'GET') {
    const type = url.searchParams.get('type');
    const q = url.searchParams.get('q');
    const categoryId = Math.trunc(pickNumber(url.searchParams.get('category_id'), 0));
    const limit = Math.min(Math.max(pickNumber(url.searchParams.get('limit'), 200), 1), 1000);
    const offset = Math.max(pickNumber(url.searchParams.get('offset'), 0), 0);

    const where = [];
    const params = [];
    if (type && ['movie', 'series', 'live'].includes(type)) {
      where.push('type = ?');
      params.push(type);
    }
    if (categoryId) {
      where.push('category_id = ?');
      params.push(categoryId);
    }
    if (q) {
      where.push('(LOWER(title) LIKE ? OR LOWER(genres) LIKE ?)');
      params.push(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`);
    }
    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    const total = await db.prepare(`SELECT COUNT(*) AS n FROM media${whereSql}`).bind(...params).first();
    const { results } = await db
      .prepare(`SELECT * FROM media${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .bind(...params, limit, offset)
      .all();
    return json({ items: (results || []).map(normaliseMedia), total: total ? total.n : 0, limit, offset });
  }

  if (path === '/api/admin/media' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return error('invalid_json');
    }
    const title = pickString(body?.title);
    if (!title) return error('title_required');

    const categoryId = Math.trunc(pickNumber(body?.category_id, 0));
    const fields = {
      title,
      description: pickString(body?.description),
      cover_url: pickString(body?.cover_url),
      backdrop_url: pickString(body?.backdrop_url),
      type: ['movie', 'series', 'live'].includes(body?.type) ? body.type : 'movie',
      release_year: Math.trunc(pickNumber(body?.release_year, 0)),
      genres: Array.isArray(body?.genres) ? body.genres.join(', ') : pickString(body?.genres),
      rating: pickNumber(body?.rating, 0),
      video_url: pickString(body?.video_url),
      format: ['mp4', 'hls', 'dash'].includes(body?.format) ? body.format : 'mp4',
      featured: body?.featured ? 1 : 0,
      category_id: categoryId > 0 ? categoryId : null,
    };

    const id = Math.trunc(pickNumber(body?.id, 0));
    if (id > 0) {
      await db
        .prepare(
          `UPDATE media SET title = ?, description = ?, cover_url = ?, backdrop_url = ?, type = ?,
           release_year = ?, genres = ?, rating = ?, video_url = ?, format = ?, featured = ?, category_id = ? WHERE id = ?`,
        )
        .bind(
          fields.title, fields.description, fields.cover_url, fields.backdrop_url, fields.type,
          fields.release_year, fields.genres, fields.rating, fields.video_url, fields.format,
          fields.featured, fields.category_id, id,
        )
        .run();
      await logActivity(db, 'media.update', `${fields.title} (#${id})`);
      return json({ ok: true, id });
    }

    const inserted = await db
      .prepare(
        `INSERT INTO media (title, description, cover_url, backdrop_url, type, release_year, genres, rating, video_url, format, featured, category_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .bind(
        fields.title, fields.description, fields.cover_url, fields.backdrop_url, fields.type,
        fields.release_year, fields.genres, fields.rating, fields.video_url, fields.format,
        fields.featured, fields.category_id,
      )
      .first();
    await logActivity(db, 'media.create', `${fields.title} (${fields.type})`);
    return json({ ok: true, id: inserted ? inserted.id : null });
  }

  if (path === '/api/admin/media/bulk-delete' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return error('invalid_json');
    }
    const ids = Array.isArray(body?.ids)
      ? body.ids.map((v) => Math.trunc(Number(v))).filter((v) => v > 0).slice(0, 500)
      : [];
    if (!ids.length) return error('ids_required');
    const placeholders = ids.map(() => '?').join(',');
    await db.batch([
      db.prepare(`DELETE FROM episodes WHERE media_id IN (${placeholders})`).bind(...ids),
      db.prepare(`DELETE FROM media WHERE id IN (${placeholders})`).bind(...ids),
    ]);
    await logActivity(db, 'media.bulk_delete', `Deleted ${ids.length} titles`);
    return json({ ok: true, deleted: ids.length });
  }

  const deleteMedia = path.match(/^\/api\/admin\/media\/(\d+)$/);
  if (deleteMedia && request.method === 'DELETE') {
    const id = Number(deleteMedia[1]);
    const row = await db.prepare('SELECT title FROM media WHERE id = ?').bind(id).first();
    await db.batch([
      db.prepare('DELETE FROM episodes WHERE media_id = ?').bind(id),
      db.prepare('DELETE FROM media WHERE id = ?').bind(id),
    ]);
    await logActivity(db, 'media.delete', row ? row.title : `#${id}`);
    return json({ ok: true, deleted: id });
  }

  if (path === '/api/admin/episode' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return error('invalid_json');
    }
    const mediaId = Math.trunc(pickNumber(body?.media_id, 0));
    const videoUrl = pickString(body?.video_url);
    if (!mediaId) return error('media_id_required');
    if (!videoUrl) return error('video_url_required');

    const values = {
      media_id: mediaId,
      season: Math.max(Math.trunc(pickNumber(body?.season, 1)), 1),
      episode_number: Math.max(Math.trunc(pickNumber(body?.episode_number, 1)), 1),
      title: pickString(body?.title, `Episode ${pickNumber(body?.episode_number, 1)}`),
      video_url: videoUrl,
      format: ['mp4', 'hls', 'dash'].includes(body?.format) ? body.format : 'mp4',
    };

    const id = Math.trunc(pickNumber(body?.id, 0));
    if (id > 0) {
      await db
        .prepare(
          'UPDATE episodes SET media_id = ?, season = ?, episode_number = ?, title = ?, video_url = ?, format = ? WHERE id = ?',
        )
        .bind(values.media_id, values.season, values.episode_number, values.title, values.video_url, values.format, id)
        .run();
      return json({ ok: true, id });
    }
    const inserted = await db
      .prepare(
        'INSERT INTO episodes (media_id, season, episode_number, title, video_url, format) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      )
      .bind(values.media_id, values.season, values.episode_number, values.title, values.video_url, values.format)
      .first();
    await logActivity(db, 'episode.create', `${values.title} (media #${values.media_id})`);
    return json({ ok: true, id: inserted ? inserted.id : null });
  }

  const deleteEpisode = path.match(/^\/api\/admin\/episode\/(\d+)$/);
  if (deleteEpisode && request.method === 'DELETE') {
    await db.prepare('DELETE FROM episodes WHERE id = ?').bind(Number(deleteEpisode[1])).run();
    return json({ ok: true });
  }

  /* ---------------- settings ---------------- */

  if (path === '/api/admin/settings' && request.method === 'GET') {
    const { results } = await db.prepare('SELECT key, value FROM settings').all();
    const out = {};
    for (const row of results || []) if (row.key !== 'admin_secret_hash') out[row.key] = row.value;
    return json(out);
  }

  if (path === '/api/admin/settings' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return error('invalid_json');
    }
    const updates = Object.entries(body || {}).filter(
      ([key, value]) =>
        key !== 'admin_secret_hash' &&
        (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number'),
    );
    if (!updates.length) return error('no_settings');
    await db.batch(
      updates.map(([key, value]) =>
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(
          key,
          typeof value === 'boolean' ? (value ? '1' : '0') : String(value),
        ),
      ),
    );
    await logActivity(db, 'settings.update', updates.map(([k]) => k).join(', '));
    return json({ ok: true, updated: updates.map(([k]) => k) });
  }

  /* ---------------- iptv ---------------- */

  if (path === '/api/admin/iptv/sources' && request.method === 'GET') {
    const { results } = await db.prepare('SELECT * FROM sources ORDER BY id DESC').all();
    return json({ items: results || [] });
  }

  if (path === '/api/admin/iptv/import' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return error('invalid_json');
    }
    const sourceUrl = pickString(body?.url);
    const pasted = pickString(body?.m3u);
    const name = pickString(body?.name) || (sourceUrl ? sourceUrl.split('/').pop() : 'Pasted playlist');
    const limit = Math.min(Math.max(pickNumber(body?.limit, MAX_IMPORT), 1), MAX_IMPORT);
    const categoryId = Math.trunc(pickNumber(body?.category_id, 0));

    let text = pasted;
    if (!text) {
      if (!sourceUrl) return error('url_or_m3u_required');
      if (!/^https?:\/\//i.test(sourceUrl)) return error('url_must_be_http');
      let response;
      try {
        response = await fetch(sourceUrl, { redirect: 'follow', cf: { cacheTtl: 0 } });
      } catch (e) {
        return error('playlist_fetch_failed', 502, { detail: String(e && e.message ? e.message : e) });
      }
      if (!response.ok) return error('playlist_fetch_failed', 502, { status: response.status });
      const declared = Number(response.headers.get('content-length') || 0);
      if (declared > MAX_PLAYLIST_BYTES) return error('playlist_too_large', 413);
      text = await response.text();
      if (text.length > MAX_PLAYLIST_BYTES) return error('playlist_too_large', 413);
    }

    const entries = parsePlaylist(text);
    if (!entries.length) return error('no_channels_found', 422);

    const existing = await db.prepare("SELECT video_url FROM media WHERE type = 'live'").all();
    const seen = new Set((existing.results || []).map((r) => r.video_url));

    const fresh = [];
    for (const entry of entries) {
      if (fresh.length >= limit) break;
      if (seen.has(entry.url)) continue;
      seen.add(entry.url);
      fresh.push(entry);
    }

    const insertSql =
      'INSERT INTO media (title, description, cover_url, backdrop_url, type, release_year, genres, rating, video_url, format, featured, source, category_id) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

    let added = 0;
    for (let i = 0; i < fresh.length; i += INSERT_CHUNK) {
      const chunk = fresh.slice(i, i + INSERT_CHUNK);
      const statements = chunk.map((entry) =>
        db.prepare(insertSql).bind(
          entry.name,
          `${entry.name}${entry.group ? ` — ${entry.group}` : ''} — imported from an IPTV provider.`,
          entry.logo || '',
          entry.logo || '',
          'live',
          2026,
          `Live TV, ${entry.group || 'Imported'}, India`,
          0,
          entry.url,
          'hls',
          0,
          sourceUrl || 'pasted',
          categoryId > 0 ? categoryId : null,
        ),
      );
      try {
        await db.batch(statements);
        added += statements.length;
      } catch (e) {
        return error('insert_failed', 500, { added, detail: String(e && e.message ? e.message : e) });
      }
    }

    const key = sourceUrl || 'pasted';
    await db.prepare('DELETE FROM sources WHERE url = ?').bind(key).run();
    await db.prepare('INSERT INTO sources (url, name, channels) VALUES (?, ?, ?)').bind(key, name, added).run();
    await logActivity(db, 'iptv.import', `${added} channels from ${name}`);
    return json({ ok: true, added, skipped: entries.length - fresh.length, found: entries.length, source: key });
  }

  if (path === '/api/admin/iptv/delete-source' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return error('invalid_json');
    }
    const sourceUrl = pickString(body?.url);
    if (!sourceUrl) return error('url_required');
    const result = await db.prepare("DELETE FROM media WHERE type = 'live' AND source = ?").bind(sourceUrl).run();
    await db.prepare('DELETE FROM sources WHERE url = ?').bind(sourceUrl).run();
    const removed = result && result.meta ? result.meta.changes : 0;
    await logActivity(db, 'iptv.delete_source', `${removed} channels from ${sourceUrl}`);
    return json({ ok: true, removed });
  }

  return error('not_found', 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const landing = url.pathname.match(/^\/movie\/(\d+)\/?$/);
    if (landing) {
      try {
        return await handleLanding(env, Number(landing[1]));
      } catch (e) {
        return new Response('Server error', { status: 500 });
      }
    }

    if (!url.pathname.startsWith('/api/')) {
      return error('not_found', 404);
    }

    const limit = await rateLimit(env, request);
    if (limit.limited) {
      return json(
        { error: 'rate_limited', message: 'Too many requests, slow down.', limit: RATE_LIMIT },
        429,
      );
    }

    try {
      if (url.pathname.startsWith('/api/admin/')) {
        return await handleAdmin(request, env, url);
      }
      return await handlePublic(request, env, url);
    } catch (e) {
      return error('server_error', 500, { detail: String(e && e.message ? e.message : e) });
    }
  },
};
