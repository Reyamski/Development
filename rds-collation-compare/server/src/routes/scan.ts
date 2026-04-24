import { Router } from 'express';
import { getConnection } from '../services/connection-manager.js';
import { fetchCollationsForDatabases } from '../services/collation-fetcher.js';
import { analyzeCollations } from '../services/collation-analyzer.js';
import { buildCollationWorkbook } from '../services/excel-builder.js';
import { DEFAULT_BASELINE, type Baseline, type CollationReport } from '../types.js';

const router = Router();

function parseBaseline(input: any): Baseline {
  const characterSet = input?.characterSet || DEFAULT_BASELINE.characterSet;
  const collation = input?.collation || DEFAULT_BASELINE.collation;
  return { characterSet: String(characterSet), collation: String(collation) };
}

/**
 * POST /api/scan
 * Body: { instance, databases: string[], baseline?: { characterSet, collation } }
 * Scans all provided databases on the active connection and returns a unified report.
 */
router.post('/', async (req, res) => {
  const { instance, databases, baseline: baselineInput } = req.body ?? {};

  if (!instance || !Array.isArray(databases) || databases.length === 0) {
    return res.status(400).json({
      error: 'Missing required fields: instance, databases (non-empty array)',
    });
  }

  const connection = getConnection();
  if (!connection) {
    return res.status(400).json({ error: 'Not connected. Use /api/teleport/connect first.' });
  }

  const baseline = parseBaseline(baselineInput);

  try {
    const collations = await fetchCollationsForDatabases(connection, databases);
    const issues = analyzeCollations(collations, baseline);

    const report: CollationReport = {
      instance,
      databases,
      baseline,
      collations,
      issues,
      timestamp: new Date().toISOString(),
    };

    res.json(report);
  } catch (error: any) {
    console.error('Scan error:', error);
    res.status(500).json({ error: error.message || 'Failed to scan collations' });
  }
});

/**
 * POST /api/scan/export
 * Body: CollationReport
 * Returns an .xlsx download of the report.
 */
router.post('/export', async (req, res) => {
  const report = req.body as CollationReport | undefined;

  if (!report || !report.instance || !Array.isArray(report.collations)) {
    return res.status(400).json({ error: 'Invalid report payload' });
  }

  try {
    const buffer = await buildCollationWorkbook(report);
    const safeInstance = report.instance.replace(/[^a-zA-Z0-9_-]/g, '_');
    const ts = (report.timestamp || new Date().toISOString()).replace(/[:.]/g, '-');
    const filename = `collations_${safeInstance}_${ts}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Excel export error:', error);
    res.status(500).json({ error: error.message || 'Failed to build Excel file' });
  }
});

export default router;
