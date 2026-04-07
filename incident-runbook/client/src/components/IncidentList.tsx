import { useEffect } from 'react';
import { useAppStore } from '../store/app-store.js';
import type { IncidentSummary } from '../api/types.js';

const TYPE_LABELS: Record<string, string> = {
  DEADLOCK_STORM: 'Deadlock Storm',
  HIGH_LOCK_WAIT: 'High Lock Wait',
  CONNECTION_EXHAUSTION: 'Connection Exhaustion',
  SLOW_QUERY_FLOOD: 'Slow Query Flood',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function IncidentRow({
  incident,
  isActive,
  onSelect,
}: {
  incident: IncidentSummary;
  isActive: boolean;
  onSelect: () => void;
}) {
  const isResolved = incident.status === 'RESOLVED';
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-colors ${
        isActive
          ? 'bg-gray-800 border border-gray-700'
          : 'hover:bg-gray-800/60 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {isResolved ? (
          <span className="text-green-400 text-xs shrink-0">✓</span>
        ) : (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
        )}
        <span className="text-xs font-medium text-gray-200 truncate">{incident.incident_id}</span>
      </div>
      <div className="pl-4 space-y-0.5">
        <div className="text-xs text-blue-400 truncate">{TYPE_LABELS[incident.type] ?? incident.type}</div>
        <div className="text-xs text-gray-500 truncate">{incident.instance}</div>
        <div className="text-xs text-gray-600 font-mono">{formatTime(incident.started_at)}</div>
      </div>
    </button>
  );
}

export function IncidentList() {
  const { incidentList, activeIncident, loadingIncidents, loadIncidents, selectIncident, openNewIncidentModal } =
    useAppStore();

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-800">
        <button
          onClick={openNewIncidentModal}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
        >
          + New Incident
        </button>
      </div>

      <div className="p-3 flex-1 overflow-y-auto">
        {loadingIncidents && (
          <div className="flex items-center justify-center py-8 gap-2">
            <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-500">Loading incidents...</p>
          </div>
        )}

        {!loadingIncidents && incidentList.length === 0 && (
          <div className="flex flex-col items-center py-10 gap-2">
            <span className="text-2xl opacity-20">📋</span>
            <p className="text-xs text-gray-600 text-center">No incidents yet.<br />Create one to get started.</p>
          </div>
        )}

        {incidentList.map((inc) => (
          <IncidentRow
            key={inc.incident_id}
            incident={inc}
            isActive={activeIncident?.incident_id === inc.incident_id}
            onSelect={() => void selectIncident(inc.incident_id)}
          />
        ))}
      </div>
    </div>
  );
}
