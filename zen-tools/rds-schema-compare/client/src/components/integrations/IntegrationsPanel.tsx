import { useState, useEffect } from 'react';
import { useComparisonStore } from '../../store/comparison-store';
import SlackSection from './SlackSection';
import ConfluenceSection from './ConfluenceSection';

const inputClass =
  'w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500';

function parseFromPath(targetPath: string): { instanceName: string; databaseName: string } {
  const normalized = targetPath.replace(/\/+$/, '');
  const parts = normalized.split('/').filter(Boolean);
  let instanceName = '';
  // Default database name to the last folder (RDS identifier)
  const databaseName = parts.length > 0 ? parts[parts.length - 1] : '';

  // Find the ancestor folder matching *-rds-* to extract instance name
  for (const part of parts) {
    const rdsIdx = part.indexOf('-rds-');
    if (rdsIdx !== -1) {
      instanceName = part.substring(0, rdsIdx);
      break;
    }
  }

  return { instanceName, databaseName };
}

export default function IntegrationsPanel() {
  const summary = useComparisonStore((s) => s.summary);
  const targetPath = useComparisonStore((s) => s.targetPath);
  const instanceName = useComparisonStore((s) => s.instanceName);
  const databaseName = useComparisonStore((s) => s.databaseName);
  const setInstanceName = useComparisonStore((s) => s.setInstanceName);
  const setDatabaseName = useComparisonStore((s) => s.setDatabaseName);
  const [expanded, setExpanded] = useState(false);

  // Auto-populate from targetPath when panel first expands
  useEffect(() => {
    if (expanded && targetPath && !instanceName && !databaseName) {
      const parsed = parseFromPath(targetPath);
      if (parsed.instanceName) setInstanceName(parsed.instanceName);
      if (parsed.databaseName) setDatabaseName(parsed.databaseName);
    }
  }, [expanded, targetPath, instanceName, databaseName, setInstanceName, setDatabaseName]);

  if (!summary) return null;

  return (
    <div className="space-y-3 border-t border-gray-800 pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-xs font-medium text-gray-400 uppercase tracking-wider"
      >
        <span>Integrations</span>
        <span className="text-gray-600">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <div className="space-y-4">
          <div className="space-y-2">
            <span className="block text-xs font-medium text-gray-500">Schema Context</span>
            <div className="space-y-1">
              <label className="block text-xs text-gray-400">Instance Name</label>
              <input
                type="text"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="Auto-parsed from target path"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-gray-400">Database Name</label>
              <input
                type="text"
                value={databaseName}
                onChange={(e) => setDatabaseName(e.target.value)}
                placeholder="Auto-parsed from target path"
                className={inputClass}
              />
            </div>
          </div>
          <SlackSection />
          <ConfluenceSection />
        </div>
      )}
    </div>
  );
}
