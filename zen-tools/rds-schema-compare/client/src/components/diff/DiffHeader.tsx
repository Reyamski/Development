import type { ComparisonResult } from '../../api/types';
import StatusBadge from '../comparison/StatusBadge';

interface Props {
  item: ComparisonResult;
}

export default function DiffHeader({ item }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 border-b border-gray-800">
      <span className="text-sm text-gray-300 font-medium">{item.key}</span>
      <StatusBadge status={item.status} />
    </div>
  );
}
