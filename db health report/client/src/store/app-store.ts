import { create } from 'zustand';
import type {
  TeleportInstance, TeleportStatus, InstanceGroup, InstanceHealth, StackHealthSummary,
  HealthReport, ThresholdConfig, SchedulerConfig, TableSizeResult, TabId,
} from '../api/types';

/**
 * Extract group prefix from instance name.
 * Strips -rds-region-accountId, -aurora-region-accountId, -mysql-region-accountId.
 * If no match, uses full instance name (single-instance group).
 */
function getInstancePrefix(name: string): string {
  const match = name.match(/^(.+?)-(?:rds|aurora|mysql)-[a-z0-9-]+-\d{8,12}$/i);
  if (match) return match[1].replace(/-+$/, '');
  return name;
}

export function groupInstances(instances: TeleportInstance[]): InstanceGroup[] {
  const byPrefix = new Map<string, TeleportInstance[]>();
  for (const inst of instances) {
    const prefix = getInstancePrefix(inst.name) || inst.name;
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix)!.push(inst);
  }

  return Array.from(byPrefix.entries()).map(([prefix, insts]) => {
    const id = prefix.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || `group-${insts[0].name}`;
    const name = insts.length === 1 ? insts[0].name : prefix;

    return { id, name, accountId: insts[0].accountId, instances: insts };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

interface AppState {
  activeTab: TabId;
  tshAvailable: boolean;
  clusters: string[];
  selectedCluster: string;
  loginStatus: TeleportStatus | null;
  instances: TeleportInstance[];

  selectedGroupId: string;

  healthInstances: InstanceHealth[];
  healthSummary: StackHealthSummary | null;
  healthLoading: boolean;
  healthError: string;

  tableSizes: TableSizeResult[];
  tableSizesLoading: boolean;
  tableSizesError: string;
  selectedInstanceKeys: Set<string>;

  reports: HealthReport[];
  selectedReport: HealthReport | null;
  reportsLoading: boolean;

  thresholds: ThresholdConfig | null;
  schedulerConfig: SchedulerConfig | null;

  awsSsoLoggedIn: boolean;
  awsSsoLoggingIn: boolean;
  awsSsoNeeded: boolean;

  error: string;
  loading: boolean;

  setActiveTab: (tab: TabId) => void;
  setTshAvailable: (available: boolean) => void;
  setClusters: (clusters: string[]) => void;
  setSelectedCluster: (cluster: string) => void;
  setLoginStatus: (status: TeleportStatus | null) => void;
  setInstances: (instances: TeleportInstance[]) => void;
  setSelectedGroupId: (id: string) => void;
  setHealthData: (instances: InstanceHealth[], summary: StackHealthSummary) => void;
  setHealthLoading: (loading: boolean) => void;
  setHealthError: (error: string) => void;
  setTableSizes: (sizes: TableSizeResult[]) => void;
  setTableSizesLoading: (loading: boolean) => void;
  setTableSizesError: (error: string) => void;
  toggleInstanceKey: (key: string) => void;
  clearSelectedInstances: () => void;
  setReports: (reports: HealthReport[]) => void;
  setSelectedReport: (report: HealthReport | null) => void;
  setReportsLoading: (loading: boolean) => void;
  setThresholds: (thresholds: ThresholdConfig) => void;
  setSchedulerConfig: (config: SchedulerConfig) => void;
  setAwsSsoLoggedIn: (loggedIn: boolean) => void;
  setAwsSsoLoggingIn: (loggingIn: boolean) => void;
  setAwsSsoNeeded: (needed: boolean) => void;
  setError: (error: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'health',
  tshAvailable: false,
  clusters: [],
  selectedCluster: '',
  loginStatus: null,
  instances: [],

  selectedGroupId: '',

  healthInstances: [],
  healthSummary: null,
  healthLoading: false,
  healthError: '',

  tableSizes: [],
  tableSizesLoading: false,
  tableSizesError: '',
  selectedInstanceKeys: new Set<string>(),

  reports: [],
  selectedReport: null,
  reportsLoading: false,

  thresholds: null,
  schedulerConfig: null,

  awsSsoLoggedIn: false,
  awsSsoLoggingIn: false,
  awsSsoNeeded: false,

  error: '',
  loading: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setTshAvailable: (available) => set({ tshAvailable: available }),
  setClusters: (clusters) => set({ clusters }),
  setSelectedCluster: (cluster) => set({
    selectedCluster: cluster,
    loginStatus: null,
    instances: [],
    selectedGroupId: '',
    healthInstances: [],
    healthSummary: null,
    error: '',
  }),
  setLoginStatus: (status) => set({ loginStatus: status }),
  setInstances: (instances) => set({ instances }),
  setSelectedGroupId: (id) => set({ selectedGroupId: id, healthInstances: [], healthSummary: null, healthError: '' }),
  setHealthData: (instances, summary) => set({ healthInstances: instances, healthSummary: summary }),
  setHealthLoading: (loading) => set({ healthLoading: loading }),
  setHealthError: (error) => set({ healthError: error }),
  setTableSizes: (sizes) => set({ tableSizes: sizes }),
  setTableSizesLoading: (loading) => set({ tableSizesLoading: loading }),
  setTableSizesError: (error) => set({ tableSizesError: error }),
  toggleInstanceKey: (key) => set((state) => {
    const next = new Set(state.selectedInstanceKeys);
    if (next.has(key)) next.delete(key); else next.add(key);
    return { selectedInstanceKeys: next };
  }),
  clearSelectedInstances: () => set({ selectedInstanceKeys: new Set() }),
  setReports: (reports) => set({ reports }),
  setSelectedReport: (report) => set({ selectedReport: report }),
  setReportsLoading: (loading) => set({ reportsLoading: loading }),
  setThresholds: (thresholds) => set({ thresholds }),
  setSchedulerConfig: (config) => set({ schedulerConfig: config }),
  setAwsSsoLoggedIn: (loggedIn) => set(loggedIn ? { awsSsoLoggedIn: true, awsSsoNeeded: false } : { awsSsoLoggedIn: false }),
  setAwsSsoLoggingIn: (loggingIn) => set({ awsSsoLoggingIn: loggingIn }),
  setAwsSsoNeeded: (needed) => set({ awsSsoNeeded: needed }),
  setError: (error) => set({ error }),
  setLoading: (loading) => set({ loading }),
}));
