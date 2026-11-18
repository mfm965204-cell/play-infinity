import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

const EMPTY = {
  id: 0,
  title: '',
  description: '',
  cover_url: '',
  backdrop_url: '',
  type: 'movie',
  release_year: new Date().getFullYear(),
  genres: '',
  rating: 0,
  video_url: '',
  format: 'mp4',
  featured: false,
  category_id: 0,
};

const PAGE = 40;

export default function MediaPanel({ refreshKey, categories = [], editing, setEditing, onSaved, onError, onAddEpisode }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);

  const load = useCallback(
    async (nextOffset = offset) => {
      try {
        const res = await api.listMedia({ type, q: search, limit: PAGE, offset: nextOffset });
        setItems(res.items || []);
        setTotal(res.total || 0);
      } catch (e) {
        onError(e.message);
      }
    },
    [type, search, offset, onError],
  );

  useEffect(() => {
    load(offset);
  }, [load, offset, refreshKey]);

  useEffect(() => {
    if (editing) {
      setForm({ ...EMPTY, ...editing, genres: (editing.genres || []).join(', ') });
    }
  }, [editing]);

  function update(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.saveMedia({
        ...form,
        id: form.id || undefined,
        genres: form.genres,
        release_year: Number(form.release_year) || 0,
        rating: Number(form.rating) || 0,
        category_id: Number(form.category_id) || 0,
      });
      setForm(EMPTY);
      setEditing(null);
      await onSaved();
      await load(offset);
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete “${item.title}” and all of its episodes?`)) return;
    try {
      await api.deleteMedia(item.id);
      if (form.id === item.id) setForm(EMPTY);
      await onSaved();
      await load(offset);
    } catch (e) {
      onError(e.message);
    }
  }

  async function bulkDelete() {
    if (!selected.length) return;
    if (!window.confirm(`Delete ${selected.length} selected title(s)?`)) return;
    try {
      await api.bulkDelete(selected);
      setSelected([]);
      await onSaved();
      await load(0);
      setOffset(0);
    } catch (e) {
      onError(e.message);
    }
  }

  function toggleSelected(id) {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
      <form onSubmit={save} className="card space-y-3 self-start">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">{form.id ? 'Edit title' : 'Add a title'}</h2>
          {form.id ? (
            <button
              type="button"
              className="text-xs text-zinc-400 hover:text-white"
              onClick={() => {
                setForm(EMPTY);
                setEditing(null);
              }}
            >
              New instead
            </button>
          ) : null}
        </div>

        <div>
          <label className="label">Title *</label>
          <input className="input" value={form.title} onChange={(e) => update({ title: e.target.value })} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => update({ type: e.target.value })}>
              <option value="movie">Movie</option>
              <option value="series">Series</option>
              <option value="live">Live TV</option>
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <input
              className="input"
              type="number"
              value={form.release_year}
              onChange={(e) => update({ release_year: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Rating (0–10)</label>
            <input
              className="input"
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={form.rating}
              onChange={(e) => update({ rating: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Genres</label>
            <input
              className="input"
              placeholder="Action, Thriller"
              value={form.genres}
              onChange={(e) => update({ genres: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="label">Category</label>
          <select
            className="input"
            value={form.category_id || 0}
            onChange={(e) => update({ category_id: Number(e.target.value) })}
          >
            <option value={0}>No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.is_premium ? ' (premium)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Cover URL (2:3 poster)</label>
          <input className="input" value={form.cover_url} onChange={(e) => update({ cover_url: e.target.value })} />
        </div>

        <div>
          <label className="label">Backdrop URL (16:9)</label>
          <input
            className="input"
            value={form.backdrop_url}
            onChange={(e) => update({ backdrop_url: e.target.value })}
          />
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            className="input min-h-[80px]"
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
          />
        </div>

        {form.type === 'series' ? (
          <p className="rounded-lg border border-edge bg-ink/60 p-3 text-xs text-zinc-400">
            Series stream from episodes. Save the series, then attach episodes in the <b>Videos</b> tab.
          </p>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
            <div>
              <label className="label">Video URL</label>
              <input
                className="input"
                placeholder="https://…/movie.m3u8"
                value={form.video_url}
                onChange={(e) => update({ video_url: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Format</label>
              <select className="input" value={form.format} onChange={(e) => update({ format: e.target.value })}>
                <option value="mp4">MP4</option>
                <option value="hls">HLS</option>
                <option value="dash">DASH</option>
              </select>
            </div>
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-3 pt-1 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="h-4 w-4 accent-rose-600"
            checked={Boolean(form.featured)}
            onChange={(e) => update({ featured: e.target.checked })}
          />
          Feature on the app hero banner
        </label>

        <button className="btn-primary w-full" disabled={busy || !form.title.trim()}>
          {busy ? 'Saving…' : form.id ? 'Update title' : 'Publish title'}
        </button>
      </form>

      <div className="card self-start">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-base font-bold">Catalogue ({total})</h2>
          <select className="input w-auto py-1.5 text-xs" value={type} onChange={(e) => { setType(e.target.value); setOffset(0); }}>
            <option value="">All types</option>
            <option value="movie">Movies</option>
            <option value="series">Series</option>
            <option value="live">Live TV</option>
          </select>
          <input
            className="input w-40 py-1.5 text-xs"
            placeholder="Search…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          />
          {selected.length ? (
            <button className="btn-danger px-2 py-1 text-xs" onClick={bulkDelete}>
              Delete {selected.length}
            </button>
          ) : null}
        </div>

        <div className="space-y-2">
          {items.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-xl border border-edge bg-ink/50 p-2.5">
              <input
                type="checkbox"
                className="h-4 w-4 accent-rose-600"
                checked={selected.includes(m.id)}
                onChange={() => toggleSelected(m.id)}
              />
              <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-zinc-900">
                {m.cover_url ? <img src={m.cover_url} alt="" className="h-full w-full object-contain" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{m.title}</p>
                <p className="truncate text-xs text-zinc-500">
                  {m.type} · {m.release_year || '—'} · ★ {m.rating}
                  {m.featured ? ' · featured' : ''}
                  {m.source ? ' · imported' : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {m.type === 'series' ? (
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => onAddEpisode(m)}>
                    Episodes
                  </button>
                ) : null}
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(m)}>
                  Edit
                </button>
                <button className="btn-danger px-2 py-1 text-xs" onClick={() => remove(m)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
          {!items.length ? <p className="text-sm text-zinc-500">Nothing here yet.</p> : null}
        </div>

        {total > PAGE ? (
          <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
            <button
              className="btn-ghost px-2 py-1"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE))}
            >
              ← Previous
            </button>
            <span>
              {offset + 1}–{Math.min(offset + PAGE, total)} of {total}
            </span>
            <button
              className="btn-ghost px-2 py-1"
              disabled={offset + PAGE >= total}
              onClick={() => setOffset(offset + PAGE)}
            >
              Next →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
