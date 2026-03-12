import { useState } from 'react';
import type { ComparisonResult, DiffStatus } from '../../api/types';
import FileListItem from './FileListItem';

const colors: Record<DiffStatus, string> = {
  added: 'text-green-400',
  removed: 'text-red-400',
  modified: 'text-amber-400',
  unchanged: 'text-gray-500',
};

interface Props {
  status: DiffStatus;
  items: ComparisonResult[];
}

export default function CategorySection({ status, items }: Props) {
  const [expanded, setExpanded] = useState(status !== 'unchanged');

  if (items.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider hover:bg-gray-800/50"
      >
        <span className="text-gray-600">{expanded ? '\u25BC' : '\u25B6'}</span>
        <span className={colors[status]}>
          {status} ({items.length})
        </span>
      </button>
      {expanded && (
        <div>
          {items.map((item) => (
            <FileListItem key={item.key} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
