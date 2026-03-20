import React, { useState } from 'react';
import { Search, Filter, Download, AlertCircle, Link2, Clock } from 'lucide-react';
import { useAppStore } from '../store/app-store';

export default function SearchFilter() {
  const [searchTerm, setSearchTerm] = useState('');
  const {
    jiraChanges,
    databaseChanges,
    configChanges,
    setActiveTab,
  } = useAppStore();

  const [filters, setFilters] = useState({
    deploymentTypes: { production: true, staging: true, hotfix: true, unknown: true },
    severities: { high: true, medium: true, low: true },
    changeTypes: { schema: true, migration: true, query_pattern: true },
  });

  const [showOnlyCorrelated, setShowOnlyCorrelated] = useState(false);
  const [showOnlyHighSeverity, setShowOnlyHighSeverity] = useState(false);

  const totalChanges = jiraChanges.length + databaseChanges.length + configChanges.length;

  const handleExport = () => {
    const data = {
      jiraChanges,
      databaseChanges,
      configChanges,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `what-changed-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search across all changes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <button className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-gray-300 transition-colors">
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs text-gray-400 font-medium">Quick Actions:</div>
        
        <button
          onClick={() => setShowOnlyHighSeverity(!showOnlyHighSeverity)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            showOnlyHighSeverity
              ? 'bg-red-900 text-red-100 border border-red-700'
              : 'bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          High Severity Only
        </button>

        <button
          onClick={() => setShowOnlyCorrelated(!showOnlyCorrelated)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            showOnlyCorrelated
              ? 'bg-green-900 text-green-100 border border-green-700'
              : 'bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          Show Correlated Only
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-md text-gray-300 text-xs font-medium transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export JSON
        </button>

        <button
          onClick={() => {
            setSearchTerm('');
            setShowOnlyCorrelated(false);
            setShowOnlyHighSeverity(false);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-md text-gray-300 text-xs font-medium transition-colors ml-auto"
        >
          <Clock className="w-3.5 h-3.5" />
          Reset Filters
        </button>
      </div>

      {totalChanges > 0 && (
        <div className="mt-3 text-xs text-gray-400">
          Showing <span className="text-blue-400 font-semibold">{totalChanges}</span> total changes
        </div>
      )}
    </div>
  );
}
