import { useState } from 'react';

interface RawQueriesPanelProps {
  queries: string[];
}

export function RawQueriesPanel({ queries }: RawQueriesPanelProps) {
  const [open, setOpen] = useState(false);

  if (!queries || queries.length === 0) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800/60 transition-colors group"
      >
        <span className="text-sm font-medium text-gray-400 flex items-center gap-2">
          <span className="text-gray-600 group-hover:text-gray-400 transition-colors text-xs">
            {open ? '▼' : '▶'}
          </span>
          Raw Queries
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-800 text-gray-500 text-xs font-mono">
            {queries.length}
          </span>
        </span>
        <span className="text-xs text-gray-600 group-hover:text-gray-500 transition-colors">
          transparency
        </span>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-gray-800 px-4 py-4 space-y-4">
          {queries.map((q, i) => (
            <div key={i}>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                Query {i + 1}
              </p>
              <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {q}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
