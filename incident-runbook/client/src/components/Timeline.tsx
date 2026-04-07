import type { TimelineEntry } from '../api/types.js';

const ACTION_STYLES: Record<string, { color: string; border: string; label: string }> = {
  RAN_DIAGNOSTIC:     { color: 'text-blue-400',  border: 'border-blue-400',  label: 'DIAGNOSTIC' },
  KILLED_CONNECTION:  { color: 'text-red-400',   border: 'border-red-400',   label: 'KILLED CONNECTION' },
  KILLED_QUERY:       { color: 'text-red-400',   border: 'border-red-400',   label: 'KILLED QUERY' },
  RESOLVED:           { color: 'text-green-400', border: 'border-green-400', label: 'RESOLVED' },
  CREATED:            { color: 'text-gray-500',  border: 'border-gray-500',  label: 'CREATED' },
  NOTE:               { color: 'text-gray-400',  border: 'border-gray-600',  label: 'NOTE' },
};

const FALLBACK_STYLE = { color: 'text-gray-300', border: 'border-gray-700', label: '' };

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour12: false });
  } catch {
    return ts;
  }
}

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg flex flex-col items-center justify-center py-10 gap-2">
        <span className="text-2xl opacity-20">📋</span>
        <p className="text-xs text-gray-600 text-center">No timeline entries yet.<br />Run a diagnostic to start.</p>
      </div>
    );
  }

  // Reverse-chronological order
  const sorted = [...entries].reverse();

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      <div className="divide-y divide-gray-800">
        {sorted.map((entry, idx) => {
          const style = ACTION_STYLES[entry.action] ?? FALLBACK_STYLE;
          const displayLabel = style.label || entry.action.replace(/_/g, ' ');
          return (
            <div key={idx} className={`flex gap-4 px-4 py-3 border-l-2 hover:bg-gray-800/40 transition-colors ${style.border}`}>
              {/* Timestamp */}
              <span className="text-gray-500 whitespace-nowrap font-mono text-xs pt-0.5 w-20 shrink-0">
                {formatTs(entry.ts)}
              </span>
              {/* Actor */}
              <span className="text-gray-400 text-xs w-20 shrink-0 truncate pt-0.5" title={entry.actor}>
                {entry.actor}
              </span>
              {/* Action badge */}
              <span className={`text-xs font-semibold tracking-wide w-36 shrink-0 pt-0.5 ${style.color}`}>
                {displayLabel}
              </span>
              {/* Detail */}
              <span className="text-gray-300 text-xs break-words min-w-0 leading-relaxed">
                {entry.detail}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
