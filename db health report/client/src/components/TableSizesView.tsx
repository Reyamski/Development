import { useState } from 'react';
import { useAppStore } from '../store/app-store';
import { useTableSizes } from '../hooks/useTableSizes';
import { InstanceSelector } from './InstanceSelector';

export function TableSizesView() {
  const { tableSizes, tableSizesLoading, tableSizesError, instances, selectedCluster, loginStatus } = useAppStore();
  const { loadTableSizes } = useTableSizes();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'totalSizeMb' | 'rows' | 'displayName'>('totalSizeMb');
  const [sortAsc, setSortAsc] = useState(false);

  const needsConnection = !selectedCluster || !loginStatus?.loggedIn;

  const filtered = tableSizes
    .filter(t => !search || t.displayName.toLowerCase().includes(search.toLowerCase()) || t.instanceName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'string') return sortAsc ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
      return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });

  const totalSize = tableSizes.reduce((sum, t) => sum + t.totalSizeMb, 0);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  if (needsConnection) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600">
        <div className="text-center">
          <div className="text-4xl mb-3 opacity-30">&#128451;</div>
          <p className="text-sm">Connect to a Teleport cluster first</p>
          <p className="text-xs text-gray-700 mt-1">Use the sidebar to select a cluster and log in</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Table Sizes</h2>
          <p className="text-xs text-gray-500">Select instances and fetch table sizes</p>
        </div>
        {tableSizes.length > 0 && (
          <span className="text-xs text-gray-400">
            {tableSizes.length} tables | {totalSize < 1024 ? `${totalSize.toFixed(1)} MB` : `${(totalSize / 1024).toFixed(2)} GB`} total
          </span>
        )}
      </div>

      <InstanceSelector />

      <div className="flex items-center gap-3">
        <button
          onClick={loadTableSizes}
          disabled={tableSizesLoading}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm rounded-lg px-4 py-2 transition-colors"
        >
          {tableSizesLoading ? 'Fetching...' : 'Fetch Table Sizes'}
        </button>
        {tableSizes.length > 0 && (
          <input
            type="text"
            placeholder="Search tables..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-gray-800 text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-emerald-500 focus:outline-none"
          />
        )}
      </div>

      {tableSizesError && <p className="text-sm text-red-400">{tableSizesError}</p>}
      {tableSizesLoading && <p className="text-sm text-gray-400 animate-pulse">Connecting and querying instances...</p>}

      {filtered.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="pb-2 pr-4">Instance</th>
                <th className="pb-2 pr-4 cursor-pointer hover:text-white" onClick={() => handleSort('displayName')}>
                  Database.Table {sortField === 'displayName' ? (sortAsc ? '\u25B2' : '\u25BC') : ''}
                </th>
                <th className="pb-2 pr-4">Engine</th>
                <th className="pb-2 pr-4 cursor-pointer hover:text-white text-right" onClick={() => handleSort('rows')}>
                  Rows {sortField === 'rows' ? (sortAsc ? '\u25B2' : '\u25BC') : ''}
                </th>
                <th className="pb-2 pr-4 text-right">Data MB</th>
                <th className="pb-2 pr-4 text-right">Index MB</th>
                <th className="pb-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort('totalSizeMb')}>
                  Total MB {sortField === 'totalSizeMb' ? (sortAsc ? '\u25B2' : '\u25BC') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={`${t.instanceName}-${t.displayName}-${i}`} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-1.5 pr-4 text-gray-400">{t.instanceName}</td>
                  <td className="py-1.5 pr-4 text-gray-200 font-mono text-xs">{t.displayName}</td>
                  <td className="py-1.5 pr-4 text-gray-500">{t.engine}</td>
                  <td className="py-1.5 pr-4 text-right text-gray-300">{t.rows.toLocaleString()}</td>
                  <td className="py-1.5 pr-4 text-right text-gray-400">{t.dataSizeMb.toFixed(2)}</td>
                  <td className="py-1.5 pr-4 text-right text-gray-400">{t.indexSizeMb.toFixed(2)}</td>
                  <td className="py-1.5 text-right text-white font-medium">{t.totalSizeMb.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
