import { useState } from 'react';
import { useAppStore } from '../store/app-store.js';

export function KillConfirmModal() {
  const { killTarget, closeKillModal, confirmKill } = useAppStore();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!killTarget) return null;

  async function handleConfirm() {
    if (!reason.trim()) {
      setError('Please provide a reason for this action.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await confirmKill(reason.trim());
    } catch (err: any) {
      setError(err.message ?? 'Kill operation failed');
      setSubmitting(false);
    }
  }

  const modeLabel = killTarget.mode === 'connection' ? 'Kill Connection' : 'Kill Query';
  const modeDesc =
    killTarget.mode === 'connection'
      ? 'This will terminate the entire connection (mysql.rds_kill).'
      : 'This will kill only the running query, leaving the connection alive (mysql.rds_kill_query).';

  const modeUppercase = killTarget.mode === 'connection' ? 'CONNECTION' : 'QUERY';

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-red-800 rounded-lg w-full max-w-md shadow-2xl overflow-hidden">
        {/* RED header */}
        <div className="bg-red-950 border-b border-red-800 px-6 py-4 flex items-center gap-3">
          <span className="text-red-400 text-xl leading-none">⚠</span>
          <div>
            <h2 className="text-base font-semibold text-red-300">{modeLabel}</h2>
            <p className="text-xs text-red-400/70 mt-0.5">Destructive action — will be logged to audit trail</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Thread details */}
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Thread ID</span>
              <span className="text-white font-mono text-sm font-bold">{killTarget.threadId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Mode</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded border ${
                killTarget.mode === 'connection'
                  ? 'bg-red-950 text-red-400 border-red-800'
                  : 'bg-yellow-950 text-yellow-400 border-yellow-800'
              }`}>
                {modeUppercase}
              </span>
            </div>
            {killTarget.info && (
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">Query</span>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs font-mono text-gray-300 overflow-x-auto leading-relaxed">
                  {killTarget.info}
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">{modeDesc}</p>

          {/* Reason — required */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
              Reason <span className="text-red-400">*</span>
              <span className="text-gray-600 normal-case font-normal tracking-normal ml-1">— required, logged in audit trail</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Blocking transaction on orders table causing cascade lockouts"
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors resize-none"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs flex items-center gap-1.5">
              <span>⚠</span> {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={closeKillModal}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm border border-gray-700 rounded-lg px-4 py-2 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleConfirm()}
              disabled={submitting || !reason.trim()}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              {submitting ? 'Executing...' : `Confirm ${modeLabel}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
