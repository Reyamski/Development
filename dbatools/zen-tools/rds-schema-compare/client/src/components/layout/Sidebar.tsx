import { useEffect, useRef } from 'react';
import { useComparisonStore } from '../../store/comparison-store';
import { useCompare } from '../../hooks/useCompare';
import { syncS3Path } from '../../api/client';
import FolderInput from '../comparison/FolderInput';
import CompareButton from '../comparison/CompareButton';
import GeneratePanel from '../output/GeneratePanel';
import IntegrationsPanel from '../integrations/IntegrationsPanel';
import DumpPanel from '../dump/DumpPanel';

export default function Sidebar() {
  const sourcePath = useComparisonStore((s) => s.sourcePath);
  const targetPath = useComparisonStore((s) => s.targetPath);
  const setSourcePath = useComparisonStore((s) => s.setSourcePath);
  const setTargetPath = useComparisonStore((s) => s.setTargetPath);

  const sourceLastSynced = useComparisonStore((s) => s.sourceLastSynced);
  const sourceSyncing = useComparisonStore((s) => s.sourceSyncing);
  const setSourceLocalPath = useComparisonStore((s) => s.setSourceLocalPath);
  const setSourceLastSynced = useComparisonStore((s) => s.setSourceLastSynced);
  const setSourceSyncing = useComparisonStore((s) => s.setSourceSyncing);

  const targetLastSynced = useComparisonStore((s) => s.targetLastSynced);
  const targetSyncing = useComparisonStore((s) => s.targetSyncing);
  const setTargetLocalPath = useComparisonStore((s) => s.setTargetLocalPath);
  const setTargetLastSynced = useComparisonStore((s) => s.setTargetLastSynced);
  const setTargetSyncing = useComparisonStore((s) => s.setTargetSyncing);

  const ignoreFkNameOnly = useComparisonStore((s) => s.ignoreFkNameOnly);
  const ignoreIndexNameOnly = useComparisonStore((s) => s.ignoreIndexNameOnly);
  const ignoreCollate = useComparisonStore((s) => s.ignoreCollate);
  const ignoreCharset = useComparisonStore((s) => s.ignoreCharset);
  const showOnlyCollateDrift = useComparisonStore((s) => s.showOnlyCollateDrift);
  const showOnlyCharsetDrift = useComparisonStore((s) => s.showOnlyCharsetDrift);
  const ignoreWhitespace = useComparisonStore((s) => s.ignoreWhitespace);
  const setIgnoreFkNameOnly = useComparisonStore((s) => s.setIgnoreFkNameOnly);
  const setIgnoreIndexNameOnly = useComparisonStore((s) => s.setIgnoreIndexNameOnly);
  const setIgnoreCollate = useComparisonStore((s) => s.setIgnoreCollate);
  const setIgnoreCharset = useComparisonStore((s) => s.setIgnoreCharset);
  const setShowOnlyCollateDrift = useComparisonStore((s) => s.setShowOnlyCollateDrift);
  const setShowOnlyCharsetDrift = useComparisonStore((s) => s.setShowOnlyCharsetDrift);
  const setIgnoreWhitespace = useComparisonStore((s) => s.setIgnoreWhitespace);
  const results = useComparisonStore((s) => s.results);
  const hasResults = results.length > 0;
  const error = useComparisonStore((s) => s.error);
  const { runCompare } = useCompare();

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (hasResults) runCompare();
  }, [ignoreFkNameOnly, ignoreIndexNameOnly, ignoreCollate, ignoreCharset, ignoreWhitespace]);

  async function handleSyncSource() {
    setSourceSyncing(true);
    try {
      const { localPath, syncedAt } = await syncS3Path(sourcePath);
      setSourceLocalPath(localPath);
      setSourceLastSynced(syncedAt);
    } catch (e: any) {
      console.error('S3 sync failed:', e.message);
    } finally {
      setSourceSyncing(false);
    }
  }

  async function handleSyncTarget() {
    setTargetSyncing(true);
    try {
      const { localPath, syncedAt } = await syncS3Path(targetPath);
      setTargetLocalPath(localPath);
      setTargetLastSynced(syncedAt);
    } catch (e: any) {
      console.error('S3 sync failed:', e.message);
    } finally {
      setTargetSyncing(false);
    }
  }

  // Clear local cache when path changes away from S3
  const prevSource = useRef(sourcePath);
  const prevTarget = useRef(targetPath);
  useEffect(() => {
    if (prevSource.current !== sourcePath && !sourcePath.startsWith('s3://')) {
      setSourceLocalPath(null);
      setSourceLastSynced(null);
    }
    prevSource.current = sourcePath;
  }, [sourcePath]);
  useEffect(() => {
    if (prevTarget.current !== targetPath && !targetPath.startsWith('s3://')) {
      setTargetLocalPath(null);
      setTargetLastSynced(null);
    }
    prevTarget.current = targetPath;
  }, [targetPath]);

  const driftFilteredCount = (showOnlyCollateDrift || showOnlyCharsetDrift)
    ? results.filter((r) => {
        if (showOnlyCollateDrift && !r.collateDrift) return false;
        if (showOnlyCharsetDrift && !r.charsetDrift) return false;
        return true;
      }).length
    : 0;

  const checkboxClass = 'flex items-center gap-2 text-xs text-gray-300 cursor-pointer';

  return (
    <aside className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col p-4 gap-3 overflow-y-auto">
      <FolderInput
        label="Source"
        value={sourcePath}
        onChange={setSourcePath}
        syncState={sourcePath.startsWith('s3://') ? {
          syncing: sourceSyncing,
          lastSynced: sourceLastSynced,
          onSync: handleSyncSource,
        } : undefined}
      />
      <FolderInput
        label="Target"
        value={targetPath}
        onChange={setTargetPath}
        syncState={targetPath.startsWith('s3://') ? {
          syncing: targetSyncing,
          lastSynced: targetLastSynced,
          onSync: handleSyncTarget,
        } : undefined}
      />

      {/* Exclude from diff */}
      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
          Exclude from diff
        </span>
        <label className={checkboxClass}>
          <input type="checkbox" checked={ignoreFkNameOnly} onChange={(e) => setIgnoreFkNameOnly(e.target.checked)} className="accent-blue-500" />
          FK name-only differences
        </label>
        <label className={checkboxClass}>
          <input type="checkbox" checked={ignoreIndexNameOnly} onChange={(e) => setIgnoreIndexNameOnly(e.target.checked)} className="accent-blue-500" />
          Index name-only differences
        </label>
        <label className={checkboxClass}>
          <input type="checkbox" checked={ignoreCollate} onChange={(e) => setIgnoreCollate(e.target.checked)} className="accent-blue-500" />
          COLLATE differences
        </label>
        <label className={checkboxClass}>
          <input type="checkbox" checked={ignoreCharset} onChange={(e) => setIgnoreCharset(e.target.checked)} className="accent-blue-500" />
          CHARSET differences
        </label>
        <label className={checkboxClass}>
          <input type="checkbox" checked={ignoreWhitespace} onChange={(e) => setIgnoreWhitespace(e.target.checked)} className="accent-blue-500" />
          Whitespace differences
        </label>
      </div>

      {/* Isolate drift */}
      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
          Isolate drift
        </span>
        <label className={checkboxClass}>
          <input type="checkbox" checked={showOnlyCollateDrift} onChange={(e) => setShowOnlyCollateDrift(e.target.checked)} className="accent-amber-500" />
          Show only COLLATE drift
        </label>
        <label className={checkboxClass}>
          <input type="checkbox" checked={showOnlyCharsetDrift} onChange={(e) => setShowOnlyCharsetDrift(e.target.checked)} className="accent-amber-500" />
          Show only CHARSET drift
        </label>
        {(showOnlyCollateDrift || showOnlyCharsetDrift) && (
          <p className="text-xs text-amber-600 pl-5">
            Showing {driftFilteredCount} of {results.length} results
          </p>
        )}
      </div>

      <CompareButton />
      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded p-2">
          {error}
        </div>
      )}
      <DumpPanel />
      <GeneratePanel />
      <IntegrationsPanel />
    </aside>
  );
}
