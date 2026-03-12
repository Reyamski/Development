import { useComparisonStore } from '../../store/comparison-store';

export default function SummaryBar() {
  const summary = useComparisonStore((s) => s.summary);
  if (!summary) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 border-b border-gray-800 text-xs font-medium">
      <span className="text-green-400">{summary.added} added</span>
      <span className="text-gray-700">|</span>
      <span className="text-red-400">{summary.removed} removed</span>
      <span className="text-gray-700">|</span>
      <span className="text-amber-400">{summary.modified} modified</span>
      <span className="text-gray-700">|</span>
      <span className="text-gray-500">{summary.unchanged} unchanged</span>
    </div>
  );
}
