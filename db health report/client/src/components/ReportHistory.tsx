import { useEffect } from 'react';
import { useAppStore } from '../store/app-store';
import { fetchReports } from '../api/client';
import { ReportDetail } from './ReportDetail';

export function ReportHistory() {
  const { reports, reportsLoading, selectedReport, setSelectedReport, setReports, setReportsLoading } = useAppStore();

  useEffect(() => {
    setReportsLoading(true);
    fetchReports(undefined, 50)
      .then(({ reports }) => setReports(reports))
      .catch(() => {})
      .finally(() => setReportsLoading(false));
  }, []);

  if (selectedReport) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="p-4 border-b border-gray-800">
          <button onClick={() => setSelectedReport(null)} className="text-sm text-emerald-400 hover:text-emerald-300">
            &larr; Back to Reports
          </button>
        </div>
        <ReportDetail report={selectedReport} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full">
      <h2 className="text-lg font-semibold text-white">Report History</h2>

      {reportsLoading && <p className="text-sm text-gray-400 animate-pulse">Loading reports...</p>}

      {reports.length === 0 && !reportsLoading && (
        <p className="text-sm text-gray-600">No reports generated yet. Use the Health tab to generate a report.</p>
      )}

      <div className="space-y-2">
        {reports.map(report => (
          <button
            key={report.id}
            onClick={() => setSelectedReport(report)}
            className="w-full text-left p-3 rounded-lg border border-gray-800 hover:border-gray-700 hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  report.summary.overallStatus === 'critical' ? 'bg-red-500' :
                  report.summary.overallStatus === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                }`} />
                <span className="text-sm text-white">{report.stackName}</span>
              </div>
              <span className="text-xs text-gray-500">{new Date(report.generatedAt).toLocaleString()}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1 ml-4.5">
              {report.instances.length} instance(s) |
              {report.summary.criticalAlerts > 0 && ` ${report.summary.criticalAlerts} critical |`}
              {report.summary.warningAlerts > 0 && ` ${report.summary.warningAlerts} warnings |`}
              {report.summary.overallStatus === 'healthy' && ' All healthy'}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
