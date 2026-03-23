import { useMemo } from 'react';
import { useComparisonStore } from '../../store/comparison-store';
import type { DiffStatus } from '../../api/types';
import CategorySection from './CategorySection';

const ORDER: DiffStatus[] = ['added', 'removed', 'modified', 'unchanged'];

export default function FileList() {
  const results = useComparisonStore((s) => s.results);
  const showOnlyCollateDrift = useComparisonStore((s) => s.showOnlyCollateDrift);
  const showOnlyCharsetDrift = useComparisonStore((s) => s.showOnlyCharsetDrift);

  const visibleResults = useMemo(() => {
    if (!showOnlyCollateDrift && !showOnlyCharsetDrift) return results;
    return results.filter((r) => {
      if (showOnlyCollateDrift && !r.collateDrift) return false;
      if (showOnlyCharsetDrift && !r.charsetDrift) return false;
      return true;
    });
  }, [results, showOnlyCollateDrift, showOnlyCharsetDrift]);

  const grouped = useMemo(() => {
    const groups: Record<DiffStatus, typeof results> = {
      added: [],
      removed: [],
      modified: [],
      unchanged: [],
    };
    for (const r of visibleResults) {
      groups[r.status].push(r);
    }
    return groups;
  }, [visibleResults]);

  if (results.length === 0) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      {ORDER.map((status) => (
        <CategorySection key={status} status={status} items={grouped[status]} />
      ))}
    </div>
  );
}
