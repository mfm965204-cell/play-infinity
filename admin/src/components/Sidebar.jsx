const NAV = [
  { id: 'overview', label: 'Dashboard', icon: '◎' },
  { id: 'media', label: 'Movies & Anime', icon: '▤' },
  { id: 'livetv', label: 'Live TV', icon: '◉' },
  { id: 'episodes', label: 'Episodes', icon: '▷' },
  { id: 'devices', label: 'Devices', icon: '▣' },
  { id: 'notifications', label: 'Notifications', icon: '✉' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
  { id: 'legal', label: 'Legal', icon: '§' },
];

export default function Sidebar({ tab, onTab, stats, onSignOut, onRefresh, loading }) {
  const banned = stats?.banned_devices || 0;

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/10 bg-black/40 px-3 py-4 backdrop-blur-xl lg:flex">
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-lg font-black shadow-glow">▶</div>
        <div>
          <p className="text-sm font-bold leading-tight">Play Infinity</p>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Studio</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => onTab(item.id)}
            className={`nav-item w-full ${tab === item.id ? 'nav-item-active' : ''}`}
          >
            <span className="w-4 text-center text-base opacity-70">{item.icon}</span>
            <span className="flex-1 text-left">{item.label}</span>
            {item.id === 'devices' && banned ? (
              <span className="rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">{banned}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
        <button className="btn-ghost w-full" onClick={onRefresh}>
          {loading ? 'Refreshing…' : 'Refresh data'}
        </button>
        <button className="btn-ghost w-full" onClick={onSignOut}>
          Sign out
        </button>
        <p className="pt-2 text-[10px] leading-relaxed text-zinc-600">Developed by Mohammad Fahad Mir</p>
      </div>
    </aside>
  );
}

export { NAV };
