import mermaid from 'mermaid';
import { useEffect, useId, useRef, useState } from 'react';
import { schemaForeignKeys } from '../api/client';
import type { SchemaEvent, SchemaForeignKeyEdge } from '../api/types';

const MAX_EDGES = 200;

type Props = {
  open: boolean;
  onClose: () => void;
  database: string | null;
  events: SchemaEvent[];
};

function erEntity(table: string): string {
  const raw = table.replace(/[^a-zA-Z0-9]/g, '_');
  const base = raw && /^[0-9]/.test(raw) ? `T_${raw}` : raw || 'Tbl';
  return `qht_${base}`;
}

function buildDefinition(edges: SchemaForeignKeyEdge[]): {
  text: string;
  truncated: boolean;
  legend: [string, string][];
} {
  const lines: string[] = ['erDiagram'];
  const legendMap = new Map<string, string>();
  const slice = edges.slice(0, MAX_EDGES);
  const truncated = edges.length > MAX_EDGES;
  for (const e of slice) {
    const child = erEntity(e.tableName);
    const parent = erEntity(e.referencedTableName);
    legendMap.set(child, e.tableName);
    legendMap.set(parent, e.referencedTableName);
    const lab = `${e.columnName} → ${e.referencedColumnName}`.slice(0, 48).replace(/"/g, "'");
    lines.push(`    ${child} }o--|| ${parent} : "${lab}"`);
  }
  const legend = [...legendMap.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  return { text: lines.join('\n'), truncated, legend };
}

let mermaidInited = false;
function ensureMermaid(): void {
  if (mermaidInited) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
  });
  mermaidInited = true;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

export function ErDiagramModal({ open, onClose, database, events }: Props) {
  const svgHostRef = useRef<HTMLDivElement>(null);
  const reactId = useId().replace(/:/g, '');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [edges, setEdges] = useState<SchemaForeignKeyEdge[]>([]);
  const [mermaidText, setMermaidText] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [legend, setLegend] = useState<[string, string][]>([]);

  useEffect(() => {
    if (!open || !database) return;
    let cancelled = false;
    setLoading(true);
    setErr('');
    setEdges([]);
    setMermaidText('');
    setLegend([]);
    setTruncated(false);
    void schemaForeignKeys(database)
      .then(({ edges: e }) => {
        if (cancelled) return;
        setEdges(e);
        const built = buildDefinition(e);
        setMermaidText(built.text);
        setTruncated(built.truncated);
        setLegend(built.legend);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load foreign keys');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, database]);

  useEffect(() => {
    if (!open) return;
    const host = svgHostRef.current;
    if (!host) return;
    const onlyHeader = mermaidText.trim() === 'erDiagram' || !mermaidText;
    if (onlyHeader) {
      host.innerHTML = '';
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        ensureMermaid();
        const uniqueId = `qh_er_${reactId}_${Date.now()}`;
        const { svg } = await mermaid.render(uniqueId, mermaidText);
        if (cancelled || !svgHostRef.current) return;
        svgHostRef.current.innerHTML = svg;
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Mermaid render failed';
          setErr((prev) => prev || msg);
          if (svgHostRef.current) svgHostRef.current.innerHTML = '';
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mermaidText, reactId]);

  if (!open) return null;

  const noFk = !loading && edges.length === 0;

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/75 p-2 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qh-er-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,840px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0c0b12] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-white/10 px-3 py-2.5">
          <div className="min-w-0">
            <h2 id="qh-er-title" className="text-sm font-bold text-white">
              ER diagram <span className="font-mono text-par-light-blue/90">(foreign keys)</span>
            </h2>
            <p className="mt-0.5 font-mono text-[10px] text-white/45">{database ?? '—'}</p>
            <p className="mt-1 text-[9px] leading-snug text-white/35">
              Built from <code className="text-white/50">information_schema</code> foreign keys. MySQL scheduled events are listed below — they do not participate in FK metadata.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <button
              type="button"
              disabled={!mermaidText || mermaidText.trim() === 'erDiagram'}
              className="rounded-lg border border-white/20 px-2.5 py-1 text-[10px] font-bold text-white/80 hover:bg-white/10 disabled:opacity-35"
              onClick={() => void copyText(mermaidText)}
            >
              Copy Mermaid
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/20 px-2.5 py-1 text-[10px] font-bold text-white/70 hover:bg-white/10"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
          {loading && <p className="text-sm text-white/50">Loading relationships…</p>}
          {err ? (
            <div className="rounded-lg border border-red-500/30 bg-red-950/35 px-2.5 py-2 text-[11px] text-red-200">{err}</div>
          ) : null}

          {!loading && noFk ? (
            <p className="text-[11px] text-white/50">
              No foreign keys found for this schema (or insufficient privileges on{' '}
              <code className="text-white/60">information_schema</code>).
            </p>
          ) : null}

          <div
            ref={svgHostRef}
            className="min-h-[120px] overflow-x-auto rounded-lg border border-white/[0.08] bg-[#12101a] p-2 [&_svg]:max-w-none"
          />

          {legend.length > 0 ? (
            <div className="rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/40 mb-1.5">Table labels</p>
              <ul className="max-h-28 overflow-y-auto font-mono text-[9px] leading-relaxed text-white/55 columns-1 sm:columns-2 gap-x-4">
                {legend.map(([id, name]) => (
                  <li key={id} className="break-all pr-2">
                    <span className="text-par-light-blue/80">{id}</span>
                    <span className="text-white/25"> → </span>
                    <span className="text-white/75">{name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {truncated ? (
            <p className="text-[10px] text-amber-200/80">Showing the first {MAX_EDGES} FK column references only.</p>
          ) : null}

          {events.length > 0 ? (
            <div className="rounded-lg border border-white/[0.08] bg-black/25 px-2.5 py-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/40 mb-1.5">Scheduled events</p>
              <ul className="max-h-32 overflow-y-auto space-y-1 font-mono text-[10px] text-white/70">
                {events.map((ev) => (
                  <li key={ev.name} className="flex flex-wrap gap-x-2 gap-y-0.5 border-b border-white/[0.05] pb-1 last:border-0">
                    <span className="font-semibold text-par-light-blue/85 break-all">{ev.name}</span>
                    {ev.status ? <span className="text-white/40">{ev.status}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
