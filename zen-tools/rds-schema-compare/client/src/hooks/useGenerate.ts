import { useCallback } from 'react';
import { generate } from '../api/client';
import { useComparisonStore } from '../store/comparison-store';

export function useGenerate() {
  const { results, selectedForExport, outputPath, singleFile, setGenerating, setGenerateResult, setError } =
    useComparisonStore();

  const runGenerate = useCallback(async () => {
    if (!outputPath) {
      setError('Output path is required');
      return;
    }
    const selected = results.filter(
      (r) => r.status !== 'unchanged' && selectedForExport.has(r.key)
    );
    if (selected.length === 0) {
      setError('No files selected for export');
      return;
    }
    setGenerating(true);
    setError(null);
    setGenerateResult(null);
    try {
      const data = await generate({ results: selected, outputPath, singleFile });
      setGenerateResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }, [results, selectedForExport, outputPath, singleFile, setGenerating, setGenerateResult, setError]);

  return { runGenerate };
}
