import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, RefreshCw, Activity, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../store/app-store';
import { fetchChangesSummary } from '../api/client';

export default function TimeWindowSelector() {
  const { 
    mode, 
    incidentTime, 
    lookbackHours, 
    autoRefresh,
    setMode,
    setIncidentTime, 
    setLookbackHours, 
    setAutoRefresh,
    setSummary, 
    setLoading, 
    setError, 
    reset 
  } = useAppStore();
  
  const [localIncidentTime, setLocalIncidentTime] = useState(incidentTime);
  const [localLookbackHours, setLocalLookbackHours] = useState(lookbackHours);

  const handleFetch = useCallback(async (customTime?: string, customLookback?: number) => {
    const timeToUse = customTime || localIncidentTime || new Date().toISOString();
    const lookbackToUse = customLookback !== undefined ? customLookback : localLookbackHours;

    setIncidentTime(timeToUse);
    setLookbackHours(lookbackToUse);
    setLoading(true);
    setError(null);
    reset();

    try {
      const summary = await fetchChangesSummary(timeToUse, lookbackToUse);
      setSummary(summary);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [localIncidentTime, localLookbackHours, setIncidentTime, setLookbackHours, setLoading, setError, reset, setSummary]);

  // Auto-fetch on mount in Daily mode
  useEffect(() => {
    if (mode === 'daily') {
      const now = new Date().toISOString();
      handleFetch(now, 24);
    }
  }, [mode]); // Only run when mode changes

  // Auto-refresh every 5 mins in Daily mode
  useEffect(() => {
    if (mode === 'daily' && autoRefresh) {
      const interval = setInterval(() => {
        const now = new Date().toISOString();
        handleFetch(now, 24);
      }, 5 * 60 * 1000); // 5 minutes

      return () => clearInterval(interval);
    }
  }, [mode, autoRefresh, handleFetch]);

  const handleSetNow = () => {
    const now = new Date();
    const formatted = now.toISOString().slice(0, 16);
    setLocalIncidentTime(formatted);
  };

  const handleSet1HourAgo = () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const formatted = oneHourAgo.toISOString().slice(0, 16);
    setLocalIncidentTime(formatted);
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-6">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2">
          {mode === 'daily' ? <Calendar className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {mode === 'daily' ? 'Daily Change Dashboard' : 'Incident Investigation'}
        </h2>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode('daily')}
            className={`px-4 py-2 rounded-l flex items-center gap-2 transition-colors ${
              mode === 'daily'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Activity className="w-4 h-4" />
            Daily
          </button>
          <button
            onClick={() => setMode('incident')}
            className={`px-4 py-2 rounded-r flex items-center gap-2 transition-colors ${
              mode === 'incident'
                ? 'bg-red-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Incident
          </button>
        </div>
      </div>

      {/* Daily Mode UI */}
      {mode === 'daily' && (
        <div className="space-y-4">
          <div className="bg-green-950 border border-green-700 rounded p-4">
            <p className="text-sm text-green-200">
              <strong>Daily Mode:</strong> Automatically shows changes from the last 24 hours.
              {autoRefresh && ' Auto-refreshing every 5 minutes.'}
            </p>
          </div>
          
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600"
              />
              Auto-refresh every 5 minutes
            </label>
            
            <button
              onClick={() => handleFetch(new Date().toISOString(), 24)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Now
            </button>
          </div>
        </div>
      )}

      {/* Incident Mode UI */}
      {mode === 'incident' && (
        <div className="space-y-4">
          <div className="bg-red-950 border border-red-700 rounded p-4">
            <p className="text-sm text-red-200">
              <strong>Incident Mode:</strong> Investigate a specific incident by setting the time and lookback window.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Incident Time
              </label>
              <input
                type="datetime-local"
                value={localIncidentTime}
                onChange={(e) => setLocalIncidentTime(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-gray-100 focus:outline-none focus:border-blue-500"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSetNow}
                  className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300"
                >
                  Now
                </button>
                <button
                  onClick={handleSet1HourAgo}
                  className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300"
                >
                  1 Hour Ago
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Lookback Hours
              </label>
              <select
                value={localLookbackHours}
                onChange={(e) => setLocalLookbackHours(parseInt(e.target.value))}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-gray-100 focus:outline-none focus:border-blue-500"
              >
                <option value={1}>1 hour</option>
                <option value={3}>3 hours</option>
                <option value={6}>6 hours</option>
                <option value={12}>12 hours</option>
                <option value={24}>24 hours</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => handleFetch()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition-colors"
          >
            Investigate Incident
          </button>
        </div>
      )}
    </div>
  );
}
