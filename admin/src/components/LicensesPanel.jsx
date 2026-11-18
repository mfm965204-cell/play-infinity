import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

export default function LicensesPanel({ refreshKey, onSaved, onError }) {
  const [items, setItems] = useState([]);
  const [days, setDays] = useState(30);
  const [deviceLimit, setDeviceLimit] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.licenses();
      setItems(res.items || []);
    } catch (e) {
      onError(e.message);
    }
  }, [onError]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function generate(event) {
    event.preventDefault();
    setBusy(true);
    setCopied(false);
    try {
      const res = await api.createLicense({ days: Number(days), device_limit: Number(deviceLimit), note });
      setGenerated(res);
      setNote('');
      await load();
      await onSaved();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(license) {
    if (!window.confirm(`Revoke ${license.key_string}? Devices using it lose premium access.`)) return;
    try {
      await api.deleteLicense(license.id);
      await load();
      await onSaved();
    } catch (e) {
      onError(e.message);
    }
  }

  async function copyKey(key) {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <form onSubmit={generate} className="card space-y-3 self-start">
        <h2 className="text-base font-bold">Generate a license key</h2>
        <p className="text-xs text-zinc-500">
          Keys bind to the first devices that verify them, up to the limit. Revoking a key cuts those devices off.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Valid for (days)</label>
            <input
              className="input"
              type="number"
              min="1"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Device limit</label>
            <input
              className="input"
              type="number"
              min="1"
              value={deviceLimit}
              onChange={(e) => setDeviceLimit(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">Note (who is it for)</label>
          <input className="input" placeholder="Fahad — 2 phones" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Generating…' : 'Generate key'}
        </button>

        {generated ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
            <p className="text-xs text-emerald-200">New key — copy it now</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 break-all rounded-lg bg-black/50 px-2 py-1.5 text-sm text-emerald-100">
                {generated.key_string}
              </code>
              <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => copyKey(generated.key_string)}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-emerald-200/70">
              Expires {generated.expiry_date} · {generated.device_limit} device(s)
            </p>
          </div>
        ) : null}
      </form>

      <div className="card self-start">
        <h2 className="mb-4 text-base font-bold">Licenses ({items.length})</h2>
        <div className="space-y-2">
          {items.map((license) => (
            <div key={license.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm text-zinc-100">{license.key_string}</p>
                <p className="text-xs text-zinc-500">
                  {license.bound}/{license.device_limit} devices · expires {license.expiry_date}
                  {license.note ? ` · ${license.note}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {license.expired ? (
                  <span className="pill border-rose-500/40 text-rose-300">Expired</span>
                ) : license.bound >= license.device_limit ? (
                  <span className="pill border-amber-500/40 text-amber-300">Full</span>
                ) : (
                  <span className="pill border-emerald-500/40 text-emerald-300">Active</span>
                )}
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => copyKey(license.key_string)}>
                  Copy
                </button>
                <button className="btn-danger px-2 py-1 text-xs" onClick={() => remove(license)}>
                  Revoke
                </button>
              </div>
            </div>
          ))}
          {!items.length ? <p className="text-sm text-zinc-500">No keys yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
