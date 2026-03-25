import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/app-store';
import { SchemaExplorer } from './SchemaExplorer';

const VIEWPORT_GAP = 10;
const MAX_PANEL_W = 640;
const BELOW_OFFSET = 6;

function clampPopoverRect(buttonEl: HTMLElement): { top: number; left: number; width: number } {
  const rect = buttonEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const width = Math.min(MAX_PANEL_W, vw - VIEWPORT_GAP * 2);
  let left = rect.right - width;
  left = Math.max(VIEWPORT_GAP, Math.min(left, vw - width - VIEWPORT_GAP));
  const top = rect.bottom + BELOW_OFFSET;
  return { top, left, width };
}

export function HeaderSchemaMenu() {
  const [open, setOpen] = useState(false);
  /** Remount SchemaExplorer on each open so folders start expanded and list state is fresh. */
  const [schemaMountKey, setSchemaMountKey] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const connectionResult = useAppStore((s) => s.connectionResult);
  const selectedDatabase = useAppStore((s) => s.selectedDatabase);

  const [popoverBox, setPopoverBox] = useState({ top: 0, left: 0, width: MAX_PANEL_W });

  const reposition = useCallback(() => {
    if (!buttonRef.current) return;
    setPopoverBox(clampPopoverRect(buttonRef.current));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((o) => {
            const next = !o;
            if (next) setSchemaMountKey((k) => k + 1);
            return next;
          });
          queueMicrotask(() => reposition());
        }}
        className={`text-left rounded-xl border px-3 py-2 min-w-[7.75rem] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-par-navy ${
          open
            ? 'bg-white text-par-navy border-white shadow-qh-sm'
            : 'text-white border-white/35 bg-white/[0.07] hover:bg-white/[0.12] hover:border-white/50'
        }`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="block text-xs font-bold leading-tight">Schema</span>
        <span
          className={`block text-[10px] font-medium mt-0.5 truncate max-w-[9rem] ${open ? 'text-par-text/50' : 'text-white/65'}`}
          title={selectedDatabase || undefined}
        >
          {connectionResult ? (selectedDatabase || 'Pick database') : 'Connect first'}
        </span>
      </button>
      {open && (
        <div
          className="fixed z-[120] flex max-h-[min(82vh,calc(100dvh-2rem))] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#12101a] text-white shadow-[0_24px_48px_-12px_rgba(0,0,0,0.55)]"
          style={{
            top: popoverBox.top,
            left: popoverBox.left,
            width: popoverBox.width,
          }}
          role="dialog"
          aria-label="Database schema"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] px-2.5 py-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Browse</span>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-[10px] font-bold text-white/50 hover:bg-white/10 hover:text-white"
              onClick={() => setOpen(false)}
            >
              Esc
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2.5 always-show-scrollbar">
            <SchemaExplorer key={schemaMountKey} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
