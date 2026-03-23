import { useQueryStore } from '../store/query-store';

export function QueryHistoryPanel() {
  const history = useQueryStore((s) => s.history);
  const savedQueries = useQueryStore((s) => s.savedQueries);
  const setEditorSql = useQueryStore((s) => s.setEditorSql);
  const removeSaved = useQueryStore((s) => s.removeSaved);
  const tab = useQueryStore((s) => s.historyTab);
  const setHistoryTab = useQueryStore((s) => s.setHistoryTab);

  const tabBtn = (id: 'history' | 'saved', label: string) => (
    <button
      type="button"
      className={`flex-1 min-w-0 px-3 py-2 rounded-lg border-2 text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-par-purple ${
        tab === id
          ? 'border-par-purple bg-par-purple text-white shadow-md'
          : 'border-par-light-purple/60 bg-white text-par-navy hover:border-par-purple/50 hover:bg-par-light-purple/25'
      }`}
      onClick={() => setHistoryTab(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2" role="tablist" aria-label="History or saved queries">
        {tabBtn('history', 'Recent history')}
        {tabBtn('saved', 'Saved queries')}
      </div>
      <p className="text-[10px] font-semibold text-par-text/55">Click any item below — SQL opens in the main editor.</p>
      {tab === 'history' ? (
        <ul className="max-h-64 overflow-y-auto space-y-2 text-xs always-show-scrollbar">
          {history.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="text-left w-full rounded-xl border-2 border-par-light-purple/40 bg-white px-3 py-2 hover:border-par-purple/50 hover:bg-par-light-purple/20 hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-par-purple"
                title={h.sql}
                onClick={() => setEditorSql(h.sql)}
              >
                <span className={`block font-bold ${h.status === 'error' ? 'text-red-600' : 'text-par-navy'}`}>
                  {new Date(h.ts).toLocaleString()}
                </span>
                <span className="block text-[10px] font-semibold text-par-text/55 mt-0.5">{h.database}</span>
              </button>
            </li>
          ))}
          {history.length === 0 && (
            <li className="rounded-xl border-2 border-dashed border-par-purple/25 px-3 py-4 text-center text-par-text/50 text-xs font-medium">
              No queries yet — run SQL from the editor.
            </li>
          )}
        </ul>
      ) : (
        <ul className="max-h-64 overflow-y-auto space-y-2 text-xs always-show-scrollbar">
          {savedQueries.map((s) => (
            <li key={s.id} className="flex items-stretch gap-1 group">
              <button
                type="button"
                className="text-left flex-1 min-w-0 rounded-xl border-2 border-par-light-purple/40 bg-white px-3 py-2 hover:border-par-purple/50 hover:bg-par-light-purple/20 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-par-purple"
                title={s.sql}
                onClick={() => setEditorSql(s.sql)}
              >
                <span className="font-bold text-par-navy block truncate">{s.title}</span>
                <span className="text-[10px] font-semibold text-par-text/55 block truncate">{s.database}</span>
              </button>
              <button
                type="button"
                className="shrink-0 px-2 rounded-lg border-2 border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 opacity-80 group-hover:opacity-100"
                title="Remove saved query"
                onClick={() => removeSaved(s.id)}
              >
                ×
              </button>
            </li>
          ))}
          {savedQueries.length === 0 && (
            <li className="rounded-xl border-2 border-dashed border-par-purple/25 px-3 py-4 text-center text-par-text/50 text-xs font-medium">
              No saved queries — use Save in the toolbar (Ctrl/Cmd+S).
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
