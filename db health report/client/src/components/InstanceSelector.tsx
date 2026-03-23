import { useAppStore } from '../store/app-store';

export function InstanceSelector() {
  const { instances, selectedInstanceKeys, toggleInstanceKey, clearSelectedInstances } = useAppStore();

  if (instances.length === 0) {
    return <p className="text-xs text-gray-600">No instances available. Connect to a cluster first.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-500">Select RDS instances:</label>
        {selectedInstanceKeys.size > 0 && (
          <button
            onClick={clearSelectedInstances}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Clear ({selectedInstanceKeys.size})
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
        {instances.map(inst => (
          <label
            key={inst.name}
            className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${
              selectedInstanceKeys.has(inst.name) ? 'bg-emerald-950/50 text-emerald-300' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedInstanceKeys.has(inst.name)}
              onChange={() => toggleInstanceKey(inst.name)}
              className="accent-emerald-500"
            />
            <span className="truncate">{inst.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
