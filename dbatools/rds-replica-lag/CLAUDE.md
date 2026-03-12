# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Quick Start

```bash
npm install && npm run dev
```

Starts both server (port 3002) and client (port 5174), opens the app in your browser.

## Commands

```bash
# Development (starts both server and client, opens browser)
npm run dev

# Server only (port 3002, tsx watch mode)
npm run dev -w server

# Client only (port 5174, Vite, proxies /api to localhost:3002)
npm run dev -w client

# Build both
npm run build

# Type-check without emitting
npx -w server tsc --noEmit
npx -w client tsc --noEmit
```

## Architecture

npm workspaces monorepo with two packages: `server` (Express + TypeScript) and `client` (React 18 + Vite + Tailwind + Zustand).

**Purpose:** Connect to AWS RDS MySQL replicas via Teleport tunnels and track replication lag — visualize CloudWatch ReplicaLag with breach zones, monitor IO/SQL thread health, and investigate lag spikes with drag-to-zoom.

### Server (`server/src/`)

Express on port 3002.

**Teleport Routes (`routes/teleport.ts`):**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/teleport/status` | GET | Check if tsh binary is available |
| `/api/teleport/clusters` | GET | List clusters from `~/.tsh/*.yaml` |
| `/api/teleport/login-status?cluster=X` | GET | Check login status for cluster |
| `/api/teleport/login` | POST | Start SSO login (opens browser) |
| `/api/teleport/instances?cluster=X` | GET | List MySQL instances on cluster |
| `/api/teleport/databases` | POST | Discover databases on instance (temp tunnel) |
| `/api/teleport/connect` | POST | Connect to a database (persistent session) |
| `/api/teleport/disconnect` | POST | Disconnect active session |
| `/api/teleport/shutdown` | POST | Clean up all tunnels (sendBeacon target) |

**Lag Routes (`routes/lag.ts`):**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/lag/replica-status` | GET | SHOW REPLICA STATUS (current lag, thread status) |
| `/api/lag/workers` | GET | Replication worker status from performance_schema |
| `/api/lag/cloudwatch` | GET | CloudWatch ReplicaLag metric |
| `/api/lag/rds-config` | GET | RDS instance config from AWS API |

**Services:**
- `services/teleport.ts` — Teleport CLI (`tsh`) integration. Identical to rds-iop-killer.
- `services/connection-manager.ts` — Persistent MySQL session management. Identical to rds-iop-killer.
- `services/lag.ts` — Replica lag queries: `SHOW REPLICA STATUS` + `performance_schema.replication_applier_status_by_worker`. Handles both old (`SHOW SLAVE STATUS`) and new (`SHOW REPLICA STATUS`) MySQL syntax.
- `services/cloudwatch.ts` — Fetches `ReplicaLag` metric from CloudWatch via AWS CLI. Dynamic period (60s/300s/900s based on time range).
- `services/aws-rds.ts` — AWS SSO integration. Identical to rds-iop-killer.

### Client (`client/src/`)

- **State** — Zustand store (`store/app-store.ts`) manages Teleport state, connection state, replica status, workers, CloudWatch lag data, time range, UTC toggle, and lag threshold.
- **API client** (`api/client.ts`) — Typed fetch wrappers for all endpoints.
- **Hooks:**
  - `hooks/useTeleport.ts` — Teleport lifecycle (identical to rds-iop-killer).
  - `hooks/useLag.ts` — Overview mode: CloudWatch + live replica status. Investigation mode (drag-zoom/custom range): same + replication workers. Request ID guard prevents stale responses.
- **Components:**
  - `TeleportControls` — Sidebar: cluster/login/instance selectors. Auto-connects with `__ALL__`.
  - `RootCauseAnalysis` — Sidebar: live lag indicator, IO/SQL thread status, issues panel, workers panel (investigation mode), SLA threshold control.
  - `LagView` — Main area: time picker + live lag banner + collapsible chart + investigation toolbar.
  - `LagChart` — SVG chart showing CloudWatch ReplicaLag (amber line). SLA threshold line (red dashed). Breach zones highlighted red. Drag-to-zoom.
  - `TimeRangePicker` — Preset buttons (5min, 30min, 1h, 6h, 12h, 24h) + Custom range + UTC/Local toggle. Amber accent.

### Lag Investigation Workflow

1. Select a replica RDS instance — auto-connects, CloudWatch lag and live replica status auto-fetched
2. Overview mode: chart shows CloudWatch ReplicaLag with SLA breach zones
3. Drag-to-zoom into a lag spike → enters investigation mode
4. Investigation mode: replication workers panel appears in sidebar with worker states and current transactions
5. Toggle chart visibility to maximize sidebar detail
6. Adjust SLA threshold in sidebar to change breach zone

### Key Types

- `ReplicaStatus` — Output of SHOW REPLICA STATUS: secondsBehindSource, ioThreadRunning, sqlThreadRunning, lastSqlError, lastIoError, sourceHost, GTID sets, channel name
- `ReplicationWorker` — Worker state from performance_schema: workerId, serviceState, lastAppliedTransaction, applyingTransaction, errors
- `CloudWatchLagPoint` — Timestamp + lagSeconds

### Environment Variables

- `AWS_SSO_START_URL` — AWS SSO portal URL (required for CloudWatch/RDS config)
- `AWS_SSO_REGION` — AWS SSO region (defaults to `us-east-1`)

### MySQL Compatibility

`getReplicaStatus()` in `services/lag.ts` handles both:
- MySQL 8.0.22+: `SHOW REPLICA STATUS` with `Replica_IO_Running`, `Seconds_Behind_Source`
- Older MySQL: `SHOW SLAVE STATUS` with `Slave_IO_Running`, `Seconds_Behind_Master`
