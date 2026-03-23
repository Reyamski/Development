import { useAppStore } from './store/app-store';
import { TeleportControls } from './components/TeleportControls';
import { StackSelector } from './components/StackSelector';
import { HealthDashboard } from './components/HealthDashboard';
import { TableSizesView } from './components/TableSizesView';
import { ReportHistory } from './components/ReportHistory';
import { SettingsPanel } from './components/SettingsPanel';
import type { TabId } from './api/types';

const TABS: { id: TabId; label: string }[] = [
  { id: 'health', label: 'Health' },
  { id: 'table-sizes', label: 'Table Sizes' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const { activeTab, setActiveTab } = useAppStore();

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-950 flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">DB</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">DB Health Report</h1>
            <p className="text-xs text-gray-500">Database health monitoring & table size tracker</p>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-emerald-600/20 text-emerald-400 font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col overflow-y-auto">
          <div className="p-4 space-y-6">
            <div>
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Connection</h2>
              <TeleportControls />
            </div>
            {activeTab === 'health' && <StackSelector />}
          </div>
        </aside>

        <section className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'health' && <HealthDashboard />}
          {activeTab === 'table-sizes' && <TableSizesView />}
          {activeTab === 'reports' && <ReportHistory />}
          {activeTab === 'settings' && <SettingsPanel />}
        </section>
      </div>
    </div>
  );
}
