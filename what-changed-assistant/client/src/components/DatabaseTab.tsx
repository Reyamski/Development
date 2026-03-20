import React from 'react';
import { Database, Table, Zap, Clock, TrendingUp } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useAppStore } from '../store/app-store';
import { DatabaseChange } from '../api/types';

export default function DatabaseTab() {
  const { databaseChanges, selectedChangeId, setSelectedChangeId } = useAppStore();

  if (databaseChanges.length === 0) {
    return (
      <div className="text-center text-gray-400 py-12">
        No database changes found in this time window
      </div>
    );
  }

  const getSeverityBadge = (severity: DatabaseChange['severity']) => {
    const badges = {
      high: 'bg-red-700 text-red-100',
      medium: 'bg-yellow-700 text-yellow-100',
      low: 'bg-green-700 text-green-100',
    };
    return badges[severity];
  };

  const getChangeTypeBadge = (type: DatabaseChange['changeType']) => {
    const badges = {
      schema: 'bg-blue-700 text-blue-100',
      migration: 'bg-purple-700 text-purple-100',
      query_pattern: 'bg-orange-700 text-orange-100',
    };
    return badges[type];
  };

  return (
    <div className="space-y-4">
      {databaseChanges.map((change) => (
        <div
          key={change.id}
          className={`bg-gray-800 border rounded-lg p-6 cursor-pointer card-hover border-accent-database ${
            selectedChangeId === change.id
              ? 'border-red-500 ring-2 ring-red-500 shadow-glow-red'
              : 'border-gray-700 hover:border-red-600'
          }`}
          onClick={() => setSelectedChangeId(selectedChangeId === change.id ? null : change.id)}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {change.changeType === 'schema' && <Table className="w-4 h-4 text-blue-400" />}
                {change.changeType === 'migration' && <Database className="w-4 h-4 text-purple-400" />}
                {change.changeType === 'query_pattern' && <Zap className="w-4 h-4 text-orange-400" />}
                <span className={`px-2 py-1 text-xs rounded ${getChangeTypeBadge(change.changeType)}`}>
                  {change.changeType}
                </span>
                <span className={`px-2 py-1 text-xs rounded ${getSeverityBadge(change.severity)}`}>
                  {change.severity}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-100">{change.description}</h3>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
            <Clock className="w-4 h-4" />
            {new Date(change.timestamp).toLocaleString()}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
            <div>
              <span className="text-gray-500">Database:</span>{' '}
              <span className="text-gray-300 font-mono">{change.database}</span>
            </div>
            {change.table && (
              <div>
                <span className="text-gray-500">Table:</span>{' '}
                <span className="text-gray-300 font-mono">{change.table}</span>
              </div>
            )}
          </div>

          {change.details && (
            <div className="mt-4 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
                <div className="text-xs font-semibold text-gray-400">Details</div>
              </div>
              {change.changeType === 'schema' && change.details.statement && (
                <div className="p-4">
                  <div className="text-xs text-gray-500 mb-2 flex items-center gap-2">
                    <Table className="w-3.5 h-3.5" />
                    SQL Statement:
                  </div>
                  <SyntaxHighlighter
                    language="sql"
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.8125rem',
                    }}
                  >
                    {change.details.statement}
                  </SyntaxHighlighter>
                  {change.details.executionTime && (
                    <div className="text-xs text-gray-400">
                      Execution Time: {change.details.executionTime}
                    </div>
                  )}
                  {change.details.rowsAffected && (
                    <div className="text-xs text-gray-400">
                      Rows Affected: {change.details.rowsAffected.toLocaleString()}
                    </div>
                  )}
                </div>
              )}
              {change.changeType === 'query_pattern' && (
                <div className="p-4">
                  <div className="text-xs text-gray-500 mb-2 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5" />
                    Query Pattern:
                  </div>
                  <SyntaxHighlighter
                    language="sql"
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.8125rem',
                    }}
                  >
                    {change.details.queryText}
                  </SyntaxHighlighter>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 mt-3 p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Executions: <span className="text-red-400 font-semibold">{change.details.executionCount?.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      Avg Latency: <span className="text-yellow-400 font-semibold">{change.details.avgLatency}ms</span>
                    </div>
                  </div>
                </div>
              )}
              {change.changeType === 'migration' && change.details.tables && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Tables Created:</div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {change.details.tables.map((table: string) => (
                      <span key={table} className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300 font-mono">
                        {table}
                      </span>
                    ))}
                  </div>
                  {change.details.backfillRows && (
                    <div className="text-xs text-gray-400">
                      Backfill Rows: {change.details.backfillRows.toLocaleString()}
                    </div>
                  )}
                  {change.details.duration && (
                    <div className="text-xs text-gray-400">Duration: {change.details.duration}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
