import type { ComparisonResult } from '../differ/types.js';
import type { Summary, SchemaContext, OutputFilter } from './types.js';

function formatQualifiedName(ctx: SchemaContext, result: ComparisonResult): string {
  return `${ctx.instanceName}.${ctx.databaseName}.${result.name}`;
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: Array<{ type: string; text: string }>;
  fields?: Array<{ type: string; text: string }>;
}

const MAX_BLOCKS = 50;

interface TypeGroup {
  label: string;
  objectType: string;
  items: ComparisonResult[];
}

function buildTypeGroups(results: ComparisonResult[]): TypeGroup[] {
  const order = [
    { label: 'Tables & Related', objectType: 'tables' },
    { label: 'Stored Procedures', objectType: 'procedures' },
    { label: 'Views', objectType: 'views' },
    { label: 'Functions', objectType: 'functions' },
    { label: 'Triggers', objectType: 'triggers' },
    { label: 'Events', objectType: 'events' },
    { label: 'Standalone Indexes', objectType: 'indexes' },
  ];
  return order
    .map(({ label, objectType }) => ({
      label,
      objectType,
      items: results.filter((r) => r.objectType === objectType),
    }))
    .filter((g) => g.items.length > 0);
}

function computeDriftInsights(
  results: ComparisonResult[],
  summary: Summary
): { driftScore: number; hasBreaking: boolean } {
  const total = summary.added + summary.removed + summary.modified + summary.unchanged;
  const driftScore = total > 0
    ? Math.round(((summary.added + summary.removed + summary.modified) / total) * 100)
    : 0;

  const hasBreaking =
    results.some((r) => r.status === 'removed' && r.objectType === 'tables') ||
    results.some(
      (r) =>
        r.status === 'modified' &&
        r.tableDiff &&
        (r.tableDiff.columns.some((c) => c.status === 'removed') ||
          r.tableDiff.foreignKeys.some((f) => f.status === 'removed'))
    );

  return { driftScore, hasBreaking };
}

// ─── Webhook (legacy one-message send) ───────────────────────────────────────

export async function sendToSlack(
  webhookUrl: string,
  results: ComparisonResult[],
  summary: Summary,
  ctx: SchemaContext
): Promise<void> {
  const blocks = buildSummaryBlocks(results, summary, ctx, undefined);

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Slack webhook failed (${res.status}): ${text}`);
  }
}

// ─── Bot API (summary message + thread reply) ─────────────────────────────────

export async function sendToSlackWithThread(
  botToken: string,
  channel: string,
  results: ComparisonResult[],
  summary: Summary,
  ctx: SchemaContext,
  filter: OutputFilter,
  confluencePageUrl?: string
): Promise<void> {
  const summaryBlocks = buildSummaryBlocks(results, summary, ctx, filter, confluencePageUrl);
  const threadBlocks = buildThreadBreakdownBlocks(results, filter, ctx);

  // Post summary message
  const res1 = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${botToken}`,
    },
    body: JSON.stringify({
      channel,
      blocks: summaryBlocks,
      text: `Schema Drift Report: ${ctx.instanceName}.${ctx.databaseName}`,
    }),
  });

  const data1 = await res1.json() as { ok: boolean; ts?: string; error?: string };
  if (!data1.ok) {
    throw new Error(`Slack chat.postMessage failed: ${data1.error}`);
  }

  // Post thread reply with detailed breakdown
  const res2 = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${botToken}`,
    },
    body: JSON.stringify({
      channel,
      thread_ts: data1.ts,
      blocks: threadBlocks,
      text: 'Detailed breakdown by object type',
    }),
  });

  const data2 = await res2.json() as { ok: boolean; error?: string };
  if (!data2.ok) {
    throw new Error(`Slack thread reply failed: ${data2.error}`);
  }
}

// ─── Summary blocks (main message) ───────────────────────────────────────────

function buildSummaryBlocks(
  results: ComparisonResult[],
  summary: Summary,
  ctx: SchemaContext,
  confluencePageUrl: string | undefined
): SlackBlock[] {
  const blocks: SlackBlock[] = [];
  const now = new Date().toLocaleString();
  const { driftScore, hasBreaking } = computeDriftInsights(results, summary);

  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: `Schema Drift Report: ${ctx.instanceName}.${ctx.databaseName}` },
  });

  blocks.push({
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*Generated:*\n${now}` },
      { type: 'mrkdwn', text: `*Total Objects:*\n${summary.added + summary.removed + summary.modified + summary.unchanged}` },
    ],
  });

  blocks.push({
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `:large_green_circle: *Added:* ${summary.added}` },
      { type: 'mrkdwn', text: `:red_circle: *Removed:* ${summary.removed}` },
      { type: 'mrkdwn', text: `:large_orange_diamond: *Modified:* ${summary.modified}` },
      { type: 'mrkdwn', text: `:white_circle: *Unchanged:* ${summary.unchanged}` },
    ],
  });

  const insightLines = [
    `*Drift Score:* ${driftScore}%`,
    `*Breaking Changes:* ${hasBreaking ? ':warning: YES' : ':white_check_mark: NO'}`,
  ];
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: insightLines.join('  |  ') },
  });

  if (confluencePageUrl) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `:confluence: *Full Report:* <${confluencePageUrl}|View on Confluence>` },
    });
  }

  return blocks.slice(0, MAX_BLOCKS);
}

// ─── Thread breakdown blocks ──────────────────────────────────────────────────

function buildThreadBreakdownBlocks(
  results: ComparisonResult[],
  filter: OutputFilter,
  ctx: SchemaContext
): SlackBlock[] {
  const blocks: SlackBlock[] = [];

  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: 'Detailed Breakdown by Object Type' },
  });

  const filtered = results.filter((r) => {
    if (r.status === 'added' && !filter.includeAdded) return false;
    if (r.status === 'removed' && !filter.includeRemoved) return false;
    if (r.status === 'modified' && !filter.includeModified) return false;
    return true;
  });

  const groups = buildTypeGroups(filtered);

  if (groups.length === 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '_No changes match the selected filters._' },
    });
    return blocks;
  }

  for (const g of groups) {
    if (blocks.length >= MAX_BLOCKS - 1) break;

    const added = g.items.filter((r) => r.status === 'added').length;
    const modified = g.items.filter((r) => r.status === 'modified').length;
    const removed = g.items.filter((r) => r.status === 'removed').length;

    const parts: string[] = [];
    if (added > 0) parts.push(`:large_green_circle: ${added} added`);
    if (modified > 0) parts.push(`:large_orange_diamond: ${modified} modified`);
    if (removed > 0) parts.push(`:red_circle: ${removed} removed`);

    let text = `*${g.label}* — ${parts.join(', ')}`;

    // For tables: show aggregate column/index/FK change counts
    if (g.objectType === 'tables') {
      const modifiedTables = g.items.filter((r) => r.status === 'modified' && r.tableDiff);
      const totalCols = modifiedTables.reduce(
        (sum, r) => sum + r.tableDiff!.columns.filter((c) => c.status !== 'unchanged').length, 0
      );
      const totalIdx = modifiedTables.reduce(
        (sum, r) => sum + r.tableDiff!.indexes.filter((i) => i.status !== 'unchanged').length, 0
      );
      const totalFks = modifiedTables.reduce(
        (sum, r) => sum + r.tableDiff!.foreignKeys.filter((f) => f.status !== 'unchanged').length, 0
      );
      const details: string[] = [];
      if (totalCols > 0) details.push(`${totalCols} col change${totalCols !== 1 ? 's' : ''}`);
      if (totalIdx > 0) details.push(`${totalIdx} idx change${totalIdx !== 1 ? 's' : ''}`);
      if (totalFks > 0) details.push(`${totalFks} FK change${totalFks !== 1 ? 's' : ''}`);
      if (details.length > 0) {
        text += `\n_↳ ${details.join(', ')} across ${modifiedTables.length} modified table${modifiedTables.length !== 1 ? 's' : ''}_`;
      }

      // List each modified table name
      for (const r of modifiedTables) {
        const name = formatQualifiedName(ctx, r);
        const colC = r.tableDiff!.columns.filter((c) => c.status !== 'unchanged').length;
        const idxC = r.tableDiff!.indexes.filter((i) => i.status !== 'unchanged').length;
        const fkC = r.tableDiff!.foreignKeys.filter((f) => f.status !== 'unchanged').length;
        const breakdown: string[] = [];
        if (colC) breakdown.push(`${colC} col`);
        if (idxC) breakdown.push(`${idxC} idx`);
        if (fkC) breakdown.push(`${fkC} fk`);
        if (r.tableDiff!.primaryKeyChanged) breakdown.push('pk');
        text += `\n  • \`${name}\`${breakdown.length ? ` _(${breakdown.join(', ')})_` : ''}`;
      }
    }

    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text },
    });
  }

  return blocks.slice(0, MAX_BLOCKS);
}
