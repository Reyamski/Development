import { Router, Request, Response } from 'express'
import {
  findTsh,
  getClusters,
  getLoginStatus,
  loginToCluster,
  listMysqlInstances,
} from '../shared/teleport.js'

const router = Router()

router.get('/clusters', async (_req: Request, res: Response) => {
  try {
    const clusters = await getClusters()
    res.json({ clusters })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get clusters' })
  }
})

router.get('/login-status', async (req: Request, res: Response) => {
  try {
    const cluster = req.query.cluster as string | undefined
    const tsh = await findTsh()
    const status = await getLoginStatus(tsh, cluster)
    res.json(status)
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get login status' })
  }
})

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { cluster } = req.body as { cluster?: string }
    if (!cluster) {
      res.status(400).json({ error: 'cluster is required' })
      return
    }
    const tsh = await findTsh()
    const proc = loginToCluster(tsh, cluster)
    proc.on('exit', () => {})
    proc.on('error', () => {})
    res.json({ started: true })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to start login' })
  }
})

router.get('/instances', async (req: Request, res: Response) => {
  try {
    const cluster = req.query.cluster as string
    if (!cluster) {
      res.status(400).json({ error: 'cluster query param is required' })
      return
    }
    const tsh = await findTsh()
    const instances = await listMysqlInstances(tsh, cluster)
    res.json({ instances })
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list instances' })
  }
})

export default router
