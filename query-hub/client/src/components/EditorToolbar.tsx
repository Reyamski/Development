import { useQueryStore } from '../store/query-store';

interface EditorToolbarProps {
  onRun: () => void;
  onExplain: () => void;
  onExport: () => void;
  onSave: () => void;
  databaseReady: boolean;
}

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-par-purple/40 focus-visible:ring-offset-2';

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

  const ghost = `px-3 py-2 rounded-xl text-xs font-semibold border border-par-light-purple/80 bg-white text-par-navy/90 shadow-qh-inset hover:border-par-purple/35 hover:bg-par-light-purple/20 transition-all duration-200 disabled:opacity-45 disabled:cursor-not-allowed ${focusRing}`;

  return (
    <div className="flex flex-col gap-3 shrink-0 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`px-4 py-2 rounded-xl text-xs font-bold bg-par-purple text-white shadow-qh-sm hover:bg-[#5a56c4] active:scale-[0.98] transition-all duration-200 disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100 ${focusRing}`}
          disabled={!databaseReady || executing}
          onClick={onRun}
        >
          {executing ? 'Running…' : 'Run'}
        </button>
        <button type="button" className={ghost} disabled={!databaseReady || explainLoading} onClick={onExplain}>
          {explainLoading ? 'EXPLAIN…' : 'EXPLAIN'}
        </button>
        <button type="button" className={ghost} disabled={!databaseReady} onClick={onExport}>
          Export CSV
        </button>
        <button type="button" className={ghost} disabled={!databaseReady} onClick={onSave}>
          Save
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-3 sm:ml-auto">
        <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-par-text/45">
          Row limit
          <input
            type="number"
            className={`w-[5.5rem] rounded-xl border border-par-light-purple bg-white px-2.5 py-1.5 text-xs font-semibold text-par-text shadow-qh-inset ${focusRing}`}
            min={1}
            max={50000}
            value={rowLimit}
            onChange={(e) => setRowLimit(Number(e.target.value) || 1000)}
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-par-text/45">
          Timeout (ms)
          <input
            type="number"
            className={`w-[6.5rem] rounded-xl border border-par-light-purple bg-white px-2.5 py-1.5 text-xs font-semibold text-par-text shadow-qh-inset ${focusRing}`}
            min={1000}
            max={600000}
            step={1000}
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(Number(e.target.value) || 30000)}
          />
        </label>
        <p className="hidden md:block text-[10px] text-par-text/55 font-medium max-w-[12rem] leading-snug pb-0.5">
          <kbd className="rounded-md bg-par-light-purple/70 px-1.5 py-0.5 font-sans text-[9px] text-par-navy/85 border border-par-purple/15 shadow-sm">
            ⌘/Ctrl
          </kbd>{' '}
          +{' '}
          <kbd className="rounded-md bg-par-light-purple/70 px-1.5 py-0.5 font-sans text-[9px] text-par-navy/85 border border-par-purple/15 shadow-sm">
            Enter
          </kbd>{' '}
          run ·{' '}
          <kbd className="rounded-md bg-par-light-purple/70 px-1.5 py-0.5 font-sans text-[9px] text-par-navy/85 border border-par-purple/15 shadow-sm">
            ⌘/Ctrl
          </kbd>{' '}
          +{' '}
          <kbd className="rounded-md bg-par-light-purple/70 px-1.5 py-0.5 font-sans text-[9px] text-par-navy/85 border border-par-purple/15 shadow-sm">
            S
          </kbd>{' '}
          save
        </p>
      </div>
    </div>
  );
}
