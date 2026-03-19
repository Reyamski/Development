import React from 'react';
import { useAppStore } from '../store/app-store';

export default function CorrelationPanel() {
  const { selectedChangeId, correlations, jiraChanges, databaseChanges, configChanges } = useAppStore();

  if (!selectedChangeId) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-green-400 mb-3">Correlations</h3>
        <div className="text-sm text-gray-400 text-center py-8">
          Select a change to see correlations
        </div>
      </div>
    );
  }

  const relatedCorrelations = correlations.filter((corr) =>
    corr.relatedChangeIds.includes(selectedChangeId)
  );

  if (relatedCorrelations.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-green-400 mb-3">Correlations</h3>
        <div className="text-sm text-gray-400 text-center py-8">
          No correlations found for this change
        </div>
      </div>
    );
  }

  const getChangeSummary = (changeId: string) => {
    const jira = jiraChanges.find((c) => c.id === changeId);
    if (jira) return { type: 'Jira', text: jira.summary, color: 'text-purple-400' };

    const db = databaseChanges.find((c) => c.id === changeId);
    if (db) return { type: 'Database', text: db.description, color: 'text-red-400' };

    const config = configChanges.find((c) => c.id === changeId);
    if (config) return { type: 'Config', text: config.parameter, color: 'text-yellow-400' };

    return { type: 'Unknown', text: changeId, color: 'text-gray-400' };
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-bold text-green-400 mb-3">
        Correlations ({relatedCorrelations.length})
      </h3>
      <div className="space-y-4">
        {relatedCorrelations.map((corr) => (
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
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-100 mb-2">{corr.description}</div>
                <div className="text-xs text-gray-400">
                  Type: {corr.type.replace(/_/g, ' ')}
                </div>
              </div>
              <span
                className={`px-2 py-1 text-xs rounded ml-2 ${
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

            <div className="space-y-2">
              <div className="text-xs text-gray-500 font-semibold">Related Changes:</div>
              {corr.relatedChangeIds
                .filter((id) => id !== selectedChangeId)
                .map((id) => {
                  const summary = getChangeSummary(id);
                  return (
                    <div key={id} className="bg-gray-900 rounded p-2 text-sm">
                      <span className={`font-semibold ${summary.color}`}>[{summary.type}]</span>{' '}
                      <span className="text-gray-300">{summary.text}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
