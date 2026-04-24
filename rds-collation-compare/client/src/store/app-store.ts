import { create } from 'zustand';
import type { Baseline, CollationReport } from '../api/client';

interface ConnectionResult {
  connected: boolean;
  instance: string;
  databases: string[];
  dbUser?: string;
}

const DEFAULT_BASELINE: Baseline = {
  characterSet: 'utf8mb4',
  collation: 'utf8mb4_0900_ai_ci',
};

interface AppState {
  selectedCluster: string;
  setSelectedCluster: (c: string) => void;
  selectedInstance: string;
  setSelectedInstance: (i: string) => void;
  selectedDatabases: string[];
  setSelectedDatabases: (d: string[]) => void;
  connectionResult: ConnectionResult | null;
  setConnectionResult: (r: ConnectionResult | null) => void;

  baseline: Baseline;
  setBaseline: (b: Baseline) => void;

  isAnalyzing: boolean;
  setIsAnalyzing: (v: boolean) => void;
  analysisResults: CollationReport | null;
  setAnalysisResults: (r: CollationReport | null) => void;
  analysisError: string | null;
  setAnalysisError: (e: string | null) => void;

  isDownloading: boolean;
  setIsDownloading: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedCluster: '',
  setSelectedCluster: (c) => set({ selectedCluster: c }),
  selectedInstance: '',
  setSelectedInstance: (i) => set({ selectedInstance: i }),
  selectedDatabases: [],
  setSelectedDatabases: (d) => set({ selectedDatabases: d }),
  connectionResult: null,
  setConnectionResult: (r) => set({ connectionResult: r }),

  baseline: DEFAULT_BASELINE,
  setBaseline: (b) => set({ baseline: b }),

  isAnalyzing: false,
  setIsAnalyzing: (v) => set({ isAnalyzing: v }),
  analysisResults: null,
  setAnalysisResults: (r) => set({ analysisResults: r }),
  analysisError: null,
  setAnalysisError: (e) => set({ analysisError: e }),

  isDownloading: false,
  setIsDownloading: (v) => set({ isDownloading: v }),
}));
