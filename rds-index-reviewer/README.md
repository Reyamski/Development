# RDS Index Reviewer

**Read-only MySQL index analysis tool for DBAs managing multiple AWS RDS instances via Teleport.**

Connects to any RDS MySQL / Aurora MySQL database through your existing Teleport infrastructure and surfaces index health findings with human-readable explanations — no auto-apply, no schema changes, no risk.

> Part of the **PAR DBA Toolkit** · `dbatools` monorepo

---

## What It Does

Pick a database, hit **Run Analysis**, get a categorized report across 5 dimensions:

| Category | What it finds | Data source |
|----------|---------------|-------------|
| **Missing Index Candidates** | High-scan queries that could benefit from an index | `performance_schema.events_statements_summary_by_digest` |
| **Unused Indexes** | Indexes with zero reads — paying write cost for nothing | `performance_schema.table_io_waits_summary_by_index_usage` |
| **Duplicate Indexes** | Indexes with identical column sets on the same table | `information_schema.STATISTICS` |
| **Overlapping Indexes** | Indexes where one is a left-prefix subset of another | `information_schema.STATISTICS` |
| **Bloat Risk Tables** | High-write tables with ≥5 indexes — every write updates all of them | `performance_schema.table_io_waits_summary_by_index_usage` |

Every finding includes a human-readable explanation:
> *"This index has never been read but is updated 2,400,000 times. It adds write overhead on every INSERT/UPDATE/DELETE with no read benefit."*

Generated SQL (e.g. `DROP INDEX idx_x ON db.table`) is **copy-only** — no execute button exists anywhere in the UI.

---

## Requirements

- **Node.js 18+**
- **`tsh`** (Teleport CLI) installed and on PATH — same machine as the API server
- **MySQL `performance_schema` enabled** — default on all AWS RDS instances
- **Teleport database access** configured for your RDS instances
- **AWS CLI** configured locally — required only if using Secrets Manager for the Confluence token

---

## Quick Start

```bash
# 1. From the monorepo root or tool directory
cd dbatools/rds-index-reviewer

# 2. Install dependencies
npm install

# 3. Create local config
cp .env.example .env
# Edit .env — minimum: set PORT if 3005 is taken

# 4. Start
npm run dev
```

Opens at:
- **UI** → http://localhost:5175
- **API** → http://localhost:3005

---

## Usage

1. **Select a Teleport cluster** from the sidebar dropdown
2. **Login via SSO** if not already authenticated — triggers `tsh login` flow
3. **Select an RDS instance** from the list
4. **Select a database** (schema) to analyze
5. **Click Connect** — establishes a Teleport tunnel (read-only)
6. **Click Run Analysis** — all 5 categories run
7. Browse findings across the 5 tabs and copy any suggested SQL for manual review
8. **Export to Confluence** — publishes a dated snapshot report (optional, requires config below)

Use **Re-analyze** to refresh results without reconnecting.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3005` | API server port |
| `TSH_PATH` | auto-detect | Full path to `tsh` binary if not in PATH |
| `CONFLUENCE_URL` | unset | Atlassian base URL, e.g. `https://company.atlassian.net` |
| `CONFLUENCE_EMAIL` | unset | Atlassian account email for API auth |
| `CONFLUENCE_API_TOKEN` | unset | Atlassian API token (use this OR Secrets Manager below) |
| `CONFLUENCE_API_TOKEN_SECRET_NAME` | unset | AWS Secrets Manager secret name containing the token |
| `CONFLUENCE_API_TOKEN_SECRET_REGION` | `us-east-1` | AWS region for the secret |
| `CONFLUENCE_SPACE_KEY` | `EDT` | Confluence space key |
| `CONFLUENCE_PARENT_PAGE_ID` | unset | Parent page ID — tool doc and dated reports are created under this |

**PAR team:** Set `CONFLUENCE_API_TOKEN_SECRET_NAME=jira_token`. Do not store the token in `.env` — it is fetched from AWS Secrets Manager at runtime.

### Confluence report structure

```
<CONFLUENCE_PARENT_PAGE_ID>  (e.g. POCs page)
└── RDS Index Reviewer              ← created once, static tool documentation
    ├── RDS Index Report_20260331   ← per-run datestamped export
    ├── RDS Index Report_20260401
    └── ...
```

---

## Architecture

```
rds-index-reviewer/
├── client/               # React + Tailwind + Vite (port 5175)
│   └── src/
│       ├── App.tsx
│       ├── api/client.ts
│       ├── store/app-store.ts
│       └── components/
│           ├── ConnectionPanel.tsx   # Teleport cluster/instance/db picker
│           └── ResultsPanel.tsx      # 5-tab findings view + export button
├── server/               # Node.js + Express + TypeScript (port 3005)
│   └── src/
│       ├── index.ts
│       ├── routes/
│       │   ├── teleport.ts      # Cluster list, SSO login, instance discovery
│       │   ├── analysis.ts      # 5-category index analysis endpoint
│       │   ├── confluence.ts    # Export to Confluence endpoint
│       │   └── health.ts
│       └── services/
│           ├── teleport.ts           # tsh tunnel spawning + lifecycle
│           ├── connection-manager.ts # MySQL connection via Teleport tunnel
│           ├── index-analyzer.ts     # All 5 analysis categories
│           └── confluence.ts         # Page creation + Secrets Manager token fetch
└── .planning/            # GSD project docs (roadmap, requirements, state)
```

---

## Safety

- **Zero write queries** — server-level guard blocks any non-`SELECT` / non-`SHOW` SQL
- **No DDL execution** — `ALTER TABLE`, `CREATE INDEX`, `DROP INDEX` are blocked server-side
- **Copy-only SQL** — generated suggestions appear in UI as text; no run/execute button
- **Persistent badge** — "Read-only analysis" label visible on every screen after connect
- **Confluence token** — fetched from AWS Secrets Manager at runtime, never stored in code or git

---

## Confluence Docs

- **Tool page:** [RDS Index Reviewer](https://partechnology.atlassian.net/wiki/spaces/EDT/pages/7531266187) — static documentation, installation, usage guide
- **Reports:** Dated child pages created per run via the Export button

---

## DBA Toolkit

| Tool | Purpose |
|------|---------|
| **query-hub** | Teleport-connected SQL editor with AI assistant (Bedrock / Kiro) |
| **rds-index-reviewer** | Read-only index health analysis with Confluence reporting |
| **rds-replica-lag** | Replica lag monitor across RDS instances |
| **rds-iop-killer** | IOP killer utility |
| **rds-schema-compare** | Schema drift detection across environments |
