import { useComparisonStore } from '../../store/comparison-store';

export default function ProgressIndicator() {
  const generating = useComparisonStore((s) => s.generating);
  const generateResult = useComparisonStore((s) => s.generateResult);

  if (generating) {
    return (
      <div className="text-xs text-blue-400 animate-pulse">Generating migration...</div>
    );
  }

  if (generateResult) {
    return (
      <div className="text-xs text-green-400">
        Generated {generateResult.totalStatements} statements to{' '}
        {generateResult.filesWritten.length} file(s)
      </div>
    );
  }

  return null;
}
