import { useAppStore } from './store/app-store';
import { TeleportControls } from './components/TeleportControls';
import { LagView } from './components/LagView';
import { RootCauseAnalysis } from './components/RootCauseAnalysis';

export default function App() {
  const connectionResult = useAppStore((s) => s.connectionResult);

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950 flex items-center gap-3 px-6 py-4">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
          <span className="text-white text-sm font-bold">RL</span>
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">RDS Replica Lag</h1>
          <p className="text-xs text-slate-500">Track and investigate replication lag on RDS MySQL replicas</p>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 shrink-0 border-r border-slate-800 bg-slate-900 flex flex-col overflow-y-auto">
          <div className="p-4 space-y-4">
            <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Connection
            </h2>
            <TeleportControls />
            <RootCauseAnalysis />
          </div>
        </aside>

        {/* Main area */}
        <section className="flex-1 overflow-hidden flex flex-col">
          {connectionResult ? (
            <LagView />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center">
                <div className="text-4xl mb-3 opacity-30">&#9203;</div>
                <p className="text-sm">Connect to a replica to get started</p>
                <p className="text-xs text-slate-600 mt-1">Select a cluster and instance from the sidebar</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
