import { useAppStore } from '../store/app-store';
import { analyzeDDL } from '../api/client';

const EXAMPLE_DDL = `ALTER TABLE ecommerce.orders ADD COLUMN processed_at DATETIME NULL`;

export function DdlInput() {
  const {
    ddl,
    setDdl,
    selectedCluster,
    selectedInstance,
    analyzing,
    setAnalyzing,
    setAnalysisResult,
    setAnalysisError,
  } = useAppStore();

  const canAnalyze = selectedCluster && selectedInstance && ddl.trim() && !analyzing;

  async function handleAnalyze() {
    if (!canAnalyze) return;
    setAnalyzing(true);
    setAnalysisError('');
    try {
      const result = await analyzeDDL(selectedCluster, selectedInstance, ddl.trim());
      setAnalysisResult(result);
    } catch (err: any) {
      setAnalysisError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleAnalyze();
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
          DDL Statement
        </label>
        {selectedCluster && selectedInstance && (
          <span className="text-xs text-gray-500">
            Target:{' '}
            <span className="text-blue-400 font-medium">{selectedInstance}</span>
          </span>
        )}
      </div>

      <textarea
        value={ddl}
        onChange={(e) => setDdl(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={EXAMPLE_DDL}
        rows={5}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-y transition-colors leading-relaxed"
        spellCheck={false}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-600">
          {selectedCluster && selectedInstance
            ? 'Press Ctrl+Enter to analyze'
            : 'Select a cluster and instance first'}
        </p>
        <button
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:border disabled:border-gray-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
        >
          {analyzing ? (
            <>
              <svg
                className="w-3.5 h-3.5 animate-spin text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              Analyze
              <span className="text-blue-300">&#8594;</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
