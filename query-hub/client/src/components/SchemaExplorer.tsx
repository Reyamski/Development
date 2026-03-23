import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../store/app-store';
import { useQueryStore } from '../store/query-store';
import { schemaColumns, schemaDatabases, schemaTables } from '../api/client';
import type { SchemaColumn, SchemaTable } from '../api/types';

export function SchemaExplorer() {
  const connectionResult = useAppStore((s) => s.connectionResult);
  const selectedDatabase = useAppStore((s) => s.selectedDatabase);
  const setEditorSql = useQueryStore((s) => s.setEditorSql);

  const [databases, setDatabases] = useState<string[]>([]);
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [columnsByTable, setColumnsByTable] = useState<Record<string, SchemaColumn[]>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const loadDbs = useCallback(async () => {
    if (!connectionResult) return;
    setLoading(true);
    setErr('');
    try {
      const { databases: d } = await schemaDatabases();
      setDatabases(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load databases');
    } finally {
      setLoading(false);
    }
  }, [connectionResult]);

  useEffect(() => {
    void loadDbs();
  }, [loadDbs]);

  const loadTables = useCallback(async (db: string) => {
    if (!db) return;
    setLoading(true);
    setErr('');
    try {
      const { tables: t } = await schemaTables(db);
      setTables(t);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load tables');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDatabase) void loadTables(selectedDatabase);
  }, [selectedDatabase, loadTables]);

  const toggleTable = async (table: string) => {
    if (!selectedDatabase) return;
    if (expanded === table) {
      setExpanded(null);
      return;
    }
    setExpanded(table);
    if (columnsByTable[table]) return;
    try {
      const { columns } = await schemaColumns(selectedDatabase, table);
      setColumnsByTable((prev) => ({ ...prev, [table]: columns }));
    } catch {
      /* ignore */
    }
  };

  const insertTable = (table: string) => {
    setEditorSql(`SELECT * FROM \`${table}\` LIMIT 100`);
  };

  if (!connectionResult) {
    return (
      <div className="rounded-xl border-2 border-dashed border-par-purple/30 bg-white px-3 py-4 text-center">
        <p className="text-sm font-semibold text-par-navy">Not connected</p>
        <p className="text-xs text-par-text/60 mt-1">Use the Connection tab → pick cluster & instance first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-par-purple bg-par-purple text-white text-xs font-bold shadow-sm hover:bg-[#5753b8] disabled:opacity-50 transition-colors"
          onClick={() => void loadDbs()}
          disabled={loading}
        >
          ↻ Refresh schema
        </button>
        {loading && <span className="text-[10px] font-semibold text-par-purple">Loading…</span>}
      </div>
      {err && (
        <div className="rounded-lg border-2 border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{err}</div>
      )}

      <div className="rounded-lg border-2 border-par-purple/25 bg-white px-3 py-2 shadow-sm">
        <span className="text-[10px] font-bold uppercase tracking-widest text-par-text/50">Current database</span>
        <p className="text-sm font-bold text-par-navy mt-0.5">{selectedDatabase || '—'}</p>
        <p className="text-[10px] text-par-text/55 mt-1">Switch DB from the dropdown above the SQL editor.</p>
      </div>

      <p className="text-[10px] font-semibold text-par-navy uppercase tracking-wide">Tables — click ▶ to expand columns</p>
      <ul className="space-y-2 max-h-[min(50vh,22rem)] overflow-y-auto pr-1 always-show-scrollbar">
        {tables.map((t) => (
          <li
            key={t.name}
            className="rounded-xl border-2 border-par-light-purple/50 bg-white shadow-sm overflow-hidden hover:border-par-purple/40 transition-colors"
          >
            <button
              type="button"
              className="w-full text-left px-3 py-2.5 font-bold text-par-navy text-sm hover:bg-par-light-purple/25 flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-par-purple"
              onClick={() => void toggleTable(t.name)}
            >
              <span className="text-par-purple w-4 shrink-0">{expanded === t.name ? '▼' : '▶'}</span>
              <span className="font-mono text-xs">{t.name}</span>
            </button>
            <div className="px-3 pb-2 pt-0 border-t border-par-light-purple/20 bg-par-light-purple/10">
              <button
                type="button"
                className="mt-2 w-full sm:w-auto px-3 py-1.5 rounded-lg border-2 border-par-orange/50 bg-white text-[11px] font-bold text-par-orange hover:bg-orange-50 transition-colors"
                onClick={() => insertTable(t.name)}
              >
                Load SELECT template into editor
              </button>
            </div>
            {expanded === t.name && columnsByTable[t.name] && (
              <ul className="mx-2 mb-2 mt-1 rounded-lg bg-[#1e1e1e] text-gray-100 px-2 py-2 font-mono text-[10px] space-y-1 max-h-40 overflow-y-auto">
                {columnsByTable[t.name].map((c) => (
                  <li key={c.name}>
                    <span className="text-par-light-blue font-semibold">{c.name}</span>{' '}
                    <span className="text-gray-400">{c.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {tables.length === 0 && !loading && (
        <p className="text-xs text-par-text/50 font-medium">No tables listed — pick a database or refresh.</p>
      )}
      {databases.length > 0 && (
        <p className="text-[10px] text-par-text/45 font-medium">Tip: main toolbar has the authoritative database dropdown.</p>
      )}
    </div>
  );
}
