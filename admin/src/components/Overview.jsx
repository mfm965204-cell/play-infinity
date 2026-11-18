function Stat({ label, value, hint }) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-extrabold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function onOff(value) {
  return value === '1' || value === true ? 'On' : 'Off';
}

export default function Overview({ stats, activity, recent, settings, onGo, onExport }) {
  const counts = stats.counts || {};
  const categories = Object.entries(stats.live_categories || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Movies" value={counts.movie || 0} />
        <Stat label="Series" value={counts.series || 0} hint={`${stats.episodes || 0} episodes`} />
        <Stat label="Live channels" value={counts.live || 0} hint={`${stats.sources || 0} source(s)`} />
        <Stat label="App version" value={settings.app_version || '1.0.0'} hint="Published to the app" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold">Service status</h2>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={onExport}>
                Export JSON
              </button>
              <button className="btn-ghost" onClick={() => onGo('settings')}>
                Manage
              </button>
            </div>
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
                <span className={`pill ${alarm ? 'border-rose-500/50 text-rose-300' : 'text-zinc-400'}`}>
                  {value}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => onGo('media')}>
              Add a title
            </button>
            <button className="btn-ghost" onClick={() => onGo('livetv')}>
              Import live channels
            </button>
            <button className="btn-ghost" onClick={() => onGo('episodes')}>
              Add episodes
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="mb-3 text-base font-bold">Live TV mix</h2>
          {categories.length ? (
            <ul className="space-y-2 text-sm">
              {categories.slice(0, 8).map(([name, n]) => (
                <li key={name}>
                  <div className="mb-1 flex justify-between text-xs text-zinc-400">
                    <span>{name}</span>
                    <span>{n}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.min(100, (n / (counts.live || 1)) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No live channels yet.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-base font-bold">Recently added</h2>
          {recent.length ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {recent.slice(0, 8).map((m) => (
                <div key={m.id} className="overflow-hidden rounded-lg border border-edge bg-ink/60">
                  <div className="aspect-[2/3] w-full bg-zinc-900">
                    {m.cover_url ? (
                      <img src={m.cover_url} alt={m.title} className="h-full w-full object-contain" />
                    ) : null}
                  </div>
                  <p className="truncate px-2 py-1.5 text-[11px] text-zinc-400">{m.title}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Nothing published yet.</p>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 text-base font-bold">Activity</h2>
          {activity.length ? (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {activity.map((item) => (
                <li key={item.id} className="flex items-start gap-3 border-b border-edge/60 pb-2 last:border-0">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  <div className="min-w-0">
                    <p className="truncate text-zinc-300">{item.detail || item.action}</p>
                    <p className="text-[11px] text-zinc-500">
                      {item.action} · {item.created_at}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No admin activity recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
