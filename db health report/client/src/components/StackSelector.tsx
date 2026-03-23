import { useEffect, useMemo } from 'react';
import { useAppStore, groupInstances } from '../store/app-store';

export function StackSelector() {
  const { instances, selectedGroupId, setSelectedGroupId } = useAppStore();

  const groups = useMemo(() => groupInstances(instances), [instances]);

  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId, setSelectedGroupId]);

  if (instances.length === 0) {
    return (
      <div className="space-y-2">
        <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">Groups</label>
        <p className="text-xs text-gray-600">Connect to a cluster to see instance groups.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">
        Groups ({groups.length})
      </label>

      <div className="space-y-1">
        {groups.map(group => (
          <label
            key={group.id}
            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
              selectedGroupId === group.id
                ? 'bg-emerald-950/50 border border-emerald-800'
                : 'hover:bg-gray-800 border border-transparent'
            }`}
          >
            <input
              type="radio"
              name="group"
              checked={selectedGroupId === group.id}
              onChange={() => setSelectedGroupId(group.id)}
              className="accent-emerald-500 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <span className="text-sm text-gray-200 block truncate" title={group.name}>
                {group.name}
              </span>
              <span className="text-xs text-gray-500">
                {group.instances.length} instance(s)
                {group.instances.length <= 2
                  ? `: ${group.instances.map(i => i.name).join(', ')}`
                  : `: ${group.instances[0].name} +${group.instances.length - 1} more`}
              </span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
