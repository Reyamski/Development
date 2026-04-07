import { useEffect, useState } from 'react';
import { useAppStore } from './store/app-store.js';
import { IncidentList } from './components/IncidentList.js';
import { NewIncidentModal } from './components/NewIncidentModal.js';
import { KillConfirmModal } from './components/KillConfirmModal.js';
import { DiagnosticsPanel } from './components/DiagnosticsPanel.js';
import { Timeline } from './components/Timeline.js';
import { PostMortemViewer } from './components/PostMortemViewer.js';

const TYPE_LABELS: Record<string, string> = {
  DEADLOCK_STORM: 'Deadlock Storm',
  HIGH_LOCK_WAIT: 'High Lock Wait',
  CONNECTION_EXHAUSTION: 'Connection Exhaustion',
  SLOW_QUERY_FLOOD: 'Slow Query Flood',
};

const TYPE_ICONS: Record<string, string> = {
  DEADLOCK_STORM: '⚡',
  HIGH_LOCK_WAIT: '🔒',
  CONNECTION_EXHAUSTION: '📡',
  SLOW_QUERY_FLOOD: '🐌',
};

function formatDuration(startedAt: string, resolvedAt?: string): string {
  const start = new Date(startedAt).getTime();
  const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const diffMs = end - start;
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs % 3_600_000) / 60_000);
  const s = Math.floor((diffMs % 60_000) / 1_000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function ResolveSection() {
  const activeIncident = useAppStore((s) => s.activeIncident);
  const resolveActiveIncident = useAppStore((s) => s.resolveActiveIncident);
  const generatePostMortem = useAppStore((s) => s.generatePostMortem);

  const [resolveDetail, setResolveDetail] = useState('');
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');

  if (!activeIncident) return null;

  async function handleResolve() {
    if (!resolveDetail.trim()) {
      setError('Please describe how the incident was resolved.');
      return;
    }
    setResolving(true);
    setError('');
    try {
      await resolveActiveIncident(resolveDetail.trim());
    } catch (err: any) {
      setError(err.message);
      setResolving(false);
    }
  }

  const isResolved = activeIncident.status === 'RESOLVED';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Resolution
      </h3>
      {!isResolved && (
        <div className="flex gap-2">
          <input
            type="text"
            value={resolveDetail}
            onChange={(e) => setResolveDetail(e.target.value)}
            placeholder="Resolution detail (e.g., Blocking transaction killed)"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors"
          />
          <button
            onClick={() => void handleResolve()}
            disabled={resolving}
            className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors whitespace-nowrap"
          >
            {resolving ? 'Resolving...' : 'Mark Resolved'}
          </button>
        </div>
      )}
      {isResolved && (
        <p className="text-xs text-green-400 flex items-center gap-1.5">
          <span>✓</span> Incident resolved
        </p>
      )}
      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="pt-1">
        <button
          onClick={() => void generatePostMortem()}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
        >
          Generate Post-Mortem
        </button>
      </div>
    </div>
  );
}

function IncidentDetail() {
  const activeIncident = useAppStore((s) => s.activeIncident);
  const [, forceUpdate] = useState(0);

  // Tick the clock every second while incident is active
  useEffect(() => {
    if (!activeIncident || activeIncident.status !== 'ACTIVE') return;
    const t = setInterval(() => forceUpdate((n) => n + 1), 1_000);
    return () => clearInterval(t);
  }, [activeIncident]);

  if (!activeIncident) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-3">
        <div className="text-4xl opacity-20">⚡</div>
        <p className="text-gray-500 text-sm font-medium">No incident selected</p>
        <p className="text-gray-600 text-xs">Select an incident from the sidebar or create a new one to begin.</p>
      </div>
    );
  }

  const isActive = activeIncident.status === 'ACTIVE';

  return (
    <div className="space-y-5">
      {/* Incident header card */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-lg">{TYPE_ICONS[activeIncident.type] ?? '🔥'}</span>
              <h2 className="text-base font-semibold text-gray-100">{activeIncident.incident_id}</h2>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                  isActive
                    ? 'bg-red-950 text-red-400 border-red-800'
                    : 'bg-green-950 text-green-400 border-green-800'
                }`}
              >
                {activeIncident.status}
              </span>
            </div>
            <p className="text-sm text-blue-400 font-medium">
              {TYPE_LABELS[activeIncident.type] ?? activeIncident.type}
            </p>
            <p className="text-xs text-gray-500">
              Instance: <span className="text-gray-300">{activeIncident.instance}</span>
              <span className="mx-1.5 text-gray-700">·</span>
              Responder: <span className="text-gray-300">{activeIncident.responder}</span>
            </p>
            {activeIncident.notes && (
              <p className="text-xs text-gray-400 italic border-l-2 border-gray-700 pl-2 mt-1">
                {activeIncident.notes}
              </p>
            )}
          </div>
          <div className="text-right shrink-0 ml-4">
            <div className={`font-mono text-2xl font-bold tabular-nums ${isActive ? 'text-red-400' : 'text-green-400'}`}>
              {formatDuration(activeIncident.started_at, activeIncident.resolved_at)}
            </div>
            <div className="text-xs text-gray-500 mt-0.5 uppercase tracking-wider">duration</div>
          </div>
        </div>
      </div>

      {/* Diagnostics */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
          Diagnostics
        </h3>
        <DiagnosticsPanel />
      </section>

      {/* Timeline */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
          Timeline
          <span className="ml-2 text-gray-700 font-normal normal-case tracking-normal">
            ({activeIncident.timeline.length} entries)
          </span>
        </h3>
        <Timeline entries={activeIncident.timeline} />
      </section>

      {/* Resolve + Post-mortem */}
      <ResolveSection />
    </div>
  );
}

export function App() {
  const showNewIncidentModal = useAppStore((s) => s.showNewIncidentModal);
  const killTarget = useAppStore((s) => s.killTarget);
  const showPostMortem = useAppStore((s) => s.showPostMortem);
  const loadInstances = useAppStore((s) => s.loadInstances);

  useEffect(() => {
    void loadInstances();
  }, [loadInstances]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-red-400 text-base">⚡</span>
            <h1 className="text-sm font-bold text-gray-100 tracking-wide">Incident Runbook</h1>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 pl-6">DBA Executor + Post-Mortem</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <IncidentList />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-950 p-6">
        <IncidentDetail />
      </main>

      {/* Modals */}
      {showNewIncidentModal && <NewIncidentModal />}
      {killTarget && <KillConfirmModal />}
      {showPostMortem && <PostMortemViewer />}
    </div>
  );
}

export default App;
