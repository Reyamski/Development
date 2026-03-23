import { useCallback } from 'react';
import { useAppStore } from '../store/app-store';
import { fetchTableSizes } from '../api/client';

export function useTableSizes() {
  const store = useAppStore();

  const loadTableSizes = useCallback(async () => {
    const { instances, selectedInstanceKeys, selectedCluster } = useAppStore.getState();
    if (selectedInstanceKeys.size === 0 || !selectedCluster) {
      store.setTableSizesError('Select at least one instance');
      return;
    }

    const selectedInstances = instances
      .filter(inst => selectedInstanceKeys.has(inst.name))
      .map(inst => ({ cluster: selectedCluster, name: inst.name }));

    if (selectedInstances.length === 0) return;

    store.setTableSizesLoading(true);
    store.setTableSizesError('');
    store.setTableSizes([]);

    try {
      const result = await fetchTableSizes(selectedInstances);
      store.setTableSizes(result.tables);
      if (result.errors.length > 0) {
        store.setTableSizesError(
          result.errors.map(e => `${e.instance}: ${e.error}`).join('; ')
        );
      }
    } catch (err: any) {
      store.setTableSizesError(err.message || 'Failed to fetch table sizes');
    } finally {
      store.setTableSizesLoading(false);
    }
  }, [store]);

  return { loadTableSizes };
}
