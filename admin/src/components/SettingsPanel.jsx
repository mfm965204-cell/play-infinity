import { useEffect, useState } from 'react';
import { api, setToken } from '../api';

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium text-zinc-200">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-zinc-500">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`toggle ${checked ? 'toggle-on' : ''}`}
      >
        <span className={`toggle-knob ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export default function SettingsPanel({ settings, onSaved, onError, onSignOut }) {
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [secret, setSecret] = useState({ current: '', next: '', confirm: '' });
  const [secretBusy, setSecretBusy] = useState(false);
  const [secretMessage, setSecretMessage] = useState('');

  useEffect(() => {
    setForm({
      maintenance: settings.maintenance === '1',
      live_tv_enabled: settings.live_tv_enabled === '1',
      downloads_enabled: settings.downloads_enabled === '1',
      update_required: settings.update_required === '1',
      maintenance_message: settings.maintenance_message || '',
      update_message: settings.update_message || '',
      app_version: settings.app_version || '1.0.0',
      premium_enabled: settings.premium_enabled === '1',
      developer_name: settings.developer_name || 'Mohammad Fahad Mir',
      developer_portfolio: settings.developer_portfolio || 'https://portfolio.mfm965204.workers.dev/',
      developer_instagram: settings.developer_instagram || 'https://www.instagram.com/fahad0101r',
    });
  }, [settings]);

  function update(patch) {
    setForm((f) => ({ ...f, ...patch }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    try {
      await api.saveSettings(form);
      setSaved(true);
      await onSaved();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function changeSecret(event) {
    event.preventDefault();
    setSecretMessage('');
    if (secret.next.length < 6) {
      setSecretMessage('Use at least 6 characters.');
      return;
    }
    if (secret.next !== secret.confirm) {
      setSecretMessage('The two new secrets do not match.');
      return;
    }
    setSecretBusy(true);
    try {
      await api.changeSecret(secret.current, secret.next);
      setToken('');
      setSecretMessage('Admin secret updated. Every session was signed out — please sign in again.');
      setTimeout(() => onSignOut(), 1800);
    } catch (e) {
      setSecretMessage(e.message === 'invalid_current_secret' ? 'Current secret is wrong.' : e.message);
    } finally {
      setSecretBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card">
        <h2 className="mb-1 text-base font-bold">Feature toggles</h2>
        <p className="mb-2 text-xs text-zinc-500">These are read by the Android app on launch.</p>

        <div className="divide-y divide-edge">
          <Toggle
            label="Enable premium system"
            hint="Turns on the license gate for premium categories."
            checked={Boolean(form.premium_enabled)}
            onChange={(v) => update({ premium_enabled: v })}
          />
          <Toggle
            label="Maintenance mode"
            hint="Blocks the whole app with a full-screen notice."
            checked={Boolean(form.maintenance)}
            onChange={(v) => update({ maintenance: v })}
          />
          <Toggle
            label="Live TV enabled"
            hint="Hides the Live TV row and tab when off."
            checked={Boolean(form.live_tv_enabled)}
            onChange={(v) => update({ live_tv_enabled: v })}
          />
          <Toggle
            label="Downloads enabled"
            hint="Toggles the offline download button."
            checked={Boolean(form.downloads_enabled)}
            onChange={(v) => update({ downloads_enabled: v })}
          />
          <Toggle
            label="App update required"
            hint="Shows a blocking update screen in the app."
            checked={Boolean(form.update_required)}
            onChange={(v) => update({ update_required: v })}
          />
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="label">Maintenance message</label>
            <textarea
              className="input min-h-[70px]"
              value={form.maintenance_message || ''}
              onChange={(e) => update({ maintenance_message: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Update message</label>
            <textarea
              className="input min-h-[70px]"
              value={form.update_message || ''}
              onChange={(e) => update({ update_message: e.target.value })}
            />
          </div>
          <div>
            <label className="label">App version label</label>
            <input
              className="input"
              value={form.app_version || ''}
              onChange={(e) => update({ app_version: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </button>
          {saved ? <span className="text-xs text-emerald-400">Saved</span> : null}
        </div>
      </div>

      <div className="space-y-6">
        <div className="card">
          <h2 className="mb-3 text-base font-bold">Developer &amp; support links</h2>
          <div className="space-y-3">
            <div>
              <label className="label">Developer name</label>
              <input
                className="input"
                value={form.developer_name || ''}
                onChange={(e) => update({ developer_name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Portfolio URL</label>
              <input
                className="input"
                value={form.developer_portfolio || ''}
                onChange={(e) => update({ developer_portfolio: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Support / Instagram URL</label>
              <input
                className="input"
                value={form.developer_instagram || ''}
                onChange={(e) => update({ developer_instagram: e.target.value })}
              />
            </div>
          </div>
          <button className="btn-ghost mt-4" onClick={save} disabled={busy}>
            Save links
          </button>
        </div>

        <form className="card space-y-3" onSubmit={changeSecret}>
          <h2 className="text-base font-bold">Change admin secret</h2>
          <p className="text-xs text-zinc-500">
            The default secret is <code className="rounded bg-white/10 px-1.5 py-0.5">admin123</code>. Changing it
            signs out every session.
          </p>
          <div>
            <label className="label">Current secret</label>
            <input
              className="input"
              type="password"
              value={secret.current}
              onChange={(e) => setSecret({ ...secret, current: e.target.value })}
            />
          </div>
          <div>
            <label className="label">New secret</label>
            <input
              className="input"
              type="password"
              value={secret.next}
              onChange={(e) => setSecret({ ...secret, next: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Confirm new secret</label>
            <input
              className="input"
              type="password"
              value={secret.confirm}
              onChange={(e) => setSecret({ ...secret, confirm: e.target.value })}
            />
          </div>
          {secretMessage ? <p className="text-xs text-amber-300">{secretMessage}</p> : null}
          <button className="btn-primary w-full" disabled={secretBusy || !secret.next}>
            {secretBusy ? 'Updating…' : 'Update secret'}
          </button>
        </form>
      </div>
    </div>
  );
}
