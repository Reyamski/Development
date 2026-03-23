# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Quick Start

```bash
npm install && npm run dev
```

Starts both server (port 3003) and client (port 5175), opens the app in your browser.

## Commands

```bash
# Development (starts both server and client, opens browser)
npm run dev

# Server only (port 3003, tsx watch mode)
npm run dev -w server

# Client only (port 5175, Vite, proxies /api to localhost:3003)
npm run dev -w client

# Build both
npm run build

# Type-check without emitting
npx -w server tsc --noEmit
npx -w client tsc --noEmit
```

No test suite or linter is configured yet.

## Architecture

npm workspaces monorepo with two packages: `server` (Express + TypeScript) and `client` (React 18 + Vite + Tailwind + Zustand + Recharts).

**Purpose:** Two-in-one DBA tool — (1) Database health dashboard with scheduled Slack reporting for daily 24h snapshots, and (2) Centralized table size browser across multiple RDS instances.

### Server (`server/src/`)

Express on port 3003.

**Teleport Routes (`routes/teleport.ts`):**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/teleport/status` | GET | Check if tsh binary is available |
| `/api/teleport/clusters` | GET | List clusters from `~/.tsh/*.yaml` |
| `/api/teleport/login-status?cluster=X` | GET | Check login status for cluster |
| `/api/teleport/login` | POST | Start SSO login (opens browser) |
| `/api/teleport/instances?cluster=X` | GET | List MySQL instances on cluster |
| `/api/teleport/shutdown` | POST | Clean up all tunnels (sendBeacon target) |

**AWS Routes (`routes/aws.ts`):**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/aws/sso-status` | GET | Check if valid AWS SSO session exists |
| `/api/aws/sso-login` | POST | Start AWS SSO login (opens browser) |

**Health Routes (`routes/health.ts`):**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/health/stack/:stackId?since=&until=` | GET | Fetch health metrics for all instances in a stack |
| `/api/health/generate-report` | POST | Generate report, save to history, send to Slack |

**Table Size Routes (`routes/table-sizes.ts`):**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/table-sizes/fetch` | POST | Connect to instances via Teleport, query table sizes |

**Stack Routes (`routes/stacks.ts`):**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/stacks` | GET | List all configured stacks |
| `/api/stacks` | POST | Create or update a stack |
| `/api/stacks/:id` | DELETE | Delete a stack |

**Settings Routes (`routes/settings.ts`):**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/settings/thresholds` | GET/POST | Read/update alert thresholds |
| `/api/settings/scheduler` | GET/POST | Read/update scheduler config |
| `/api/settings/scheduler/run-now` | POST | Trigger immediate report generation |
| `/api/settings/reports` | GET | List historical reports |
| `/api/settings/reports/:id` | GET/DELETE | Read or delete a specific report |

**Services:**
- `services/teleport.ts` — Teleport CLI (`tsh`) integration with tunnel registry
- `services/connection-manager.ts` — Multi-session MySQL connection manager (supports concurrent tunnels for table sizes)
- `services/aws-rds.ts` — AWS SSO integration, RDS instance config via `describe-db-instances`
- `services/cloudwatch.ts` — 10 CloudWatch metrics: ReadIOPS, WriteIOPS, DiskQueueDepth, ReadLatency, WriteLatency, CPUUtilization, FreeableMemory, DatabaseConnections, BurstBalance, ReplicaLag
- `services/health.ts` — Health metrics aggregation with MetricSummary computation, threshold-based alerting
- `services/table-sizes.ts` — Queries `information_schema.TABLES` via temporary Teleport tunnels
- `services/slack.ts` — Formats and sends health reports to Slack via incoming webhook
- `services/scheduler.ts` — node-cron scheduling for automated daily reports
- `services/report-store.ts` — JSON file storage for historical reports in `data/reports/`
- `services/stacks.ts` — Stack configuration management (JSON file in `data/stacks.json`)
- `services/settings-store.ts` — Threshold and scheduler settings persistence

### Client (`client/src/`)

- **State** — Zustand store (`store/app-store.ts`) manages tabs, Teleport state, stacks, health data, table sizes, reports, thresholds, scheduler config, AWS SSO state.
- **API client** (`api/client.ts`) — Typed fetch wrappers for all endpoints.
- **Hooks:**
  - `hooks/useTeleport.ts` — Teleport lifecycle: cluster loading, login polling, instance discovery
  - `hooks/useHealth.ts` — Health data fetching, report generation
  - `hooks/useTableSizes.ts` — Table size fetching with progress tracking
- **Components:**
  - `TeleportControls` — Sidebar: cluster/login selectors
  - `StackSelector` — Radio button stack selector with add/create UI
  - `HealthDashboard` — Main health view: metric cards per instance, alerts, "Generate & Share Report" button
  - `MetricCard` — Individual metric display with trend indicator
  - `MetricChart` — Recharts area chart for metric time series
  - `TableSizesView` — Table sizes with checkbox instance selection, search, sortable results
  - `InstanceSelector` — Checkbox-based multi-instance selector
  - `SettingsPanel` — Alert thresholds, Slack webhook, scheduler config
  - `ReportHistory` — Historical reports list with status indicators
  - `ReportDetail` — Single report detailed view
- **Layout** — Dark theme with emerald accent. Tabbed navigation (Health, Table Sizes, Reports, Settings). Left sidebar for connection + stack selection.

### Health Dashboard Workflow

1. Connect to a Teleport cluster and login
2. Create a stack (group of RDS instances) or select an existing one
3. Health tab auto-fetches CloudWatch metrics for the last 24 hours
4. View per-instance metric cards with alerts highlighted
5. Click "Generate & Share Report" to save and post to Slack

### Table Sizes Workflow

1. Connect to a Teleport cluster
2. Switch to "Table Sizes" tab
3. Select instances via checkboxes
4. Click "Fetch Table Sizes" — connects to each instance, queries `information_schema.TABLES`
5. Results displayed in sortable, searchable `Database.Table` format

### Scheduled Reporting

- Configure via Settings tab: Slack webhook URL, cron expression, timezone, target stacks
- Default: daily at 9 AM UTC
- Uses node-cron for scheduling
- Reports are saved to `data/reports/` for historical access

### Alert Thresholds (Configurable)

| Metric | Warning | Critical |
|--------|---------|----------|
| CPU | 80% | 90% |
| Free Memory | < 1024 MB | < 512 MB |
| IOPS | 80% of provisioned | 95% of provisioned |
| Queue Depth | 5 | 10 |
| Replica Lag | 10s | 30s |

### Key Types

Server types in `server/src/types.ts`. Client mirrors in `client/src/api/types.ts`.

- `Stack` — Named group of RDS instances
- `StackInstance` — Instance reference (name, instanceId, accountId, region, cluster)
- `InstanceHealth` — Per-instance health with MetricSummary for 11 metrics + alerts
- `MetricSummary` — avg, max, min, current, dataPoints, trend
- `HealthAlert` — metric, level (warning/critical), message, value, threshold
- `HealthReport` — Full report with instances, summary, period, metadata
- `TableSizeResult` — instanceName, database, table, displayName, sizes, rows, engine
- `ThresholdConfig` — Configurable alert thresholds
- `SchedulerConfig` — Cron expression, timezone, stack IDs, Slack webhook

### Data Storage

All data is stored as JSON files in `server/data/` (gitignored):
- `stacks.json` — Stack configurations
- `settings.json` — Thresholds and scheduler settings
- `reports/` — Historical health reports (one JSON file per report)

### Environment Variables

- `AWS_SSO_START_URL` — AWS SSO portal URL (auto-detected from `~/.aws/config`)
- `AWS_SSO_REGION` — AWS SSO region (defaults to `us-east-1`)
- `TSH_PATH` — Override path to tsh binary
- `SLACK_WEBHOOK_URL` — Default Slack webhook URL
- `SLACK_CHANNEL` — Default Slack channel
