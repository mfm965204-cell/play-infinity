import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

const EMPTY = { id: 0, name: '', slug: '', is_premium: false, is_enabled: true, sort_order: 100 };

export default function CategoriesPanel({ refreshKey, onSaved, onError }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.categories();
      setItems(res.items || []);
    } catch (e) {
      onError(e.message);
    }
  }, [onError]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  function update(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.saveCategory({
        ...form,
        id: form.id || undefined,
        slug: form.slug || undefined,
      });
      setForm(EMPTY);
      await load();
      await onSaved();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(category) {
    if (!window.confirm(`Delete the “${category.name}” category? Its titles stay, just uncategorised.`)) return;
    try {
      await api.deleteCategory(category.id);
      await load();
      await onSaved();
    } catch (e) {
      onError(e.message);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <form onSubmit={save} className="card space-y-3 self-start">
        <h2 className="text-base font-bold">{form.id ? 'Edit category' : 'New category'}</h2>
        <p className="text-xs text-zinc-500">
          Categories become rows on the app home screen. Premium categories are locked behind a license key
          when the premium system is enabled.
        </p>

        <div>
          <label className="label">Name *</label>
          <input className="input" value={form.name} onChange={(e) => update({ name: e.target.value })} required />
        </div>
        <div>
          <label className="label">Slug</label>
          <input
            className="input"
            placeholder="auto from the name"
            value={form.slug}
            onChange={(e) => update({ slug: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Sort order</label>
          <input
            className="input"
            type="number"
            value={form.sort_order}
            onChange={(e) => update({ sort_order: e.target.value })}
          />
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm">
          <span>
            <span className="block text-zinc-200">Premium</span>
            <span className="text-xs text-zinc-500">Locks this row behind a license key</span>
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-rose-600"
            checked={form.is_premium}
            onChange={(e) => update({ is_premium: e.target.checked })}
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm">
          <span>
            <span className="block text-zinc-200">Enabled</span>
            <span className="text-xs text-zinc-500">Off hides the row completely</span>
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-rose-600"
            checked={form.is_enabled}
            onChange={(e) => update({ is_enabled: e.target.checked })}
          />
        </label>

        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={busy || !form.name.trim()}>
            {busy ? 'Saving…' : form.id ? 'Update category' : 'Create category'}
          </button>
          {form.id ? (
            <button type="button" className="btn-ghost" onClick={() => setForm(EMPTY)}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className="card self-start">
        <h2 className="mb-4 text-base font-bold">Categories ({items.length})</h2>
        <div className="space-y-2">
          {items.map((category) => (
            <div
              key={category.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {category.name} <span className="text-xs font-normal text-zinc-500">/{category.slug}</span>
                </p>
                <p className="text-xs text-zinc-500">
                  {category.media_count ?? 0} titles · order {category.sort_order}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {category.is_premium ? <span className="pill border-amber-500/40 text-amber-300">Premium</span> : null}
                {category.is_enabled ? (
                  <span className="pill border-emerald-500/40 text-emerald-300">Live</span>
                ) : (
                  <span className="pill text-zinc-500">Hidden</span>
                )}
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setForm({ ...category, slug: category.slug })}>
                  Edit
                </button>
                <button className="btn-danger px-2 py-1 text-xs" onClick={() => remove(category)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
          {!items.length ? <p className="text-sm text-zinc-500">No categories yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
