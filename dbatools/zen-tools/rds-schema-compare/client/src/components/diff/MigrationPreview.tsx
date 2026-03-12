import { useState, useEffect, useMemo } from 'react';
import { useComparisonStore } from '../../store/comparison-store';
import { preview } from '../../api/client';

export default function MigrationPreview() {
  const selectedKey = useComparisonStore((s) => s.selectedKey);
  const results = useComparisonStore((s) => s.results);
  const [sql, setSql] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const selected = useMemo(
    () => results.find((r) => r.key === selectedKey),
    [results, selectedKey]
  );

  useEffect(() => {
    if (!selected || selected.status === 'unchanged') {
      setSql(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    preview(selected)
      .then((res) => {
        if (!cancelled) setSql(res.sql);
      })
      .catch(() => {
        if (!cancelled) setSql('-- Error generating preview');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  if (!selected || selected.status === 'unchanged') return null;

  return (
    <div className="border-t border-gray-800 flex flex-col bg-gray-950">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-200 hover:bg-gray-900 transition-colors"
      >
        <span className="text-[10px]">{collapsed ? '\u25B6' : '\u25BC'}</span>
        Migration SQL Preview
        {loading && <span className="text-blue-400 font-normal animate-pulse ml-1">loading...</span>}
      </button>
      {!collapsed && (
        <div className="overflow-auto max-h-56 px-4 pb-3">
          <pre className="text-xs font-mono text-emerald-300 whitespace-pre-wrap leading-relaxed">
            {loading ? '-- Generating...' : sql || '-- No preview available'}
          </pre>
        </div>
      )}
    </div>
  );
}
