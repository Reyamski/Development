import { useEffect, useState, useMemo } from 'react';
import { useAppStore, groupInstances } from '../store/app-store';
import { useHealth } from '../hooks/useHealth';
import { MetricCard } from './MetricCard';
import type { InstanceHealth } from '../api/types';

export function HealthDashboard() {
  const {
    selectedGroupId, instances, healthInstances, healthSummary, healthLoading, healthError,
  } = useAppStore();
  const { loadHealth, generateAndSendReport } = useHealth();
  const [generating, setGenerating] = useState(false);
  const [reportResult, setReportResult] = useState<{ slackSent: boolean; slackError?: string } | null>(null);

  const groups = useMemo(() => groupInstances(instances), [instances]);
  const currentGroup = groups.find(g => g.id === selectedGroupId);

  useEffect(() => {
    if (selectedGroupId) loadHealth(selectedGroupId);
  }, [selectedGroupId]);

  const handleGenerate = async () => {
    if (!selectedGroupId) return;
    setGenerating(true);
    setReportResult(null);
    const result = await generateAndSendReport(selectedGroupId);
    if (result) setReportResult({ slackSent: result.slackSent, slackError: result.slackError });
    setGenerating(false);
  };

  if (!selectedGroupId || !currentGroup) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600">
        <div className="text-center">
          <div className="text-4xl mb-3 opacity-30">&#128202;</div>
          <p className="text-sm">Select a group to view health metrics</p>
          <p className="text-xs text-gray-700 mt-1">Groups are auto-detected from your RDS instances</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{currentGroup.name}</h2>
          <p className="text-xs text-gray-500">Last 24 hours &middot; {currentGroup.instances.length} instance(s)</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadHealth(selectedGroupId)}
            disabled={healthLoading}
            className="text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || healthLoading}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm rounded-lg px-4 py-2 transition-colors"
          >
            {generating ? 'Generating...' : 'Generate & Share Report'}
          </button>
        </div>
      </div>

      {reportResult && (
        <div className={`text-sm rounded-lg p-3 ${reportResult.slackSent ? 'bg-emerald-950/50 border border-emerald-800 text-emerald-400' : 'bg-amber-950/50 border border-amber-800 text-amber-400'}`}>
          {reportResult.slackSent ? 'Report generated and sent to Slack!' : `Report saved. ${reportResult.slackError || 'Slack not configured.'}`}
        </div>
      )}

      {healthSummary && (
        <div className={`rounded-lg p-4 border ${
          healthSummary.overallStatus === 'critical' ? 'bg-red-950/30 border-red-800' :
          healthSummary.overallStatus === 'warning' ? 'bg-amber-950/30 border-amber-800' :
          'bg-emerald-950/30 border-emerald-800'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-3 h-3 rounded-full ${
              healthSummary.overallStatus === 'critical' ? 'bg-red-500' :
              healthSummary.overallStatus === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
            }`} />
            <span className="text-sm font-medium text-white capitalize">{healthSummary.overallStatus}</span>
            {healthSummary.totalAlerts > 0 && (
              <span className="text-xs text-gray-400">
                ({healthSummary.criticalAlerts} critical, {healthSummary.warningAlerts} warnings)
              </span>
            )}
          </div>
          {healthSummary.highlights.map((h, i) => (
            <p key={i} className="text-xs text-gray-400 ml-5">{h}</p>
          ))}
        </div>
      )}

      {healthError && <p className="text-sm text-red-400">{healthError}</p>}
      {healthLoading && <p className="text-sm text-gray-400 animate-pulse">Loading health data...</p>}

      {healthInstances.map(inst => (
        <InstancePanel key={inst.instanceId} instance={inst} />
      ))}
    </div>
  );
}

function InstancePanel({ instance }: { instance: InstanceHealth }) {
  const m = instance.metrics;
  const hasAlerts = instance.alerts.length > 0;

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${
      hasAlerts ? 'border-amber-800/50 bg-gray-900/50' : 'border-gray-800 bg-gray-900/30'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-white">{instance.name}</h3>
          {instance.rdsConfig && (
            <span className="text-xs text-gray-500">
              {instance.rdsConfig.instanceClass} | {instance.rdsConfig.storageType}
              {instance.rdsConfig.provisionedIops > 0 ? ` | ${instance.rdsConfig.provisionedIops} IOPS` : ''}
            </span>
          )}
        </div>
        {hasAlerts && (
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
