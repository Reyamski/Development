import type { ComparisonResult } from '../../api/types';
import StatusBadge from './StatusBadge';
import { useComparisonStore } from '../../store/comparison-store';

interface Props {
  item: ComparisonResult;
}

export default function FileListItem({ item }: Props) {
  const selectedKey = useComparisonStore((s) => s.selectedKey);
  const setSelectedKey = useComparisonStore((s) => s.setSelectedKey);
  const selectedForExport = useComparisonStore((s) => s.selectedForExport);
  const toggleExport = useComparisonStore((s) => s.toggleExport);
  const isSelected = selectedKey === item.key;
  const isChecked = selectedForExport.has(item.key);
  const isChanged = item.status !== 'unchanged';

  return (
    <div
      className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-sm hover:bg-gray-800 transition-colors ${
        isSelected ? 'bg-gray-800 border-l-2 border-blue-500' : 'border-l-2 border-transparent'
      }`}
    >
      {isChanged && (
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => {
            e.stopPropagation();
            toggleExport(item.key);
          }}
          className="accent-blue-500 shrink-0 cursor-pointer"
        />
      )}
      <button
        onClick={() => setSelectedKey(item.key)}
        className="flex-1 flex items-center justify-between text-left min-w-0"
      >
        <span className="truncate text-gray-300 mr-2">
          <span className="text-gray-600 text-xs">{item.objectType}/</span>
          {item.name}
        </span>
        <StatusBadge status={item.status} />
      </button>
    </div>
  );
}
