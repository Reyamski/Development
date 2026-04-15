import { Router, Request, Response } from 'express'
import { generateMarkdownReport } from '../services/report.js'
import type { AuditResult } from '../types.js'

const router = Router()

router.post('/', (req: Request, res: Response) => {
  try {
    const auditResult: AuditResult = req.body

    if (!auditResult?.instance || !auditResult?.users) {
      res.status(400).json({ error: 'Invalid audit result payload' })
      return
    }

    const markdown = generateMarkdownReport(auditResult)
    const filename = `rogue-db-audit-${auditResult.instance}-${new Date(auditResult.auditedAt).toISOString().slice(0, 10)}.md`

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(markdown)
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' })
  }
})

export default router
