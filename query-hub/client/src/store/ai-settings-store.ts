import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAppStore } from './app-store';

/** Kiro: AWS SSO account + region only (same profile resolution as RDS Replica Lag). Bedrock model is server env only. */
interface KiroSettingsState {
  awsAccountId: string;
  awsRegion: string;
  setAwsAccountId: (v: string) => void;
  setAwsRegion: (v: string) => void;
  clearKiroSelection: () => void;
}

const PERSIST_VERSION = 4;

export const useAiSettingsStore = create<KiroSettingsState>()(
  persist(
    (set) => ({
      awsAccountId: '',
      awsRegion: 'us-east-1',

      setAwsAccountId: (awsAccountId) => set({ awsAccountId }),
      setAwsRegion: (awsRegion) => set({ awsRegion }),
      clearKiroSelection: () => set({ awsAccountId: '', awsRegion: 'us-east-1' }),
    }),
    {
      name: 'query-hub:kiro-settings',
      version: PERSIST_VERSION,
      migrate: (persisted, version) => {
        if (version >= PERSIST_VERSION) return persisted as Pick<KiroSettingsState, 'awsAccountId' | 'awsRegion'>;
        const p = (persisted ?? {}) as Record<string, unknown>;
        return {
          awsAccountId: typeof p.awsAccountId === 'string' ? p.awsAccountId : '',
          awsRegion:
            typeof p.awsRegion === 'string'
              ? p.awsRegion
              : typeof p.bedrockRegion === 'string'
                ? p.bedrockRegion
                : 'us-east-1',
        };
      },
      partialize: (s) => ({
        awsAccountId: s.awsAccountId,
        awsRegion: s.awsRegion,
      }),
    },
  ),
);

/**
 * Headers for Kiro / Bedrock — model ID from QUERY_HUB_BEDROCK_MODEL_ID on the server.
 * Prefer AWS account + region from the selected Teleport MySQL instance (same as RDS Replica Lag);
 * fallback to saved Kiro fields when Teleport metadata is missing.
 */
export function buildAiHeaders(): Record<string, string> {
  const app = useAppStore.getState();
  const inst = app.instances.find((i) => i.name === app.selectedInstance);
  const s = useAiSettingsStore.getState();
  const accountId = (inst?.accountId?.trim() || s.awsAccountId.trim()) || '';
  const region = (inst?.region?.trim() || s.awsRegion.trim() || 'us-east-1') || 'us-east-1';
  const h: Record<string, string> = {
    'X-Query-Hub-AI-Provider': 'bedrock',
  };
  if (accountId) {
    h['X-Query-Hub-Aws-Account-Id'] = accountId;
  }
  h['X-Query-Hub-Bedrock-Region'] = region;
  return h;
}
