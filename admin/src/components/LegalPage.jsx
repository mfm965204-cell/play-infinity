import { useEffect, useState } from 'react';
import { api } from '../api';
import Footer from './Footer';

export default function LegalPage({ kind, onBack }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .publicSettings()
      .then((s) => {
        if (alive) setText(s[kind] || '');
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [kind]);

  const title = kind === 'privacy_policy' ? 'Privacy Policy' : 'Terms & Conditions';

  return (
    <div className="min-h-screen">
      <header className="border-b border-edge">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <button className="btn-ghost" onClick={onBack}>
            ← Back
          </button>
          <h1 className="text-lg font-bold">{title}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <article className="whitespace-pre-wrap text-[15px] leading-7 text-zinc-300">{text}</article>
        )}
      </main>

      <Footer navigate={onBack} />
    </div>
  );
}
