import { Router, Request, Response } from 'express';
import { getConnection, getActiveSession } from '../services/connection-manager.js';
import { buildSchemaSummary } from '../services/schema-summary.js';
import { guardSql, stripSqlComments } from '../services/sql-guard.js';
import { runAiCompletion, aiErrorStatus } from '../services/ai-providers.js';

const router = Router();

const SAFETY_RULES = `Rules:
- Prefer MySQL 8 compatible syntax.
- Always add LIMIT to generated SELECT unless the user explicitly forbids it.
- Never suggest DROP, TRUNCATE, DELETE without WHERE, GRANT, or other destructive/privilege SQL.
- If unsure, say you are unsure instead of inventing tables/columns.`;

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

    const system = `You are an expert MySQL DBA assistant for Query Hub.\n${SAFETY_RULES}\n\n${
      schemaBlock ? `Schema context:\n${schemaBlock}\n` : ''
    }`;

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
    const system = `Explain SQL for MySQL DBAs. Be concise. ${SAFETY_RULES}\n\n${schemaBlock ? `Schema:\n${schemaBlock}` : ''}`;
    const { text, model } = await runAiCompletion(system, `Explain this SQL in plain English:\n\n${userSql}`, 2048);
    res.json({ explanation: text, model });
  } catch (e) {
    const status = aiErrorStatus(e);
    res.status(status).json({ error: e instanceof Error ? e.message : 'AI request failed' });
  }
});

router.post('/optimize', async (req: Request, res: Response) => {
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
    const system = `Suggest MySQL query optimizations. Return improved SQL in a \`\`\`sql block when applicable. ${SAFETY_RULES}\n\n${schemaBlock ? `Schema:\n${schemaBlock}` : ''}`;
    const { text, model } = await runAiCompletion(system, `Analyze and optimize:\n\n${userSql}`, 4096);
    const sqlMatch = text.match(/```sql\n([\s\S]*?)```/i);
    const optimizedSql = sqlMatch ? sqlMatch[1].trim() : undefined;
    res.json({ message: text, optimizedSql, model });
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

    const system = `You are an expert MySQL DBA helping interpret EXPLAIN plans and query results inside Query Hub.\n${SAFETY_RULES}\n\n${schemaBlock ? `Schema context:\n${schemaBlock}\n` : ''}`;
    const { text, model } = await runAiCompletion(system, userContent, 3072);
    res.json({ explanation: text, model });
  } catch (e) {
    const status = aiErrorStatus(e);
    res.status(status).json({ error: e instanceof Error ? e.message : 'AI request failed' });
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
