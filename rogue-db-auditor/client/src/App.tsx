import { useAppStore } from './store/app-store';
import { InstancePicker } from './components/InstancePicker';
import { SummaryBar } from './components/SummaryBar';
import { UserTable } from './components/UserTable';
import { ReportExport } from './components/ReportExport';
import { runAudit } from './api/client';
import type { RiskFilter } from './store/app-store';

const FILTER_LABELS: { value: RiskFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
  { value: 'CLEAN', label: 'Clean' },
];

const FILTER_ACTIVE: Record<string, string> = {
  ALL:    'bg-blue-600 border-blue-600 text-white',
  HIGH:   'bg-red-500/10 border-red-500/30 text-red-400',
  MEDIUM: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  LOW:    'bg-blue-500/10 border-blue-500/30 text-blue-400',
  CLEAN:  'bg-green-500/10 border-green-500/30 text-green-400',
};

export default function App() {
  const {
    selectedInstance,
    selectedCluster,
    auditResult,
    auditing,
    auditError,
    setAuditResult,
    setAuditing,
    setAuditError,
    riskFilter,
    setRiskFilter,
    searchQuery,
    setSearchQuery,
  } = useAppStore();

  async function handleRunAudit() {
    if (!selectedInstance) return;
    setAuditing(true);
    setAuditError('');
    try {
      const result = await runAudit(selectedInstance, selectedCluster || undefined);
      setAuditResult(result);
    } catch (err: any) {
      setAuditError(err.message);
    } finally {
      setAuditing(false);
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">

      {/* ── Header ── */}
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4 shrink-0">
        <div className="flex items-center gap-4">
          {/* Logo mark */}
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>

          {/* Title */}
          <div className="shrink-0">
            <h1 className="text-base font-semibold text-gray-100 leading-tight">Rogue DB Auditor</h1>
            <p className="text-xs text-gray-500">Detect overprivileged MySQL users</p>
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-gray-800 shrink-0"></div>

          {/* Instance picker (inline) */}
          <div className="flex-1 min-w-0">
            <InstancePicker />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRunAudit}
              disabled={!selectedInstance || auditing}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              {auditing ? (
                <>
                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full"></span>
                  Running...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                  </svg>
                  Run Audit
                </>
              )}
            </button>

            <ReportExport />
          </div>
        </div>
      </header>

      {/* ── Error banner ── */}
      {auditError && (
        <div className="shrink-0 flex items-start gap-3 bg-red-500/10 border-b border-red-500/30 px-6 py-3">
          <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-400">Audit failed</p>
            <p className="text-xs text-red-400/80 mt-0.5">{auditError}</p>
          </div>
        </div>
      )}

      {/* ── Summary bar ── */}
      {auditResult && <SummaryBar />}

      {/* ── Filter + search bar ── */}
      {auditResult && (
        <div className="shrink-0 flex items-center gap-3 px-6 py-3 border-b border-gray-800 bg-gray-950">
          {/* Risk filter toggles */}
          <div className="flex items-center gap-1">
            {FILTER_LABELS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setRiskFilter(value)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors
                  ${riskFilter === value
                    ? FILTER_ACTIVE[value]
                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative ml-2">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z" />
            </svg>
            <input
              type="text"
              placeholder="Search user..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-gray-900 border border-gray-800 rounded-lg pl-8 pr-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 w-52 transition-colors"
            />
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto">

        {/* Loading state */}
        {auditing && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="relative w-12 h-12 mx-auto mb-4">
                <div className="animate-spin w-12 h-12 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                <div className="absolute inset-2 rounded-full bg-gray-950"></div>
              </div>
              <p className="text-sm font-medium text-gray-300">Auditing users...</p>
              <p className="text-xs text-gray-600 mt-1">Querying mysql.user and running SHOW GRANTS</p>
            </div>
          </div>
        )}

        {/* Results table */}
        {!auditing && auditResult && <UserTable />}

        {/* Empty / initial state */}
        {!auditing && !auditResult && !auditError && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-400">No audit run yet</p>
              <p className="text-xs text-gray-600 mt-1.5">
                Select a cluster and instance, then click Run Audit.<br />
                Detects SUPER, ALL PRIVILEGES, FILE, wildcard hosts, and more.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
