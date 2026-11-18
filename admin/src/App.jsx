import { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import Login from './components/Login';
import Overview from './components/Overview';
import MediaPanel from './components/MediaPanel';
import EpisodePanel from './components/EpisodePanel';
import LiveTvPanel from './components/LiveTvPanel';
import SettingsPanel from './components/SettingsPanel';
import LegalPanel from './components/LegalPanel';
import LegalPage from './components/LegalPage';
import Footer from './components/Footer';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'media', label: 'Media' },
  { id: 'livetv', label: 'Live TV' },
  { id: 'episodes', label: 'Videos' },
  { id: 'settings', label: 'App settings' },
  { id: 'legal', label: 'Legal' },
];

export default function App() {
  const [route, setRoute] = useState(window.location.pathname);
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState({ counts: {}, episodes: 0, sources: 0, live_categories: {} });
  const [activity, setActivity] = useState([]);
  const [recent, setRecent] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const navigate = useCallback((path) => {
    window.history.pushState({}, '', path);
    setRoute(path);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) return;
    setLoading(true);
    setError('');
    try {
      const [statsRes, activityRes, settingsRes, recentRes] = await Promise.all([
        api.stats(),
        api.activity(),
        api.getSettings(),
        api.listMedia({ limit: 12 }),
      ]);
      setStats(statsRes || { counts: {}, episodes: 0, sources: 0, live_categories: {} });
      setActivity(activityRes.items || []);
      setSettings(settingsRes || {});
      setRecent(recentRes.items || []);
      setAuthed(true);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      if (e.status === 401) {
        setToken('');
        setAuthed(false);
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) refresh();
  }, [authed, refresh]);

  if (route === '/privacy' || route === '/terms') {
    return (
      <LegalPage
        kind={route === '/privacy' ? 'privacy_policy' : 'terms_conditions'}
        onBack={() => navigate('/')}
      />
    );
  }

  if (!authed) {
    return (
      <Login
        onSuccess={() => {
          setAuthed(true);
          setTab('overview');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-edge bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-lg font-black shadow-glow">
              ▶
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Play Infinity</p>
              <p className="text-[11px] uppercase tracking-widest text-zinc-500">Studio console</p>
            </div>
          </div>

          <nav className="ml-4 hidden gap-1 lg:flex">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  tab === t.id ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={refresh} className="btn-ghost hidden sm:inline-flex">
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              onClick={() => {
                setToken('');
                setAuthed(false);
              }}
              className="btn-ghost"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${
                tab === t.id ? 'bg-white/10 text-white' : 'text-zinc-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6">
        {error ? (
          <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {tab === 'overview' ? (
          <Overview
            stats={stats}
            activity={activity}
            recent={recent}
            settings={settings}
            onGo={(next) => setTab(next)}
            onExport={async () => {
              try {
                const data = await api.exportAll();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `playinfinity-export-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) {
                setError(e.message);
              }
            }}
          />
        ) : null}

        {tab === 'media' ? (
          <MediaPanel
            refreshKey={refreshKey}
            editing={editing}
            setEditing={setEditing}
            onSaved={refresh}
            onError={setError}
            onAddEpisode={(m) => {
              setEditing(null);
              setTab('episodes');
              window.__piPreselect = m.id;
            }}
          />
        ) : null}

        {tab === 'livetv' ? (
          <LiveTvPanel
            refreshKey={refreshKey}
            onSaved={refresh}
            onError={setError}
            onEdit={(channel) => {
              setEditing(channel);
              setTab('media');
            }}
          />
        ) : null}

        {tab === 'episodes' ? (
          <EpisodePanel refreshKey={refreshKey} onSaved={refresh} onError={setError} />
        ) : null}

        {tab === 'settings' ? (
          <SettingsPanel
            settings={settings}
            onSaved={refresh}
            onError={setError}
            onSignOut={() => setAuthed(false)}
          />
        ) : null}

        {tab === 'legal' ? (
          <LegalPanel settings={settings} onSaved={refresh} onError={setError} navigate={navigate} />
        ) : null}
      </main>

      <Footer navigate={navigate} />
    </div>
  );
}
