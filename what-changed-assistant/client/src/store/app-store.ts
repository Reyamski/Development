import { create } from 'zustand';
import { ChangesSummary, TimeWindow, JiraRelease, DatabaseChange, ConfigChange, Correlation } from '../api/types';

interface AppState {
  incidentTime: string;
  lookbackHours: number;
  timeWindow: TimeWindow | null;
  jiraChanges: JiraRelease[];
  databaseChanges: DatabaseChange[];
  configChanges: ConfigChange[];
  correlations: Correlation[];
  loading: boolean;
  error: string | null;
  selectedChangeId: string | null;
  activeTab: 'summary' | 'jira' | 'database' | 'config';
  
  setIncidentTime: (time: string) => void;
  setLookbackHours: (hours: number) => void;
  setSummary: (summary: ChangesSummary) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedChangeId: (id: string | null) => void;
  setActiveTab: (tab: 'summary' | 'jira' | 'database' | 'config') => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  incidentTime: '',
  lookbackHours: 6,
  timeWindow: null,
  jiraChanges: [],
  databaseChanges: [],
  configChanges: [],
  correlations: [],
  loading: false,
  error: null,
  selectedChangeId: null,
  activeTab: 'summary',
  
  setIncidentTime: (time) => set({ incidentTime: time }),
  setLookbackHours: (hours) => set({ lookbackHours: hours }),
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
