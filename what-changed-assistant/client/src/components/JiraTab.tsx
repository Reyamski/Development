import React from 'react';
import { useAppStore } from '../store/app-store';
import { JiraRelease } from '../api/types';

export default function JiraTab() {
  const { jiraChanges, selectedChangeId, setSelectedChangeId } = useAppStore();

  if (jiraChanges.length === 0) {
    return (
      <div className="text-center text-gray-400 py-12">
        No Jira releases or deployments found in this time window
      </div>
    );
  }

  const getDeploymentTypeBadge = (type: JiraRelease['deploymentType']) => {
    const badges = {
      production: 'bg-red-700 text-red-100',
      staging: 'bg-blue-700 text-blue-100',
      hotfix: 'bg-orange-700 text-orange-100',
      unknown: 'bg-gray-700 text-gray-200',
    };
    return badges[type] || badges.unknown;
  };

  return (
    <div className="space-y-4">
      {jiraChanges.map((release) => (
        <div
          key={release.id}
          className={`bg-gray-800 border rounded-lg p-6 cursor-pointer transition-all ${
            selectedChangeId === release.id
              ? 'border-purple-500 ring-2 ring-purple-500'
              : 'border-gray-700 hover:border-purple-600'
          }`}
          onClick={() => setSelectedChangeId(selectedChangeId === release.id ? null : release.id)}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-sm text-purple-400">{release.key}</span>
                <span className={`px-2 py-1 text-xs rounded ${getDeploymentTypeBadge(release.deploymentType)}`}>
                  {release.deploymentType}
                </span>
                <span className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-200">
                  {release.status}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-100">{release.summary}</h3>
            </div>
          </div>

          <div className="text-sm text-gray-400 mb-3">
            Released: {new Date(release.releaseDate).toLocaleString()}
          </div>

          {release.description && (
            <p className="text-sm text-gray-300 mb-3 leading-relaxed">{release.description}</p>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            {release.assignee && (
              <div>
                <span className="text-gray-500">Assignee:</span>{' '}
                <span className="text-gray-300">{release.assignee}</span>
              </div>
            )}
            {release.reporter && (
              <div>
                <span className="text-gray-500">Reporter:</span>{' '}
                <span className="text-gray-300">{release.reporter}</span>
              </div>
            )}
          </div>

          {release.labels.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {release.labels.map((label) => (
                <span key={label} className="px-2 py-1 text-xs rounded bg-purple-900 text-purple-200">
                  {label}
                </span>
              ))}
            </div>
          )}

          {release.components.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {release.components.map((component) => (
                <span key={component} className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300">
                  {component}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
