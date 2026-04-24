import { useAppStore } from './store/app-store';
import { TeleportControls } from './components/TeleportControls';
import { IopsView } from './components/IopsView';
import { RootCauseAnalysis } from './components/RootCauseAnalysis';
import { ParameterGroupPanel } from './components/ParameterGroupPanel';

export default function App() {
  const connectionResult = useAppStore((s) => s.connectionResult);

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950 flex items-center gap-3 px-6 py-4">
        <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
          <span className="text-white text-sm font-bold">IO</span>
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">RDS IOP Killer</h1>
          <p className="text-xs text-gray-500">Connect to RDS MySQL instances via Teleport</p>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col overflow-y-auto">
          <div className="p-4 space-y-4">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Connection
            </h2>
            <TeleportControls />
            <ParameterGroupPanel />
            <RootCauseAnalysis />
          </div>
        </aside>

        {/* Main area — chart + tabs only after Teleport connects to an RDS instance */}
        <section className="flex-1 overflow-hidden flex flex-col bg-gray-950">
          {connectionResult ? (
            <IopsView />
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="max-w-md rounded-xl border border-gray-700 bg-gray-900/80 px-8 py-10 text-center shadow-lg">
                <div className="text-3xl mb-4" aria-hidden>
                  📊
                </div>
                <p className="text-base font-medium text-gray-200">
                  IOPS chart &amp; analysis dito lalabas
                </p>
                <p className="text-sm text-gray-400 mt-3 leading-relaxed">
                  Sa sidebar: <span className="text-gray-300">Login via SSO</span> → pumili ng{' '}
                  <span className="text-gray-300">RDS instance</span> (auto-connect). Pag connected na, maglo-load ang CloudWatch chart at tabs.
                </p>
                <p className="text-xs text-gray-500 mt-4 border-t border-gray-800 pt-4">
                  Kung naka-login ka na pero walang instance list, i-refresh ang page o i-check ang Teleport DB access.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
