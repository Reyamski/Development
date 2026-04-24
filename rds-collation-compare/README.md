# RDS Collation Compare

Standalone tool for comparing database and table collations across RDS MySQL instances via Teleport.

## What it does

Connects to RDS MySQL instances through Teleport tunnels and analyzes collation settings at the database, table, and column levels. Identifies mismatches, non-standard collations, and potential compatibility issues.

**Checks include:**
- Database-level collation settings
- Table-level collation settings
- Column-level collation settings
- Character set mismatches
- Collation inconsistencies within schemas
- Detection of non-UTF8MB4 collations
- Identification of mixed collations

## Requirements

- **Node.js 18+**
- **`tsh`** (Teleport CLI) installed and on PATH — same machine as the API server
- **Teleport database access** configured for your RDS instances

## Quick Start

```bash
# From the tool directory
cd rds-collation-compare

# Install dependencies
npm install

# Create local config
cp .env.example .env
# Edit .env — minimum: set PORT if 4020 is taken

# Start both server and client
npm run dev
```

Opens at:
- **UI** → http://localhost:8197
- **API** → http://localhost:8020

## Usage

1. **Select a Teleport cluster** from the sidebar dropdown
2. **Login via SSO** if not already authenticated — triggers `tsh login` flow
3. **Select an RDS instance** from the list
4. **Select a database** (schema) to analyze
5. **Click Connect** — establishes a Teleport tunnel (read-only)
6. **Click Run Analysis** — analyzes all collation settings
7. Browse findings and review recommended actions

Use **Re-analyze** to refresh results without reconnecting.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_PORT` | `8020` | API server port |
| `CLIENT_PORT` | `8197` | Vite dev server port |
| `TSH_PATH` | auto-detect | Full path to `tsh` binary if not in PATH |

## Architecture

```
rds-collation-compare/
├── client/               # React + Tailwind + Vite (port 6192)
│   └── src/
│       ├── App.tsx
│       ├── api/client.ts
│       ├── store/app-store.ts
│       └── components/
│           ├── ConnectionPanel.tsx   # Teleport cluster/instance/db picker
│           └── ResultsPanel.tsx      # Collation analysis view
├── server/               # Node.js + Express + TypeScript (port 4020)
│   └── src/
│       ├── index.ts
│       ├── routes/
│       │   ├── teleport.ts      # Cluster list, SSO login, instance discovery
│       │   └── scan.ts          # Collation analysis endpoint
│       └── services/
│           ├── teleport.ts           # tsh tunnel spawning + lifecycle
│           ├── connection-manager.ts # MySQL connection via Teleport tunnel
│           ├── collation-fetcher.ts  # Fetch collations from DB
│           └── collation-analyzer.ts # Analyze and flag issues
```

## Safety

- **Zero write queries** — read-only analysis
- **No DDL execution** — no schema changes
- **Persistent badge** — "Read-only analysis" label visible after connect
