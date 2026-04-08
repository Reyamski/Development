import { useEffect, useState } from 'react';
import { useAppStore } from './store/app-store';
import { useQueryStore } from './store/query-store';
import { useWorkspaceStore } from './store/workspace-store';
import { TeleportControls } from './components/TeleportControls';
import { SqlEditor } from './components/SqlEditor';
import { EditorToolbar } from './components/EditorToolbar';
import { ResultsGrid } from './components/ResultsGrid';
import { QueryHistoryPanel } from './components/QueryHistoryPanel';
import { WorkspaceTabBar } from './components/WorkspaceTabBar';
import { HeaderSchemaMenu } from './components/HeaderSchemaMenu';
import { useQueryActions } from './hooks/useQuery';

type SidebarTab = 'connection' | 'history';

export default function App() {
  const connectionResult = useAppStore((s) => s.connectionResult);
  const selectedInstance = useAppStore((s) => s.selectedInstance);
  const databases = connectionResult?.databases ?? [];
  const selectedDatabase = useAppStore((s) => s.selectedDatabase);
  const setSelectedDatabase = useAppStore((s) => s.setSelectedDatabase);
  const saveCurrent = useQueryStore((s) => s.saveCurrent);
  const captureWorkspace = useWorkspaceStore((s) => s.captureActiveTabFromStores);
  const renameActiveTab = useWorkspaceStore((s) => s.renameActiveTab);

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('connection');

  const { run, explain, exportCsv } = useQueryActions();

  useEffect(() => {
    useWorkspaceStore.getState().bootstrapFromStores();
  }, []);

  useEffect(() => {
    if (selectedInstance && connectionResult?.connected) {
      renameActiveTab(selectedInstance);
      captureWorkspace();
    }
  }, [selectedInstance, connectionResult?.connected, renameActiveTab, captureWorkspace]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (connectionResult && selectedDatabase) void run();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (connectionResult && selectedDatabase) {
          const title = window.prompt('Save query as…', 'My query');
          if (title?.trim()) saveCurrent(title.trim(), selectedDatabase);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [connectionResult, selectedDatabase, run, saveCurrent]);

  const tabDefs: { id: SidebarTab; label: string; hint: string }[] = [
    { id: 'connection', label: 'Connection', hint: 'Cluster & MySQL' },
    { id: 'history', label: 'History', hint: 'Runs & saved' },
  ];

  const tabBtn = ({ id, label, hint }: { id: SidebarTab; label: string; hint: string }) => (
    <button
      type="button"
      key={id}
      aria-current={sidebarTab === id ? 'page' : undefined}
      className={`w-full text-left rounded-xl px-3 py-2.5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-par-purple focus-visible:ring-offset-2 focus-visible:ring-offset-[#ebe9f5] ${
        sidebarTab === id
          ? 'bg-white text-par-navy shadow-qh-sm ring-1 ring-par-purple/15 font-semibold'
          : 'text-par-navy/75 hover:bg-white/60 hover:text-par-navy font-medium'
      }`}
      onClick={() => setSidebarTab(id)}
    >
      <span className="block text-sm leading-tight">{label}</span>
      <span
        className={`block text-[10px] mt-0.5 ${sidebarTab === id ? 'text-par-text/50 font-medium' : 'text-par-text/40'}`}
      >
        {hint}
      </span>
    </button>
  );

  return (
    <div className="h-screen flex flex-col min-h-0 bg-gradient-to-b from-[#f6f5fb] via-white to-[#fbfafd] text-par-text">
      <header className="border-b border-par-purple/20 bg-gradient-to-r from-par-navy via-[#363a5c] to-par-navy shrink-0 shadow-qh-sm flex flex-col">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3.5 flex-wrap">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-par-purple to-[#524fc4] flex items-center justify-center shadow-qh ring-2 ring-white/15 shrink-0">
            <span className="text-white text-sm font-extrabold tracking-tight">QH</span>
          </div>
          <div className="min-w-0 shrink">
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">Query Hub</h1>
            <p className="text-[10px] sm:text-[11px] font-medium text-white/65 mt-0.5 leading-snug">
              Teleport · SQL · EXPLAIN · CSV
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
            <HeaderSchemaMenu />
            <span
              className="inline-flex items-center px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-[0.14em] text-white/90 bg-white/[0.08] border border-white/20 backdrop-blur-sm"
              title="In-app assistant is planned for a future release"
            >
              AI · Soon
            </span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold text-white border border-white/30 bg-white/[0.06] hover:bg-white/[0.12] hover:border-white/45 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-par-navy"
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 sm:px-6 py-2.5 border-t border-white/[0.08] bg-black/10">
          <WorkspaceTabBar />
          <p className="text-[9px] text-white/38 ml-auto max-w-[15rem] leading-snug hidden lg:block text-right font-medium">
            Each tab has its own SQL and results. One DB session on the API — switching tabs reconnects.
          </p>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden min-h-0">
        <aside className="w-[19rem] shrink-0 border-r border-par-purple/10 bg-[#ebe9f5]/80 flex flex-col overflow-hidden">
          <div className="px-3 pt-3 pb-2 shrink-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-par-navy/40 mb-2 px-1">Workspace</p>
            <div className="p-1 rounded-2xl bg-par-light-purple/50 border border-par-purple/10 shadow-qh-inset">
              <nav className="flex flex-col gap-1" role="tablist" aria-label="Sidebar">
                {tabDefs.map((t) => tabBtn(t))}
              </nav>
            </div>
          </div>
          <div className="px-3 pb-3 pt-1 overflow-y-auto flex-1 min-h-0 always-show-scrollbar">
            {sidebarTab === 'connection' && (
              <>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] mb-3 px-1 text-par-navy/65">
                  Teleport
                </h2>
                <TeleportControls />
              </>
            )}
            {sidebarTab === 'history' && (
              <>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] mb-2 px-1 text-par-navy/65">
                  History & saved
                </h2>
                <QueryHistoryPanel />
              </>
            )}
          </div>
        </aside>

        <section className="flex-1 flex flex-col min-w-0 overflow-hidden p-3 sm:p-5 min-h-0">
          {connectionResult ? (
            <div className="flex flex-col flex-1 min-h-0 gap-3 sm:gap-4">
              {databases.length > 0 && (
                <div className="flex items-center gap-3 shrink-0 flex-wrap rounded-2xl border border-par-purple/15 bg-white/90 shadow-qh-sm px-4 py-3">
                  <label className="text-[11px] font-bold text-par-navy uppercase tracking-widest text-par-navy/80">
                    Database
                  </label>
                  <select
                    className="rounded-xl border border-par-light-purple bg-white shadow-qh-inset px-3 py-2 text-sm text-par-text min-w-[200px] focus:outline-none focus:ring-2 focus:ring-par-purple/30 focus:border-par-purple transition-shadow"
                    value={selectedDatabase}
                    onChange={(e) => setSelectedDatabase(e.target.value)}
                  >
                    {databases.map((db) => (
                      <option key={db} value={db}>
                        {db}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-col flex-1 min-h-0 rounded-2xl border border-par-light-purple/50 bg-white shadow-qh overflow-hidden">
                <div className="shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 pb-2 border-b border-par-light-purple/25 bg-gradient-to-b from-white to-par-light-purple/[0.12]">
                  <EditorToolbar
                    databaseReady={!!selectedDatabase}
                    onRun={() => void run()}
                    onExplain={() => void explain()}
                    onExport={() => void exportCsv()}
                    onSave={() => {
                      const title = window.prompt('Save query as…', 'My query');
                      if (title?.trim() && selectedDatabase) saveCurrent(title.trim(), selectedDatabase);
                    }}
                  />
                </div>
                <div className="shrink-0 px-3 sm:px-4 pb-1 min-h-0">
                  <SqlEditor onRun={() => void run()} />
                </div>
                <div className="flex flex-1 flex-col min-h-0 overflow-hidden border-t border-par-light-purple/20 bg-[#faf9fd]/90 px-3 sm:px-4 py-3 sm:py-4">
                  <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
                    <ResultsGrid />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 min-h-0">
              <div className="text-center max-w-sm rounded-2xl border border-par-light-purple/40 bg-white/80 shadow-qh-sm px-8 py-10">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-par-light-purple/50 text-2xl shadow-qh-inset">
                  <span className="opacity-80" aria-hidden>
                    ◇
                  </span>
                </div>
                <p className="text-base font-bold text-par-navy tracking-tight">Connect to MySQL</p>
                <p className="text-xs text-par-text/55 mt-3 leading-relaxed">
                  In the sidebar, choose a cluster, complete SSO, then pick a database instance. Cluster list comes from{' '}
                  <code className="rounded-md bg-par-light-purple/60 px-1.5 py-0.5 text-[11px] font-medium text-par-navy/90">
                    tsh
                  </code>{' '}
                  on the API host — run{' '}
                  <code className="rounded-md bg-par-light-purple/60 px-1.5 py-0.5 text-[11px] font-medium text-par-navy/90">
                    tsh login
                  </code>{' '}
                  there if the list is empty.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
