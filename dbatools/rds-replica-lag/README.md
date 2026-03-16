# RDS Replica Lag

A tool that monitors RDS MySQL replica lag in real time. It charts lag over time, correlates it with source/primary write activity, analyzes replica parameters, and provides data-driven root cause analysis when lag spikes happen.

Works on **Windows** and **macOS**.

---

## Before You Start

Make sure these are already set up on your machine:

| What | Why you need it |
|------|-----------------|
| **AWS profile** | The app uses your AWS account to read CloudWatch and RDS data. Your AWS profile must be configured and ready to use. |
| **Teleport** | The app connects to RDS through Teleport. You need Teleport installed and logged in to your cluster. |
| **Node.js** (v18 or newer) | The app runs on Node.js. |
| **Git** | To clone the repository. |

**Checklist before running:**

- [ ] AWS profile is configured (you can run `aws sso login` and it works)
- [ ] Teleport is installed (`tsh` command works in your terminal)
- [ ] You are logged in to your Teleport cluster
- [ ] Node.js is installed (`node --version` shows v18 or higher)

---

## How to Run

### Step 1: Clone the repository

```bash
git clone https://github.com/Reyamski/Development.git
cd Development/dbatools/rds-replica-lag
```

If you already cloned before, just pull the latest changes:

```bash
cd Development/dbatools/rds-replica-lag
git pull
```

### Step 2: Login to AWS and Teleport

```bash
aws sso login --sso-session <your-sso-session-name>
tsh login --proxy=<your-teleport-proxy>
```

### Step 3: Install dependencies (first time only)

```bash
npm install
```

Wait until it finishes. You only need to do this once, or when you pull new changes.

### Step 4: Start the app

```bash
npm run dev
```

The app will start and your browser should open automatically at http://localhost:5174.

### Step 5: Use the app

1. **Login** — Click your Teleport cluster and complete the login in the browser that opens.
2. **Select instance** — Pick your RDS replica from the dropdown.
3. **View lag** — The chart shows replica lag over time with the source/primary WriteIOPS overlaid in amber so you can visually correlate write spikes on the primary with lag spikes on the replica.
4. **Check parameters** — The sidebar shows your replica's MySQL parameter group with recommendations (e.g., increase `slave_parallel_workers`, set `slave_parallel_type=LOGICAL_CLOCK`).
5. **Investigate a spike** — Click and drag across a lag spike on the chart to zoom in. The tool will show:
   - **Root Cause Analysis** — Data-driven narrative correlating the lag with source write activity, specific slow queries, and worker utilization
   - **Query Analysis** — Top queries ranked by lag impact with per-query recommendations (index suggestions, optimization hints)
   - **Worker Activity** — Parallel replication worker utilization with tuning advice
   - **Source Correlation** — Whether the lag spike was caused by a write burst on the primary

---

## Features

### Lag Chart with Source Correlation

The chart shows two data series:

- **ReplicaLag** (gray line, left Y-axis) — How far behind the replica is, in seconds
- **Source WriteIOPS** (amber line, right Y-axis) — Write activity on the primary/source instance

When both lines spike at the same time, it means high write load on the primary is the likely cause of lag. This data comes from CloudWatch — no connection to the primary database is required.

### Replica Parameter Analysis

On connect, the tool fetches your RDS parameter group and checks replica-specific settings:

| Parameter | What it checks |
|-----------|---------------|
| `slave_parallel_workers` | Should be 8-16, not 0 (single-threaded) |
| `slave_parallel_type` | Should be LOGICAL_CLOCK, not DATABASE |
| `slave_preserve_commit_order` | Should be ON for consistency |
| `innodb_flush_log_at_trx_commit` | Can safely be 2 on a replica (faster apply) |
| `sync_binlog` | Can be relaxed on replica if no downstream replicas |
| `innodb_buffer_pool_size` | Should be 70-80% of instance memory |
| `innodb_io_capacity` | Should be >200 for SSD storage |
| `read_only` | Should be ON for replicas |

Each recommendation shows current vs suggested values, whether it requires a reboot (REBOOT) or can be applied live (LIVE), and detailed pros/cons.

### Data-Driven Root Cause Analysis

When investigating a lag spike, the RCA shows:

- **Specific queries** that contributed to lag (from `dba.events_statements_summary_by_digest_history`), ranked by impact with index suggestions
- **Worker utilization** — how many parallel workers are active vs idle, with scaling recommendations
- **Source write correlation** — "Source primary write spike detected — peak 12.8K IOPS (avg 5.2K), 2.5x surge"
- **GTID gap** — how many transactions are pending application
- **Slow applier detection** — statements that took >1s to apply on the replica

---

## When Something Goes Wrong

### "Port already in use"

The app might already be running. Try opening:

- http://localhost:5174
- or http://localhost:5178

If one of these opens the app, you are good. If you want to stop the old process and restart:

**Windows (PowerShell):**

```powershell
netstat -ano | findstr ":3002"
taskkill /PID <PID> /F
```

**macOS / Linux (Terminal):**

```bash
lsof -i :3002
kill -9 <PID>
```

Replace `<PID>` with the process ID you see in the output.

### "Teleport not found" or "tsh binary not available"

Teleport is not installed or not in your PATH. Install it from [Teleport docs](https://goteleport.com/docs/installation/) and make sure `tsh version` works before running the app again.

### CloudWatch or AWS errors

- Run `aws sso login` and complete the login in the browser.
- Check that your AWS profile has permissions to read CloudWatch and RDS.
- Make sure your environment variables are set (see below).

---

## Environment Variables

The app auto-detects AWS SSO settings from `~/.aws/config`. Only set these in a `.env` file if auto-detection doesn't work:

| Variable | Required? | What it does |
|----------|-----------|--------------|
| `AWS_SSO_START_URL` | Auto-detected | Your AWS SSO portal URL |
| `AWS_SSO_REGION` | No | AWS SSO region (default: `us-east-1`) |

---

## FAQ

**Q: Does this work on Mac?**

A: Yes. The app is cross-platform — same commands work on Windows, macOS, and Linux.

**Q: Why do I need an AWS profile?**

A: The app reads CloudWatch metrics from AWS to show how lag changes over time. It also uses your AWS account to get RDS instance details.

**Q: Why do I need Teleport?**

A: RDS databases are not reachable directly from your laptop. Teleport creates a secure tunnel so the app can connect and run queries like `SHOW REPLICA STATUS`.

**Q: What if the browser does not open automatically?**

A: Open your browser and go to http://localhost:5174 (Vite may use a different port like 5175-5179 if 5174 is busy).

**Q: What if I see "lag N/A" or no data?**

A: Make sure you are logged in to Teleport, selected an instance, and that the instance is a replica (read replica).

---

## Quick Reference

| Command | What it does |
|---------|--------------|
| `npm install` | Install dependencies (first time or after updates) |
| `npm run dev` | Start the app (server + client, opens browser) |
| `npm run dev -w server` | Start only the backend (port 3002) |
| `npm run dev -w client` | Start only the frontend (port 5174) |
| `npm run build` | Build for production |

| Port | What runs there |
|------|-----------------|
| 3002 | Backend API |
| 5174 | Frontend (Vite dev server) |
