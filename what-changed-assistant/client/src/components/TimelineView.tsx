import React from 'react';
import { GitCommit, Ticket, Database, Settings } from 'lucide-react';
import { useAppStore } from '../store/app-store';

export default function TimelineView() {
  const {
    jiraChanges,
    databaseChanges,
    configChanges,
    timeWindow,
    setSelectedChangeId,
    setActiveTab,
  } = useAppStore();

  if (!timeWindow) return null;

  const allChanges = [
    ...jiraChanges.map((c) => ({ ...c, type: 'jira' as const, time: new Date(c.releaseDate) })),
    ...databaseChanges.map((c) => ({ ...c, type: 'database' as const, time: new Date(c.timestamp) })),
    ...configChanges.map((c) => ({ ...c, type: 'config' as const, time: new Date(c.timestamp) })),
  ].sort((a, b) => a.time.getTime() - b.time.getTime());

  if (allChanges.length === 0) return null;

  const startTime = new Date(timeWindow.startTime).getTime();
  const endTime = new Date(timeWindow.endTime).getTime();
  const duration = endTime - startTime;

  const getPosition = (changeTime: Date) => {
    const time = changeTime.getTime();
    return ((time - startTime) / duration) * 100;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'jira':
        return <Ticket className="w-4 h-4" />;
      case 'database':
        return <Database className="w-4 h-4" />;
      case 'config':
        return <Settings className="w-4 h-4" />;
      default:
        return <GitCommit className="w-4 h-4" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'jira':
        return 'bg-purple-500 border-purple-400 text-purple-100';
      case 'database':
        return 'bg-red-500 border-red-400 text-red-100';
      case 'config':
        return 'bg-yellow-500 border-yellow-400 text-yellow-100';
      default:
        return 'bg-gray-500 border-gray-400 text-gray-100';
    }
  };

  const handleChangeClick = (change: any, type: string) => {
    setSelectedChangeId(change.id);
    if (type === 'jira') setActiveTab('jira');
    else if (type === 'database') setActiveTab('database');
    else if (type === 'config') setActiveTab('config');
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-6">
      <h2 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
        <GitCommit className="w-5 h-5" />
        Change Timeline
      </h2>

      <div className="relative h-24">
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-700" />

        <div className="absolute top-1/2 left-0 w-2 h-2 rounded-full bg-gray-500 -translate-y-1/2" />
        <div className="absolute top-1/2 right-0 w-2 h-2 rounded-full bg-gray-500 -translate-y-1/2" />

        {allChanges.map((change, index) => (
          <button
            key={`${change.type}-${change.id}-${index}`}
            onClick={() => handleChangeClick(change, change.type)}
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group ${getColor(
              change.type
            )} w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-200 hover:scale-125 hover:shadow-lg z-10`}
            style={{ left: `${getPosition(change.time)}%` }}
            title={`${change.type.toUpperCase()}: ${'summary' in change ? change.summary : change.description}`}
          >
            {getIcon(change.type)}
            
            <div className="absolute bottom-full mb-2 hidden group-hover:block w-48 bg-gray-800 border border-gray-600 rounded-lg p-2 text-xs text-left shadow-xl">
              <div className="font-semibold text-gray-100 mb-1">
                {'summary' in change ? change.summary : change.description}
              </div>
              <div className="text-gray-400">{change.time.toLocaleString()}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-between mt-4 text-xs text-gray-400">
        <div>{new Date(timeWindow.startTime).toLocaleString()}</div>
        <div className="font-semibold text-blue-400">{timeWindow.lookbackHours} hours before incident</div>
        <div>{new Date(timeWindow.endTime).toLocaleString()}</div>
      </div>

      <div className="flex items-center gap-6 mt-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span className="text-gray-400">Jira ({jiraChanges.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-gray-400">Database ({databaseChanges.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-gray-400">Config ({configChanges.length})</span>
        </div>
      </div>
    </div>
  );
}
