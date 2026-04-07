import { Router } from 'express'
import { pingInference } from '../services/colorizerClient.js'

const router = Router()

router.get('/', async (_req, res) => {
  const inference = await pingInference()
  res.json({
    backend: 'ok',
    inference: inference.up ? 'ok' : 'unreachable',
    inferenceDetail: inference,
    timestamp: new Date().toISOString(),
  })
})

export default router
