import http from 'http';
import https from 'https';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

type Config = {
  url?: string;
  email?: string;
  token?: string;
  tokenSecretId?: string;
  tokenSecretRegion: string;
  spaceKey: string;
  parentPageId?: string;
};

let cachedSecretToken: string | null = null;

const DEFAULT_AWS_REGION = 'us-east-1';
const DEFAULT_CONFLUENCE_SPACE = 'EDT';

function normalizeConfluenceBaseUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/+$/, '').replace(/\/wiki$/, '');
}

function getConfig(): Config {
  return {
    url: normalizeConfluenceBaseUrl(process.env.CONFLUENCE_URL),
    email: process.env.CONFLUENCE_EMAIL,
    token: process.env.CONFLUENCE_API_TOKEN,
    tokenSecretId:
      process.env.CONFLUENCE_API_TOKEN_SECRET_NAME ||
      process.env.ATLASSIAN_API_TOKEN_SECRET_NAME,
    tokenSecretRegion:
      process.env.CONFLUENCE_API_TOKEN_SECRET_REGION ||
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION ||
      DEFAULT_AWS_REGION,
    spaceKey: process.env.CONFLUENCE_SPACE_KEY || DEFAULT_CONFLUENCE_SPACE,
    parentPageId: process.env.CONFLUENCE_PARENT_PAGE_ID,
  };
}

function isConfigured(): boolean {
  const { url, email, token, tokenSecretId, spaceKey, parentPageId } = getConfig();
  return !!(url && email && (token || tokenSecretId) && spaceKey && parentPageId);
}

function extractSecretValue(secretString: string): string {
  const trimmed = secretString.trim();
  if (!trimmed) {
    throw new Error('AWS secret was empty.');
  }

  if (!trimmed.startsWith('{')) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const candidates = [
      parsed.CONFLUENCE_API_TOKEN,
      parsed.ATLASSIAN_API_TOKEN,
      parsed.JIRA_API_TOKEN,
      parsed.apiToken,
      parsed.token,
      parsed.jira_token,
      parsed.jiraToken,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
  } catch {
    return trimmed;
  }

  throw new Error(
    'AWS secret JSON did not contain a recognizable Atlassian token field. Expected token, apiToken, JIRA_API_TOKEN, or CONFLUENCE_API_TOKEN.'
  );
}

async function resolveConfluenceToken(): Promise<string> {
  const { token, tokenSecretId, tokenSecretRegion } = getConfig();

  if (token) {
    return token;
  }

  if (cachedSecretToken) {
    return cachedSecretToken;
  }

  if (!tokenSecretId) {
    throw new Error(
      'Confluence not configured. Set CONFLUENCE_API_TOKEN or CONFLUENCE_API_TOKEN_SECRET_NAME.'
    );
  }

  try {
    const { stdout } = await execFileAsync(
      'aws',
      [
        'secretsmanager',
        'get-secret-value',
        '--secret-id',
        tokenSecretId,
        '--region',
        tokenSecretRegion,
        '--query',
        'SecretString',
        '--output',
        'text',
      ],
      { timeout: 15000 }
    );

    cachedSecretToken = extractSecretValue(stdout);
    return cachedSecretToken;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to load Confluence API token from AWS Secrets Manager secret "${tokenSecretId}" in region "${tokenSecretRegion}": ${message}`
    );
  }
}

async function confluenceRequest(method: string, path: string, body?: object): Promise<any> {
  const { url, email } = getConfig();

  if (!url || !email) {
    throw new Error('Confluence URL and email must be configured before making requests.');
  }

  const token = await resolveConfluenceToken();
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const bodyStr = body ? JSON.stringify(body) : undefined;

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(`${url}${path}`);
    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const bodyPreview = data.slice(0, 300);
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Confluence API error ${res.statusCode}: ${parsed.message || data}`));
            } else {
              resolve(parsed);
            }
          } catch {
            reject(
              new Error(
                `Failed to parse Confluence response for ${method} ${path} (status ${res.statusCode ?? 'unknown'}): ${bodyPreview}`
              )
            );
          }
        });
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function getPageByTitle(spaceKey: string, title: string): Promise<{ id: string; version: number } | null> {
  try {
    const result = await confluenceRequest(
      'GET',
      `/wiki/rest/api/content?spaceKey=${encodeURIComponent(spaceKey)}&title=${encodeURIComponent(title)}&expand=version`
    );
    if (result.results && result.results.length > 0) {
      return { id: result.results[0].id, version: result.results[0].version.number };
    }
    return null;
  } catch {
    return null;
  }
}

async function createPage(spaceKey: string, parentId: string, title: string, body: string): Promise<{ id: string; url: string }> {
  const { url } = getConfig();
  const result = await confluenceRequest('POST', '/wiki/rest/api/content', {
    type: 'page',
    title,
    space: { key: spaceKey },
    ancestors: [{ id: parentId }],
    body: {
      storage: {
        value: body,
        representation: 'storage',
      },
    },
  });

  return {
    id: result.id,
    url: `${url}/wiki${result._links?.webui || `/spaces/${spaceKey}/pages/${result.id}`}`,
  };
}

function buildDocPageContent(): string {
  return `
<h2>Overview</h2>
<p>RDS Index Reviewer is a <strong>read-only</strong> MySQL index analysis tool for DBAs managing multiple AWS RDS instances via Teleport. It surfaces index health findings with human-readable explanations - no auto-apply, no schema changes.</p>

<h2>Confluence Structure</h2>
<p>This page is the landing page for the RDS Index Reviewer tool under the shared POCs section. Each export from the UI creates a dated child page beneath this page so reports stay grouped together.</p>

<h2>Analysis Categories</h2>
<table data-layout="default">
  <tbody>
    <tr>
      <th><strong>Category</strong></th>
      <th><strong>What it finds</strong></th>
      <th><strong>Data source</strong></th>
    </tr>
    <tr>
      <td>Missing Index Candidates</td>
      <td>High-scan queries that could benefit from an index</td>
      <td>performance_schema.events_statements_summary_by_digest</td>
    </tr>
    <tr>
      <td>Unused Indexes</td>
      <td>Indexes with zero reads - paying write cost for nothing</td>
      <td>performance_schema.table_io_waits_summary_by_index_usage</td>
    </tr>
    <tr>
      <td>Duplicate Indexes</td>
      <td>Indexes with identical column sets on the same table</td>
      <td>information_schema.STATISTICS</td>
    </tr>
    <tr>
      <td>Overlapping Indexes</td>
      <td>Indexes where one is a left-prefix of another</td>
      <td>information_schema.STATISTICS</td>
    </tr>
    <tr>
      <td>Bloat Risk Tables</td>
      <td>High-write tables with many indexes</td>
      <td>performance_schema.table_io_waits_summary_by_index_usage</td>
    </tr>
  </tbody>
</table>

<h2>How to Use</h2>
<ol>
  <li>Open the tool and select a <strong>Teleport cluster</strong></li>
  <li>Login via SSO if prompted</li>
  <li>Select an <strong>RDS instance</strong> and <strong>database</strong></li>
  <li>Click <strong>Connect</strong> then <strong>Run Analysis</strong></li>
  <li>Review findings across 5 tabs</li>
  <li>Copy suggested SQL for manual review - <strong>nothing is executed automatically</strong></li>
  <li>Click <strong>Export to Confluence</strong> to save a dated snapshot here</li>
</ol>

<h2>Safety</h2>
<ac:structured-macro ac:name="info">
  <ac:rich-text-body>
    <p>All analysis is <strong>read-only</strong>. The tool never executes ALTER TABLE, CREATE INDEX, DROP INDEX, or any write query. Generated SQL in findings is for copy/review only.</p>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Datestamped Reports</h2>
<p>Each "Export to Confluence" creates a child page below this one named <code>RDS Index Report_YYYYMMDD</code>. Run weekly to track index health trends over time.</p>
`;
}

function buildRunPageContent(database: string, instance: string, results: any): string {
  const total =
    results.missingIndexes.length +
    results.unusedIndexes.length +
    results.duplicateIndexes.length +
    results.overlappingIndexes.length +
    results.bloatRiskTables.length;
  const warnings = [
    ...results.missingIndexes,
    ...results.unusedIndexes,
    ...results.duplicateIndexes,
    ...results.overlappingIndexes,
    ...results.bloatRiskTables,
  ].filter((f: any) => f.severity === 'warning').length;

  function findingsTable(findings: any[], cols: { key: string; label: string }[]): string {
    if (!findings.length) return '<p><em>No findings in this category.</em></p>';
    const header = cols.map((c) => `<th><strong>${c.label}</strong></th>`).join('');
    const rows = findings
      .map((f) => {
        const cells = cols
          .map((c) => `<td>${String(f[c.key] ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`)
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');
    return `<table data-layout="default"><tbody><tr>${header}</tr>${rows}</tbody></table>`;
  }

  function section(title: string, count: number, content: string): string {
    const status = count === 0 ? 'OK' : 'Warning';
    return `
<h2>${status} ${title} (${count})</h2>
${content}
`;
  }

  return `
<h2>Summary</h2>
<table data-layout="default">
  <tbody>
    <tr><th>Database</th><td><code>${database}</code></td></tr>
    <tr><th>Instance</th><td><code>${instance}</code></td></tr>
    <tr><th>Analyzed At</th><td>${new Date(results.analyzedAt).toLocaleString()}</td></tr>
    <tr><th>Total Findings</th><td>${total}</td></tr>
    <tr><th>Warnings</th><td>${warnings}</td></tr>
  </tbody>
</table>

<table data-layout="default">
  <tbody>
    <tr>
      <th>Category</th>
      <th>Count</th>
    </tr>
    <tr><td>Missing Index Candidates</td><td>${results.missingIndexes.length}</td></tr>
    <tr><td>Unused Indexes</td><td>${results.unusedIndexes.length}</td></tr>
    <tr><td>Duplicate Indexes</td><td>${results.duplicateIndexes.length}</td></tr>
    <tr><td>Overlapping Indexes</td><td>${results.overlappingIndexes.length}</td></tr>
    <tr><td>Bloat Risk Tables</td><td>${results.bloatRiskTables.length}</td></tr>
  </tbody>
</table>

${section(
  'Missing Index Candidates',
  results.missingIndexes.length,
  findingsTable(results.missingIndexes, [
    { key: 'table', label: 'Table' },
    { key: 'rowsExamined', label: 'Rows Examined' },
    { key: 'execCount', label: 'Executions' },
    { key: 'explanation', label: 'Explanation' },
  ])
)}

${section(
  'Unused Indexes',
  results.unusedIndexes.length,
  findingsTable(results.unusedIndexes, [
    { key: 'table', label: 'Table' },
    { key: 'indexName', label: 'Index' },
    { key: 'writeCount', label: 'Write Count' },
    { key: 'explanation', label: 'Explanation' },
    { key: 'suggestedSql', label: 'Suggested SQL' },
  ])
)}

${section(
  'Duplicate Indexes',
  results.duplicateIndexes.length,
  findingsTable(results.duplicateIndexes, [
    { key: 'table', label: 'Table' },
    { key: 'indexName', label: 'Index' },
    { key: 'duplicateOf', label: 'Duplicate Of' },
    { key: 'explanation', label: 'Explanation' },
    { key: 'suggestedSql', label: 'Suggested SQL' },
  ])
)}

${section(
  'Overlapping Indexes',
  results.overlappingIndexes.length,
  findingsTable(results.overlappingIndexes, [
    { key: 'table', label: 'Table' },
    { key: 'redundantIndex', label: 'Redundant Index' },
    { key: 'coveringIndex', label: 'Covered By' },
    { key: 'explanation', label: 'Explanation' },
    { key: 'suggestedSql', label: 'Suggested SQL' },
  ])
)}

${section(
  'Bloat Risk Tables',
  results.bloatRiskTables.length,
  findingsTable(results.bloatRiskTables, [
    { key: 'table', label: 'Table' },
    { key: 'indexCount', label: 'Index Count' },
    { key: 'totalWrites', label: 'Total Writes' },
    { key: 'explanation', label: 'Explanation' },
  ])
)}

<hr/>
<p><em>Generated by RDS Index Reviewer - Read-only analysis - No schema changes were made</em></p>
`;
}

export async function exportToConfluence(
  database: string,
  instance: string,
  results: any
): Promise<{ pageUrl: string; summaryPageUrl: string }> {
  if (!isConfigured()) {
    throw new Error(
      'Confluence not configured. Set CONFLUENCE_URL, CONFLUENCE_EMAIL, CONFLUENCE_PARENT_PAGE_ID, and either CONFLUENCE_API_TOKEN or CONFLUENCE_API_TOKEN_SECRET_NAME.'
    );
  }

  const { spaceKey, parentPageId } = getConfig();
  const summaryPageTitle = 'RDS Index Reviewer';

  let summaryPage;
  try {
    summaryPage = await getPageByTitle(spaceKey, summaryPageTitle);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed while looking up the tool landing page "${summaryPageTitle}": ${message}`);
  }

  let summaryPageId: string;
  let summaryPageUrl: string;
  const { url } = getConfig();

  if (!summaryPage) {
    let created;
    try {
      created = await createPage(
        spaceKey,
        parentPageId!,
        summaryPageTitle,
        buildDocPageContent()
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed while creating the tool landing page "${summaryPageTitle}": ${message}`);
    }
    summaryPageId = created.id;
    summaryPageUrl = created.url;
  } else {
    summaryPageId = summaryPage.id;
    summaryPageUrl = `${url}/wiki/spaces/${spaceKey}/pages/${summaryPageId}`;
  }

  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const runPageTitle = `RDS Index Report_${dateStr}`;

  let existing;
  try {
    existing = await getPageByTitle(spaceKey, runPageTitle);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed while checking for an existing report page "${runPageTitle}": ${message}`);
  }

  const finalTitle = existing
    ? `RDS Index Report_${dateStr}_${String(now.getHours()).padStart(2, '0')}${String(
        now.getMinutes()
      ).padStart(2, '0')}`
    : runPageTitle;

  let runPage;
  try {
    runPage = await createPage(
      spaceKey,
      summaryPageId,
      finalTitle,
      buildRunPageContent(database, instance, results)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed while creating the report page "${finalTitle}": ${message}`);
  }

  return { pageUrl: runPage.url, summaryPageUrl };
}

export { isConfigured };
