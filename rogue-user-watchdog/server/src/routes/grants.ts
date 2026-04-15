import { Router, Request, Response } from 'express'
import {
  findTsh,
  getLoginStatus,
  startTunnel,
  stopTunnel,
  registerTunnel,
  unregisterTunnel,
} from '../shared/teleport.js'

const router = Router()

router.get('/:instance/:user/:host', async (req: Request, res: Response) => {
  const { instance, user } = req.params
  const host = decodeURIComponent(req.params.host)
  const cluster = req.query.cluster as string | undefined

  if (!instance || !user || !host) {
    res.status(400).json({ error: 'instance, user, and host params are required' })
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
    res.status(401).json({ error: 'Not logged in to Teleport' })
    return
  }

  let tunnel
  try {
    tunnel = await startTunnel(tsh, instance, loginStatus.username, cluster)
    registerTunnel(tunnel)
  } catch (err: unknown) {
    res.status(500).json({ error: `Failed to start tunnel: ${err instanceof Error ? err.message : String(err)}` })
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
    })

    const [rows] = await connection.query('SHOW GRANTS FOR ?@?', [user, host])
    const grants = (rows as Record<string, unknown>[]).map((r) => Object.values(r)[0] as string)

    await connection.end()
    res.json({ user, host, grants })
  } catch (err: unknown) {
    try { await connection?.end() } catch { /* ignore */ }
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' })
  } finally {
    unregisterTunnel(instance)
    try { await stopTunnel(tsh!, tunnel) } catch { /* ignore */ }
  }
})

export default router
