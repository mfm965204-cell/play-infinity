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
 *   POST   /api/admin/login              { secret }             -> { token }
 *   POST   /api/admin/secret             { current, next }      -> rotate the admin secret
 *   GET    /api/admin/stats                                     -> dashboard counters
 *   GET    /api/admin/activity                                  -> recent admin actions
 *   GET    /api/admin/export                                    -> full JSON export
 *   GET    /api/admin/media?type=&q=&limit=&offset=
 *   POST   /api/admin/media              { id?, title, ... }    -> create or update
 *   POST   /api/admin/media/bulk-delete  { ids: [] }
 *   DELETE /api/admin/media/:id
 *   POST   /api/admin/episode            { id?, media_id, ... }
 *   DELETE /api/admin/episode/:id
 *   GET    /api/admin/settings
 *   POST   /api/admin/settings           { key: value, ... }
 *   GET    /api/admin/iptv/sources
 *   POST   /api/admin/iptv/import        { url? , m3u? , name?, limit? }
 *   POST   /api/admin/iptv/delete-source { url }
 *
 * Developed by Mohammad Fahad Mir
 */

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PLAYLIST_BYTES = 6 * 1024 * 1024;
const MAX_IMPORT = 2000;
const INSERT_CHUNK = 40;

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

async function logActivity(db, action, detail) {
  try {
    await db.prepare('INSERT INTO activity (action, detail) VALUES (?, ?)').bind(action, detail).run();
  } catch {
    // logging must never break a request
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
    source: row.source || '',
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

/** Minimal M3U / M3U8 playlist parser. */
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
    const limit = Math.min(Math.max(pickNumber(url.searchParams.get('limit'), 60), 1), 400);

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

  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  if (path === '/api/admin/stats') {
    const byType = await db.prepare('SELECT type, COUNT(*) AS n FROM media GROUP BY type').all();
    const episodes = await db.prepare('SELECT COUNT(*) AS n FROM episodes').first();
    const sources = await db.prepare('SELECT COUNT(*) AS n FROM sources').first();
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
    });
  }

  if (path === '/api/admin/activity') {
    const { results } = await db.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT 30').all();
    return json({ items: results || [] });
  }

  if (path === '/api/admin/export') {
    const media = await db.prepare('SELECT * FROM media ORDER BY id').all();
    const episodes = await db.prepare('SELECT * FROM episodes ORDER BY id').all();
    const settings = await db.prepare("SELECT key, value FROM settings WHERE key != 'admin_secret_hash'").all();
    const settingsObject = {};
    for (const row of settings.results || []) settingsObject[row.key] = row.value;
    return json({
      exported_at: new Date().toISOString(),
      media: (media.results || []).map(normaliseMedia),
      episodes: (episodes.results || []).map(normaliseEpisode),
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
    await db
      .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .bind('admin_secret_hash', await sha256Hex(next))
      .run();
    await db.prepare('DELETE FROM sessions').run();
    await logActivity(db, 'secret', 'Admin secret rotated, all sessions signed out');
    return json({ ok: true, sessions_invalidated: true });
  }

  if (path === '/api/admin/media' && request.method === 'GET') {
    const type = url.searchParams.get('type');
    const q = url.searchParams.get('q');
    const limit = Math.min(Math.max(pickNumber(url.searchParams.get('limit'), 200), 1), 1000);
    const offset = Math.max(pickNumber(url.searchParams.get('offset'), 0), 0);

    const where = [];
    const params = [];
    if (type && ['movie', 'series', 'live'].includes(type)) {
      where.push('type = ?');
      params.push(type);
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
      await db
        .prepare(
          `UPDATE media SET title = ?, description = ?, cover_url = ?, backdrop_url = ?, type = ?,
           release_year = ?, genres = ?, rating = ?, video_url = ?, format = ?, featured = ? WHERE id = ?`,
        )
        .bind(
          fields.title, fields.description, fields.cover_url, fields.backdrop_url, fields.type,
          fields.release_year, fields.genres, fields.rating, fields.video_url, fields.format,
          fields.featured, id,
        )
        .run();
      await logActivity(db, 'media.update', `${fields.title} (#${id})`);
      return json({ ok: true, id });
    }

    const inserted = await db
      .prepare(
        `INSERT INTO media (title, description, cover_url, backdrop_url, type, release_year, genres, rating, video_url, format, featured)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .bind(
        fields.title, fields.description, fields.cover_url, fields.backdrop_url, fields.type,
        fields.release_year, fields.genres, fields.rating, fields.video_url, fields.format,
        fields.featured,
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
    await logActivity(db, 'media.delete', `${row ? row.title : '#' + id}`);
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

  if (path === '/api/admin/settings' && request.method === 'GET') {
    const { results } = await db.prepare('SELECT key, value FROM settings').all();
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
      'INSERT INTO media (title, description, cover_url, backdrop_url, type, release_year, genres, rating, video_url, format, featured, source) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

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
