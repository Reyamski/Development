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
      className={`flex-1 min-w-0 px-3 py-2 rounded-xl text-[11px] font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-par-purple focus-visible:ring-offset-2 focus-visible:ring-offset-[#ebe9f5] ${
        tab === id
          ? 'bg-white text-par-navy shadow-qh-sm ring-1 ring-par-purple/15'
          : 'text-par-navy/65 hover:bg-white/50 hover:text-par-navy'
      }`}
      onClick={() => setHistoryTab(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-1 rounded-2xl bg-par-light-purple/40 border border-par-purple/10" role="tablist" aria-label="History or saved">
        {tabBtn('history', 'Recent')}
        {tabBtn('saved', 'Saved')}
      </div>
      <p className="text-[10px] text-par-text/45 font-medium px-0.5">Tap an item to load SQL in the editor.</p>
      {tab === 'history' ? (
        <ul className="max-h-[min(20rem,45vh)] overflow-y-auto space-y-1.5 text-xs always-show-scrollbar pr-0.5">
          {history.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="text-left w-full rounded-xl border border-par-light-purple/35 bg-white/90 px-3 py-2.5 hover:border-par-purple/30 hover:bg-white hover:shadow-qh-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-par-purple/40"
                title={h.sql}
                onClick={() => setEditorSql(h.sql)}
              >
                <span className={`block text-[11px] font-bold ${h.status === 'error' ? 'text-red-600' : 'text-par-navy'}`}>
                  {new Date(h.ts).toLocaleString()}
                </span>
                <span className="block text-[10px] font-semibold text-par-text/45 mt-0.5 truncate">{h.database}</span>
              </button>
            </li>
          ))}
          {history.length === 0 && (
            <li className="rounded-2xl border border-dashed border-par-purple/20 bg-white/50 px-4 py-6 text-center text-par-text/45 text-[11px] font-medium leading-relaxed">
              No runs yet. Execute SQL from the main editor.
            </li>
          )}
        </ul>
      ) : (
        <ul className="max-h-[min(20rem,45vh)] overflow-y-auto space-y-1.5 text-xs always-show-scrollbar pr-0.5">
          {savedQueries.map((s) => (
            <li key={s.id} className="flex items-stretch gap-1.5 group">
              <button
                type="button"
                className="text-left flex-1 min-w-0 rounded-xl border border-par-light-purple/35 bg-white/90 px-3 py-2.5 hover:border-par-purple/30 hover:bg-white hover:shadow-qh-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-par-purple/40"
                title={s.sql}
                onClick={() => setEditorSql(s.sql)}
              >
                <span className="font-bold text-par-navy block truncate text-[11px]">{s.title}</span>
                <span className="text-[10px] font-semibold text-par-text/45 block truncate">{s.database}</span>
              </button>
              <button
                type="button"
                className="shrink-0 w-9 rounded-xl border border-red-100 text-red-500 text-lg font-light leading-none hover:bg-red-50 hover:border-red-200 opacity-70 group-hover:opacity-100 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                title="Remove"
                aria-label={`Remove ${s.title}`}
                onClick={() => removeSaved(s.id)}
              >
                ×
              </button>
            </li>
          ))}
          {savedQueries.length === 0 && (
            <li className="rounded-2xl border border-dashed border-par-purple/20 bg-white/50 px-4 py-6 text-center text-par-text/45 text-[11px] font-medium leading-relaxed">
              Nothing saved. Use <strong className="text-par-navy/70">Save</strong> or{' '}
              <kbd className="rounded bg-par-light-purple/60 px-1 font-sans">⌘S</kbd> /{' '}
              <kbd className="rounded bg-par-light-purple/60 px-1 font-sans">Ctrl+S</kbd>.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
