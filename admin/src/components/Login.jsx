import { useState } from 'react';
import { api, setToken } from '../api';

export default function Login({ onSuccess }) {
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.login(secret.trim());
      setToken(res.token);
      onSuccess();
    } catch (e) {
      setError(e.message === 'invalid_secret' ? 'That admin secret is not correct.' : e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-5">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-brand text-3xl shadow-glow">
            ▶
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Play Infinity</h1>
          <p className="mt-1 text-sm text-zinc-400">Studio console — sign in to manage the catalogue</p>
        </div>

        <form onSubmit={submit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="secret">
              Admin secret
            </label>
            <input
              id="secret"
              className="input"
              type="password"
              autoFocus
              autoComplete="current-password"
              placeholder="••••••••"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button className="btn-primary w-full" disabled={busy || !secret.trim()}>
            {busy ? 'Checking…' : 'Enter studio'}
          </button>

          <p className="text-center text-xs text-zinc-500">
            The default secret is <code className="rounded bg-white/10 px-1.5 py-0.5">admin123</code>. Change it
            from App settings after signing in.
          </p>
        </form>

        <p className="mt-8 text-center text-xs text-zinc-600">
          Developed by Mohammad Fahad Mir ·{' '}
          <a className="text-zinc-400 hover:text-white" href="https://portfolio.mfm965204.workers.dev/" target="_blank" rel="noreferrer">
            Portfolio
          </a>{' '}
          ·{' '}
          <a className="text-zinc-400 hover:text-white" href="https://www.instagram.com/fahad0101r" target="_blank" rel="noreferrer">
            Support
          </a>
        </p>
      </div>
    </div>
  );
}
