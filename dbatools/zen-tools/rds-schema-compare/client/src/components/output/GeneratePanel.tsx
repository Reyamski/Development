import { useComparisonStore } from '../../store/comparison-store';
import { useGenerate } from '../../hooks/useGenerate';
import OutputModeToggle from './OutputModeToggle';
import OutputPathInput from './OutputPathInput';
import ProgressIndicator from './ProgressIndicator';

export default function GeneratePanel() {
  const summary = useComparisonStore((s) => s.summary);
  const results = useComparisonStore((s) => s.results);
  const selectedForExport = useComparisonStore((s) => s.selectedForExport);
  const selectAllChanged = useComparisonStore((s) => s.selectAllChanged);
  const deselectAll = useComparisonStore((s) => s.deselectAll);
  const generating = useComparisonStore((s) => s.generating);
  const { runGenerate } = useGenerate();

  if (!summary) return null;

  const totalChanged = results.filter((r) => r.status !== 'unchanged').length;
  const selectedCount = selectedForExport.size;

  return (
    <div className="space-y-3 border-t border-gray-800 pt-3">
      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
        Generate Migration
      </h3>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {selectedCount} of {totalChanged} files selected
        </span>
        <div className="flex gap-2">
          <button
            onClick={selectAllChanged}
            className="text-[10px] text-blue-400 hover:text-blue-300"
          >
            All
          </button>
          <button
            onClick={deselectAll}
            className="text-[10px] text-blue-400 hover:text-blue-300"
          >
            None
          </button>
        </div>
      </div>
      <OutputModeToggle />
      <OutputPathInput />
      <button
        onClick={runGenerate}
        disabled={generating || selectedCount === 0}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
      >
        {generating ? 'Generating...' : `Generate SQL (${selectedCount})`}
      </button>
      <ProgressIndicator />
    </div>
  );
}
