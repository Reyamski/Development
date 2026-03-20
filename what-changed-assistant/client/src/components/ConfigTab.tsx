import React from 'react';
import { Settings, Flag, FileCode, Clock, User, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store/app-store';
import { ConfigChange } from '../api/types';

export default function ConfigTab() {
  const { configChanges, selectedChangeId, setSelectedChangeId } = useAppStore();

  if (configChanges.length === 0) {
    return (
      <div className="text-center text-gray-400 py-12">
        No config changes found in this time window
      </div>
    );
  }

  const getChangeTypeBadge = (type: ConfigChange['changeType']) => {
    const badges = {
      parameter: 'bg-blue-700 text-blue-100',
      feature_flag: 'bg-green-700 text-green-100',
      env_var: 'bg-purple-700 text-purple-100',
    };
    return badges[type];
  };

  return (
    <div className="space-y-4">
      {configChanges.map((change) => (
        <div
          key={change.id}
          className={`bg-gray-800 border rounded-lg p-6 cursor-pointer card-hover border-accent-config ${
            selectedChangeId === change.id
              ? 'border-yellow-500 ring-2 ring-yellow-500 shadow-glow-yellow'
              : 'border-gray-700 hover:border-yellow-600'
          }`}
          onClick={() => setSelectedChangeId(selectedChangeId === change.id ? null : change.id)}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {change.changeType === 'parameter' && <Settings className="w-4 h-4 text-blue-400" />}
                {change.changeType === 'feature_flag' && <Flag className="w-4 h-4 text-green-400" />}
                {change.changeType === 'env_var' && <FileCode className="w-4 h-4 text-purple-400" />}
                <span className={`px-2 py-1 text-xs rounded ${getChangeTypeBadge(change.changeType)}`}>
                  {change.changeType.replace('_', ' ')}
                </span>
                {change.requiresReboot && (
                  <span className="px-2 py-1 text-xs rounded bg-red-700 text-red-100 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Requires Reboot
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-100 font-mono">{change.parameter}</h3>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
            <Clock className="w-4 h-4" />
            {new Date(change.timestamp).toLocaleString()}
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded p-4 mb-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-gray-500 mb-1">Old Value:</div>
                <code className="text-red-400 font-mono">
                  {change.oldValue || <span className="text-gray-500 italic">null</span>}
                </code>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">New Value:</div>
                <code className="text-green-400 font-mono">{change.newValue}</code>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-gray-500" />
              <span className="text-gray-500">Source:</span>
              <span className="text-gray-300">{change.source}</span>
            </div>
            {change.appliedBy && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                <span className="text-gray-500">Applied By:</span>
                <span className="text-gray-300">{change.appliedBy}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
