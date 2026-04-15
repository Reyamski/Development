import { Router, Request, Response } from 'express'
import {
  findTsh,
  getLoginStatus,
  startTunnel,
  stopTunnel,
  registerTunnel,
  unregisterTunnel,
} from '../shared/teleport.js'
import { fetchUserData } from '../services/user-fetcher.js'
import { runRulesEngine } from '../services/rules-engine.js'
import type { AuditResult } from '../types.js'

const router = Router()

router.get('/:instance', async (req: Request, res: Response) => {
  const { instance } = req.params
  const cluster = req.query.cluster as string | undefined

  if (!instance) {
    res.status(400).json({ error: 'instance param is required' })
    return
  }

  let tsh: string
  try {
    tsh = await findTsh()
  } catch (err: unknown) {
    res.status(503).json({ error: `tsh not available: ${err instanceof Error ? err.message : String(err)}` })
    return
  }

  const loginStatus = await getLoginStatus(tsh, cluster)
  if (!loginStatus.loggedIn || !loginStatus.username) {
    res.status(401).json({ error: 'Not logged in to Teleport. Please authenticate first.' })
    return
  }

  let tunnel
  try {
    tunnel = await startTunnel(tsh, instance, loginStatus.username, cluster)
    registerTunnel(tunnel)
  } catch (err: unknown) {
    res.status(500).json({ error: `Failed to start Teleport tunnel: ${err instanceof Error ? err.message : String(err)}` })
    return
  }

  let connection: import('mysql2/promise').Connection | undefined
  try {
    const mysql = await import('mysql2/promise')
    connection = await mysql.createConnection({
      host: tunnel.host,
      port: tunnel.port,
      user: tunnel.dbUser,
      database: 'mysql',
      multipleStatements: false,
    })

    const data = await fetchUserData(connection)
    const { auditedUsers, systemUserCount } = runRulesEngine(data)

    const highCount = auditedUsers.filter(u => u.riskLevel === 'HIGH').length
    const mediumCount = auditedUsers.filter(u => u.riskLevel === 'MEDIUM').length
    const lowCount = auditedUsers.filter(u => u.riskLevel === 'LOW').length
    const cleanCount = auditedUsers.filter(u => u.riskLevel === 'CLEAN').length

    const result: AuditResult = {
      instance,
      auditedAt: new Date().toISOString(),
      summary: {
        totalUsers: auditedUsers.length + systemUserCount,
        systemUsers: systemUserCount,
        highRisk: highCount,
        mediumRisk: mediumCount,
        lowRisk: lowCount,
        clean: cleanCount,
      },
      users: auditedUsers,
    }

    await connection.end()
    res.json(result)
  } catch (err: unknown) {
    try { await connection?.end() } catch { /* ignore */ }
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' })
  } finally {
    unregisterTunnel(instance)
    try { await stopTunnel(tsh!, tunnel) } catch { /* ignore */ }
  }
})

export default router
