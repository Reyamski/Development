import { useEffect, useState } from 'react';
import { useAppStore } from '../store/app-store';
import {
  fetchThresholds, saveThresholds, fetchSchedulerConfig, saveSchedulerConfig, runSchedulerNow,
} from '../api/client';
import type { ThresholdConfig, SchedulerConfig } from '../api/types';

export function SettingsPanel() {
  const { instances } = useAppStore();
  const [thresholds, setThresholds] = useState<ThresholdConfig | null>(null);
  const [scheduler, setScheduler] = useState<SchedulerConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchThresholds().then(setThresholds).catch(() => {});
    fetchSchedulerConfig().then(setScheduler).catch(() => {});
  }, []);

  const handleSaveThresholds = async () => {
    if (!thresholds) return;
    setSaving(true);
    try {
      await saveThresholds(thresholds);
      setMessage('Thresholds saved');
      setTimeout(() => setMessage(''), 3000);
    } catch { setMessage('Failed to save'); }
    setSaving(false);
  };

  const handleSaveScheduler = async () => {
    if (!scheduler) return;
    setSaving(true);
    try {
      await saveSchedulerConfig(scheduler);
      setMessage('Scheduler config saved');
      setTimeout(() => setMessage(''), 3000);
    } catch { setMessage('Failed to save'); }
    setSaving(false);
  };

  const handleRunNow = async () => {
    setSaving(true);
    try {
      await runSchedulerNow();
      setMessage('Report generated and sent!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: unknown) { setMessage(err instanceof Error ? err.message : 'Failed'); }
    setSaving(false);
  };

  const thresholdField = (label: string, key: keyof ThresholdConfig, unit: string) => (
    <div className="flex items-center justify-between gap-2">
      <label className="text-xs text-gray-400 flex-1">{label}</label>
      <input
        type="number"
        value={thresholds?.[key] ?? ''}
        onChange={e => setThresholds(t => t ? { ...t, [key]: Number(e.target.value) } : t)}
        className="w-20 bg-gray-800 text-sm text-right rounded px-2 py-1 border border-gray-700 focus:border-emerald-500 focus:outline-none"
      />
      <span className="text-xs text-gray-600 w-8">{unit}</span>
    </div>
  );

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full max-w-2xl">
      <h2 className="text-lg font-semibold text-white">Settings</h2>

      {message && (
        <div className="text-sm rounded-lg p-3 bg-emerald-950/50 border border-emerald-800 text-emerald-400">{message}</div>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-300 border-b border-gray-800 pb-2">Alert Thresholds</h3>
        {thresholds && (
          <div className="space-y-2">
            {thresholdField('CPU Warning', 'cpuWarning', '%')}
            {thresholdField('CPU Critical', 'cpuCritical', '%')}
            {thresholdField('Memory Warning', 'memoryWarningMb', 'MB')}
            {thresholdField('Memory Critical', 'memoryCriticalMb', 'MB')}
            {thresholdField('IOPS Warning', 'iopsWarningPct', '%')}
            {thresholdField('IOPS Critical', 'iopsCriticalPct', '%')}
            {thresholdField('Queue Depth Warning', 'queueDepthWarning', '')}
            {thresholdField('Queue Depth Critical', 'queueDepthCritical', '')}
            {thresholdField('Replica Lag Warning', 'replicaLagWarning', 's')}
            {thresholdField('Replica Lag Critical', 'replicaLagCritical', 's')}
            <button onClick={handleSaveThresholds} disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm rounded px-4 py-1.5 transition-colors">
              Save Thresholds
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-300 border-b border-gray-800 pb-2">Slack & Scheduler</h3>
        {scheduler && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Slack Webhook URL</label>
              <input type="text" value={scheduler.slackWebhookUrl}
                onChange={e => setScheduler(s => s ? { ...s, slackWebhookUrl: e.target.value } : s)}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full bg-gray-800 text-sm rounded px-2 py-1.5 border border-gray-700 focus:border-emerald-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Slack Channel</label>
              <input type="text" value={scheduler.slackChannel}
                onChange={e => setScheduler(s => s ? { ...s, slackChannel: e.target.value } : s)}
                placeholder="#dba-reports"
                className="w-full bg-gray-800 text-sm rounded px-2 py-1.5 border border-gray-700 focus:border-emerald-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cron Expression</label>
              <input type="text" value={scheduler.cronExpression}
                onChange={e => setScheduler(s => s ? { ...s, cronExpression: e.target.value } : s)}
                placeholder="0 9 * * *"
                className="w-full bg-gray-800 text-sm rounded px-2 py-1.5 border border-gray-700 focus:border-emerald-500 focus:outline-none" />
              <p className="text-xs text-gray-600 mt-1">Default: 0 9 * * * (9 AM daily)</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Timezone</label>
              <input type="text" value={scheduler.timezone}
                onChange={e => setScheduler(s => s ? { ...s, timezone: e.target.value } : s)}
                placeholder="UTC"
                className="w-full bg-gray-800 text-sm rounded px-2 py-1.5 border border-gray-700 focus:border-emerald-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Groups to Report On</label>
              <p className="text-xs text-gray-600">
                {instances.length > 0
                  ? 'Scheduled reports will cover all auto-detected groups from your connected cluster.'
                  : 'Connect to a cluster to see available groups.'}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={scheduler.enabled}
                onChange={e => setScheduler(s => s ? { ...s, enabled: e.target.checked } : s)}
                className="accent-emerald-500" />
              Enable scheduled reports
            </label>
            <div className="flex gap-2">
              <button onClick={handleSaveScheduler} disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm rounded px-4 py-1.5 transition-colors">
                Save Scheduler
              </button>
              <button onClick={handleRunNow} disabled={saving}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm rounded px-4 py-1.5 transition-colors">
                Run Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
