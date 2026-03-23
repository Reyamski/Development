import { useQueryStore } from '../store/query-store';

interface EditorToolbarProps {
  onRun: () => void;
  onExplain: () => void;
  onExport: () => void;
  onSave: () => void;
  databaseReady: boolean;
}

export function EditorToolbar({
  onRun,
  onExplain,
  onExport,
  onSave,
  databaseReady,
}: EditorToolbarProps) {
  const rowLimit = useQueryStore((s) => s.rowLimit);
  const timeoutMs = useQueryStore((s) => s.timeoutMs);
  const setRowLimit = useQueryStore((s) => s.setRowLimit);
  const setTimeoutMs = useQueryStore((s) => s.setTimeoutMs);
  const executing = useQueryStore((s) => s.executing);
  const explainLoading = useQueryStore((s) => s.explainLoading);

  const btn =
    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const primary = `${btn} bg-par-purple text-white hover:bg-[#5753b8]`;
  const secondary = `${btn} bg-white border border-par-light-purple text-par-text hover:bg-par-light-purple/20`;

  return (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      <button type="button" className={primary} disabled={!databaseReady || executing} onClick={onRun}>
        {executing ? 'Running…' : 'Run'}
      </button>
      <button
        type="button"
        className={secondary}
        disabled={!databaseReady || explainLoading}
        onClick={onExplain}
      >
        {explainLoading ? 'EXPLAIN…' : 'EXPLAIN'}
      </button>
      <button type="button" className={secondary} disabled={!databaseReady} onClick={onExport}>
        Export CSV
      </button>
      <button type="button" className={secondary} disabled={!databaseReady} onClick={onSave}>
        Save
      </button>
      <div className="flex items-center gap-2 ml-2 text-xs text-par-text/70">
        <label className="flex items-center gap-1">
          Row limit
          <input
            type="number"
            className="w-20 border border-par-light-purple rounded px-2 py-1 text-par-text"
            min={1}
            max={50000}
            value={rowLimit}
            onChange={(e) => setRowLimit(Number(e.target.value) || 1000)}
          />
        </label>
        <label className="flex items-center gap-1">
          Timeout (ms)
          <input
            type="number"
            className="w-24 border border-par-light-purple rounded px-2 py-1 text-par-text"
            min={1000}
            max={600000}
            step={1000}
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(Number(e.target.value) || 30000)}
          />
        </label>
      </div>
    </div>
  );
}
