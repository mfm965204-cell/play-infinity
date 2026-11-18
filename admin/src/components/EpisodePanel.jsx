import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

const EMPTY = {
  id: 0,
  media_id: 0,
  season: 1,
  episode_number: 1,
  title: '',
  video_url: '',
  format: 'hls',
};

export default function EpisodePanel({ refreshKey, onSaved, onError }) {
  const [series, setSeries] = useState([]);
  const [selected, setSelected] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [episodes, setEpisodes] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .listMedia({ type: 'series', limit: 200 })
      .then((res) => {
        if (!alive) return;
        const items = res.items || [];
        setSeries(items);
        if (!selected && items.length) {
          const preselect = window.__piPreselect;
          const next = preselect || items[0].id;
          window.__piPreselect = null;
          setSelected(next);
          setForm((f) => ({ ...f, media_id: next }));
        }
      })
      .catch((e) => onError(e.message));
    return () => {
      alive = false;
    };
  }, [refreshKey, onError]);

  const loadEpisodes = useCallback(async () => {
    if (!selected) {
      setEpisodes([]);
      return;
    }
    try {
      const detail = await api.mediaDetail(selected);
      setEpisodes(detail.episodes || []);
    } catch (e) {
      onError(e.message);
    }
  }, [selected, onError]);

  useEffect(() => {
    loadEpisodes();
  }, [loadEpisodes]);

  function update(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.saveEpisode({
        ...form,
        id: form.id || undefined,
        media_id: Number(form.media_id),
        season: Number(form.season),
        episode_number: Number(form.episode_number),
      });
      setForm({
        ...EMPTY,
        media_id: form.media_id,
        season: form.season,
        episode_number: Number(form.episode_number) + 1,
      });
      await loadEpisodes();
      await onSaved();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(episode) {
    if (!window.confirm(`Delete ${episode.title}?`)) return;
    try {
      await api.deleteEpisode(episode.id);
      await loadEpisodes();
      await onSaved();
    } catch (e) {
      onError(e.message);
    }
  }

  if (!series.length) {
    return (
      <div className="card">
        <h2 className="text-base font-bold">No series yet</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Add a title with type <b>Series</b> in the Media tab, then come back here to attach episodes.
        </p>
      </div>
    );
  }

  const current = series.find((s) => s.id === selected);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <form onSubmit={save} className="card space-y-3 self-start">
        <h2 className="text-base font-bold">Add an episode</h2>

        <div>
          <label className="label">Series</label>
          <select
            className="input"
            value={form.media_id}
            onChange={(e) => {
              update({ media_id: Number(e.target.value) });
              setSelected(Number(e.target.value));
            }}
          >
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Season</label>
            <input
              className="input"
              type="number"
              min="1"
              value={form.season}
              onChange={(e) => update({ season: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Episode</label>
            <input
              className="input"
              type="number"
              min="1"
              value={form.episode_number}
              onChange={(e) => update({ episode_number: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="label">Episode title</label>
          <input className="input" value={form.title} onChange={(e) => update({ title: e.target.value })} />
        </div>

        <div>
          <label className="label">Video URL *</label>
          <input
            className="input"
            placeholder="https://…/episode.m3u8"
            value={form.video_url}
            onChange={(e) => update({ video_url: e.target.value })}
            required
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

        <button className="btn-primary w-full" disabled={busy || !form.video_url.trim()}>
          {busy ? 'Saving…' : 'Add episode'}
        </button>
      </form>

      <div className="card self-start">
        <h2 className="mb-1 text-base font-bold">{current ? current.title : 'Episodes'}</h2>
        <p className="mb-4 text-xs text-zinc-500">{episodes.length} episode(s)</p>
        <div className="space-y-2">
          {episodes.map((episode) => (
            <div key={episode.id} className="flex items-center gap-3 rounded-xl border border-edge bg-ink/50 p-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-xs font-bold text-zinc-300">
                S{episode.season}E{episode.episode_number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{episode.title}</p>
                <p className="truncate text-xs text-zinc-500">
                  {episode.format.toUpperCase()} · {episode.video_url}
                </p>
              </div>
              <button className="btn-danger px-2 py-1 text-xs" onClick={() => remove(episode)}>
                Delete
              </button>
            </div>
          ))}
          {!episodes.length ? <p className="text-sm text-zinc-500">No episodes for this series yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
