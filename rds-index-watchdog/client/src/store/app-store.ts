import { create } from 'zustand';

interface ConnectionResult {
  connected: boolean;
  instance: string;
  database: string;
  dbUser?: string;
}

interface AppState {
  // Teleport
  selectedCluster: string;
  setSelectedCluster: (c: string) => void;
  selectedInstance: string;
  setSelectedInstance: (i: string) => void;
  selectedDatabase: string;
  setSelectedDatabase: (d: string) => void;
  selectedDatabases: string[];
  setSelectedDatabases: (d: string[]) => void;
  connectionResult: ConnectionResult | null;
  setConnectionResult: (r: ConnectionResult | null) => void;
  // Analysis
  isAnalyzing: boolean;
  setIsAnalyzing: (v: boolean) => void;
  analysisResults: AnalysisResults | null;
  setAnalysisResults: (r: AnalysisResults | null) => void;
  analysisError: string | null;
  setAnalysisError: (e: string | null) => void;
}

export interface AnalysisResults {
  missingIndexes: MissingIndexFinding[];
  unusedIndexes: UnusedIndexFinding[];
  duplicateIndexes: DuplicateIndexFinding[];
  overlappingIndexes: OverlappingIndexFinding[];
  bloatRiskTables: BloatRiskFinding[];
  analyzedAt: string;
  database: string;
  instance: string;
}

export interface MissingIndexFinding {
  table: string;
  digestText: string;
  rowsExamined: number;
  rowsSent: number;
  execCount: number;
  suggestedColumns: string[];
  explanation: string;
  severity: 'warning' | 'info';
}

export interface UnusedIndexFinding {
  table: string;
  indexName: string;
  columns: string[];
  writeCount: number;
  explanation: string;
  suggestedSql: string;
  severity: 'warning' | 'info';
}

export interface DuplicateIndexFinding {
  table: string;
  indexName: string;
  duplicateOf: string;
  columns: string[];
  explanation: string;
  suggestedSql: string;
  severity: 'warning';
}

export interface OverlappingIndexFinding {
  table: string;
  redundantIndex: string;
  coveringIndex: string;
  redundantColumns: string[];
  coveringColumns: string[];
  explanation: string;
  suggestedSql: string;
  severity: 'info';
}

export interface BloatRiskFinding {
  table: string;
  indexCount: number;
  totalWrites: number;
  indexes: string[];
  explanation: string;
  severity: 'warning' | 'info';
}

export const useAppStore = create<AppState>((set) => ({
  selectedCluster: '',
  setSelectedCluster: (c) => set({ selectedCluster: c }),
  selectedInstance: '',
  setSelectedInstance: (i) => set({ selectedInstance: i }),
  selectedDatabase: '',
  setSelectedDatabase: (d) => set({ selectedDatabase: d }),
  selectedDatabases: [],
  setSelectedDatabases: (d) => set({ selectedDatabases: d }),
  connectionResult: null,
  setConnectionResult: (r) => set({ connectionResult: r }),
  isAnalyzing: false,
  setIsAnalyzing: (v) => set({ isAnalyzing: v }),
  analysisResults: null,
  setAnalysisResults: (r) => set({ analysisResults: r }),
  analysisError: null,
  setAnalysisError: (e) => set({ analysisError: e }),
}));
