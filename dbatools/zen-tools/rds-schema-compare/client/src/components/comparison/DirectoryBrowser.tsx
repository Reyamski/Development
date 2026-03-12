import { useState, useEffect, useCallback } from 'react';
import { browse } from '../../api/client';
import type { BrowseResponse } from '../../api/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

export default function DirectoryBrowser({ open, onClose, onSelect, initialPath }: Props) {
  const [data, setData] = useState<BrowseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (path?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await browse(path);
      setData(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      load(initialPath || undefined);
    }
  }, [open, initialPath, load]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-[540px] max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-200">Select Directory</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">&times;</button>
        </div>

        {/* Current path */}
        <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-800">
          <p className="text-xs text-gray-400 font-mono truncate">{data?.current || '...'}</p>
        </div>

        {/* Directory list */}
        <div className="flex-1 overflow-y-auto min-h-[200px]">
          {loading && (
            <div className="flex items-center justify-center py-8 text-sm text-gray-500">Loading...</div>
          )}
          {error && (
            <div className="px-4 py-3 text-xs text-red-400">{error}</div>
          )}
          {!loading && data && (
            <div className="py-1">
              {data.parent && (
                <button
                  onClick={() => load(data.parent!)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-blue-400 hover:bg-gray-800 transition-colors"
                >
                  <span className="text-base">&#8593;</span>
                  <span>..</span>
                </button>
              )}
              {data.directories.length === 0 && !data.parent && (
                <div className="px-4 py-3 text-xs text-gray-600">No subdirectories</div>
              )}
              {data.directories.map((dir) => (
                <button
                  key={dir.path}
                  onClick={() => load(dir.path)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors text-left"
                >
                  <span className="text-amber-500 text-xs">&#128193;</span>
                  <span className="truncate">{dir.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (data?.current) {
                onSelect(data.current);
                onClose();
              }
            }}
            disabled={!data?.current}
            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors"
          >
            Select This Folder
          </button>
        </div>
      </div>
    </div>
  );
}
