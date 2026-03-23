import type { HealthReport, InstanceHealth } from '../api/types';
import { MetricCard } from './MetricCard';

interface ReportDetailProps {
  report: HealthReport;
}

export function ReportDetail({ report }: ReportDetailProps) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className={`w-3 h-3 rounded-full ${
            report.summary.overallStatus === 'critical' ? 'bg-red-500' :
            report.summary.overallStatus === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
          }`} />
          <h2 className="text-lg font-semibold text-white">{report.stackName}</h2>
        </div>
        <p className="text-xs text-gray-500">
          Generated: {new Date(report.generatedAt).toLocaleString()} |
          Period: {new Date(report.period.since).toLocaleString()} — {new Date(report.period.until).toLocaleString()}
        </p>
      </div>

      <div className={`rounded-lg p-4 border ${
        report.summary.overallStatus === 'critical' ? 'bg-red-950/30 border-red-800' :
        report.summary.overallStatus === 'warning' ? 'bg-amber-950/30 border-amber-800' :
        'bg-emerald-950/30 border-emerald-800'
      }`}>
        <p className="text-sm font-medium text-white capitalize mb-2">{report.summary.overallStatus}</p>
        {report.summary.highlights.map((h, i) => (
          <p key={i} className="text-xs text-gray-400">{h}</p>
        ))}
      </div>

      {report.instances.map(inst => (
        <ReportInstancePanel key={inst.instanceId} instance={inst} />
      ))}
    </div>
  );
}

function ReportInstancePanel({ instance }: { instance: InstanceHealth }) {
  const m = instance.metrics;

  return (
    <div className="rounded-lg border border-gray-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">{instance.name}</h3>
        {instance.alerts.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-400">
            {instance.alerts.length} alert(s)
          </span>
        )}
      </div>

      {instance.alerts.length > 0 && (
        <div className="space-y-1">
          {instance.alerts.map((alert, i) => (
            <div key={i} className={`text-xs px-2 py-1 rounded ${
              alert.level === 'critical' ? 'bg-red-950/50 text-red-400' : 'bg-amber-950/50 text-amber-400'
            }`}>
              {alert.message}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricCard label="CPU" value={m.cpuUtilization.avg} unit="%" max={m.cpuUtilization.max} trend={m.cpuUtilization.trend} />
        <MetricCard label="Memory" value={m.freeableMemoryMb.current} unit=" MB" min={m.freeableMemoryMb.min} trend={m.freeableMemoryMb.trend} invertTrend />
        <MetricCard label="IOPS" value={m.totalIops.avg} max={m.totalIops.max} trend={m.totalIops.trend} />
        <MetricCard label="Queue" value={m.diskQueueDepth.avg} max={m.diskQueueDepth.max} trend={m.diskQueueDepth.trend} />
        <MetricCard label="Connections" value={m.databaseConnections.avg} max={m.databaseConnections.max} trend={m.databaseConnections.trend} />
        <MetricCard label="Read Lat" value={m.readLatencyMs.avg} unit=" ms" max={m.readLatencyMs.max} trend={m.readLatencyMs.trend} />
        <MetricCard label="Write Lat" value={m.writeLatencyMs.avg} unit=" ms" max={m.writeLatencyMs.max} trend={m.writeLatencyMs.trend} />
        {m.replicaLag.max >= 0 && (
          <MetricCard label="Replica Lag" value={m.replicaLag.avg} unit=" s" max={m.replicaLag.max} trend={m.replicaLag.trend} />
        )}
      </div>
    </div>
  );
}
