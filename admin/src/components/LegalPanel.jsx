import { useEffect, useState } from 'react';
import { api } from '../api';

export default function LegalPanel({ settings, onSaved, onError, navigate }) {
  const [form, setForm] = useState({ privacy_policy: '', terms_conditions: '' });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    setForm({
      privacy_policy: settings.privacy_policy || '',
      terms_conditions: settings.terms_conditions || '',
    });
  }, [settings]);

  async function save(which) {
    setBusy(true);
    setSaved('');
    try {
      await api.saveSettings({ [which]: form[which] });
      setSaved(which);
      await onSaved();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {[
        { key: 'privacy_policy', title: 'Privacy Policy', path: '/privacy' },
        { key: 'terms_conditions', title: 'Terms & Conditions', path: '/terms' },
      ].map((doc) => (
        <div key={doc.key} className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">{doc.title}</h2>
            <button className="text-xs text-zinc-400 hover:text-white" onClick={() => navigate(doc.path)}>
              Preview →
            </button>
          </div>
          <textarea
            className="input min-h-[420px] font-mono text-[13px] leading-6"
            value={form[doc.key] || ''}
            onChange={(e) => {
              setForm({ ...form, [doc.key]: e.target.value });
              setSaved('');
            }}
          />
          <div className="mt-3 flex items-center gap-3">
            <button className="btn-primary" onClick={() => save(doc.key)} disabled={busy}>
              {busy ? 'Saving…' : `Save ${doc.title}`}
            </button>
            {saved === doc.key ? <span className="text-xs text-emerald-400">Saved</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
