import { create } from 'zustand';
import type { TeleportInstance, TeleportStatus, ConnectionResult } from '../api/types';

interface AppState {
  tshAvailable: boolean;
  clusters: string[];
  selectedCluster: string;
  loginStatus: TeleportStatus | null;
  instances: TeleportInstance[];
  selectedInstance: string;
  connectionResult: ConnectionResult | null;
  connecting: boolean;
  /** Active schema when connected with __ALL__ (list from server) */
  selectedDatabase: string;
  error: string;
  /** Failed to GET /api/teleport/clusters (network / server down) */
  clustersLoadError: string;

  setTshAvailable: (v: boolean) => void;
  setClusters: (v: string[]) => void;
  setSelectedCluster: (v: string) => void;
  setLoginStatus: (v: TeleportStatus | null) => void;
  setInstances: (v: TeleportInstance[]) => void;
  setSelectedInstance: (v: string) => void;
  setConnectionResult: (v: ConnectionResult | null) => void;
  setConnecting: (v: boolean) => void;
  setSelectedDatabase: (v: string) => void;
  setError: (v: string) => void;
  setClustersLoadError: (v: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  tshAvailable: false,
  clusters: [],
  selectedCluster: '',
  loginStatus: null,
  instances: [],
  selectedInstance: '',
  connectionResult: null,
  connecting: false,
  selectedDatabase: '',
  error: '',
  clustersLoadError: '',

  setTshAvailable: (v) => set({ tshAvailable: v }),
  setClusters: (v) => set({ clusters: v }),
  setSelectedCluster: (v) =>
    set({
      selectedCluster: v,
      loginStatus: null,
      instances: [],
      selectedInstance: '',
      connectionResult: null,
      selectedDatabase: '',
      error: '',
    }),
  setLoginStatus: (v) => set({ loginStatus: v }),
  setInstances: (v) => set({ instances: v }),
  setSelectedInstance: (v) =>
    set({
      selectedInstance: v,
      connectionResult: null,
      selectedDatabase: '',
      error: '',
    }),
  setConnectionResult: (v) =>
    set(() => {
      if (!v) return { connectionResult: null, selectedDatabase: '' };
      const databases = v.databases;
      const selectedDatabase = databases && databases.length > 0 ? databases[0] : '';
      return { connectionResult: v, selectedDatabase };
    }),
  setConnecting: (v) => set({ connecting: v }),
  setSelectedDatabase: (v) => set({ selectedDatabase: v }),
  setError: (v) => set({ error: v }),
  setClustersLoadError: (v) => set({ clustersLoadError: v }),
}));
