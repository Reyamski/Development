import type { SchemaEventRefs, SchemaRefTablesViews } from '../api/types';

function backtickIdent(name: string): string {
  return `\`${name.replace(/`/g, '``')}\``;
}

type Kind = 'view' | 'procedure' | 'function' | 'event';

type Props = {
  open: boolean;
  onClose: () => void;
  database: string | null;
  kind: Kind;
  objectName: string;
  bundle: SchemaRefTablesViews | SchemaEventRefs;
  /** For labeling routines inside events (procedure vs function). */
  routineKindByName: Map<string, 'PROCEDURE' | 'FUNCTION'>;
  onInsertName: (quoted: string) => void;
};

function isEventRefs(b: SchemaRefTablesViews | SchemaEventRefs): b is SchemaEventRefs {
  return 'routines' in b && Array.isArray((b as SchemaEventRefs).routines);
}

function Section(props: {
  title: string;
  names: string[];
  onPick: (name: string) => void;
  emptyHint: string;
  badge?: (name: string) => string | null;
}) {
  const { title, names, onPick, emptyHint, badge } = props;
  return (
    <div className="rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/40 mb-1.5">{title}</p>
      {names.length === 0 ? (
        <p className="text-[10px] text-white/35">{emptyHint}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {names.map((name) => {
            const chip = badge?.(name) ?? null;
            return (
              <li key={name}>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/[0.06] px-2 py-1 font-mono text-[10px] text-par-light-blue/95 hover:bg-white/10"
                  onClick={() => onPick(backtickIdent(name))}
                  title="Insert quoted name at cursor"
                >
                  {chip ? (
                    <span className="rounded bg-white/10 px-1 text-[8px] font-bold uppercase tracking-wide text-white/55">
                      {chip}
                    </span>
                  ) : null}
                  {name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function kindTitle(kind: Kind): string {
  switch (kind) {
    case 'view':
      return 'View';
    case 'procedure':
      return 'Procedure';
    case 'function':
      return 'Function';
    case 'event':
      return 'Event';
    default:
      return 'Object';
  }
}

export function SchemaRefsModal(props: Props) {
  const { open, onClose, database, kind, objectName, bundle, routineKindByName, onInsertName } = props;
  if (!open) return null;

  const ev = isEventRefs(bundle) ? bundle : null;

  return (
    <div
      className="fixed inset-0 z-[205] flex items-center justify-center bg-black/75 p-2 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qh-refs-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(88vh,560px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0c0b12] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/10 px-3 py-2.5">
          <div className="min-w-0">
            <h2 id="qh-refs-title" className="text-sm font-bold text-white">
              References — {kindTitle(kind)}
            </h2>
            <p className="mt-0.5 font-mono text-[11px] text-par-light-blue/90 break-all">{objectName}</p>
            <p className="mt-0.5 font-mono text-[10px] text-white/40">{database ?? '—'}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-white/20 px-2.5 py-1 text-[11px] font-bold text-white/70 hover:bg-white/10"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <p className="text-[10px] leading-snug text-white/35">
            Names come from server metadata when available; events also scan{' '}
            <strong className="text-white/50">CALL</strong> targets and backtick identifiers. Unquoted identifiers may be missing.
          </p>

          {ev ? (
            <Section
              title="Stored routines (procedures & functions)"
              names={ev.routines}
              onPick={onInsertName}
              emptyHint="No procedures or functions detected in this event body."
              badge={(name) => {
                const t = routineKindByName.get(name);
                if (t === 'PROCEDURE') return 'P';
                if (t === 'FUNCTION') return 'F';
                return null;
              }}
            />
          ) : null}

          <Section
            title="Tables"
            names={bundle.tables}
            onPick={onInsertName}
            emptyHint="No base tables detected."
          />

          <Section
            title="Views"
            names={bundle.views}
            onPick={onInsertName}
            emptyHint="No views detected."
          />
        </div>
      </div>
    </div>
  );
}
