import { useState, useCallback } from 'react';
import { validatePath } from '../../api/client';
import DirectoryBrowser from './DirectoryBrowser';

interface SyncState {
  syncing: boolean;
  lastSynced: string | null;
  onSync: () => void;
}

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  syncState?: SyncState;
}

function formatSyncAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

const isS3 = (p: string) => p.startsWith('s3://');

export default function FolderInput({ label, value, onChange, syncState }: Props) {
  const [valid, setValid] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);

  const check = useCallback(async (path: string) => {
    if (!path || isS3(path)) {
      setValid(null);
      return;
    }
    setChecking(true);
    try {
      const res = await validatePath(path);
      setValid(res.valid);
    } catch {
      setValid(false);
    } finally {
      setChecking(false);
    }
  }, []);

  const handleSelect = (path: string) => {
    onChange(path);
    setValid(true);
  };

  const s3Mode = isS3(value);

  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
        {label}
      </label>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setValid(null);
            }}
            onBlur={() => check(value)}
            placeholder="/path/to/schema/dump or s3://bucket/path"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
          {!s3Mode && checking && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">...</span>
          )}
          {!s3Mode && !checking && valid === true && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-400">OK</span>
          )}
          {!s3Mode && !checking && valid === false && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-red-400">Invalid</span>
          )}
        </div>
        {s3Mode && syncState ? (
          <button
            onClick={syncState.onSync}
            disabled={syncState.syncing}
            className="px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors shrink-0 disabled:text-gray-600"
            title="Sync from S3"
          >
            {syncState.syncing ? '…' : '⇩ Sync'}
          </button>
        ) : !s3Mode ? (
          <button
            onClick={() => setBrowserOpen(true)}
            className="px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors shrink-0"
            title="Browse..."
          >
            &#128194;
          </button>
        ) : null}
      </div>
      {s3Mode && syncState?.lastSynced && (
        <p className="text-xs text-gray-600">
          Synced {formatSyncAge(syncState.lastSynced)}
          {syncState.syncing ? ' — syncing…' : ''}
        </p>
      )}
      {s3Mode && !syncState?.lastSynced && !syncState?.syncing && (
        <p className="text-xs text-gray-600">Not yet synced — click Sync to download</p>
      )}
      <DirectoryBrowser
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onSelect={handleSelect}
        initialPath={value || undefined}
      />
    </div>
  );
}
