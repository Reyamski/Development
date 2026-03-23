import { useCompare } from '../../hooks/useCompare';
import { useComparisonStore } from '../../store/comparison-store';

export default function CompareButton() {
  const { runCompare } = useCompare();
  const loading = useComparisonStore((s) => s.loading);

  return (
    <button
      onClick={runCompare}
      disabled={loading}
      className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
    >
      {loading ? 'Comparing...' : 'Compare'}
    </button>
  );
}
