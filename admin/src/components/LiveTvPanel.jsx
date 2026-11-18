import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

const PAGE = 60;

export default function LiveTvPanel({ refreshKey, onSaved, onError, onEdit }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [limit, setLimit] = useState(500);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const [sources, setSources] = useState([]);
  const [channels, setChannels] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');

  const [manual, setManual] = useState({ title: '', logo: '', stream: '' });

  const loadChannels = useCallback(
    async (nextOffset = offset) => {
      try {
        const res = await api.listMedia({ type: 'live', q: search, limit: PAGE, offset: nextOffset });
        setChannels(res.items || []);
        setTotal(res.total || 0);
      } catch (e) {
        onError(e.message);
      }
    },
    [search, offset, onError],
  );

  const loadSources = useCallback(async () => {
    try {
      const res = await api.iptvSources();
      setSources(res.items || []);
    } catch (e) {
      onError(e.message);
    }
  }, [onError]);

  useEffect(() => {
    loadChannels(offset);
  }, [loadChannels, offset, refreshKey]);

  useEffect(() => {
    loadSources();
  }, [loadSources, refreshKey]);

  async function importFromUrl(event) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await api.iptvImport({ url: url.trim(), name: name.trim(), limit: Number(limit) || 500 });
      setResult(`Added ${res.added} channels (${res.skipped} duplicates skipped, ${res.found} found).`);
      setUrl('');
      setName('');
      await loadSources();
      await loadChannels(0);
      setOffset(0);
      await onSaved();
    } catch (e) {
      setResult(`Import failed: ${e.message}${e.payload?.detail ? ` — ${e.payload.detail}` : ''}`);
    } finally {
      setBusy(false);
    }
  }

  async function importPasted(event) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await api.iptvImport({ m3u: pasted, name: name.trim() || 'Pasted playlist', limit: Number(limit) || 500 });
      setResult(`Added ${res.added} channels from the pasted playlist.`);
      setPasted('');
      await loadSources();
      await loadChannels(0);
      setOffset(0);
      await onSaved();
    } catch (e) {
      setResult(`Import failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function removeSource(source) {
    if (!window.confirm(`Remove all channels imported from ${source.name || source.url}?`)) return;
    try {
      const res = await api.iptvDeleteSource(source.url);
      setResult(`Removed ${res.removed} channels.`);
      await loadSources();
      await loadChannels(0);
      setOffset(0);
      await onSaved();
    } catch (e) {
      onError(e.message);
    }
  }

  async function addManual(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.saveMedia({
        title: manual.title,
        type: 'live',
        video_url: manual.stream,
        format: 'hls',
        cover_url: manual.logo,
        backdrop_url: manual.logo,
        genres: 'Live TV, Manual, India',
        description: `${manual.title} — manually added live channel.`,
        release_year: new Date().getFullYear(),
      });
      setManual({ title: '', logo: '', stream: '' });
      await loadChannels(0);
      setOffset(0);
      await onSaved();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeChannel(channel) {
    if (!window.confirm(`Delete ${channel.title}?`)) return;
    try {
      await api.deleteMedia(channel.id);
      await loadChannels(offset);
      await onSaved();
    } catch (e) {
      onError(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={importFromUrl} className="card space-y-3">
          <h2 className="text-base font-bold">Import from an IPTV provider</h2>
          <p className="text-xs text-zinc-500">
            Paste any M3U / M3U8 playlist URL — your provider's link, or a country playlist from the
            iptv-org project. The Worker fetches it server-side, parses the channels and stores them in D1.
          </p>
          <div>
            <label className="label">Playlist URL</label>
            <input
              className="input"
              placeholder="https://iptv-org.github.io/iptv/countries/in.m3u"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Source name</label>
              <input className="input" placeholder="My provider" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Max channels</label>
              <input
                className="input"
                type="number"
                min="1"
                max="2000"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </div>
          </div>
          <button className="btn-primary w-full" disabled={busy || !url.trim()}>
            {busy ? 'Importing…' : 'Import channels'}
          </button>
        </form>

        <form onSubmit={importPasted} className="card space-y-3">
          <h2 className="text-base font-bold">…or paste a playlist</h2>
          <p className="text-xs text-zinc-500">
            Drop the raw M3U text here if the provider needs a login or a custom user agent.
          </p>
          <textarea
            className="input min-h-[150px] font-mono text-[11px]"
            placeholder={'#EXTM3U\n#EXTINF:-1 tvg-logo="https://…",Channel name\nhttps://…/stream.m3u8'}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <button className="btn-ghost w-full" disabled={busy || !pasted.trim()}>
            {busy ? 'Working…' : 'Import pasted playlist'}
          </button>
        </form>
      </div>

      {result ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {result}
        </div>
      ) : null}

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">Sources ({sources.length})</h2>
        </div>
        <div className="space-y-2">
          {sources.map((source) => (
            <div key={source.id} className="flex items-center gap-3 rounded-xl border border-edge bg-ink/50 p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{source.name || source.url}</p>
                <p className="truncate text-xs text-zinc-500">
                  {source.channels} channels · {source.created_at}
                </p>
                <p className="truncate text-[11px] text-zinc-600">{source.url}</p>
              </div>
              <button className="btn-danger px-2 py-1 text-xs" onClick={() => removeSource(source)}>
                Remove
              </button>
            </div>
          ))}
          {!sources.length ? <p className="text-sm text-zinc-500">No imports yet.</p> : null}
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-base font-bold">Channels ({total})</h2>
          <input
            className="input w-48 py-1.5 text-xs"
            placeholder="Search channels…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {channels.map((channel) => (
            <div key={channel.id} className="flex items-center gap-3 rounded-xl border border-edge bg-ink/50 p-2.5">
              <div className="grid h-10 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-zinc-900">
                {channel.cover_url ? (
                  <img src={channel.cover_url} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-zinc-600">TV</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{channel.title}</p>
                <p className="truncate text-[11px] text-zinc-500">
                  {(channel.genres || []).slice(1).join(' · ') || 'Live'}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => onEdit(channel)}>
                  Edit
                </button>
                <button className="btn-danger px-2 py-1 text-xs" onClick={() => removeChannel(channel)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        {!channels.length ? <p className="text-sm text-zinc-500">No channels match.</p> : null}

        {total > PAGE ? (
          <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
            <button className="btn-ghost px-2 py-1" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
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

      <form onSubmit={addManual} className="card space-y-3">
        <h2 className="text-base font-bold">Add a single channel</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Channel name *</label>
            <input
              className="input"
              value={manual.title}
              onChange={(e) => setManual({ ...manual, title: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Logo URL</label>
            <input className="input" value={manual.logo} onChange={(e) => setManual({ ...manual, logo: e.target.value })} />
          </div>
          <div>
            <label className="label">Stream URL *</label>
            <input
              className="input"
              placeholder="https://…/live.m3u8"
              value={manual.stream}
              onChange={(e) => setManual({ ...manual, stream: e.target.value })}
              required
            />
          </div>
        </div>
        <button className="btn-primary" disabled={busy || !manual.title || !manual.stream}>
          Add channel
        </button>
      </form>
    </div>
  );
}
