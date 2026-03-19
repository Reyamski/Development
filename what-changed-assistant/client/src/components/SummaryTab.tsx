import React from 'react';
import { useAppStore } from '../store/app-store';

export default function SummaryTab() {
  const { timeWindow, jiraChanges, databaseChanges, configChanges, correlations, setActiveTab } = useAppStore();

  if (!timeWindow) {
    return (
      <div className="text-center text-gray-400 py-12">
        Select an incident time and fetch changes to see summary
      </div>
    );
  }

  const totalChanges = jiraChanges.length + databaseChanges.length + configChanges.length;

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-blue-400 mb-4">Time Window</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Incident Time:</span>
            <div className="text-gray-100 font-mono">{new Date(timeWindow.incidentTime).toLocaleString()}</div>
          </div>
          <div>
            <span className="text-gray-400">Lookback:</span>
            <div className="text-gray-100 font-mono">{timeWindow.lookbackHours} hours</div>
          </div>
          <div>
            <span className="text-gray-400">Start Time:</span>
            <div className="text-gray-100 font-mono">{new Date(timeWindow.startTime).toLocaleString()}</div>
          </div>
          <div>
            <span className="text-gray-400">End Time:</span>
            <div className="text-gray-100 font-mono">{new Date(timeWindow.endTime).toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setActiveTab('jira')}
          className="bg-purple-900 hover:bg-purple-800 border border-purple-700 rounded-lg p-6 text-left transition-colors"
        >
          <div className="text-4xl font-bold text-purple-400">{jiraChanges.length}</div>
          <div className="text-sm text-gray-300 mt-2">Jira Releases/Deployments</div>
        </button>

        <button
          onClick={() => setActiveTab('database')}
          className="bg-red-900 hover:bg-red-800 border border-red-700 rounded-lg p-6 text-left transition-colors"
        >
          <div className="text-4xl font-bold text-red-400">{databaseChanges.length}</div>
          <div className="text-sm text-gray-300 mt-2">Database Changes</div>
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className="bg-yellow-900 hover:bg-yellow-800 border border-yellow-700 rounded-lg p-6 text-left transition-colors"
        >
          <div className="text-4xl font-bold text-yellow-400">{configChanges.length}</div>
          <div className="text-sm text-gray-300 mt-2">Config Changes</div>
        </button>
      </div>

      {correlations.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-bold text-green-400 mb-4">
            Detected Correlations ({correlations.length})
          </h3>
          <div className="space-y-3">
            {correlations.map((corr) => (
              <div
                key={corr.id}
                className={`p-4 rounded border ${
                  corr.strength === 'strong'
                    ? 'bg-green-950 border-green-700'
                    : corr.strength === 'medium'
                    ? 'bg-yellow-950 border-yellow-700'
                    : 'bg-gray-900 border-gray-600'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-100">{corr.description}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Type: {corr.type} | Strength: {corr.strength}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      corr.strength === 'strong'
                        ? 'bg-green-700 text-green-100'
                        : corr.strength === 'medium'
                        ? 'bg-yellow-700 text-yellow-100'
                        : 'bg-gray-600 text-gray-200'
                    }`}
                  >
                    {corr.strength}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalChanges === 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center">
          <div className="text-gray-400 text-lg">No changes detected in this time window</div>
        </div>
      )}
    </div>
  );
}
