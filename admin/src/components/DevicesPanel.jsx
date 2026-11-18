import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

export default function DevicesPanel({ refreshKey, onSaved, onError }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.devices();
      setItems(res.items || []);
    } catch (e) {
      onError(e.message);
    }
  }, [onError]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function toggleBan(device) {
    setBusy(true);
    try {
      await api.banDevice(device.id, device.banned !== 1);
      await load();
      await onSaved();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(device) {
    if (!window.confirm(`Remove ${device.device_id} from the register?`)) return;
    try {
      await api.deleteDevice(device.id);
      await load();
      await onSaved();
    } catch (e) {
      onError(e.message);
    }
  }

  const visible = items.filter((item) => {
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return (
      item.device_id.toLowerCase().includes(needle) ||
      (item.model || '').toLowerCase().includes(needle) ||
      (item.manufacturer || '').toLowerCase().includes(needle)
    );
  });

  const banned = items.filter((item) => item.banned === 1).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Registered devices</p>
          <p className="mt-2 text-3xl font-extrabold">{items.length}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Banned</p>
          <p className="mt-2 text-3xl font-extrabold text-rose-400">{banned}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Active</p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-400">{items.length - banned}</p>
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-base font-bold">Device register</h2>
          <input
            className="input w-56 py-1.5 text-xs"
            placeholder="Search id, model…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn-ghost px-2 py-1 text-xs" onClick={load}>
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="pb-2 pr-3">Device</th>
                <th className="pb-2 pr-3">Model</th>
                <th className="pb-2 pr-3">App</th>
                <th className="pb-2 pr-3">First seen</th>
                <th className="pb-2 pr-3">Last seen</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {visible.map((device) => (
                <tr key={device.id}>
                  <td className="py-2.5 pr-3 font-mono text-[11px] text-zinc-300">{device.device_id}</td>
                  <td className="py-2.5 pr-3 text-xs text-zinc-400">
                    {[device.manufacturer, device.model].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-zinc-500">{device.app_version || '—'}</td>
                  <td className="py-2.5 pr-3 text-xs text-zinc-500">{device.first_seen}</td>
                  <td className="py-2.5 pr-3 text-xs text-zinc-500">{device.last_seen}</td>
                  <td className="py-2.5 pr-3">
                    {device.banned === 1 ? (
                      <span className="pill border-rose-500/40 text-rose-300">Banned</span>
                    ) : (
                      <span className="pill border-emerald-500/40 text-emerald-300">Active</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        className={`px-2 py-1 text-xs ${device.banned === 1 ? 'btn-ghost' : 'btn-danger'}`}
                        disabled={busy}
                        onClick={() => toggleBan(device)}
                      >
                        {device.banned === 1 ? 'Unban' : 'Ban'}
                      </button>
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => remove(device)}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length ? (
            <p className="py-8 text-sm text-zinc-500">
              No devices yet — they appear here the first time someone opens the app.
            </p>
          ) : null}
        </div>
      </div>

      <div className="card">
        <h2 className="text-base font-bold">How banning works</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          The app generates a random device id on first launch and registers it here. Banning a device makes
          every catalogue request from that id return 403, so the app shows a blocked screen immediately —
          no reinstall needed, and the ban survives an app update because the id is stored on the device.
        </p>
      </div>
    </div>
  );
}
