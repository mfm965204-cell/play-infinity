import { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import Login from './components/Login';
import Sidebar, { NAV } from './components/Sidebar';
import Overview from './components/Overview';
import MediaPanel from './components/MediaPanel';
import EpisodePanel from './components/EpisodePanel';
import LiveTvPanel from './components/LiveTvPanel';
import DevicesPanel from './components/DevicesPanel';
import NotificationsPanel from './components/NotificationsPanel';
import SettingsPanel from './components/SettingsPanel';
import LegalPanel from './components/LegalPanel';
import LegalPage from './components/LegalPage';
import SharePage from './components/SharePage';
import Footer from './components/Footer';

export default function App() {
  const [route, setRoute] = useState(window.location.pathname);
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState({ counts: {} });
  const [activity, setActivity] = useState([]);
  const [recent, setRecent] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [live, setLive] = useState(null);

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
      setStats(statsRes || { counts: {} });
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

  // Real-time stats over server-sent events.
  useEffect(() => {
    if (!authed) return undefined;
    const token = getToken();
    if (!token) return undefined;
    let source = null;
    try {
      source = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'stats') setLive(data);
        } catch {
          /* ignore malformed frame */
        }
      };
    } catch {
      source = null;
    }
    return () => {
      try {
        source?.close();
      } catch {
        /* already closed */
      }
    };
  }, [authed]);

  const shareMatch = route.match(/^\/movie\/(\d+)\/?$/);
  if (shareMatch) {
    return <SharePage id={Number(shareMatch[1])} />;
  }

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
    <div className="flex min-h-screen">
      <Sidebar
        tab={tab}
        onTab={setTab}
        stats={stats}
        loading={loading}
        onRefresh={refresh}
        onSignOut={() => {
          setToken('');
          setAuthed(false);
        }}
      />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-5 py-3">
            <h1 className="text-sm font-bold">{NAV.find((item) => item.id === tab)?.label || 'Studio'}</h1>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden items-center gap-2 text-xs text-zinc-500 sm:flex">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-400' : 'bg-zinc-600'}`}
                  title={live ? `Live · ${live.at}` : 'Connecting…'}
                />
                {live ? live.devices : stats.devices || 0} devices ·{' '}
                {live ? live.banned : stats.banned_devices || 0} banned ·{' '}
                {live ? live.media : stats.counts?.movie + stats.counts?.anime + stats.counts?.live || 0} titles
              </span>
              <button className="btn-ghost lg:hidden" onClick={refresh}>
                Refresh
              </button>
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
            {NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${
                  tab === item.id ? 'bg-white/10 text-white' : 'text-zinc-400'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        <main className="px-5 py-6">
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
              onGo={setTab}
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

          {tab === 'devices' ? (
            <DevicesPanel refreshKey={refreshKey} onSaved={refresh} onError={setError} />
          ) : null}

          {tab === 'notifications' ? (
            <NotificationsPanel refreshKey={refreshKey} onSaved={refresh} onError={setError} />
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
    </div>
  );
}
