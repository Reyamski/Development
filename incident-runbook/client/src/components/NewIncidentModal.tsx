import { useState, useEffect } from 'react';
import { useAppStore } from '../store/app-store.js';
import type { IncidentType } from '../api/types.js';

const INCIDENT_TYPES: { value: IncidentType; label: string; description: string; icon: string }[] = [
  { value: 'DEADLOCK_STORM', label: 'Deadlock Storm', description: 'Repeated deadlocks / lock wait timeouts', icon: '⚡' },
  { value: 'HIGH_LOCK_WAIT', label: 'High Lock Wait', description: 'Queries stuck waiting for metadata or row locks', icon: '🔒' },
  { value: 'CONNECTION_EXHAUSTION', label: 'Connection Exhaustion', description: 'max_connections approaching or reached', icon: '📡' },
  { value: 'SLOW_QUERY_FLOOD', label: 'Slow Query Flood', description: 'CPU/IOPS spike from slow queries', icon: '🐌' },
];

export function NewIncidentModal() {
  const {
    closeNewIncidentModal,
    createIncident,
    clusters,
    instances,
    selectedCluster,
    selectedInstance,
    actorName,
    loadInstances,
  } = useAppStore();

  const [cluster, setCluster] = useState(selectedCluster);
  const [instance, setInstance] = useState(selectedInstance);
  const [type, setType] = useState<IncidentType>('DEADLOCK_STORM');
  const [responder, setResponder] = useState(actorName);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadInstances(cluster || undefined);
  }, [cluster, loadInstances]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!instance || !cluster) {
      setError('Please select a cluster and instance.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await createIncident({ instance, cluster, type, responder, notes: notes || undefined });
    } catch (err: any) {
      setError(err.message ?? 'Failed to create incident');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-md shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-red-400">🔥</span>
            <h2 className="text-base font-semibold text-gray-100">New Incident</h2>
          </div>
          <button
            onClick={closeNewIncidentModal}
            className="text-gray-500 hover:text-gray-300 text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-5">
          {/* Cluster */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Cluster</label>
            <select
              value={cluster}
              onChange={(e) => setCluster(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">— select cluster —</option>
              {clusters.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Instance */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Instance</label>
            <select
              value={instance}
              onChange={(e) => setInstance(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">— select instance —</option>
              {instances.map((i) => (
                <option key={i.name} value={i.name}>{i.name}</option>
              ))}
              {/* Allow manual entry if no instances loaded */}
              {instance && !instances.find((i) => i.name === instance) && (
                <option value={instance}>{instance}</option>
              )}
            </select>
            {/* Manual input fallback */}
            <input
              type="text"
              placeholder="Or type instance name..."
              value={instance}
              onChange={(e) => setInstance(e.target.value)}
              className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Incident Type */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Incident Type</label>
            <div className="space-y-1.5">
              {INCIDENT_TYPES.map((t) => (
                <label
                  key={t.value}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    type === t.value
                      ? 'bg-blue-600/10 border border-blue-600/50'
                      : 'hover:bg-gray-800 border border-gray-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={t.value}
                    checked={type === t.value}
                    onChange={() => setType(t.value)}
                    className="mt-0.5 accent-blue-500"
                  />
                  <span className="text-base leading-none mt-0.5">{t.icon}</span>
                  <div>
                    <div className="text-sm text-gray-200 font-medium">{t.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{t.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Responder */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Responder</label>
            <input
              type="text"
              value={responder}
              onChange={(e) => setResponder(e.target.value)}
              placeholder="Your name"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
              Notes <span className="text-gray-600 normal-case font-normal tracking-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
              placeholder="Initial observations, alert context..."
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs flex items-center gap-1.5">
              <span>⚠</span> {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={closeNewIncidentModal}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm border border-gray-700 rounded-lg px-4 py-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              {submitting ? 'Creating...' : 'Create Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
