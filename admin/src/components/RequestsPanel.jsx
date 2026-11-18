import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

export default function RequestsPanel({ refreshKey, onSaved, onError }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('pending');

  const load = useCallback(async () => {
    try {
      const res = await api.requests();
      setItems(res.items || []);
    } catch (e) {
      onError(e.message);
    }
  }, [onError]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function fulfill(request) {
    try {
      await api.fulfillRequest(request.id);
      await load();
      await onSaved();
    } catch (e) {
      onError(e.message);
    }
  }

  const visible = filter === 'all' ? items : items.filter((item) => item.status === filter);
  const pending = items.filter((item) => item.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-base font-bold">Request inbox</h2>
          <span className="pill border-amber-500/40 text-amber-300">{pending} pending</span>
          <select className="input w-auto py-1.5 text-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="pending">Pending</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="all">All</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="pb-2 pr-3">Title</th>
                <th className="pb-2 pr-3">Device</th>
                <th className="pb-2 pr-3">Asked</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {visible.map((request) => (
                <tr key={request.id}>
                  <td className="py-2.5 pr-3 font-medium">{request.title}</td>
                  <td className="py-2.5 pr-3 font-mono text-[11px] text-zinc-500">
                    {request.device_id ? `${request.device_id.slice(0, 12)}…` : '—'}
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-zinc-500">{request.created_at}</td>
                  <td className="py-2.5 pr-3">
                    {request.status === 'pending' ? (
                      <span className="pill border-amber-500/40 text-amber-300">Pending</span>
                    ) : (
                      <span className="pill border-emerald-500/40 text-emerald-300">Fulfilled</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    {request.status === 'pending' ? (
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => fulfill(request)}>
                        Mark fulfilled
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length ? <p className="py-6 text-sm text-zinc-500">Nothing here.</p> : null}
        </div>
      </div>
    </div>
  );
}
