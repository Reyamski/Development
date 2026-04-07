import { useState } from 'react';
import { useAppStore } from '../store/app-store';
import { downloadReport } from '../api/client';

export function ReportExport() {
  const { auditResult } = useAppStore();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  if (!auditResult) return null;

  async function handleExport() {
    if (!auditResult) return;
    setExporting(true);
    setExportError('');
    try {
      await downloadReport(auditResult);
    } catch (err: any) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExport}
        disabled={exporting}
        className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm border border-gray-700 rounded-lg px-4 py-2 disabled:opacity-50 transition-colors flex items-center gap-2"
      >
        {exporting ? (
          <>
            <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full"></span>
            Generating...
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </>
        )}
      </button>
      {exportError && (
        <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">{exportError}</span>
      )}
    </div>
  );
}
