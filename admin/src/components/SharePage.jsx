import { useEffect, useState } from 'react';

export default function SharePage({ id }) {
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`/api/media/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'That title is not in the catalogue.' : `HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (alive) {
          setItem(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const appLink = `playinfinity://movie/${id}`;

  function openApp() {
    window.location.href = appLink;
    setTimeout(() => {
      if (!document.hidden) {
        // eslint-disable-next-line no-alert
        window.alert('Play Infinity did not open. Install the APK from the GitHub Actions page, then try again.');
      }
    }, 1600);
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0B0B0F] text-zinc-500">
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0B0B0F] px-6 text-center text-zinc-300">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Title not found</h1>
          <p className="mt-2 text-sm text-zinc-500">{error || 'This link does not point at anything in the catalogue.'}</p>
        </div>
      </div>
    );
  }

  const poster = item.backdrop_url || item.cover_url;
  const meta = [
    item.release_year || null,
    item.rating ? `★ ${Number(item.rating).toFixed(1)}` : null,
    ...(item.genres || []).slice(0, 2),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-white">
      <div className="relative flex min-h-[70vh] items-end">
        {poster ? (
          <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B0B0F]/40 via-[#0B0B0F]/85 to-[#0B0B0F]" />
        <div className="relative mx-auto w-full max-w-3xl px-6 py-10">
          <div className="mb-5 flex items-center gap-2 text-sm font-extrabold tracking-wide">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#E50914] text-xs">▶</span>
            Play Infinity
          </div>
          <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">{item.title}</h1>
          {meta ? <p className="mt-2 text-sm text-zinc-400">{meta}</p> : null}
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-zinc-300">
            {(item.description || '').slice(0, 260)}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              onClick={openApp}
              className="rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-zinc-200"
            >
              ▶ Open in Play Infinity
            </button>
            <a
              href="https://github.com/mfm965204-cell/play-infinity/actions"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Get the app
            </a>
          </div>

          <p className="mt-5 max-w-xl text-xs leading-relaxed text-zinc-500">
            Tap <b className="text-zinc-300">Open in Play Infinity</b>. If the app is not installed yet, download the
            latest APK from the GitHub Actions page first. Direct app link:{' '}
            <span className="font-mono text-zinc-400">{appLink}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
