import React from 'react';
import { BarChart3, Ticket, Database, Settings } from 'lucide-react';
import { useAppStore } from './store/app-store';
import TimeWindowSelector from './components/TimeWindowSelector';
import SearchFilter from './components/SearchFilter';
import TimelineView from './components/TimelineView';
import RootCauseSuggestions from './components/RootCauseSuggestions';
import SummaryTab from './components/SummaryTab';
import JiraTab from './components/JiraTab';
import DatabaseTab from './components/DatabaseTab';
import ConfigTab from './components/ConfigTab';
import CorrelationPanel from './components/CorrelationPanel';

export default function App() {
  const { activeTab, setActiveTab, loading, error, timeWindow } = useAppStore();

  const tabs = [
    { id: 'summary' as const, label: 'Summary', Icon: BarChart3 },
    { id: 'jira' as const, label: 'Jira', Icon: Ticket },
    { id: 'database' as const, label: 'Database', Icon: Database },
    { id: 'config' as const, label: 'Config', Icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            What Changed? Assistant
          </h1>
          <p className="text-gray-400 text-lg">
            Identify changes before an incident: Jira releases, DB migrations, config changes, and query patterns
          </p>
        </header>

        <TimeWindowSelector />

        {!loading && timeWindow && (
          <>
            <SearchFilter />
            <TimelineView />
            <RootCauseSuggestions />
          </>
        )}

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
              {tabs.map((tab) => {
                const Icon = tab.Icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'border-b-2 border-blue-500 text-blue-400'
                        : 'text-gray-400 hover:text-gray-300 hover:-translate-y-0.5'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                );
              })}
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
