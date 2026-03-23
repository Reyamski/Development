import type { ComparisonResult, TableDiffDetail } from '../differ/types.js';
import type { ConfluenceConfig, Summary, SchemaContext, OutputFilter } from './types.js';

function formatQualifiedName(ctx: SchemaContext, result: ComparisonResult): string {
  return `${ctx.instanceName}.${ctx.databaseName}.${result.name}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function authHeader(email: string, apiToken: string): string {
  return 'Basic ' + Buffer.from(`${email}:${apiToken}`).toString('base64');
}

const COLLATION_OPTION_KEYS = new Set([
  'CHARSET', 'COLLATE', 'CHARACTER SET', 'DEFAULT COLLATE', 'DEFAULT CHARACTER SET',
]);
const COLLATION_COL_PATTERN = /\b(COLLATE\s+\S+|CHARACTER\s+SET\s+\S+|CHARSET\s+\S+)/gi;

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
  summary: Summary,
  ctx: SchemaContext
): { driftScore: number; hasBreaking: boolean; mostImpacted: { qualifiedName: string; changeCount: number } | null } {
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

  let mostImpacted: { qualifiedName: string; changeCount: number } | null = null;
  for (const r of results) {
    if (!r.tableDiff) continue;
    const count =
      r.tableDiff.columns.filter((c) => c.status !== 'unchanged').length +
      r.tableDiff.indexes.filter((i) => i.status !== 'unchanged').length +
      r.tableDiff.foreignKeys.filter((f) => f.status !== 'unchanged').length;
    if (!mostImpacted || count > mostImpacted.changeCount) {
      mostImpacted = { qualifiedName: formatQualifiedName(ctx, r), changeCount: count };
    }
  }

  return { driftScore, hasBreaking, mostImpacted };
}

export async function publishToConfluence(
  config: ConfluenceConfig,
  results: ComparisonResult[],
  summary: Summary,
  ctx: SchemaContext,
  filter: OutputFilter
): Promise<{ pageUrl: string; pageId: string }> {
  const title = config.pageTitle || `Schema Comparison - ${ctx.instanceName} - ${new Date().toISOString().split('T')[0]}`;
  const body = buildConfluenceBody(results, summary, ctx, filter);

  const existing = await findPageByTitle(config, title);

  if (existing) {
    return updatePage(config, existing.id, existing.version + 1, title, body);
  } else {
    return createPage(config, title, body);
  }
}

async function findPageByTitle(
  config: ConfluenceConfig,
  title: string
): Promise<{ id: string; version: number } | null> {
  const url = `${config.baseUrl}/rest/api/content?spaceKey=${encodeURIComponent(config.spaceKey)}&title=${encodeURIComponent(title)}&expand=version`;

  const res = await fetch(url, {
    headers: {
      Authorization: authHeader(config.email, config.apiToken),
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Confluence search failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data.results && data.results.length > 0) {
    const page = data.results[0];
    return { id: page.id, version: page.version.number };
  }
  return null;
}

async function createPage(
  config: ConfluenceConfig,
  title: string,
  body: string
): Promise<{ pageUrl: string; pageId: string }> {
  const payload: Record<string, unknown> = {
    type: 'page',
    title,
    space: { key: config.spaceKey },
    body: { storage: { value: body, representation: 'storage' } },
  };

  if (config.parentPageId) {
    payload.ancestors = [{ id: config.parentPageId }];
  }

  const res = await fetch(`${config.baseUrl}/rest/api/content`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(config.email, config.apiToken),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Confluence create failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const pageUrl = `${config.baseUrl}${data._links?.webui || `/pages/${data.id}`}`;
  return { pageUrl, pageId: data.id };
}

async function updatePage(
  config: ConfluenceConfig,
  pageId: string,
  newVersion: number,
  title: string,
  body: string
): Promise<{ pageUrl: string; pageId: string }> {
  const payload = {
    type: 'page',
    title,
    version: { number: newVersion },
    body: { storage: { value: body, representation: 'storage' } },
  };

  const res = await fetch(`${config.baseUrl}/rest/api/content/${pageId}`, {
    method: 'PUT',
    headers: {
      Authorization: authHeader(config.email, config.apiToken),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Confluence update failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const pageUrl = `${config.baseUrl}${data._links?.webui || `/pages/${pageId}`}`;
  return { pageUrl, pageId };
}

// ─── Page body builder ────────────────────────────────────────────────────────

function buildConfluenceBody(
  results: ComparisonResult[],
  summary: Summary,
  ctx: SchemaContext,
  filter: OutputFilter
): string {
  const now = new Date().toISOString();
  const parts: string[] = [];

  // Info panel
  parts.push(`
<ac:structured-macro ac:name="info">
  <ac:rich-text-body>
    <p>Generated by <strong>RDS Schema Compare</strong> on ${escapeXml(now)}</p>
    <p><strong>Instance:</strong> ${escapeXml(ctx.instanceName)} | <strong>Database:</strong> ${escapeXml(ctx.databaseName)}</p>
  </ac:rich-text-body>
</ac:structured-macro>`);

  // Summary table
  parts.push(`
<h2>Summary</h2>
<table>
  <tbody>
    <tr><th>Status</th><th>Count</th></tr>
    <tr>
      <td>${statusMacro('Green', 'Added')}</td>
      <td>${summary.added}</td>
    </tr>
    <tr>
      <td>${statusMacro('Red', 'Removed')}</td>
      <td>${summary.removed}</td>
    </tr>
    <tr>
      <td>${statusMacro('Yellow', 'Modified')}</td>
      <td>${summary.modified}</td>
    </tr>
    <tr>
      <td>${statusMacro('Grey', 'Unchanged')}</td>
      <td>${summary.unchanged}</td>
    </tr>
  </tbody>
</table>`);

  // Drift insights
  const { driftScore, hasBreaking, mostImpacted } = computeDriftInsights(results, summary, ctx);
  const breakingLabel = hasBreaking
    ? statusMacro('Red', 'YES')
    : statusMacro('Green', 'NO');

  parts.push(`
<h2>Drift Insights</h2>
<table>
  <tbody>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Drift Score</td><td>${driftScore}%</td></tr>
    <tr><td>Breaking Changes</td><td>${breakingLabel}</td></tr>
    <tr><td>Most Impacted Object</td><td>${mostImpacted ? `<code>${escapeXml(mostImpacted.qualifiedName)}</code> (${mostImpacted.changeCount} changes)` : 'None'}</td></tr>
  </tbody>
</table>`);

  // Table of contents
  parts.push(`<ac:structured-macro ac:name="toc"/>`);

  // Apply status filters
  const filtered = results.filter((r) => {
    if (r.status === 'added' && !filter.includeAdded) return false;
    if (r.status === 'removed' && !filter.includeRemoved) return false;
    if (r.status === 'modified' && !filter.includeModified) return false;
    return true;
  });

  const groups = buildTypeGroups(filtered);

  if (groups.length === 0) {
    parts.push(`<p><em>No changes match the selected filters.</em></p>`);
    return parts.join('\n');
  }

  // High Level Summary expand
  parts.push(buildHighLevelExpand(groups));

  // In-Depth Analysis expand
  parts.push(buildInDepthExpand(groups, ctx));

  return parts.join('\n');
}

// ─── High Level expand ────────────────────────────────────────────────────────

function buildHighLevelExpand(groups: TypeGroup[]): string {
  const rows: string[] = [];

  for (const g of groups) {
    const added = g.items.filter((r) => r.status === 'added').length;
    const modified = g.items.filter((r) => r.status === 'modified').length;
    const removed = g.items.filter((r) => r.status === 'removed').length;

    rows.push(`<tr>
      <td><strong>${escapeXml(g.label)}</strong></td>
      <td>${added > 0 ? `${statusMacro('Green', 'Added')} ${added}` : '-'}</td>
      <td>${modified > 0 ? `${statusMacro('Yellow', 'Modified')} ${modified}` : '-'}</td>
      <td>${removed > 0 ? `${statusMacro('Red', 'Removed')} ${removed}` : '-'}</td>
      <td>${g.items.length}</td>
    </tr>`);

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
      if (totalCols > 0 || totalIdx > 0 || totalFks > 0) {
        const details: string[] = [];
        if (totalCols > 0) details.push(`${totalCols} column change${totalCols !== 1 ? 's' : ''}`);
        if (totalIdx > 0) details.push(`${totalIdx} index change${totalIdx !== 1 ? 's' : ''}`);
        if (totalFks > 0) details.push(`${totalFks} FK change${totalFks !== 1 ? 's' : ''}`);
        rows.push(`<tr>
          <td colspan="5"><em style="margin-left:16px">↳ ${details.join(' &nbsp;|&nbsp; ')} across ${modifiedTables.length} modified table${modifiedTables.length !== 1 ? 's' : ''}</em></td>
        </tr>`);
      }
    }
  }

  const table = `<table>
  <tbody>
    <tr><th>Object Type</th><th>Added</th><th>Modified</th><th>Removed</th><th>Total Changes</th></tr>
    ${rows.join('\n')}
  </tbody>
</table>`;

  return expandBlock('High Level Summary', table);
}

// ─── In-Depth expand ──────────────────────────────────────────────────────────

function buildInDepthExpand(groups: TypeGroup[], ctx: SchemaContext): string {
  const parts: string[] = [];

  for (const g of groups) {
    parts.push(`<h3>${escapeXml(g.label)} (${g.items.length})</h3>`);

    if (g.objectType === 'tables') {
      for (const r of g.items) {
        const qualName = formatQualifiedName(ctx, r);
        parts.push(buildTableExpand(r, qualName));
      }
    } else {
      for (const r of g.items) {
        const qualName = formatQualifiedName(ctx, r);
        parts.push(buildObjectExpand(r, qualName));
      }
    }
  }

  return expandBlock('In-Depth Analysis', parts.join('\n'));
}

function buildTableExpand(r: ComparisonResult, qualName: string): string {
  const label = `${r.status}: ${qualName}`;

  if (r.status === 'added') {
    return expandBlock(label, r.targetRaw ? sqlCodeBlock(r.targetRaw) : '<p><em>No SQL available</em></p>');
  }

  if (r.status === 'removed') {
    return expandBlock(label, r.sourceRaw ? sqlCodeBlock(r.sourceRaw) : '<p><em>No SQL available</em></p>');
  }

  // modified
  const subParts: string[] = [];

  if (r.tableDiff) {
    subParts.push(buildTableDiffSection(r.tableDiff));
    const collationHtml = buildTableCollationSection(r);
    if (collationHtml) subParts.push(collationHtml);
  }

  return expandBlock(label, subParts.join('\n') || '<p><em>No structural changes detected</em></p>');
}

function buildObjectExpand(r: ComparisonResult, qualName: string): string {
  const label = `${r.status}: ${qualName}`;

  if (r.status === 'added') {
    return expandBlock(label, r.targetRaw ? sqlCodeBlock(r.targetRaw) : '<p><em>No SQL available</em></p>');
  }

  if (r.status === 'removed') {
    return expandBlock(label, r.sourceRaw ? sqlCodeBlock(r.sourceRaw) : '<p><em>No SQL available</em></p>');
  }

  // modified — show source and target SQL side by side in sub-expands
  const subParts: string[] = [];
  if (r.sourceRaw) subParts.push(expandBlock('Source SQL', sqlCodeBlock(r.sourceRaw)));
  if (r.targetRaw) subParts.push(expandBlock('Target SQL', sqlCodeBlock(r.targetRaw)));

  return expandBlock(label, subParts.join('\n') || '<p><em>No SQL available</em></p>');
}

// ─── Table diff detail ────────────────────────────────────────────────────────

function buildTableDiffSection(diff: TableDiffDetail): string {
  const parts: string[] = [];

  // Column changes
  const changedCols = diff.columns.filter((c) => c.status !== 'unchanged');
  if (changedCols.length > 0) {
    let table = `<table><tbody><tr><th>Column</th><th>Status</th><th>Source</th><th>Target</th></tr>`;
    for (const col of changedCols) {
      table += `<tr>
        <td><code>${escapeXml(col.name)}</code></td>
        <td>${statusMacro(statusColour(col.status), col.status)}</td>
        <td>${col.sourceDefinition ? escapeXml(col.sourceDefinition) : '-'}</td>
        <td>${col.targetDefinition ? escapeXml(col.targetDefinition) : '-'}</td>
      </tr>`;
    }
    table += '</tbody></table>';
    parts.push(expandBlock(`Column Changes (${changedCols.length})`, table));
  }

  // Index changes
  const changedIdx = diff.indexes.filter((i) => i.status !== 'unchanged');
  if (changedIdx.length > 0) {
    let table = `<table><tbody><tr><th>Index</th><th>Status</th><th>Source Columns</th><th>Target Columns</th></tr>`;
    for (const idx of changedIdx) {
      table += `<tr>
        <td><code>${escapeXml(idx.name)}</code></td>
        <td>${statusMacro(statusColour(idx.status), idx.status)}</td>
        <td>${idx.sourceColumns ? escapeXml(idx.sourceColumns.join(', ')) : '-'}</td>
        <td>${idx.targetColumns ? escapeXml(idx.targetColumns.join(', ')) : '-'}</td>
      </tr>`;
    }
    table += '</tbody></table>';
    parts.push(expandBlock(`Index Changes (${changedIdx.length})`, table));
  }

  // Foreign key changes
  const changedFks = diff.foreignKeys.filter((f) => f.status !== 'unchanged');
  if (changedFks.length > 0) {
    let table = `<table><tbody><tr><th>Foreign Key</th><th>Status</th></tr>`;
    for (const fk of changedFks) {
      table += `<tr>
        <td><code>${escapeXml(fk.name)}</code></td>
        <td>${statusMacro(statusColour(fk.status), fk.status)}</td>
      </tr>`;
    }
    table += '</tbody></table>';
    parts.push(expandBlock(`Foreign Key Changes (${changedFks.length})`, table));
  }

  // Primary key
  if (diff.primaryKeyChanged) {
    parts.push(`<p>${statusMacro('Yellow', 'Modified')} <strong>Primary key changed</strong></p>`);
  }

  // Table option changes (non-collation)
  const nonCollationOptions = Object.entries(diff.optionChanges).filter(
    ([key]) => !COLLATION_OPTION_KEYS.has(key.toUpperCase())
  );
  if (nonCollationOptions.length > 0) {
    let table = `<table><tbody><tr><th>Option</th><th>Source</th><th>Target</th></tr>`;
    for (const [key, change] of nonCollationOptions) {
      table += `<tr>
        <td><code>${escapeXml(key)}</code></td>
        <td>${change.source ? escapeXml(change.source) : '-'}</td>
        <td>${change.target ? escapeXml(change.target) : '-'}</td>
      </tr>`;
    }
    table += '</tbody></table>';
    parts.push(expandBlock(`Table Option Changes (${nonCollationOptions.length})`, table));
  }

  return parts.join('\n');
}

// ─── Collation / Charset section (per-table, inline) ─────────────────────────

function buildTableCollationSection(r: ComparisonResult): string {
  if (!r.tableDiff) return '';

  const tableOptionChanges: Record<string, { source?: string; target?: string }> = {};
  for (const [key, val] of Object.entries(r.tableDiff.optionChanges)) {
    if (COLLATION_OPTION_KEYS.has(key.toUpperCase())) {
      tableOptionChanges[key] = val;
    }
  }

  const columnCollationChanges: Array<{ columnName: string; source?: string; target?: string }> = [];
  for (const col of r.tableDiff.columns) {
    if (col.status === 'unchanged') continue;
    const srcMatches = col.sourceDefinition?.match(COLLATION_COL_PATTERN);
    const tgtMatches = col.targetDefinition?.match(COLLATION_COL_PATTERN);
    const srcCollation = srcMatches ? srcMatches.join(' ') : undefined;
    const tgtCollation = tgtMatches ? tgtMatches.join(' ') : undefined;
    if (srcCollation !== tgtCollation) {
      columnCollationChanges.push({ columnName: col.name, source: srcCollation, target: tgtCollation });
    }
  }

  if (Object.keys(tableOptionChanges).length === 0 && columnCollationChanges.length === 0) {
    return '';
  }

  let table = `<table><tbody><tr><th>Object</th><th>Property</th><th>Source</th><th>Target</th></tr>`;
  for (const [key, val] of Object.entries(tableOptionChanges)) {
    table += `<tr>
      <td>Table</td>
      <td><code>${escapeXml(key)}</code></td>
      <td>${val.source ? escapeXml(val.source) : '-'}</td>
      <td>${val.target ? escapeXml(val.target) : '-'}</td>
    </tr>`;
  }
  for (const col of columnCollationChanges) {
    table += `<tr>
      <td>Column: <code>${escapeXml(col.columnName)}</code></td>
      <td>COLLATE / CHARSET</td>
      <td>${col.source ? escapeXml(col.source) : 'none'}</td>
      <td>${col.target ? escapeXml(col.target) : 'none'}</td>
    </tr>`;
  }
  table += '</tbody></table>';

  return expandBlock('Collation &amp; Charset Drift', table);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sqlCodeBlock(sql: string): string {
  return `<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">sql</ac:parameter>
  <ac:plain-text-body><![CDATA[${sql}]]></ac:plain-text-body>
</ac:structured-macro>`;
}

function expandBlock(title: string, content: string): string {
  return `<ac:structured-macro ac:name="expand">
  <ac:parameter ac:name="title">${escapeXml(title)}</ac:parameter>
  <ac:rich-text-body>${content}</ac:rich-text-body>
</ac:structured-macro>`;
}

function statusMacro(colour: string, title: string): string {
  return `<ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">${colour}</ac:parameter><ac:parameter ac:name="title">${escapeXml(title)}</ac:parameter></ac:structured-macro>`;
}

function statusColour(status: string): string {
  const map: Record<string, string> = {
    added: 'Green',
    removed: 'Red',
    modified: 'Yellow',
    unchanged: 'Grey',
  };
  return map[status] ?? 'Grey';
}
