import { create } from 'zustand'
import type { TeleportInstance, LoginStatus, AuditResult, RiskLevel } from '../api/client'

export interface WatchdogState {
  // Teleport
  clusters: string[]
  selectedCluster: string
  loginStatus: LoginStatus | null
  instances: TeleportInstance[]
  selectedInstance: TeleportInstance | null

  // Audit
  auditResult: AuditResult | null
  loading: boolean
  loggingIn: boolean
  error: string

  // UI filters
  searchQuery: string
  riskFilter: RiskLevel | 'ALL'
  expandedUser: string | null

  // Actions
  set: (partial: Partial<WatchdogState>) => void
  reset: () => void
}

const defaults = {
  clusters: [] as string[],
  selectedCluster: '',
  loginStatus: null,
  instances: [] as TeleportInstance[],
  selectedInstance: null,
  auditResult: null,
  loading: false,
  loggingIn: false,
  error: '',
  searchQuery: '',
  riskFilter: 'ALL' as const,
  expandedUser: null,
}

export const useWatchdogStore = create<WatchdogState>((set) => ({
  ...defaults,
  set: (partial) => set(partial),
  reset: () => set(defaults),
}))
