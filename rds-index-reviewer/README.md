# RDS Index Reviewer

**Read-only MySQL index analysis tool for DBAs managing multiple AWS RDS instances via Teleport.**

Connects to any RDS MySQL / Aurora MySQL database through your existing Teleport infrastructure and surfaces index health findings with human-readable explanations - no auto-apply, no schema changes, no risk.

---

## What It Does

Pick a database, hit **Run Analysis**, get a categorized report across 5 dimensions:

| Category | What it finds |
|----------|---------------|
| **Missing Index Candidates** | High-scan queries from `performance_schema` that could benefit from an index |
| **Unused Indexes** | Indexes with zero reads since last server restart - paying write cost for nothing |
| **Duplicate Indexes** | Indexes with identical column sets on the same table |
| **Overlapping Indexes** | Indexes where one is a left-prefix subset of another (shorter one is redundant) |
| **Bloat Risk Tables** | High-write tables with >=5 indexes - every write updates all of them |

Every finding includes a human-readable explanation:
> *"This index has never been read but is updated 2,400,000 times. It adds write overhead on every INSERT/UPDATE/DELETE with no read benefit."*

Generated SQL (e.g. `DROP INDEX idx_x ON db.table`) is **copy-only** - no execute button exists anywhere.

---

## Requirements

- Node.js 18+
- `tsh` (Teleport CLI) installed and on PATH - same machine as the API server
- MySQL `performance_schema` enabled (default on AWS RDS instances)
- Teleport database access configured for your RDS instances

---

## Installation

### 1. Install dependencies

```bash
cd dbatools/rds-index-reviewer
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` - at minimum set the port if 3005 is taken:

```env
PORT=3005
```

### 3. Run

```bash
npm run dev
```

Opens at **http://localhost:5175** (client) and **http://localhost:3005** (API)

---

## Usage

1. **Select a Teleport cluster** from the sidebar dropdown
2. **Login via SSO** if not already authenticated (`tsh login` must be available)
3. **Select an RDS instance** from the list
4. **Select a database** (schema) to analyze
5. **Click Connect**, then **Run Analysis**
6. Browse findings across the 5 tabs and copy any suggested SQL for manual review
7. Optionally click **Export to Confluence** to publish a dated report page

Use **Re-analyze** to refresh results without reconnecting.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3005` | API server port |
| `TSH_PATH` | auto-detect | Full path to `tsh` binary if not in PATH |
| `CONFLUENCE_URL` | unset | Atlassian site base URL, e.g. `https://company.atlassian.net` (the server also tolerates `/wiki`) |
| `CONFLUENCE_EMAIL` | unset | Account email used for Confluence API auth |
| `CONFLUENCE_API_TOKEN` | unset | Atlassian API token |
| `CONFLUENCE_API_TOKEN_SECRET_NAME` | unset | AWS Secrets Manager secret id/name for the Atlassian token |
| `CONFLUENCE_API_TOKEN_SECRET_REGION` | `AWS_REGION` or `us-east-1` | Region for the secret lookup |
| `CONFLUENCE_SPACE_KEY` | `EDT` | Space key for report pages |
| `CONFLUENCE_PARENT_PAGE_ID` | unset | Parent page under which the `RDS Index Reviewer` tool page is created |

If you already store the Atlassian token in AWS Secrets Manager, you can skip `CONFLUENCE_API_TOKEN` and set `CONFLUENCE_API_TOKEN_SECRET_NAME=jira_token` instead. The server will fetch the secret through the local `aws` CLI at export time.

Confluence export structure is:
- Parent page: your shared POCs page
- Tool landing page: `RDS Index Reviewer`
- Child report pages: `RDS Index Report_YYYYMMDD`

---

## Architecture

```text
rds-index-reviewer/
├── client/               # React + Tailwind + Vite (port 5175)
│   └── src/
│       ├── App.tsx
│       ├── api/client.ts
│       ├── store/app-store.ts
│       └── components/
│           ├── ConnectionPanel.tsx
│           └── ResultsPanel.tsx
├── server/               # Node/Express + TypeScript (port 3005)
│   └── src/
│       ├── index.ts
│       ├── routes/
│       │   ├── teleport.ts
│       │   ├── analysis.ts
│       │   ├── confluence.ts
│       │   └── health.ts
│       └── services/
│           ├── teleport.ts
│           ├── connection-manager.ts
│           ├── index-analyzer.ts
│           └── confluence.ts
└── .planning/            # GSD project docs (roadmap, requirements)
```

**Data sources used (read-only):**
- `performance_schema.events_statements_summary_by_digest` - missing index detection
- `performance_schema.table_io_waits_summary_by_index_usage` - unused index and bloat detection
- `information_schema.STATISTICS` - duplicate and overlapping index detection

---

## Safety

- **Zero write queries** - enforced by server middleware that blocks any non-read SQL
- **No `ALTER TABLE`**, no `CREATE INDEX`, no `DROP INDEX` execution
- Generated SQL in finding cards is display/copy only
- Persistent "Read-only analysis" badge in the UI header
- Confluence export publishes findings only; it never changes the target database

---

## Part of the DBA Toolkit

This tool is part of the `dbatools` monorepo alongside:
- **query-hub** - Teleport-connected SQL editor with AI assistant
- **rds-replica-lag** - Replica lag monitor
- **rds-iop-killer** - IOP killer utility
