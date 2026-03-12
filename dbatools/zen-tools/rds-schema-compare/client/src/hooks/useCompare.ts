import { useCallback } from 'react';
import { compare } from '../api/client';
import { useComparisonStore } from '../store/comparison-store';

export function useCompare() {
  const {
    sourcePath,
    targetPath,
    sourceLocalPath,
    targetLocalPath,
    ignoreFkNameOnly,
    ignoreIndexNameOnly,
    ignoreCollate,
    ignoreCharset,
    ignoreWhitespace,
    setResults,
    setLoading,
    setError,
    reset,
  } = useComparisonStore();

  const runCompare = useCallback(async () => {
    const effectiveSource = sourceLocalPath ?? sourcePath;
    const effectiveTarget = targetLocalPath ?? targetPath;

    if (!effectiveSource || !effectiveTarget) {
      setError('Both source and target paths are required');
      return;
    }
    setLoading(true);
    setError(null);
    reset();
    try {
      const data = await compare(effectiveSource, effectiveTarget, {
        ignoreFkNameOnly,
        ignoreIndexNameOnly,
        ignoreCollate,
        ignoreCharset,
        ignoreWhitespace,
      });
      setResults(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [
    sourcePath, targetPath, sourceLocalPath, targetLocalPath,
    ignoreFkNameOnly, ignoreIndexNameOnly, ignoreCollate, ignoreCharset, ignoreWhitespace,
    setResults, setLoading, setError, reset,
  ]);

  return { runCompare };
}
