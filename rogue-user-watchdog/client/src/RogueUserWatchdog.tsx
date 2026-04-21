import { useEffect, useCallback, useRef } from 'react'
import { useWatchdogStore } from './store/app-store'
import type { RiskLevel, AuditUser } from './api/client'
import {
  teleportClusters,
  teleportLoginStatus,
  teleportLogin,
  teleportInstances,
  auditInstance,
  downloadReport,
} from './api/client'

interface RogueUserWatchdogProps {
  standalone?: boolean
}

// ===== Risk color helpers =====

function riskBg(level: RiskLevel): string {
  switch (level) {
    case 'HIGH':   return 'bg-red-100 text-red-700 border border-red-200'
    case 'MEDIUM': return 'bg-amber-100 text-amber-700 border border-amber-200'
    case 'LOW':    return 'bg-blue-100 text-blue-700 border border-blue-200'
    case 'CLEAN':  return 'bg-green-100 text-green-700 border border-green-200'
  }
}

function riskDot(level: RiskLevel): string {
  switch (level) {
    case 'HIGH':   return 'bg-red-500'
    case 'MEDIUM': return 'bg-amber-400'
    case 'LOW':    return 'bg-blue-400'
    case 'CLEAN':  return 'bg-green-500'
  }
}

function severityBg(s: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  switch (s) {
    case 'HIGH':   return 'bg-red-50 text-red-600 border border-red-200'
    case 'MEDIUM': return 'bg-amber-50 text-amber-600 border border-amber-200'
    case 'LOW':    return 'bg-blue-50 text-blue-600 border border-blue-200'
  }
}

// ===== Sub-components =====

function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${riskBg(level)}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${riskDot(level)}`} />
      {level}
    </span>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex-1 min-w-[5rem] rounded-xl border px-4 py-3 ${color}`}>
      <div className="text-xl font-extrabold leading-tight">{value}</div>
      <div className="text-xs font-semibold mt-0.5 opacity-80">{label}</div>
    </div>
  )
}

interface UserRowProps {
  user: AuditUser
  isExpanded: boolean
  onToggle: () => void
}

function UserRow({ user, isExpanded, onToggle }: UserRowProps) {
  const userHost = `${user.user}@${user.host}`
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer hover:bg-[#f8f8fd] transition-colors border-b border-[#e1e0f7]/30 last:border-0"
      >
        <td className="px-4 py-3 whitespace-nowrap">
          <RiskBadge level={user.riskLevel} />
        </td>
        <td className="px-4 py-3">
          <span className="font-mono text-sm text-[#303451] font-semibold">{user.user}</span>
          <span className="text-[#212438]/40 text-sm">@</span>
          <span className="font-mono text-sm text-[#212438]/70">{user.host}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-xs font-mono text-[#212438]/60 bg-[#e1e0f7]/30 px-2 py-0.5 rounded">
            {user.plugin}
          </span>
        </td>
        <td className="px-4 py-3">
          {user.flags.length === 0 ? (
            <span className="text-xs text-[#212438]/30">—</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#212438]/70">
              <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {user.flags.length} flag{user.flags.length !== 1 ? 's' : ''}
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <span className="text-xs text-[#6864d1] font-semibold select-none">
            {isExpanded ? 'Hide ▲' : 'Details ▼'}
          </span>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-[#f8f8fd] border-b border-[#e1e0f7]/30">
          <td colSpan={5} className="px-5 py-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Flags */}
              <div>
                <h4 className="text-xs font-bold text-[#303451] uppercase tracking-wide mb-2">
                  Flags ({user.flags.length})
                </h4>
                {user.flags.length === 0 ? (
                  <p className="text-xs text-[#212438]/40">No flags — account is clean.</p>
                ) : (
                  <div className="space-y-2">
                    {user.flags.map((flag, i) => (
                      <div key={i} className="rounded-lg border border-[#e1e0f7]/60 bg-white px-3 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${severityBg(flag.severity)}`}>
                            {flag.severity}
                          </span>
                          <span className="text-xs font-mono font-semibold text-[#303451]">{flag.rule}</span>
                        </div>
                        <p className="text-xs text-[#212438]/60">{flag.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Grants */}
              <div>
                <h4 className="text-xs font-bold text-[#303451] uppercase tracking-wide mb-2">
                  Grants Summary ({user.grantsSummary.length})
                </h4>
                {user.grantsSummary.length === 0 ? (
                  <p className="text-xs text-[#212438]/40">No grant data.</p>
                ) : (
                  <ul className="space-y-1">
                    {user.grantsSummary.map((g, i) => (
                      <li key={i} className="text-xs font-mono text-[#212438]/70 bg-white border border-[#e1e0f7]/60 rounded px-2 py-1 break-all">
                        {g}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Account metadata */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {user.accountLocked && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                      ACCOUNT LOCKED
                    </span>
                  )}
                  {user.passwordExpired && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-100 text-orange-600 border border-orange-200">
                      PASSWORD EXPIRED
                    </span>
                  )}
                  {user.passwordLifetime !== null && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#e1e0f7]/40 text-[#6864d1]">
                      PWD LIFETIME: {user.passwordLifetime}d
                    </span>
                  )}
                  {user.passwordLifetime === null && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#e1e0f7]/40 text-[#212438]/50">
                      NO PWD LIFETIME
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Full grants (collapsed detail) */}
            {user.grants.length > 0 && (
              <details className="mt-3">
                <summary className="text-xs font-semibold text-[#6864d1] cursor-pointer select-none">
                  Raw SHOW GRANTS ({user.grants.length})
                </summary>
                <div className="mt-2 bg-[#303451] rounded-lg p-3 max-h-40 overflow-y-auto">
                  {user.grants.map((g, i) => (
                    <div key={i} className="text-[11px] font-mono text-green-300 break-all leading-5">{g}</div>
                  ))}
                </div>
              </details>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ===== Main component =====

export default function RogueUserWatchdog({ standalone = false }: RogueUserWatchdogProps) {
  const wrapper = standalone ? 'min-h-screen bg-gradient-to-br from-white to-[#e1e0f7]/20 p-8' : ''
  const store = useWatchdogStore()
  const s = store.set

  const loginPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (loginPollRef.current) clearInterval(loginPollRef.current)
      useWatchdogStore.getState().reset()
    }
  }, [])

  // Load clusters on mount
  useEffect(() => {
    teleportClusters()
      .then(({ clusters }) => s({ clusters }))
      .catch(() => {})
  }, [s])

  // Select cluster → check login status
  const selectCluster = useCallback(async (cluster: string) => {
    if (loginPollRef.current) { clearInterval(loginPollRef.current); loginPollRef.current = null }
    s({ selectedCluster: cluster, loginStatus: null, instances: [], selectedInstance: null, auditResult: null, error: '', loggingIn: false })
    try {
      const status = await teleportLoginStatus(cluster)
      s({ loginStatus: status })
      if (status.loggedIn) {
        loadInstances(cluster)
      }
    } catch {}
  }, [s])

  const startLogin = useCallback(async () => {
    const cluster = useWatchdogStore.getState().selectedCluster
    if (!cluster) return
    s({ error: '', loggingIn: true })

    // Check immediately first — might already be logged in
    try {
      const status = await teleportLoginStatus(cluster)
      if (status.loggedIn) {
        s({ loginStatus: status, loggingIn: false })
        loadInstances(cluster)
        return
      }
    } catch {}

    try {
      await teleportLogin(cluster)
    } catch (err: unknown) {
      s({ error: err instanceof Error ? err.message : 'Failed to start SSO login', loggingIn: false })
      return
    }

    // Auto-cancel after 3 minutes
    const autoCancel = setTimeout(() => {
      if (loginPollRef.current) { clearInterval(loginPollRef.current); loginPollRef.current = null }
      useWatchdogStore.getState().set({
        loggingIn: false,
        error: 'SSO login timed out after 3 minutes. Try again or check if a browser window opened.',
      })
    }, 3 * 60 * 1000)

    loginPollRef.current = setInterval(async () => {
      try {
        const status = await teleportLoginStatus(cluster)
        if (status.loggedIn) {
          clearTimeout(autoCancel)
          if (loginPollRef.current) clearInterval(loginPollRef.current)
          loginPollRef.current = null
          useWatchdogStore.getState().set({ loginStatus: status, loggingIn: false })
          loadInstances(cluster)
        }
      } catch {}
    }, 2000)
  }, [s])

  const cancelLogin = useCallback(() => {
    if (loginPollRef.current) { clearInterval(loginPollRef.current); loginPollRef.current = null }
    s({ loggingIn: false })
  }, [s])

  const checkLoginNow = useCallback(async () => {
    const cluster = useWatchdogStore.getState().selectedCluster
    if (!cluster) return
    s({ error: '' })
    try {
      const status = await teleportLoginStatus(cluster)
      if (status.loggedIn) {
        if (loginPollRef.current) { clearInterval(loginPollRef.current); loginPollRef.current = null }
        s({ loginStatus: status, loggingIn: false })
        await loadInstances(cluster)
      } else {
        s({ error: 'Not logged in yet — complete SSO in the browser window first.' })
      }
    } catch (err: unknown) {
      s({ error: err instanceof Error ? err.message : 'Login check failed' })
    }
  }, [s])

  const loadInstances = async (cluster: string) => {
    try {
      const { instances } = await teleportInstances(cluster)
      useWatchdogStore.getState().set({ instances, error: '' })
    } catch (err: unknown) {
      useWatchdogStore.getState().set({ error: err instanceof Error ? err.message : 'Failed to load instances' })
    }
  }

  const runAudit = useCallback(async () => {
    const { selectedCluster, selectedInstance } = useWatchdogStore.getState()
    if (!selectedCluster || !selectedInstance) return
    s({ loading: true, error: '', auditResult: null })
    try {
      const result = await auditInstance(selectedInstance.name, selectedCluster)
      s({ auditResult: result, loading: false })
    } catch (err: unknown) {
      s({ loading: false, error: err instanceof Error ? err.message : 'Audit failed' })
    }
  }, [s])

  const handleDownloadReport = useCallback(async () => {
    const { auditResult } = useWatchdogStore.getState()
    if (!auditResult) return
    try {
      await downloadReport(auditResult)
    } catch (err: unknown) {
      s({ error: err instanceof Error ? err.message : 'Report download failed' })
    }
  }, [s])

  const toggleUser = useCallback((userKey: string) => {
    const current = useWatchdogStore.getState().expandedUser
    useWatchdogStore.getState().set({ expandedUser: current === userKey ? null : userKey })
  }, [])

  // Derived state
  const needsLogin = store.loginStatus && !store.loginStatus.loggedIn
  const isLoggingIn = store.loggingIn
  const canRunAudit = !!store.loginStatus?.loggedIn && !!store.selectedInstance && !store.loading

  // Filtered users
  const filteredUsers: AuditUser[] = (store.auditResult?.users ?? []).filter((u) => {
    const matchesSearch =
      store.searchQuery === '' ||
      u.user.toLowerCase().includes(store.searchQuery.toLowerCase()) ||
      u.host.toLowerCase().includes(store.searchQuery.toLowerCase())
    const matchesRisk = store.riskFilter === 'ALL' || u.riskLevel === store.riskFilter
    return matchesSearch && matchesRisk
  })

  const riskFilterOptions: Array<RiskLevel | 'ALL'> = ['ALL', 'HIGH', 'MEDIUM', 'LOW', 'CLEAN']

  return (
    <div className={wrapper}>
      {standalone && (
        <h1 className="text-3xl font-extrabold text-[#303451] mb-6">Rogue User Watchdog</h1>
      )}

      <div className="flex gap-6">
        {/* ===== Sidebar ===== */}
        <div className="w-[19rem] flex-shrink-0 space-y-4">
          <div className="bg-white rounded-2xl shadow-qh border border-[#e1e0f7]/40 p-5">
            <h3 className="text-sm font-bold text-[#303451] mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-[#6864d1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Connection
            </h3>

            {/* Step indicator */}
            <div className="flex items-center gap-1 mb-4">
              {(['Cluster', 'Login', 'Instance'] as const).map((step, i) => {
                const done =
                  i === 0 ? !!store.selectedCluster :
                  i === 1 ? !!store.loginStatus?.loggedIn :
                  !!store.selectedInstance
                const active =
                  i === 0 ? !store.selectedCluster :
                  i === 1 ? !!store.selectedCluster && !store.loginStatus?.loggedIn :
                  !!store.loginStatus?.loggedIn && !store.selectedInstance
                return (
                  <div key={step} className="flex items-center gap-1 flex-1">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                      done ? 'bg-green-500 text-white' :
                      active ? 'bg-[#6864d1] text-white' :
                      'bg-[#e1e0f7]/60 text-[#212438]/40'
                    }`}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span className={`text-[10px] font-semibold ${
                      done ? 'text-green-600' : active ? 'text-[#6864d1]' : 'text-[#212438]/30'
                    }`}>{step}</span>
                    {i < 2 && <div className={`flex-1 h-px ${done ? 'bg-green-300' : 'bg-[#e1e0f7]'} mx-1`} />}
                  </div>
                )
              })}
            </div>

            {/* Cluster dropdown */}
            <label className="block text-xs font-semibold text-[#212438]/60 mb-1">Teleport Cluster</label>
            <select
              className="w-full px-3 py-2 rounded-lg border border-[#e1e0f7] text-sm text-[#212438] bg-white focus:outline-none focus:ring-2 focus:ring-[#6864d1]/30 mb-3"
              value={store.selectedCluster}
              onChange={(e) => e.target.value && selectCluster(e.target.value)}
              disabled={store.loading}
            >
              <option value="">Select a cluster...</option>
              {store.clusters.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Login */}
            {needsLogin && !isLoggingIn && (
              <button
                onClick={startLogin}
                className="w-full px-4 py-2 rounded-lg bg-[#6864d1] text-white font-semibold text-sm hover:bg-[#5753b8] transition-colors cursor-pointer mb-3"
              >
                Login via SSO
              </button>
            )}
            {isLoggingIn && (
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex items-center gap-2 text-xs text-[#6864d1] bg-[#e1e0f7]/20 rounded-lg px-3 py-2">
                  <div className="w-4 h-4 border-2 border-[#6864d1]/30 border-t-[#6864d1] rounded-full animate-spin flex-shrink-0" />
                  Complete SSO login in your browser, then wait...
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={checkLoginNow}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-[#6864d1]/40 text-[#6864d1] text-xs font-semibold hover:bg-[#e1e0f7]/40 transition-colors"
                  >
                    Already done? Check now
                  </button>
                  <button
                    onClick={cancelLogin}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-500 text-xs font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {store.error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 break-words">
                {store.error}
              </div>
            )}
            {store.loginStatus?.loggedIn && (
              <div className="text-xs text-green-600 font-semibold mb-3 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {store.loginStatus.username}
              </div>
            )}

            {/* Instance dropdown */}
            {store.instances.length > 0 && (
              <>
                <label className="block text-xs font-semibold text-[#212438]/60 mb-1">MySQL Instance</label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-[#e1e0f7] text-sm text-[#212438] bg-white focus:outline-none focus:ring-2 focus:ring-[#6864d1]/30 mb-3"
                  value={store.selectedInstance?.name ?? ''}
                  onChange={(e) => {
                    const inst = store.instances.find((i) => i.name === e.target.value)
                    s({ selectedInstance: inst ?? null })
                  }}
                  disabled={store.loading}
                >
                  <option value="">Select an instance...</option>
                  {store.instances.map((inst) => (
                    <option key={inst.name} value={inst.name}>{inst.name}</option>
                  ))}
                </select>
              </>
            )}

            {/* Run Audit button */}
            <button
              onClick={runAudit}
              disabled={!canRunAudit}
              className={`w-full px-4 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                canRunAudit
                  ? 'bg-[#6864d1] text-white hover:bg-[#5753b8] cursor-pointer'
                  : 'bg-[#e1e0f7]/60 text-[#212438]/30 cursor-not-allowed'
              }`}
            >
              {store.loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Auditing...
                </span>
              ) : 'Run Audit'}
            </button>

            {store.error && (
              <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {store.error}
              </div>
            )}
          </div>

          {/* Instance info card */}
          {store.selectedInstance && (
            <div className="bg-white rounded-2xl shadow-qh border border-[#e1e0f7]/40 p-4">
              <h4 className="text-xs font-bold text-[#303451] mb-2 uppercase tracking-wide">Instance</h4>
              <div className="space-y-1">
                <div className="text-xs font-mono text-[#303451] font-semibold truncate" title={store.selectedInstance.name}>
                  {store.selectedInstance.name}
                </div>
                <div className="text-[10px] text-[#212438]/50 font-mono">
                  {store.selectedInstance.accountId} · {store.selectedInstance.region}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===== Main Content ===== */}
        <div className="flex-1 min-w-0">
          {/* Empty state */}
          {!store.auditResult && !store.loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6864d1] to-[#8c9fff] flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-[#303451] mb-1">Rogue User Watchdog</h2>
                <p className="text-sm text-[#212438]/50">
                  Select a cluster and instance, then run an audit
                </p>
              </div>
            </div>
          )}

          {/* Loading state */}
          {store.loading && (
            <div className="bg-white rounded-2xl shadow-qh border border-[#e1e0f7]/40 p-10 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-[#e1e0f7] border-t-[#6864d1] rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-sm font-semibold text-[#303451]">Running Security Audit</p>
                <p className="text-xs text-[#212438]/50 mt-1">
                  Connecting via Teleport and analysing MySQL user accounts...
                </p>
              </div>
            </div>
          )}

          {/* Audit results */}
          {store.auditResult && !store.loading && (
            <div className="space-y-4">
              {/* Header row */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-extrabold text-[#303451]">
                    Audit: <span className="font-mono">{store.auditResult.instance}</span>
                  </h2>
                  <p className="text-xs text-[#212438]/50">
                    {new Date(store.auditResult.auditedAt).toLocaleString()}
                    {' · '}
                    {store.auditResult.summary.totalUsers} total users
                    {store.auditResult.summary.systemUsers > 0 && ` (${store.auditResult.summary.systemUsers} system)`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={runAudit}
                    disabled={!canRunAudit}
                    className="px-4 py-2 rounded-xl text-sm font-semibold border border-[#e1e0f7] text-[#6864d1] hover:bg-[#e1e0f7]/30 transition-colors cursor-pointer"
                  >
                    Re-run
                  </button>
                  <button
                    onClick={handleDownloadReport}
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-[#6864d1] text-white hover:bg-[#5753b8] transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Excel Report
                  </button>
                </div>
              </div>

              {/* Summary row */}
              <div className="flex gap-3 flex-wrap">
                <SummaryCard
                  label="HIGH RISK"
                  value={store.auditResult.summary.highRisk}
                  color="bg-red-50 text-red-700 border border-red-200"
                />
                <SummaryCard
                  label="MEDIUM RISK"
                  value={store.auditResult.summary.mediumRisk}
                  color="bg-amber-50 text-amber-700 border border-amber-200"
                />
                <SummaryCard
                  label="LOW RISK"
                  value={store.auditResult.summary.lowRisk}
                  color="bg-blue-50 text-blue-700 border border-blue-200"
                />
                <SummaryCard
                  label="CLEAN"
                  value={store.auditResult.summary.clean}
                  color="bg-green-50 text-green-700 border border-green-200"
                />
              </div>

              {/* Filter bar */}
              <div className="bg-white rounded-xl shadow-qh border border-[#e1e0f7]/40 px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[12rem]">
                  <input
                    type="text"
                    placeholder="Search by username or host..."
                    className="w-full px-3 py-1.5 rounded-lg border border-[#e1e0f7] text-sm text-[#212438] bg-[#f8f8fd] focus:outline-none focus:ring-2 focus:ring-[#6864d1]/30"
                    value={store.searchQuery}
                    onChange={(e) => s({ searchQuery: e.target.value })}
                  />
                </div>
                <div className="flex gap-1">
                  {riskFilterOptions.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => s({ riskFilter: opt })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        store.riskFilter === opt
                          ? 'bg-[#6864d1] text-white'
                          : 'bg-[#e1e0f7]/40 text-[#212438]/60 hover:bg-[#e1e0f7]/70'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-[#212438]/40 ml-auto">
                  {filteredUsers.length} of {store.auditResult.users.length}
                </span>
              </div>

              {/* User table */}
              <div className="bg-white rounded-2xl shadow-qh border border-[#e1e0f7]/40 overflow-hidden">
                {filteredUsers.length === 0 ? (
                  <div className="px-6 py-10 text-center text-sm text-[#212438]/40">
                    No users match your filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-[#f8f8fd] border-b border-[#e1e0f7]/60">
                          <th className="px-4 py-3 text-xs font-bold text-[#212438]/50 uppercase tracking-wide w-28">Risk</th>
                          <th className="px-4 py-3 text-xs font-bold text-[#212438]/50 uppercase tracking-wide">User@Host</th>
                          <th className="px-4 py-3 text-xs font-bold text-[#212438]/50 uppercase tracking-wide">Plugin</th>
                          <th className="px-4 py-3 text-xs font-bold text-[#212438]/50 uppercase tracking-wide">Flags</th>
                          <th className="px-4 py-3 text-xs font-bold text-[#212438]/50 uppercase tracking-wide text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((user) => {
                          const key = `${user.user}@${user.host}`
                          return (
                            <UserRow
                              key={key}
                              user={user}
                              isExpanded={store.expandedUser === key}
                              onToggle={() => toggleUser(key)}
                            />
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
