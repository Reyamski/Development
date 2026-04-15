import { useAppStore } from './store/app-store';
import { ConnectionPanel } from './components/ConnectionPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { runAnalysis } from './api/client';

export default function App() {
  const connectionResult = useAppStore((s) => s.connectionResult);
  const selectedDatabase = useAppStore((s) => s.selectedDatabase);
  const selectedInstance = useAppStore((s) => s.selectedInstance);
  const isAnalyzing = useAppStore((s) => s.isAnalyzing);
  const analysisResults = useAppStore((s) => s.analysisResults);
  const analysisError = useAppStore((s) => s.analysisError);
  const setIsAnalyzing = useAppStore((s) => s.setIsAnalyzing);
  const setAnalysisResults = useAppStore((s) => s.setAnalysisResults);
  const setAnalysisError = useAppStore((s) => s.setAnalysisError);

  async function handleRunAnalysis() {
    if (!selectedDatabase) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const results = await runAnalysis(selectedDatabase, selectedInstance);
      setAnalysisResults(results);
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-gradient-to-b from-[#f6f5fb] via-white to-[#fbfafd] text-slate-800">
      <header className="shrink-0 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-sm">
        <div className="flex items-center gap-3 px-6 py-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow ring-2 ring-white/15">
            <span className="text-xs font-extrabold tracking-tight text-white">IX</span>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">RDS Index Watchdog</h1>
            <p className="text-[11px] font-medium text-white/60">Read-only index analysis - MySQL - Teleport</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              Read-only
            </span>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-slate-50/80">
          <div className="p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Connection</p>
            <ConnectionPanel />
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-5">
          {!connectionResult ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="max-w-sm rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-2xl">
                  DI
                </div>
                <p className="font-bold text-slate-800">Connect to MySQL</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Select a Teleport cluster, authenticate, pick an RDS instance and database, then run analysis.
                </p>
              </div>
            </div>
          ) : !analysisResults && !isAnalyzing ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <p className="mb-1 font-medium text-slate-600">
                  Connected to <span className="font-bold text-slate-800">{selectedDatabase}</span>
                </p>
                <p className="mb-6 text-sm text-slate-400">Ready to analyze indexes</p>
                <button
                  onClick={handleRunAnalysis}
                  className="rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white shadow transition-colors hover:bg-violet-700"
                >
                  Run Analysis
                </button>
                {analysisError && <p className="mt-3 text-sm text-red-600">{analysisError}</p>}
              </div>
            </div>
          ) : isAnalyzing ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
                <p className="font-medium text-slate-600">Analyzing indexes...</p>
                <p className="mt-1 text-sm text-slate-400">Querying performance_schema and information_schema</p>
              </div>
            </div>
          ) : (
            <ResultsPanel
              results={analysisResults!}
              instance={connectionResult.instance}
              onReanalyze={handleRunAnalysis}
            />
          )}
        </main>
      </div>
    </div>
  );
}
