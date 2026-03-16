import { create } from 'zustand';
import type { TeleportInstance, TeleportStatus, ConnectionResult, ReplicaStatus, ReplicationWorker, CloudWatchLagPoint, TimeRange, InvestigationData } from '../api/types';

function makeTimeRange(label: string, minutes: number): TimeRange {
  const now = new Date();
  return {
    since: new Date(now.getTime() - minutes * 60 * 1000).toISOString(),
    until: now.toISOString(),
    label,
  };
}

export const TIME_PRESETS: { label: string; minutes: number }[] = [
  { label: 'Last 5 min', minutes: 5 },
  { label: 'Last 30 min', minutes: 30 },
  { label: 'Last 1 hour', minutes: 60 },
  { label: 'Last 6 hours', minutes: 360 },
  { label: 'Last 12 hours', minutes: 720 },
  { label: 'Last 24 hours', minutes: 1440 },
];

interface AppState {
  // Teleport
  tshAvailable: boolean;
  clusters: string[];
  selectedCluster: string;
  loginStatus: TeleportStatus | null;
  instances: TeleportInstance[];
  selectedInstance: string;

  // Connection
  connectionResult: ConnectionResult | null;
  connecting: boolean;

  // Replica lag
  replicaStatus: ReplicaStatus | null;
  replicationWorkers: ReplicationWorker[];
  investigationData: InvestigationData | null;
  cloudwatchData: CloudWatchLagPoint[];
  lagLoading: boolean;
  lagError: string;
  lastRefreshed: Date | null;

  // Time range
  timeRange: TimeRange;
  showUtc: boolean;

  // Lag threshold (seconds) — 0 = disabled
  lagThreshold: number;
  chartHoverLagSeconds: number | null;
  chartHoverIsBreach: boolean;
  chartPinned: boolean;

  // RDS config
  rdsConfig: {
    instanceClass: string;
    engine: string;
    engineVersion: string;
    parameterGroupName: string | null;
  } | null;

  // Parameter group
  parameterGroup: Record<string, { value: string; source: string }> | null;
  parameterGroupName: string | null;
  parameterGroupLoading: boolean;

  // General
  error: string;
  awsAuthRequired: boolean;
  awsAuthMessage: string;

  // Actions
  setTshAvailable: (available: boolean) => void;
  setClusters: (clusters: string[]) => void;
  setSelectedCluster: (cluster: string) => void;
  setLoginStatus: (status: TeleportStatus | null) => void;
  setInstances: (instances: TeleportInstance[]) => void;
  setSelectedInstance: (instance: string) => void;
  setConnectionResult: (result: ConnectionResult | null) => void;
  setConnecting: (connecting: boolean) => void;
  setReplicaStatus: (status: ReplicaStatus | null) => void;
  setReplicationWorkers: (workers: ReplicationWorker[]) => void;
  setInvestigationData: (data: InvestigationData | null) => void;
  setCloudwatchData: (data: CloudWatchLagPoint[]) => void;
  setLagLoading: (loading: boolean) => void;
  setLagError: (error: string) => void;
  setLastRefreshed: (date: Date | null) => void;
  setTimeRange: (range: TimeRange) => void;
  setShowUtc: (utc: boolean) => void;
  setLagThreshold: (threshold: number) => void;
  setChartHoverContext: (lagSeconds: number | null, isBreach: boolean) => void;
  setChartPinned: (pinned: boolean) => void;
  setRdsConfig: (config: AppState['rdsConfig']) => void;
  setParameterGroup: (params: AppState['parameterGroup']) => void;
  setParameterGroupName: (name: string | null) => void;
  setParameterGroupLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  setAwsAuthRequired: (required: boolean, message?: string) => void;
  reset: () => void;
}

const defaultTimeRange = makeTimeRange('Last 1 hour', 60);

const initialState = {
  tshAvailable: false,
  clusters: [],
  selectedCluster: '',
  loginStatus: null,
  instances: [],
  selectedInstance: '',
  connectionResult: null,
  connecting: false,
  replicaStatus: null,
  replicationWorkers: [],
  investigationData: null,
  cloudwatchData: [],
  lagLoading: false,
  lagError: '',
  lastRefreshed: null,
  timeRange: defaultTimeRange,
  showUtc: false,
  lagThreshold: 30, // default 30s threshold
  chartHoverLagSeconds: null,
  chartHoverIsBreach: false,
  chartPinned: false,
  rdsConfig: null,
  parameterGroup: null,
  parameterGroupName: null,
  parameterGroupLoading: false,
  error: '',
  awsAuthRequired: false,
  awsAuthMessage: '',
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setTshAvailable: (available) => set({ tshAvailable: available }),
  setClusters: (clusters) => set({ clusters }),
  setSelectedCluster: (cluster) => set({
    selectedCluster: cluster,
    loginStatus: null,
    instances: [],
    selectedInstance: '',
    connectionResult: null,
    replicaStatus: null,
    replicationWorkers: [],
    investigationData: null,
    cloudwatchData: [],
    lagError: '',
    error: '',
    awsAuthRequired: false,
    awsAuthMessage: '',
    chartHoverLagSeconds: null,
    chartHoverIsBreach: false,
    chartPinned: false,
  }),
  setLoginStatus: (status) => set({ loginStatus: status }),
  setInstances: (instances) => set({ instances }),
  setSelectedInstance: (instance) => set({
    selectedInstance: instance,
    connectionResult: null,
    replicaStatus: null,
    replicationWorkers: [],
    investigationData: null,
    cloudwatchData: [],
    lagError: '',
    error: '',
    rdsConfig: null,
    awsAuthRequired: false,
    awsAuthMessage: '',
    chartHoverLagSeconds: null,
    chartHoverIsBreach: false,
    chartPinned: false,
  }),
  setConnectionResult: (result) => set({ connectionResult: result }),
  setConnecting: (connecting) => set({ connecting }),
  setReplicaStatus: (status) => set({ replicaStatus: status }),
  setReplicationWorkers: (workers) => set({ replicationWorkers: workers }),
  setInvestigationData: (data) => set({ investigationData: data }),
  setCloudwatchData: (data) => set({ cloudwatchData: data }),
  setLagLoading: (loading) => set({ lagLoading: loading }),
  setLagError: (error) => set({ lagError: error }),
  setLastRefreshed: (date) => set({ lastRefreshed: date }),
  setTimeRange: (range) => set({ timeRange: range }),
  setShowUtc: (utc) => set({ showUtc: utc }),
  setLagThreshold: (threshold) => set({ lagThreshold: threshold }),
  setChartHoverContext: (lagSeconds, isBreach) => set({ chartHoverLagSeconds: lagSeconds, chartHoverIsBreach: isBreach }),
  setChartPinned: (pinned) => set({ chartPinned: pinned }),
  setRdsConfig: (config) => set({ rdsConfig: config }),
  setParameterGroup: (params) => set({ parameterGroup: params }),
  setParameterGroupName: (name) => set({ parameterGroupName: name }),
  setParameterGroupLoading: (loading) => set({ parameterGroupLoading: loading }),
  setError: (error) => set({ error }),
  setAwsAuthRequired: (required, message = '') => set({ awsAuthRequired: required, awsAuthMessage: message }),
  reset: () => set(initialState),
}));
