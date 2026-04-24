import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/app-store';
import { useQueryStore } from '../store/query-store';
import {
  schemaColumns,
  schemaDatabases,
  schemaEvents,
  schemaObjectDependencies,
  schemaObjectDdl,
  schemaRoutines,
  schemaTables,
} from '../api/client';
import type {
  SchemaColumn,
  SchemaDdlKind,
  SchemaEvent,
  SchemaEventRefs,
  SchemaObjectDependencies,
  SchemaRefTablesViews,
  SchemaRoutine,
  SchemaTable,
} from '../api/types';
import { DdlCodeViewer } from './DdlCodeViewer';
import { ErDiagramModal } from './ErDiagramModal';
import { SchemaRefsModal } from './SchemaRefsModal';

type Props = {
  onClose?: () => void;
};

type FolderId = 'tables' | 'views' | 'procedures' | 'functions' | 'events';

const FOLDER_DEFAULT: Record<FolderId, boolean> = {
  tables: true,
  views: true,
  procedures: true,
  functions: true,
  events: true,
};

function backtickIdent(name: string): string {
  return `\`${name.replace(/`/g, '``')}\``;
}

function refCountTv(b: SchemaRefTablesViews): number {
  return b.tables.length + b.views.length;
}

function refCountEv(b: SchemaEventRefs): number {
  return b.tables.length + b.views.length + b.routines.length;
}

function eventScheduleSummary(e: SchemaEvent): string {
  const parts: string[] = [];
  if (e.eventType) parts.push(e.eventType);
  if (e.executeAt != null && String(e.executeAt) !== '') {
    parts.push(`@ ${e.executeAt}`);
  } else if (e.intervalValue != null && e.intervalField) {
    parts.push(`every ${e.intervalValue} ${e.intervalField}`);
  }
  return parts.join(' · ');
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

export function SchemaExplorer({ onClose }: Props) {
  const connectionResult = useAppStore((s) => s.connectionResult);
  const selectedDatabase = useAppStore((s) => s.selectedDatabase);
  const setSelectedDatabase = useAppStore((s) => s.setSelectedDatabase);
  const setEditorSql = useQueryStore((s) => s.setEditorSql);
  const requestEditorInsert = useQueryStore((s) => s.requestEditorInsert);

  const [apiDatabases, setApiDatabases] = useState<string[]>([]);
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [routines, setRoutines] = useState<SchemaRoutine[]>([]);
  const [events, setEvents] = useState<SchemaEvent[]>([]);
  const [openFolders, setOpenFolders] = useState<Record<FolderId, boolean>>(FOLDER_DEFAULT);
  const [expandedColKey, setExpandedColKey] = useState<string | null>(null);
  const [columnsByKey, setColumnsByKey] = useState<Record<string, SchemaColumn[]>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('');
  const [ddlModal, setDdlModal] = useState<{
    title: string;
    objectName: string;
    kind: SchemaDdlKind;
    text: string;
    loading: boolean;
  } | null>(null);
  const [erDiagramOpen, setErDiagramOpen] = useState(false);
  const [objectDeps, setObjectDeps] = useState<SchemaObjectDependencies | null>(null);
  const [refsModal, setRefsModal] = useState<{
    kind: 'view' | 'procedure' | 'function' | 'event';
    objectName: string;
    bundle: SchemaRefTablesViews | SchemaEventRefs;
  } | null>(null);

  const connectionDbs = connectionResult?.databases ?? [];

  const routineKindByName = useMemo(() => {
    const m = new Map<string, 'PROCEDURE' | 'FUNCTION'>();
    for (const r of routines) m.set(r.name, r.type);
    return m;
  }, [routines]);

  const loadDbs = useCallback(async () => {
    if (!connectionResult) return;
    setLoading(true);
    setErr('');
    try {
      const { databases: d } = await schemaDatabases();
      setApiDatabases(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to list databases');
    } finally {
      setLoading(false);
    }
  }, [connectionResult]);

  useEffect(() => {
    void loadDbs();
  }, [loadDbs]);

  const mergedDatabases = useMemo(() => {
    const s = new Set<string>([...connectionDbs, ...apiDatabases]);
    if (selectedDatabase) s.add(selectedDatabase);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [connectionDbs, apiDatabases, selectedDatabase]);

  const loadSchema = useCallback(async (db: string) => {
    if (!db) {
      setTables([]);
      setRoutines([]);
      setEvents([]);
      setObjectDeps(null);
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const [t, r, ev, od] = await Promise.all([
        schemaTables(db),
        schemaRoutines(db).catch(() => ({ routines: [] as SchemaRoutine[] })),
        schemaEvents(db).catch(() => ({ events: [] as SchemaEvent[] })),
        schemaObjectDependencies(db).catch(
          () =>
            ({
              views: {},
              routines: {},
              events: {},
            }) satisfies SchemaObjectDependencies,
        ),
      ]);
      setTables(t.tables);
      setRoutines(r.routines);
      setEvents(ev.events);
      setObjectDeps(od);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load schema');
      setTables([]);
      setRoutines([]);
      setEvents([]);
      setObjectDeps({ views: {}, routines: {}, events: {} });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSchema(selectedDatabase || '');
    setExpandedColKey(null);
    setColumnsByKey({});
  }, [selectedDatabase, loadSchema]);

  const matches = useCallback(
    (name: string) => {
      const q = filter.trim().toLowerCase();
      if (!q) return true;
      return name.toLowerCase().includes(q);
    },
    [filter],
  );

  const baseTables = useMemo(() => tables.filter((t) => t.type === 'BASE TABLE'), [tables]);
  const viewTables = useMemo(
    () => tables.filter((t) => t.type === 'VIEW' || t.type === 'SYSTEM VIEW'),
    [tables],
  );
  const procedures = useMemo(() => routines.filter((r) => r.type === 'PROCEDURE'), [routines]);
  const functions = useMemo(() => routines.filter((r) => r.type === 'FUNCTION'), [routines]);

  const fBase = useMemo(() => baseTables.filter((t) => matches(t.name)), [baseTables, matches]);
  const fViews = useMemo(() => viewTables.filter((t) => matches(t.name)), [viewTables, matches]);
  const fProcs = useMemo(() => procedures.filter((r) => matches(r.name)), [procedures, matches]);
  const fFuncs = useMemo(() => functions.filter((r) => matches(r.name)), [functions, matches]);
  const fEvents = useMemo(() => events.filter((ev) => matches(ev.name)), [events, matches]);

  const toggleFolder = (id: FolderId) => {
    setOpenFolders((p) => ({ ...p, [id]: !p[id] }));
  };

  const colKey = (name: string) => `c:${name}`;

  const toggleColumns = async (name: string) => {
    if (!selectedDatabase) return;
    const k = colKey(name);
    if (expandedColKey === k) {
      setExpandedColKey(null);
      return;
    }
    setExpandedColKey(k);
    if (columnsByKey[k]) return;
    try {
      const { columns } = await schemaColumns(selectedDatabase, name);
      setColumnsByKey((prev) => ({ ...prev, [k]: columns }));
    } catch {
      setColumnsByKey((prev) => ({ ...prev, [k]: [] }));
    }
  };

  const insertSelect = (name: string) => {
    setEditorSql(`SELECT * FROM \`${name}\` LIMIT 100`);
    onClose?.();
  };

  const insertCall = (name: string) => {
    setEditorSql(`-- Edit arguments as needed\nCALL \`${name}\`();\n`);
    onClose?.();
  };

  const insertFn = (name: string) => {
    setEditorSql(`SELECT \`${name}\`();\n`);
    onClose?.();
  };

  const openDdl = async (objectName: string, kind: SchemaDdlKind, title: string) => {
    if (!selectedDatabase) return;
    setDdlModal({ title, objectName, kind, text: '', loading: true });
    try {
      const { ddl } = await schemaObjectDdl(selectedDatabase, objectName, kind);
      setDdlModal((m) => (m ? { ...m, text: ddl, loading: false } : null));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load DDL';
      setDdlModal((m) => (m ? { ...m, text: `-- Error: ${msg}`, loading: false } : null));
    }
  };

  const inp =
    'w-full min-w-0 rounded-lg bg-black/35 border border-white/[0.12] px-2.5 py-2 text-[11px] text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-par-purple/50 focus:border-par-purple/40';

  const btnGhost =
    'shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/65 hover:bg-white/10 hover:text-white border border-transparent hover:border-white/15';

  const folderHeader = (id: FolderId, label: string, count: number) => (
    <button
      type="button"
      onClick={() => toggleFolder(id)}
      className="flex w-full min-w-0 items-center gap-1.5 border-b border-white/[0.06] bg-black/25 px-2 py-1.5 text-left hover:bg-white/[0.04]"
    >
      <span className="w-4 shrink-0 text-center text-[10px] text-white/45">{openFolders[id] ? '▼' : '▶'}</span>
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">{label}</span>
      <span className="ml-auto tabular-nums text-[10px] font-semibold text-white/35">{count}</span>
    </button>
  );

  const renderTableLikeRow = (t: SchemaTable, ddlKind: SchemaDdlKind) => {
    const k = colKey(t.name);
    const open = expandedColKey === k;
    const cols = columnsByKey[k];
    return (
      <li key={`${ddlKind}-${t.name}`} className="border-b border-white/[0.04] last:border-0">
        <div className="flex min-w-0 items-start gap-1 py-1 pl-1 pr-1 hover:bg-white/[0.04]">
          <button
            type="button"
            className="mt-0.5 flex h-6 w-5 shrink-0 items-center justify-center rounded text-white/45 hover:bg-white/10 hover:text-white"
            aria-expanded={open}
            onClick={() => void toggleColumns(t.name)}
            title="Columns"
          >
            {open ? '▼' : '▶'}
          </button>
          <div className="min-w-0 flex-1 overflow-x-auto">
            <button
              type="button"
              className="block w-full text-left font-mono text-[11px] font-medium leading-snug text-white/92 break-all whitespace-normal hover:text-white"
              title={t.name}
              onClick={() => void toggleColumns(t.name)}
            >
              {t.name}
            </button>
            {t.comment ? (
              <p className="mt-0.5 text-[9px] leading-snug text-white/35 break-words">{t.comment}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col gap-0.5 items-end pr-1 sm:flex-row sm:items-center sm:gap-1 sm:pr-2">
            <button type="button" className={btnGhost} title="Insert SELECT * … LIMIT 100" onClick={() => insertSelect(t.name)}>
              Sel
            </button>
            <button
              type="button"
              className={btnGhost}
              title="View CREATE TABLE / VIEW (DDL)"
              onClick={() => void openDdl(t.name, ddlKind, ddlKind === 'view' ? 'View' : 'Table')}
            >
              DDL
            </button>
            <button
              type="button"
              className={btnGhost}
              title="Insert quoted name at cursor in SQL editor"
              onClick={() => requestEditorInsert(backtickIdent(t.name))}
            >
              Ins
            </button>
            {ddlKind === 'view' && objectDeps ? (() => {
              const b = objectDeps.views[t.name] ?? { tables: [], views: [] };
              const n = refCountTv(b);
              return (
                <button
                  type="button"
                  className={btnGhost}
                  title="Open tables and views referenced by this view"
                  onClick={() => setRefsModal({ kind: 'view', objectName: t.name, bundle: b })}
                >
                  Refs{n > 0 ? ` (${n})` : ''}
                </button>
              );
            })() : null}
          </div>
        </div>
        {open && cols && (
          <ul className="mx-1 mb-1 max-h-36 overflow-y-auto rounded border border-white/[0.08] bg-[#07060c] px-2 py-1.5 font-mono text-[10px] leading-tight">
            {cols.length === 0 ? (
              <li className="text-white/40">No columns (permission?)</li>
            ) : (
              cols.map((c) => (
                <li key={c.name} className="flex flex-wrap gap-x-2 gap-y-0.5 border-b border-white/[0.04] py-0.5 last:border-0">
                  <span className="font-semibold text-par-light-blue/90 break-all">{c.name}</span>
                  <span className="text-white/45 break-all">{c.type}</span>
                  {c.key ? <span className="text-amber-200/80">{c.key}</span> : null}
                </li>
              ))
            )}
          </ul>
        )}
        {open && cols === undefined && <p className="ml-8 mb-1 text-[10px] text-white/35">Loading columns…</p>}
      </li>
    );
  };

  const renderRoutineRow = (r: SchemaRoutine) => {
    const isProc = r.type === 'PROCEDURE';
    const kind: SchemaDdlKind = isProc ? 'procedure' : 'function';
    return (
      <li key={`${r.type}-${r.name}`} className="border-b border-white/[0.04] last:border-0">
        <div className="flex min-w-0 items-start gap-1 py-1 pl-1 pr-1 hover:bg-white/[0.04]">
          <span className="mt-1 w-5 shrink-0 text-center text-[9px] text-white/30">{isProc ? 'P' : 'F'}</span>
          <div className="min-w-0 flex-1 overflow-x-auto">
            <span className="block font-mono text-[11px] font-medium leading-snug text-white/92 break-all whitespace-normal" title={r.name}>
              {r.name}
            </span>
            {r.comment ? <p className="mt-0.5 text-[9px] text-white/35 break-words">{r.comment}</p> : null}
          </div>
          <div className="flex shrink-0 flex-col gap-0.5 items-end pr-1 sm:flex-row sm:items-center sm:gap-1 sm:pr-2">
            <button
              type="button"
              className={btnGhost}
              title={isProc ? 'Insert CALL …(); template' : 'Insert SELECT …(); template'}
              onClick={() => (isProc ? insertCall(r.name) : insertFn(r.name))}
            >
              {isProc ? 'Call' : 'Sel'}
            </button>
            <button
              type="button"
              className={btnGhost}
              title="View CREATE PROCEDURE / FUNCTION"
              onClick={() => void openDdl(r.name, kind, isProc ? 'Procedure' : 'Function')}
            >
              DDL
            </button>
            <button
              type="button"
              className={btnGhost}
              title="Insert quoted name at cursor in SQL editor"
              onClick={() => requestEditorInsert(backtickIdent(r.name))}
            >
              Ins
            </button>
            {objectDeps ? (() => {
              const k = `${r.type}:${r.name}`;
              const b = objectDeps.routines[k] ?? { tables: [], views: [] };
              const n = refCountTv(b);
              return (
                <button
                  type="button"
                  className={btnGhost}
                  title="Open tables and views referenced by this routine"
                  onClick={() =>
                    setRefsModal({
                      kind: isProc ? 'procedure' : 'function',
                      objectName: r.name,
                      bundle: b,
                    })
                  }
                >
                  Refs{n > 0 ? ` (${n})` : ''}
                </button>
              );
            })() : null}
          </div>
        </div>
      </li>
    );
  };

  const renderEventRow = (ev: SchemaEvent) => {
    const sched = eventScheduleSummary(ev);
    const st = ev.status?.toUpperCase() ?? '';
    const statusCls =
      st === 'ENABLED'
        ? 'text-emerald-300/90 bg-emerald-500/15 border-emerald-400/25'
        : st === 'DISABLED'
          ? 'text-white/45 bg-white/[0.06] border-white/10'
          : 'text-amber-200/85 bg-amber-500/12 border-amber-400/20';
    return (
      <li key={`event-${ev.name}`} className="border-b border-white/[0.04] last:border-0">
        <div className="flex min-w-0 items-start gap-1 py-1 pl-1 pr-1 hover:bg-white/[0.04]">
          <span className="mt-1 w-5 shrink-0 text-center text-[9px] font-bold text-par-light-blue/70" title="Event">
            E
          </span>
          <div className="min-w-0 flex-1 overflow-x-auto">
            <span className="block font-mono text-[11px] font-medium leading-snug text-white/92 break-all whitespace-normal" title={ev.name}>
              {ev.name}
            </span>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              {ev.status ? (
                <span className={`rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide border ${statusCls}`}>{ev.status}</span>
              ) : null}
              {sched ? <span className="text-[9px] text-white/40 break-words">{sched}</span> : null}
            </div>
            {ev.comment ? <p className="mt-0.5 text-[9px] text-white/35 break-words">{ev.comment}</p> : null}
          </div>
          <div className="flex shrink-0 flex-col gap-0.5 items-end pr-1 sm:flex-row sm:items-center sm:gap-1 sm:pr-2">
            <button
              type="button"
              className={btnGhost}
              title="View CREATE EVENT (DDL)"
              onClick={() => void openDdl(ev.name, 'event', 'Event')}
            >
              DDL
            </button>
            <button
              type="button"
              className={btnGhost}
              title="Insert quoted name at cursor in SQL editor"
              onClick={() => requestEditorInsert(backtickIdent(ev.name))}
            >
              Ins
            </button>
            {objectDeps ? (() => {
              const b = objectDeps.events[ev.name] ?? { tables: [], views: [], routines: [] };
              const n = refCountEv(b);
              return (
                <button
                  type="button"
                  className={btnGhost}
                  title="Open routines, tables, and views referenced by this event"
                  onClick={() => setRefsModal({ kind: 'event', objectName: ev.name, bundle: b })}
                >
                  Refs{n > 0 ? ` (${n})` : ''}
                </button>
              );
            })() : null}
          </div>
        </div>
      </li>
    );
  };

  if (!connectionResult) {
    return (
      <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] px-3 py-4 text-center">
        <p className="text-xs font-bold text-white/80">Not connected</p>
        <p className="text-[10px] text-white/45 mt-1">Use Connection in the sidebar first.</p>
      </div>
    );
  }

  const totalShown = fBase.length + fViews.length + fProcs.length + fFuncs.length + fEvents.length;

  return (
    <div className="flex flex-col gap-2.5 min-h-0 min-w-0 text-[11px] text-white/88">
      <div className="flex flex-wrap items-center gap-2 shrink-0 min-w-0">
        <button
          type="button"
          className="shrink-0 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white/80 hover:bg-white/10 disabled:opacity-40"
          onClick={() => {
            void loadDbs();
            if (selectedDatabase) void loadSchema(selectedDatabase);
          }}
          disabled={loading}
        >
          Refresh
        </button>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-par-purple/40 bg-par-purple/20 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-par-light-blue/95 hover:bg-par-purple/30 disabled:opacity-40"
          title="Entity–relationship view from foreign keys + list of scheduled events"
          disabled={!selectedDatabase}
          onClick={() => setErDiagramOpen(true)}
        >
          ER diagram
        </button>
        {loading && <span className="text-[10px] font-semibold text-par-light-blue/90">Loading…</span>}
        <span className="ml-auto text-[10px] text-white/35 font-medium tabular-nums whitespace-nowrap">
          {totalShown} shown
        </span>
      </div>

      {err && (
        <div className="shrink-0 rounded-lg border border-red-500/30 bg-red-950/40 px-2 py-1.5 text-[10px] font-medium text-red-200">
          {err}
        </div>
      )}

      <div className="shrink-0 space-y-1 min-w-0">
        <label htmlFor="qh-schema-db" className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40 block">
          Database (schema)
        </label>
        <select
          id="qh-schema-db"
          className={inp + ' font-mono font-medium cursor-pointer'}
          value={selectedDatabase}
          onChange={(e) => {
            setSelectedDatabase(e.target.value);
            setExpandedColKey(null);
            setFilter('');
          }}
        >
          {mergedDatabases.length === 0 ? (
            <option value="">—</option>
          ) : (
            mergedDatabases.map((d) => (
              <option key={d} value={d} className="bg-par-navy text-white">
                {d}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="shrink-0 space-y-1 min-w-0">
        <label htmlFor="qh-schema-filter" className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40 block">
          Filter objects
        </label>
        <input
          id="qh-schema-filter"
          type="search"
          className={inp}
          placeholder="Filter by name…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="min-h-[14rem] max-h-[min(56vh,480px)] flex flex-col rounded-lg border border-white/[0.1] bg-black/25 overflow-hidden shrink-0 min-w-0">
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto always-show-scrollbar">
          <div className="min-w-[280px]">
            {folderHeader('tables', 'Tables', fBase.length)}
            {openFolders.tables && (
              <ul className="py-0.5">{fBase.map((t) => renderTableLikeRow(t, 'table'))}</ul>
            )}

            {folderHeader('views', 'Views', fViews.length)}
            {openFolders.views && (
              <ul className="py-0.5">{fViews.map((t) => renderTableLikeRow(t, 'view'))}</ul>
            )}

            {folderHeader('procedures', 'Stored procedures', fProcs.length)}
            {openFolders.procedures && <ul className="py-0.5">{fProcs.map((r) => renderRoutineRow(r))}</ul>}

            {folderHeader('functions', 'Functions', fFuncs.length)}
            {openFolders.functions && <ul className="py-0.5">{fFuncs.map((r) => renderRoutineRow(r))}</ul>}

            {folderHeader('events', 'Events', fEvents.length)}
            {openFolders.events && <ul className="py-0.5">{fEvents.map((ev) => renderEventRow(ev))}</ul>}

            {!loading && totalShown === 0 && (
              <p className="px-3 py-6 text-center text-[10px] text-white/40 font-medium">No objects match this filter.</p>
            )}
          </div>
        </div>
      </div>

      <p className="text-[9px] leading-relaxed text-white/30 shrink-0">
        Expand a row to load columns. <strong className="text-white/45">DDL</strong> opens SHOW CREATE.{' '}
        <strong className="text-white/45">Ins</strong> inserts the quoted identifier at the SQL editor cursor.{' '}
        <strong className="text-white/45">Refs</strong> opens referenced tables, views, and (for events) stored routines.{' '}
        <strong className="text-white/45">ER diagram</strong> maps foreign keys. Use the toolbar database control for global context.
      </p>

      {refsModal ? (
        <SchemaRefsModal
          open
          onClose={() => setRefsModal(null)}
          database={selectedDatabase}
          kind={refsModal.kind}
          objectName={refsModal.objectName}
          bundle={refsModal.bundle}
          routineKindByName={routineKindByName}
          onInsertName={(q) => {
            requestEditorInsert(q);
            setRefsModal(null);
          }}
        />
      ) : null}

      <ErDiagramModal
        open={erDiagramOpen}
        onClose={() => setErDiagramOpen(false)}
        database={selectedDatabase}
        events={events}
      />

      {ddlModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qh-ddl-title"
          onClick={() => setDdlModal(null)}
        >
          <div
            className="flex max-h-[min(88vh,720px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0a0910] shadow-2xl ring-1 ring-par-purple/15"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/[0.08] px-4 py-3 bg-gradient-to-r from-[#12101c]/90 to-transparent">
              <div className="min-w-0">
                <h2 id="qh-ddl-title" className="text-sm font-bold text-white tracking-tight">
                  {ddlModal.title}:{' '}
                  <span className="font-mono text-par-light-blue break-all font-semibold">{ddlModal.objectName}</span>
                </h2>
                <p className="text-[10px] text-white/45 mt-1 font-mono tracking-wide">{selectedDatabase}</p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-xl border border-white/18 px-3 py-1.5 text-[11px] font-bold text-white/75 hover:bg-white/[0.08] hover:text-white transition-colors"
                onClick={() => setDdlModal(null)}
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4 flex flex-col">
              {ddlModal.loading ? (
                <p className="text-sm text-white/55 py-4">Loading definition…</p>
              ) : (
                <DdlCodeViewer value={ddlModal.text} />
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 border-t border-white/10 px-3 py-2">
              <button
                type="button"
                disabled={ddlModal.loading || !ddlModal.text}
                className="rounded-lg bg-par-purple px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#5a56c4] disabled:opacity-40"
                onClick={() => void copyText(ddlModal.text)}
              >
                Copy DDL
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/20 px-3 py-1.5 text-[11px] font-bold text-white/80 hover:bg-white/10"
                onClick={() => {
                  setEditorSql(ddlModal.text);
                  setDdlModal(null);
                  onClose?.();
                }}
                disabled={ddlModal.loading || !ddlModal.text}
              >
                Send to editor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
