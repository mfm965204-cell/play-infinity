import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

const EMPTY = { title: '', body: '' };

export default function NotificationsPanel({ refreshKey, onSaved, onError }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.notifications();
      setItems(res.items || []);
    } catch (e) {
      onError(e.message);
    }
  }, [onError]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function push(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.pushNotification({ title: form.title, body: form.body });
      setForm(EMPTY);
      await load();
      await onSaved();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete “${item.title}”?`)) return;
    try {
      await api.deleteNotification(item.id);
      await load();
      await onSaved();
    } catch (e) {
      onError(e.message);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <form onSubmit={push} className="card space-y-3 self-start">
        <h2 className="text-base font-bold">Push a banner</h2>
        <p className="text-xs text-zinc-500">
          The newest active banner appears at the top of every app screen within a few seconds — no update needed.
        </p>
        <div>
          <label className="label">Title *</label>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </div>
        <div>
          <label className="label">Message</label>
          <textarea
            className="input min-h-[90px]"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </div>
        <button className="btn-primary w-full" disabled={busy || !form.title.trim()}>
          {busy ? 'Pushing…' : 'Push banner to all devices'}
        </button>
      </form>

      <div className="card self-start">
        <h2 className="mb-4 text-base font-bold">Sent banners ({items.length})</h2>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  {item.body ? <p className="mt-1 text-xs text-zinc-400">{item.body}</p> : null}
                  <p className="mt-1 text-[11px] text-zinc-600">{item.created_at}</p>
                </div>
                <button className="btn-danger px-2 py-1 text-xs" onClick={() => remove(item)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
          {!items.length ? <p className="text-sm text-zinc-500">No banners sent yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
