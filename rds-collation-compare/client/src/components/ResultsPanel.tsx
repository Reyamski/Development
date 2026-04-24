import { useMemo } from 'react';
import { useAppStore } from '../store/app-store';
import { scanCollations, downloadCollationExcel } from '../api/client';

export function ResultsPanel() {
  const {
    connectionResult,
    selectedDatabases,
    baseline,
    setBaseline,
    isAnalyzing,
    setIsAnalyzing,
    analysisResults,
    setAnalysisResults,
    analysisError,
    setAnalysisError,
    isDownloading,
    setIsDownloading,
  } = useAppStore();

  async function handleScan() {
    if (!connectionResult || selectedDatabases.length === 0) {
      setAnalysisError('Select at least one database in the sidebar');
      return;
    }
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const results = await scanCollations(
        connectionResult.instance,
        selectedDatabases,
        baseline,
      );
      setAnalysisResults(results);
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : 'Failed to analyze collations');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleDownload() {
    if (!analysisResults) return;
    setIsDownloading(true);
    setAnalysisError(null);
    try {
      await downloadCollationExcel(analysisResults);
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : 'Failed to download Excel');
    } finally {
      setIsDownloading(false);
    }
  }

  const mismatchRows = useMemo(() => {
    if (!analysisResults) return [];
    return analysisResults.collations.filter((c) =>
      c.characterSet !== analysisResults.baseline.characterSet ||
      c.collation !== analysisResults.baseline.collation,
    );
  }, [analysisResults]);

  const connected = !!connectionResult?.connected;

  if (!connected) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400">
        <div className="text-center">
          <p className="text-sm">Connect to an instance to start</p>
          <p className="text-xs mt-1">Select a cluster, instance, and databases from the sidebar</p>
        </div>
      </div>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return 'text-red-700 bg-red-50 border-red-200';
      case 'MEDIUM': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'LOW': return 'text-blue-700 bg-blue-50 border-blue-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header + actions */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Collation Analysis</h2>
          <p className="text-xs text-slate-500">
            {connectionResult!.instance} · {selectedDatabases.length} database{selectedDatabases.length !== 1 ? 's' : ''} selected
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleScan}
            disabled={isAnalyzing || selectedDatabases.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            {isAnalyzing ? 'Fetching…' : analysisResults ? 'Re-scan' : 'Fetch Collations'}
          </button>
          {analysisResults && (
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              {isDownloading ? 'Building…' : 'Download Excel'}
            </button>
          )}
        </div>
      </div>

      {/* Baseline inputs */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Baseline (mark as mismatch if different)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Character set</label>
            <input
              type="text"
              value={baseline.characterSet}
              onChange={(e) => setBaseline({ ...baseline, characterSet: e.target.value })}
              disabled={isAnalyzing}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Collation</label>
            <input
              type="text"
              value={baseline.collation}
              onChange={(e) => setBaseline({ ...baseline, collation: e.target.value })}
              disabled={isAnalyzing}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>
      </div>

      {analysisError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {analysisError}
        </div>
      )}

      {!analysisResults && !isAnalyzing && (
        <div className="text-center py-16 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
          Click <span className="font-semibold text-slate-600">Fetch Collations</span> to analyze the selected databases
        </div>
      )}

      {analysisResults && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Databases</p>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {new Set(analysisResults.collations.filter(c => c.level === 'database').map(c => c.database)).size}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Tables</p>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {analysisResults.collations.filter(c => c.level === 'table').length}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Columns</p>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {analysisResults.collations.filter(c => c.level === 'column').length}
              </p>
            </div>
            <div className={`rounded-lg border p-3 ${mismatchRows.length > 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <p className="text-[10px] uppercase font-semibold text-slate-500">Mismatches</p>
              <p className={`text-xl font-bold mt-1 ${mismatchRows.length > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {mismatchRows.length}
              </p>
            </div>
          </div>

          {/* Issues preview (auto-analyze) */}
          {analysisResults.issues.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  Mismatches vs baseline
                  <span className="ml-2 text-[11px] font-normal text-slate-500 font-mono">
                    {analysisResults.baseline.characterSet} / {analysisResults.baseline.collation}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">Full list in Excel export</p>
              </div>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {analysisResults.issues.slice(0, 50).map((issue, i) => (
                  <div key={i} className={`rounded border px-3 py-2 text-xs ${getSeverityColor(issue.severity)}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold uppercase">{issue.severity}</span>
                      <span className="text-[10px] opacity-60">·</span>
                      <span className="text-[10px] font-medium">{issue.level}</span>
                    </div>
                    <p className="font-mono text-[11px]">
                      {issue.database}
                      {issue.table && ` › ${issue.table}`}
                      {issue.column && ` › ${issue.column}`}
                    </p>
                    <p className="mt-1 text-[11px]">
                      <span className="font-semibold">{issue.currentCharset}/{issue.currentCollation}</span>
                      <span className="mx-1 opacity-60">→</span>
                      <span className="opacity-80">{issue.expectedCharset}/{issue.expectedCollation}</span>
                    </p>
                  </div>
                ))}
                {analysisResults.issues.length > 50 && (
                  <div className="text-center text-[11px] text-slate-500 py-2">
                    Showing first 50 of {analysisResults.issues.length} — download Excel for full list
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-emerald-700 font-semibold text-sm">All collations match baseline</p>
              <p className="text-xs text-emerald-600 mt-1">
                {analysisResults.baseline.characterSet} / {analysisResults.baseline.collation}
              </p>
            </div>
          )}

          {/* Preview table */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Collation Preview</h3>
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Level</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Database</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Table</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Column</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Charset</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Collation</th>
                  </tr>
                </thead>
                <tbody>
                  {analysisResults.collations.slice(0, 100).map((col, i) => {
                    const mismatch = col.characterSet !== analysisResults.baseline.characterSet
                      || col.collation !== analysisResults.baseline.collation;
                    return (
                      <tr
                        key={i}
                        className={`border-b border-slate-100 ${mismatch ? 'bg-red-50' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            col.level === 'database' ? 'bg-purple-100 text-purple-700' :
                            col.level === 'table' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {col.level}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono">{col.database}</td>
                        <td className="px-3 py-2 font-mono text-slate-600">{col.table || '-'}</td>
                        <td className="px-3 py-2 font-mono text-slate-500">{col.column || '-'}</td>
                        <td className={`px-3 py-2 font-mono ${mismatch ? 'font-bold text-red-700' : 'text-slate-600'}`}>
                          {col.characterSet}
                        </td>
                        <td className={`px-3 py-2 font-mono ${mismatch ? 'font-bold text-red-700' : ''}`}>
                          {col.collation}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {analysisResults.collations.length > 100 && (
                <div className="px-3 py-2 bg-slate-50 text-xs text-slate-500 text-center">
                  Showing first 100 of {analysisResults.collations.length} — download Excel for full data
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
