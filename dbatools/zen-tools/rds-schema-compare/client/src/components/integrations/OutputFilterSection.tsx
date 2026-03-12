import type { OutputFilter } from '../../api/types';

interface OutputFilterSectionProps {
  filter: OutputFilter;
  onFilterChange: (partial: Partial<OutputFilter>) => void;
  integrationId: string;
}

export default function OutputFilterSection({ filter, onFilterChange, integrationId }: OutputFilterSectionProps) {
  return (
    <div className="space-y-2 pt-2 border-t border-gray-700">
      <span className="block text-xs font-medium text-gray-500">Output Filters</span>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={filter.includeAdded}
            onChange={(e) => onFilterChange({ includeAdded: e.target.checked })}
            className="accent-green-500"
          />
          Added
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={filter.includeRemoved}
            onChange={(e) => onFilterChange({ includeRemoved: e.target.checked })}
            className="accent-red-500"
          />
          Removed
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={filter.includeModified}
            onChange={(e) => onFilterChange({ includeModified: e.target.checked })}
            className="accent-yellow-500"
          />
          Modified
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={filter.includeCollation}
            onChange={(e) => onFilterChange({ includeCollation: e.target.checked })}
            className="accent-blue-500"
          />
          Collation & Charset
        </label>
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
          <input
            type="radio"
            name={`detailLevel-${integrationId}`}
            checked={filter.detailLevel === 'full'}
            onChange={() => onFilterChange({ detailLevel: 'full' })}
          />
          Full Detail
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
          <input
            type="radio"
            name={`detailLevel-${integrationId}`}
            checked={filter.detailLevel === 'list'}
            onChange={() => onFilterChange({ detailLevel: 'list' })}
          />
          List Only
        </label>
      </div>
    </div>
  );
}
