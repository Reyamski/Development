import React from 'react';
import { Lightbulb, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../store/app-store';

export default function RootCauseSuggestions() {
  const { jiraChanges, databaseChanges, configChanges, correlations, timeWindow } = useAppStore();

  if (!timeWindow || correlations.length === 0) return null;

  const strongCorrelations = correlations.filter((c) => c.strength === 'strong');
  
  const allChanges = [
    ...jiraChanges.map((c) => ({ ...c, type: 'jira', time: new Date(c.releaseDate).getTime() })),
    ...databaseChanges.map((c) => ({ ...c, type: 'database', time: new Date(c.timestamp).getTime() })),
    ...configChanges.map((c) => ({ ...c, type: 'config', time: new Date(c.timestamp).getTime() })),
  ].sort((a, b) => a.time - b.time);

  const getChangeName = (id: string) => {
    const jira = jiraChanges.find((c) => c.id === id);
    if (jira) return jira.summary;

    const db = databaseChanges.find((c) => c.id === id);
    if (db) return db.description;

    const config = configChanges.find((c) => c.id === id);
    if (config) return config.parameter;

    return 'Unknown change';
  };

  const buildRootCauseChain = () => {
    if (strongCorrelations.length === 0) return null;

    const correlation = strongCorrelations[0];
    const relatedChanges = correlation.relatedChangeIds.map((id) => {
      const change = allChanges.find((c) => c.id === id);
      return change ? { id, name: getChangeName(id), time: change.time, type: change.type } : null;
    }).filter(Boolean).sort((a, b) => a!.time - b!.time);

    return { correlation, chain: relatedChanges };
  };

  const rootCause = buildRootCauseChain();
  
  const confidence = strongCorrelations.length > 0 ? 85 : correlations.length > 2 ? 65 : 45;

  return (
    <div className="bg-gradient-to-br from-green-950 to-gray-900 border border-green-700 rounded-lg p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-6 h-6 text-yellow-400" />
        <h2 className="text-lg font-bold text-green-400">AI Root Cause Suggestions</h2>
        <span className="ml-auto px-3 py-1 bg-green-700 text-green-100 text-xs font-semibold rounded-full">
          {confidence}% Confidence
        </span>
      </div>

      {rootCause ? (
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-gray-100 mb-2">Likely Root Cause Chain</div>
              <div className="text-sm text-gray-300 mb-3">{rootCause.correlation.description}</div>
            </div>
          </div>

          <div className="space-y-2">
            {rootCause.chain.map((change, index) => (
              <div key={change!.id} className="flex items-start gap-3 pl-8">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-gray-200 font-medium">{change!.name}</div>
                  <div className="text-xs text-gray-400">
                    {change!.type.toUpperCase()} • {new Date(change!.time).toLocaleTimeString()}
                  </div>
                </div>
                {index < rootCause.chain.length - 1 && (
                  <TrendingUp className="w-4 h-4 text-green-400" />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-4">
            <button className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
              <CheckCircle2 className="w-4 h-4" />
              Mark as Root Cause
            </button>
            <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition-colors">
              View Details
            </button>
            <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition-colors">
              Add to Report
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <div className="text-sm">
            Analyzing correlations...
            <br />
            <span className="text-xs">Found {correlations.length} correlation(s), but none with strong confidence</span>
          </div>
        </div>
      )}
    </div>
  );
}
