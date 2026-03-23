import { create } from 'zustand';
import { ChangesSummary, TimeWindow, JiraRelease, DatabaseChange, ConfigChange, Correlation } from '../api/types';

interface AppState {
  mode: 'daily' | 'incident';
  incidentTime: string;
  lookbackHours: number;
  autoRefresh: boolean;
  timeWindow: TimeWindow | null;
  jiraChanges: JiraRelease[];
  databaseChanges: DatabaseChange[];
  configChanges: ConfigChange[];
  correlations: Correlation[];
  loading: boolean;
  error: string | null;
  selectedChangeId: string | null;
  activeTab: 'summary' | 'jira' | 'database' | 'config';
  
  setMode: (mode: 'daily' | 'incident') => void;
  setIncidentTime: (time: string) => void;
  setLookbackHours: (hours: number) => void;
  setAutoRefresh: (enabled: boolean) => void;
  setSummary: (summary: ChangesSummary) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedChangeId: (id: string | null) => void;
  setActiveTab: (tab: 'summary' | 'jira' | 'database' | 'config') => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  mode: 'daily',
  incidentTime: '',
  lookbackHours: 24,
  autoRefresh: true,
  timeWindow: null,
  jiraChanges: [],
  databaseChanges: [],
  configChanges: [],
  correlations: [],
  loading: false,
  error: null,
  selectedChangeId: null,
  activeTab: 'summary',
  
  setMode: (mode) => set({ mode, lookbackHours: mode === 'daily' ? 24 : 6 }),
  setIncidentTime: (time) => set({ incidentTime: time }),
  setLookbackHours: (hours) => set({ lookbackHours: hours }),
  setAutoRefresh: (enabled) => set({ autoRefresh: enabled }),
  setSummary: (summary) => set({
    timeWindow: summary.timeWindow,
    jiraChanges: summary.jiraChanges,
    databaseChanges: summary.databaseChanges,
    configChanges: summary.configChanges,
    correlations: summary.correlations,
  }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setSelectedChangeId: (id) => set({ selectedChangeId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  reset: () => set({
    timeWindow: null,
    jiraChanges: [],
    databaseChanges: [],
    configChanges: [],
    correlations: [],
    loading: false,
    error: null,
    selectedChangeId: null,
  }),
}));
