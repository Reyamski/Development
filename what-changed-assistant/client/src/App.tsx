import React from 'react';
import { useAppStore } from './store/app-store';
import TimeWindowSelector from './components/TimeWindowSelector';
import SummaryTab from './components/SummaryTab';
import JiraTab from './components/JiraTab';
import DatabaseTab from './components/DatabaseTab';
import ConfigTab from './components/ConfigTab';
import CorrelationPanel from './components/CorrelationPanel';

export default function App() {
  const { activeTab, setActiveTab, loading, error, timeWindow } = useAppStore();

  const tabs = [
    { id: 'summary' as const, label: 'Summary', icon: '📊' },
    { id: 'jira' as const, label: 'Jira', icon: '🎫' },
    { id: 'database' as const, label: 'Database', icon: '🗄️' },
    { id: 'config' as const, label: 'Config', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-blue-400 mb-2">What Changed? Assistant</h1>
          <p className="text-gray-400">
            Identify changes before an incident: Jira releases, DB migrations, config changes, and query patterns
          </p>
        </header>

        <TimeWindowSelector />

        {error && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6">
            <div className="font-semibold text-red-100">Error</div>
            <div className="text-sm text-red-200 mt-1">{error}</div>
          </div>
        )}

        {loading && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center mb-6">
            <div className="text-blue-400 text-lg animate-pulse">Fetching changes...</div>
          </div>
        )}

        {!loading && timeWindow && (
          <>
            <div className="flex border-b border-gray-700 mb-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-3 font-semibold transition-colors ${
                    activeTab === tab.id
                      ? 'border-b-2 border-blue-500 text-blue-400'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {activeTab === 'summary' && <SummaryTab />}
                {activeTab === 'jira' && <JiraTab />}
                {activeTab === 'database' && <DatabaseTab />}
                {activeTab === 'config' && <ConfigTab />}
              </div>

              <div className="lg:col-span-1">
                <CorrelationPanel />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
