import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from './store/app-store';
import { useQueryStore } from './store/query-store';
import { TeleportControls } from './components/TeleportControls';
import { SqlEditor } from './components/SqlEditor';
import { EditorToolbar } from './components/EditorToolbar';
import { ResultsGrid } from './components/ResultsGrid';
import { SchemaExplorer } from './components/SchemaExplorer';
import { QueryHistoryPanel } from './components/QueryHistoryPanel';
import { AiAssistant } from './components/AiAssistant';
import { useQueryActions } from './hooks/useQuery';

type SidebarTab = 'connection' | 'schema' | 'history';

export default function App() {
  const connectionResult = useAppStore((s) => s.connectionResult);
  const databases = connectionResult?.databases ?? [];
  const selectedDatabase = useAppStore((s) => s.selectedDatabase);
  const setSelectedDatabase = useAppStore((s) => s.setSelectedDatabase);
  const saveCurrent = useQueryStore((s) => s.saveCurrent);
  const aiPanelRequest = useQueryStore((s) => s.aiPanelRequest);

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('connection');
  const [aiOpen, setAiOpen] = useState(false);

  const { run, explain, exportCsv } = useQueryActions();

  const clearAiPanelRequest = useCallback(() => {
    useQueryStore.getState().setAiPanelRequest(null);
  }, []);

  useEffect(() => {
    if (aiPanelRequest) setAiOpen(true);
  }, [aiPanelRequest]);

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
    { id: 'connection', label: 'Connection', hint: 'Teleport & DB' },
    { id: 'schema', label: 'Schema', hint: 'Tables & columns' },
    { id: 'history', label: 'History & saved', hint: 'Past runs' },
  ];

  const tabBtn = ({ id, label, hint }: { id: SidebarTab; label: string; hint: string }) => (
    <button
      type="button"
      key={id}
      aria-current={sidebarTab === id ? 'page' : undefined}
      className={`w-full text-left rounded-xl border-2 px-3 py-2.5 transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-par-purple focus-visible:ring-offset-2 ${
        sidebarTab === id
          ? 'border-par-purple bg-par-purple text-white font-semibold shadow-md'
          : 'border-par-light-purple/60 bg-white text-par-navy font-semibold hover:border-par-purple/70 hover:bg-par-light-purple/35 active:scale-[0.99]'
      }`}
      onClick={() => setSidebarTab(id)}
    >
      <span className="block text-sm leading-tight">{label}</span>
      <span
        className={`block text-[10px] font-medium mt-0.5 ${sidebarTab === id ? 'text-white/85' : 'text-par-text/55'}`}
      >
        {hint} · click to open
      </span>
    </button>
  );

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-white to-par-light-purple/20 text-par-text">
      <header className="border-b-2 border-par-purple/30 bg-par-navy flex items-center gap-3 px-6 py-4 shrink-0 shadow-md">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-par-purple to-par-light-blue flex items-center justify-center shadow-lg ring-2 ring-white/20">
          <span className="text-white text-sm font-bold">QH</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white tracking-tight">Query Hub</h1>
          <p className="text-xs font-semibold text-par-light-blue/95 mt-0.5">
            Teleport · SQL · EXPLAIN · AI — internal DBA workspace
          </p>
        </div>
        <button
          type="button"
          className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-par-navy ${
            aiOpen
              ? 'bg-white text-par-navy border-white'
              : 'text-white border-white/40 bg-white/10 hover:bg-white/20 hover:border-white/60'
          }`}
          onClick={() => setAiOpen((o) => !o)}
        >
          {aiOpen ? 'Close AI' : 'Open AI'}
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white border-2 border-white/35 hover:bg-white/15 hover:border-white/55 transition-colors"
        >
          Refresh
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden min-h-0">
        <aside className="w-[19rem] shrink-0 border-r-2 border-par-purple/20 bg-gradient-to-b from-[#f4f3fb] to-white flex flex-col overflow-hidden shadow-inner">
          <div className="px-3 pt-3 pb-2 border-b border-par-purple/15 shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-par-navy/55 mb-2">Sidebar — pick a panel</p>
            <nav className="flex flex-col gap-2" role="tablist" aria-label="Sidebar sections">
              {tabDefs.map((t) => tabBtn(t))}
            </nav>
          </div>
          <div className="p-4 overflow-y-auto flex-1 min-h-0 always-show-scrollbar">
            {sidebarTab === 'connection' && (
              <>
                <h2 className="text-xs font-bold text-par-navy uppercase tracking-[0.12em] mb-1 pb-2 border-b-2 border-par-purple/25">
                  Teleport connection
                </h2>
                <p className="text-[10px] text-par-text/55 mb-3">Cluster, SSO, and MySQL instance below.</p>
                <TeleportControls />
              </>
            )}
            {sidebarTab === 'schema' && (
              <>
                <h2 className="text-xs font-bold text-par-navy uppercase tracking-[0.12em] mb-1 pb-2 border-b-2 border-par-purple/25">
                  Database schema
                </h2>
                <p className="text-[10px] text-par-text/55 mb-3">
                  Expand tables, click actions to load SQL into the editor.
                </p>
                <SchemaExplorer />
              </>
            )}
            {sidebarTab === 'history' && (
              <>
                <h2 className="text-xs font-bold text-par-navy uppercase tracking-[0.12em] mb-1 pb-2 border-b-2 border-par-purple/25">
                  History & saved
                </h2>
                <p className="text-[10px] text-par-text/55 mb-3">Click any row to load SQL into the editor.</p>
                <QueryHistoryPanel />
              </>
            )}
          </div>
        </aside>

        <section className="flex-1 flex flex-col min-w-0 overflow-hidden p-4 gap-3">
          {connectionResult ? (
            <>
              {databases.length > 0 && (
                <div className="flex items-center gap-3 shrink-0 flex-wrap rounded-xl border-2 border-par-purple/20 bg-par-light-purple/15 px-3 py-2">
                  <label className="text-xs font-bold text-par-navy uppercase tracking-widest">Active database</label>
                  <select
                    className="border border-par-light-purple rounded px-3 py-2 text-sm text-par-text focus:border-par-purple focus:ring-1 focus:ring-par-purple focus:outline-none min-w-[200px]"
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
              <SqlEditor onRun={() => void run()} />
              <div className="flex-1 flex flex-col min-h-0 border-t border-par-light-purple/30 pt-3">
                <ResultsGrid />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-par-text/50 px-4">
              <div className="text-center max-w-md">
                <div className="text-4xl mb-3 opacity-30">&#128193;</div>
                <p className="text-sm font-semibold text-par-navy/80">Connect to a MySQL instance</p>
                <p className="text-xs text-par-text/50 mt-1">Cluster → SSO → instance (lahat sa left sidebar)</p>
                <p className="text-[11px] text-par-text/40 mt-3 leading-relaxed">
                  Tip: ang cluster list galing sa Teleport profiles sa machine na tumatakbo ang Query Hub API (
                  <code className="bg-par-light-purple/40 px-1 rounded">~/.tsh</code>). Kung walang options sa dropdown,
                  mag-<code className="bg-par-light-purple/40 px-1 rounded">tsh login</code> doon muna.
                </p>
              </div>
            </div>
          )}
        </section>

        {aiOpen && (
          <AiAssistant
            onClose={() => setAiOpen(false)}
            panelRequest={aiPanelRequest}
            onPanelRequestConsumed={clearAiPanelRequest}
          />
        )}
      </div>
    </div>
  );
}
