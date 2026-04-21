import { Router, Request, Response } from 'express'
import { generateExcelReport } from '../services/excel-report.js'
import type { AuditResult } from '../types.js'

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  try {
    const auditResult: AuditResult = req.body

    if (!auditResult?.instance || !auditResult?.users) {
      res.status(400).json({ error: 'Invalid audit result payload' })
      return
    }

    const excelBuffer = await generateExcelReport(auditResult)
    const filename = `rogue-db-audit-${auditResult.instance}-${new Date(auditResult.auditedAt).toISOString().slice(0, 10)}.xlsx`

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(excelBuffer)
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' })
  }
})

export default router
