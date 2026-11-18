/**
 * Play Infinity — API + admin panel host (Cloudflare Worker + D1)
 *
 * Public API (no auth, the user app has no login):
 *   GET  /api/health
 *   GET  /api/settings
 *   GET  /api/media?type=movie|series|live&genre=action&q=search&limit=50
 *   GET  /api/media/:id            -> media + episodes
 *
 * Admin API (Bearer <session token> or Bearer <admin secret>):
 *   POST   /api/admin/login        { secret }            -> { token }
 *   POST   /api/admin/secret       { current, next }     -> rotate the admin secret
 *   GET    /api/admin/media
 *   POST   /api/admin/media        { id?, title, ... }   -> create or update
 *   DELETE /api/admin/media/:id
 *   POST   /api/admin/episode      { id?, media_id, ... }
 *   DELETE /api/admin/episode/:id
 *   GET    /api/admin/settings
 *   POST   /api/admin/settings     { key: value, ... }
 *
 * Developed by Mohammad Fahad Mir
 */

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

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

async function getSetting(db, key) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  return row ? row.value : null;
}

async function adminSecretHash(db) {
  return (await getSetting(db, 'admin_secret_hash')) || (await sha256Hex('admin123'));
}

/** Accepts a live session token, or the raw admin secret. */
async function isAdmin(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;

  const hash = await adminSecretHash(env.DB);
  if (timingSafeEqual(await sha256Hex(token), hash)) return true;

  const now = Date.now();
  const session = await env.DB.prepare('SELECT token, expires_at FROM sessions WHERE token = ?').bind(token).first();
  return Boolean(session && session.expires_at > now);
}

async function requireAdmin(request, env) {
  if (await isAdmin(request, env)) return null;
  return error('unauthorized', 401);
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
    created_at: row.created_at,
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

function pickString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function pickNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function handlePublic(request, env, url) {
  const path = url.pathname;

  if (path === '/api/health') {
    const counts = await env.DB.prepare('SELECT COUNT(*) AS total FROM media').first();
    return json({ ok: true, service: 'play-infinity', media: counts ? counts.total : 0 });
  }

  if (path === '/api/settings') {
    const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
    const out = {};
    for (const row of results || []) {
      if (PUBLIC_SETTING_KEYS.includes(row.key)) out[row.key] = row.value;
    }
    return json(out);
  }

  if (path === '/api/media') {
    const type = url.searchParams.get('type');
    const genre = url.searchParams.get('genre');
    const q = url.searchParams.get('q');
    const limit = Math.min(Math.max(pickNumber(url.searchParams.get('limit'), 60), 1), 200);

    const where = [];
    const params = [];
    if (type && ['movie', 'series', 'live'].includes(type)) {
      where.push('type = ?');
      params.push(type);
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
    const { results } = await env.DB.prepare(sql).bind(...params, limit).all();
    return json({ items: (results || []).map(normaliseMedia) });
  }

  const mediaMatch = path.match(/^\/api\/media\/(\d+)$/);
  if (mediaMatch) {
    const row = await env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(Number(mediaMatch[1])).first();
    if (!row) return error('not_found', 404);
    const { results } = await env.DB.prepare(
      'SELECT * FROM episodes WHERE media_id = ? ORDER BY season ASC, episode_number ASC',
    )
      .bind(Number(mediaMatch[1]))
      .all();
    return json({ ...normaliseMedia(row), episodes: (results || []).map(normaliseEpisode) });
  }

  return error('not_found', 404);
}

async function handleAdmin(request, env, url) {
  const path = url.pathname;

  if (path === '/api/admin/login' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return error('invalid_json');
    }
    const secret = pickString(body?.secret);
    if (!secret) return error('secret_required');
    const hash = await adminSecretHash(env.DB);
    if (!timingSafeEqual(await sha256Hex(secret), hash)) return error('invalid_secret', 401);

    const token = randomToken();
    const now = Date.now();
    await env.DB.prepare('INSERT INTO sessions (token, created_at, expires_at) VALUES (?, ?, ?)')
      .bind(token, now, now + SESSION_TTL_MS)
      .run();
    return json({ token, expires_at: now + SESSION_TTL_MS });
  }

  const denied = await requireAdmin(request, env);
  if (denied) return denied;

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
      const hash = await adminSecretHash(env.DB);
      if (!timingSafeEqual(await sha256Hex(current), hash)) return error('invalid_current_secret', 401);
    }
    await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .bind('admin_secret_hash', await sha256Hex(next))
      .run();
    await env.DB.prepare('DELETE FROM sessions').run();
    return json({ ok: true, sessions_invalidated: true });
  }

  if (path === '/api/admin/media' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM media ORDER BY id DESC').all();
    return json({ items: (results || []).map(normaliseMedia) });
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
    };

    const id = Math.trunc(pickNumber(body?.id, 0));
    if (id > 0) {
      await env.DB.prepare(
        `UPDATE media SET title = ?, description = ?, cover_url = ?, backdrop_url = ?, type = ?,
         release_year = ?, genres = ?, rating = ?, video_url = ?, format = ?, featured = ? WHERE id = ?`,
      )
        .bind(
          fields.title, fields.description, fields.cover_url, fields.backdrop_url, fields.type,
          fields.release_year, fields.genres, fields.rating, fields.video_url, fields.format,
          fields.featured, id,
        )
        .run();
      return json({ ok: true, id });
    }

    const inserted = await env.DB.prepare(
      `INSERT INTO media (title, description, cover_url, backdrop_url, type, release_year, genres, rating, video_url, format, featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
      .bind(
        fields.title, fields.description, fields.cover_url, fields.backdrop_url, fields.type,
        fields.release_year, fields.genres, fields.rating, fields.video_url, fields.format,
        fields.featured,
      )
      .first();
    return json({ ok: true, id: inserted ? inserted.id : null });
  }

  const deleteMedia = path.match(/^\/api\/admin\/media\/(\d+)$/);
  if (deleteMedia && request.method === 'DELETE') {
    const id = Number(deleteMedia[1]);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM episodes WHERE media_id = ?').bind(id),
      env.DB.prepare('DELETE FROM media WHERE id = ?').bind(id),
    ]);
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
      await env.DB.prepare(
        'UPDATE episodes SET media_id = ?, season = ?, episode_number = ?, title = ?, video_url = ?, format = ? WHERE id = ?',
      )
        .bind(values.media_id, values.season, values.episode_number, values.title, values.video_url, values.format, id)
        .run();
      return json({ ok: true, id });
    }

    const inserted = await env.DB.prepare(
      'INSERT INTO episodes (media_id, season, episode_number, title, video_url, format) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    )
      .bind(values.media_id, values.season, values.episode_number, values.title, values.video_url, values.format)
      .first();
    return json({ ok: true, id: inserted ? inserted.id : null });
  }

  const deleteEpisode = path.match(/^\/api\/admin\/episode\/(\d+)$/);
  if (deleteEpisode && request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM episodes WHERE id = ?').bind(Number(deleteEpisode[1])).run();
    return json({ ok: true });
  }

  if (path === '/api/admin/settings' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
    const out = {};
    for (const row of results || []) {
      if (row.key !== 'admin_secret_hash') out[row.key] = row.value;
    }
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
      ([key, value]) => key !== 'admin_secret_hash' && (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number'),
    );
    if (!updates.length) return error('no_settings');
    await env.DB.batch(
      updates.map(([key, value]) =>
        env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(
          key,
          typeof value === 'boolean' ? (value ? '1' : '0') : String(value),
        ),
      ),
    );
    return json({ ok: true, updated: updates.map(([k]) => k) });
  }

  return error('not_found', 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (!url.pathname.startsWith('/api/')) {
      return error('not_found', 404);
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
