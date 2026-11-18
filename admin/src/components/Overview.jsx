const STATS = [
  { key: 'movie', label: 'Movies' },
  { key: 'series', label: 'Series' },
  { key: 'live', label: 'Live channels' },
];

function onOff(value) {
  return value === '1' || value === true ? 'On' : 'Off';
}

export default function Overview({ counts, media, settings, onGoMedia, onGoSettings }) {
  const featured = media.find((m) => m.featured) || media[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.key} className="card">
            <p className="text-xs uppercase tracking-wider text-zinc-500">{s.label}</p>
            <p className="mt-2 text-3xl font-extrabold">{counts[s.key] ?? 0}</p>
          </div>
        ))}
        <div className="card">
          <p className="text-xs uppercase tracking-wider text-zinc-500">App version</p>
          <p className="mt-2 text-3xl font-extrabold">{settings.app_version || '1.0.0'}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold">Service status</h2>
            <button className="btn-ghost" onClick={onGoSettings}>
              Manage
            </button>
          </div>
          <ul className="divide-y divide-edge text-sm">
            {[
              ['Maintenance mode', onOff(settings.maintenance), settings.maintenance === '1'],
              ['Live TV', onOff(settings.live_tv_enabled), false],
              ['Downloads', onOff(settings.downloads_enabled), false],
              ['Force update', onOff(settings.update_required), settings.update_required === '1'],
            ].map(([label, value, alarm]) => (
              <li key={label} className="flex items-center justify-between py-3">
                <span className="text-zinc-300">{label}</span>
                <span
                  className={`pill ${alarm ? 'border-rose-500/50 text-rose-300' : 'text-zinc-400'}`}
                >
                  {value}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2 className="mb-3 text-base font-bold">Hero banner</h2>
          {featured ? (
            <div className="overflow-hidden rounded-xl border border-edge">
              <img
                src={featured.backdrop_url || featured.cover_url}
                alt=""
                className="h-32 w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="p-3">
                <p className="text-sm font-semibold">{featured.title}</p>
                <p className="text-xs text-zinc-500">
                  {featured.type} · {featured.release_year || '—'} · ★ {featured.rating || 0}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Nothing published yet.</p>
          )}
          <button className="btn-primary mt-4 w-full" onClick={onGoMedia}>
            Add content
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-base font-bold">Recently added</h2>
        {media.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {media.slice(0, 6).map((m) => (
              <div key={m.id} className="overflow-hidden rounded-lg border border-edge bg-ink/60">
                <div className="aspect-[2/3] w-full bg-zinc-900">
                  {m.cover_url ? (
                    <img src={m.cover_url} alt={m.title} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <p className="truncate px-2 py-1.5 text-xs text-zinc-400">{m.title}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No titles yet — add your first movie from the Media tab.</p>
        )}
      </div>
    </div>
  );
}
