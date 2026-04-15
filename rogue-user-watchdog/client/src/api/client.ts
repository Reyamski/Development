// ===== Types =====

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW'
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN'

export interface TeleportInstance {
  name: string
  uri: string
  accountId: string
  region: string
  instanceId: string
}

export interface LoginStatus {
  loggedIn: boolean
  username: string
}

export interface AuditFlag {
  severity: Severity
  rule: string
  detail: string
}

export interface AuditUser {
  user: string
  host: string
  plugin: string
  passwordExpired: boolean
  accountLocked: boolean
  passwordLifetime: number | null
  riskLevel: RiskLevel
  flags: AuditFlag[]
  grants: string[]
  grantsSummary: string[]
}

export interface AuditSummary {
  totalUsers: number
  systemUsers: number
  highRisk: number
  mediumRisk: number
  lowRisk: number
  clean: number
}

export interface AuditResult {
  instance: string
  auditedAt: string
  summary: AuditSummary
  users: AuditUser[]
}

export interface GrantsResult {
  user: string
  host: string
  grants: string[]
}

// ===== Helpers =====

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function post<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ===== Teleport =====

export const teleportClusters = () =>
  get<{ clusters: string[] }>('/api/teleport/clusters')

export const teleportLoginStatus = (cluster: string) =>
  get<LoginStatus>(`/api/teleport/login-status?cluster=${encodeURIComponent(cluster)}`)

export const teleportLogin = (cluster: string) =>
  post<{ started: boolean }>('/api/teleport/login', { cluster })

export const teleportInstances = (cluster: string) =>
  get<{ instances: TeleportInstance[] }>(`/api/teleport/instances?cluster=${encodeURIComponent(cluster)}`)

// ===== Rogue User Watchdog =====

export function auditInstance(instance: string, cluster: string): Promise<AuditResult> {
  const params = new URLSearchParams({ cluster })
  return get<AuditResult>(`/api/rogue-user-watchdog/audit/${encodeURIComponent(instance)}?${params}`)
}

export function fetchUserGrants(instance: string, user: string, host: string, cluster: string): Promise<GrantsResult> {
  const params = new URLSearchParams({ cluster })
  return get<GrantsResult>(
    `/api/rogue-user-watchdog/grants/${encodeURIComponent(instance)}/${encodeURIComponent(user)}/${encodeURIComponent(host)}?${params}`
  )
}

export async function downloadReport(auditResult: AuditResult): Promise<void> {
  const res = await fetch('/api/rogue-user-watchdog/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(auditResult),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || `Report failed: ${res.status}`)
  }
  const blob = await res.blob()
  const filename = `rogue-db-audit-${auditResult.instance}-${new Date(auditResult.auditedAt).toISOString().slice(0, 10)}.md`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
