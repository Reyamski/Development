import React, { useState } from 'react';
import { useAppStore } from '../store/app-store';
import { fetchChangesSummary } from '../api/client';

export default function TimeWindowSelector() {
  const { incidentTime, lookbackHours, setIncidentTime, setLookbackHours, setSummary, setLoading, setError, reset } = useAppStore();
  const [localIncidentTime, setLocalIncidentTime] = useState(incidentTime);
  const [localLookbackHours, setLocalLookbackHours] = useState(lookbackHours);

  const handleFetch = async () => {
    if (!localIncidentTime) {
      setError('Please select an incident time');
      return;
    }

    setIncidentTime(localIncidentTime);
    setLookbackHours(localLookbackHours);
    setLoading(true);
    setError(null);
    reset();

    try {
      const summary = await fetchChangesSummary(localIncidentTime, localLookbackHours);
      setSummary(summary);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
      <h2 className="text-xl font-bold mb-4 text-blue-400">Incident Time Window</h2>
      
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
        onClick={handleFetch}
        className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition-colors"
      >
        Fetch Changes
      </button>
    </div>
  );
}
