import { Router, Request, Response } from 'express';
import { getConnection, getActiveSession } from '../services/connection-manager.js';
import { buildSchemaSummary } from '../services/schema-summary.js';
import { guardSql, stripSqlComments } from '../services/sql-guard.js';
import { runAiCompletion, aiErrorStatus } from '../services/ai-providers.js';

const router = Router();

const SAFETY_RULES = `Rules:
- Prefer MySQL 8 compatible syntax.
- Always add LIMIT to generated SELECT unless the user explicitly forbids it.
- ONLY suggest read-only operations: SELECT, EXPLAIN, SHOW, DESCRIBE. Never suggest INSERT, UPDATE, DELETE, REPLACE.
- NEVER suggest DDL (CREATE, ALTER, DROP, TRUNCATE, RENAME) — including ADD INDEX, DROP INDEX, ALTER TABLE.
- NEVER suggest OPTIMIZE TABLE, ANALYZE TABLE, REPAIR TABLE, FLUSH, LOCK TABLES — these block the table.
- NEVER suggest GRANT, REVOKE, or any privilege/user management SQL.
- If a question requires a write operation to answer, say so plainly and stop — do not generate the write SQL.
- If unsure, say you are unsure instead of inventing tables/columns.
- When asked to "improve performance", explain trade-offs in plain English only. Do not output index/schema-change SQL.`;

router.post('/ask', async (req: Request, res: Response) => {
  try {
    const { message, includeSchema } = req.body as {
      message?: string;
      includeSchema?: boolean;
    };
    if (!message?.trim()) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    let schemaBlock = '';
    const safeDb = getActiveSession()?.database ?? '';
    if (includeSchema && safeDb) {
      try {
        const conn = getConnection();
        schemaBlock = await buildSchemaSummary(conn, safeDb);
      } catch {
        schemaBlock = '(Could not load schema — connect and pick a database.)';
      }
    }

    const system = `You are an expert MySQL DBA assistant for Query Hub.
${SAFETY_RULES}

Response format:
- Answer in plain English first (1–3 short paragraphs).
- If the question asks for SQL, ALWAYS include a complete \`\`\`sql block with a runnable query — never end with a colon or "here's the query:" without the actual SQL.
- If you cannot answer without a write operation, explain why and stop — do not output partial SQL.

${schemaBlock ? `Schema context:\n${schemaBlock}\n` : ''}`;

    const { text, model } = await runAiCompletion(system, message.trim(), 4096);
    const sqlMatch = text.match(/```sql\n([\s\S]*?)```/i);
    const sqlSuggestion = sqlMatch ? sqlMatch[1].trim() : undefined;

    res.json({
      message: text,
      sqlSuggestion,
      model,
    });
  } catch (e) {
    const status = aiErrorStatus(e);
    res.status(status).json({ error: e instanceof Error ? e.message : 'AI request failed' });
  }
});

router.post('/explain', async (req: Request, res: Response) => {
  try {
    const { sql } = req.body as { sql?: string };
    if (!sql?.trim()) {
      res.status(400).json({ error: 'sql is required' });
      return;
    }
    let schemaBlock = '';
    const safeDb = getActiveSession()?.database ?? '';
    if (safeDb) {
      try {
        const conn = getConnection();
        schemaBlock = await buildSchemaSummary(conn, safeDb, 25);
      } catch {
        /* ignore */
      }
    }
    const userSql = stripSqlComments(sql).trim();
    const system = `Explain SQL for MySQL DBAs. Be thorough but not bloated — finish every section you start. ${SAFETY_RULES}\n\n${schemaBlock ? `Schema:\n${schemaBlock}` : ''}`;
    const { text, model } = await runAiCompletion(system, `Explain this SQL in plain English:\n\n${userSql}`, 4096);
    res.json({ explanation: text, model });
  } catch (e) {
    const status = aiErrorStatus(e);
    res.status(status).json({ error: e instanceof Error ? e.message : 'AI request failed' });
  }
});

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body as { prompt?: string };
    if (!prompt?.trim()) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }
    let schemaBlock = '';
    const safeDb = getActiveSession()?.database ?? '';
    if (safeDb) {
      try {
        const conn = getConnection();
        schemaBlock = await buildSchemaSummary(conn, safeDb);
      } catch {
        schemaBlock = '';
      }
    }
    const system = `Generate MySQL SELECT queries from natural language. Put final SQL only in a \`\`\`sql code block. ${SAFETY_RULES}\n\n${schemaBlock ? `Schema:\n${schemaBlock}` : 'No schema loaded — infer carefully.'}`;
    const { text, model } = await runAiCompletion(system, prompt.trim(), 4096);
    const sqlMatch = text.match(/```sql\n([\s\S]*?)```/i);
    const sql = sqlMatch ? sqlMatch[1].trim() : undefined;
    res.json({ message: text, sql, model });
  } catch (e) {
    const status = aiErrorStatus(e);
    res.status(status).json({ error: e instanceof Error ? e.message : 'AI request failed' });
  }
});

router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      mode?: string;
      sql?: string;
      explainPlan?: Record<string, unknown>[];
      columns?: string[];
      rows?: unknown[][];
    };
    const mode = body.mode;
    if (mode !== 'explain_plan' && mode !== 'result_sample') {
      res.status(400).json({ error: 'mode must be explain_plan or result_sample' });
      return;
    }

    let schemaBlock = '';
    const safeDb = getActiveSession()?.database ?? '';
    if (safeDb) {
      try {
        const conn = getConnection();
        schemaBlock = await buildSchemaSummary(conn, safeDb, 20);
      } catch {
        /* ignore */
      }
    }

    const sqlLine = body.sql?.trim() ? `Original SQL:\n${stripSqlComments(body.sql).trim()}\n\n` : '';

    let userContent: string;
    if (mode === 'explain_plan') {
      if (!body.explainPlan || !Array.isArray(body.explainPlan) || body.explainPlan.length === 0) {
        res.status(400).json({ error: 'explainPlan (non-empty array) is required for explain_plan' });
        return;
      }
      userContent = `${sqlLine}MySQL EXPLAIN output (rows as JSON):\n${JSON.stringify(body.explainPlan, null, 2)}\n\nExplain this execution plan for a DBA: access types, keys used, row estimates, and whether anything looks risky (e.g. full table scan, filesort). Use short bullets.`;
    } else {
      const cols = body.columns;
      const rows = body.rows;
      if (!cols?.length || !rows?.length) {
        res.status(400).json({ error: 'columns and rows (non-empty) are required for result_sample' });
        return;
      }
      const preview = rows.slice(0, 25);
      userContent = `${sqlLine}The query returned a result set. Columns: ${cols.join(', ')}\n\nSample rows (up to 25, JSON):\n${JSON.stringify(preview)}\n\nSummarize what this data represents and call out anything notable (e.g. NULL-heavy columns, query text patterns). Keep it concise.`;
    }

    const system = `You are an expert MySQL DBA helping interpret EXPLAIN plans and query results inside Query Hub. Finish every section you start.\n${SAFETY_RULES}\n\n${schemaBlock ? `Schema context:\n${schemaBlock}\n` : ''}`;
    const { text, model } = await runAiCompletion(system, userContent, 4096);
    res.json({ explanation: text, model });
  } catch (e) {
    const status = aiErrorStatus(e);
    res.status(status).json({ error: e instanceof Error ? e.message : 'AI request failed' });
  }
});

/** POST /api/ai/sso-login — spawn `aws sso login --profile <bedrock-profile>` on the API host.
 * Browser opens for SSO authorization; the spawned process exits when the user completes login.
 * Mirrors how Teleport login is handled — fire-and-forget, status polled separately. */
router.post('/sso-login', async (_req: Request, res: Response) => {
  try {
    const profile = process.env.QUERY_HUB_BEDROCK_PROFILE?.trim();
    if (!profile) {
      res.status(503).json({ error: 'QUERY_HUB_BEDROCK_PROFILE is not configured on the server.' });
      return;
    }
    const { spawn } = await import('node:child_process');
    const proc = spawn('aws', ['sso', 'login', '--profile', profile], {
      stdio: 'ignore',
      detached: true,
      windowsHide: false,
      shell: process.platform === 'win32', // resolve aws.cmd / aws.exe via PATH on Windows
    });
    proc.on('error', () => { /* surfaced via subsequent /ask or /explain failures */ });
    proc.unref();
    res.json({ started: true, profile });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to launch AWS SSO login' });
  }
});

router.post('/validate-ai-sql', (req: Request, res: Response) => {
  const { sql } = req.body as { sql?: string };
  if (!sql?.trim()) {
    res.status(400).json({ error: 'sql is required' });
    return;
  }
  const g = guardSql(sql);
  res.json({ valid: g.allowed, blocked: !g.allowed, reason: g.reason, blockedPattern: g.blockedPattern });
});

export default router;
