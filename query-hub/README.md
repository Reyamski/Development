# Query Hub

Internal MySQL DBA tool — connect to RDS MySQL via Teleport, run guarded SQL, get AI-assisted explanations and analyses powered by Amazon Bedrock (Claude).

**Read-only by design.** Triple-layered safeguard ensures no write or schema-modifying SQL ever reaches MySQL through this tool.

---

## Quick start

```bash
cd query-hub
npm install                  # installs server + client workspaces
cp .env.example .env         # then edit .env (see Configuration)
npm run dev                  # boots server (3004) + client (5192) concurrently
```

Then open http://localhost:5192 in your browser.

Stop the dev servers with `Ctrl+C`.

---

## Configuration (`.env`)

Located at `query-hub/.env` — the API loads it at boot. Sample:

```
PORT=3004

# AWS Bedrock — server-side only, credentials never reach the browser
QUERY_HUB_BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-6
QUERY_HUB_BEDROCK_PROFILE=PAR-AI-Development-PARAILabEngineer
QUERY_HUB_BEDROCK_REGION=us-east-1

# Optional: pre-fill the cluster dropdown
TELEPORT_CLUSTERS=par-prod.teleport.sh,par-nonprod.teleport.sh

# Optional: explicit tsh path if not on PATH
# QUERY_HUB_TSH_PATH=C:\Program Files\Teleport Connect\tsh.exe
```

### Bedrock setup notes

- The model ID **must use a cross-region inference profile prefix** (`us.`) for Sonnet 4.6 on-demand throughput. The bare foundation model ID returns `ValidationException`.
- The AWS profile needs `bedrock:InvokeModel` and `bedrock:Converse` on the chosen model. PAR setup: use the `PAR-AI-Development` account (account ID `506221082134`) with the `PARAILabEngineer` SSO role. The `PAR-AI-Nonprod` `ai_developer` role is intentionally read-only and cannot invoke Bedrock — that account is reserved for production AI workloads (AVA, POSChat).
- SSO session lifetime is ~12h. Refresh with `aws sso login --profile <your-profile>` when expired.

### Teleport setup notes

- `tsh` must be installed on the same machine that runs the API server. The app auto-detects it on PATH, in WinGet's package directory, or in standard install locations on Windows / macOS.
- `Login via SSO` in the UI runs `tsh login --proxy=<host>` so it works regardless of which root cluster you're already authenticated to.

---

## Project layout

```
query-hub/
├── server/        # Express API on port 3004
│   └── src/
│       ├── routes/      # ai, query, schema, teleport, auth-email
│       └── services/    # ai-providers, sql-guard, query-runner, teleport, schema-summary
├── client/        # React + Vite on port 5192
│   └── src/
│       ├── components/  # AiPanel, SqlEditor, ResultsGrid, TeleportControls, etc.
│       ├── store/       # zustand stores (app, query, workspace)
│       ├── hooks/       # useQuery, useTeleport, useWorkspaceTabs
│       └── api/         # client.ts (typed fetch wrappers)
└── .env / .env.example
```

---

## Read-only safeguards

The tool never executes destructive SQL. Three independent layers, each catches a different failure mode:

### Layer 1 — AI prompt rules

In `server/src/routes/ai.ts`, every Bedrock call uses `SAFETY_RULES` system text that forbids the model from suggesting:

- DDL: `CREATE / ALTER / DROP / TRUNCATE / RENAME` (incl. `ADD INDEX`, `OPTIMIZE TABLE`, `ANALYZE TABLE`, `REPAIR TABLE`)
- DML writes: `INSERT / UPDATE / DELETE / REPLACE`
- Locking: `LOCK TABLES`, `FLUSH`, `SELECT … FOR UPDATE`
- Privileges: `GRANT / REVOKE / CREATE USER / ALTER USER`
- The model is told to explain trade-offs in plain English instead of emitting risky SQL

### Layer 2 — App-level SQL guard (the strong one)

`server/src/services/sql-guard.ts` runs on every editor query *and* on every AI-suggested SQL. **Allowlist** (not blocklist):

```
SELECT, WITH, SHOW, DESCRIBE, DESC, EXPLAIN
```

Anything else returns `blocked: true` with reason `NOT_READ_ONLY`, reaches the UI as a friendly red banner, and never hits MySQL. Plus belt-and-suspenders blocks for:

- `SELECT … INTO OUTFILE / DUMPFILE` (server-side file writes)
- `SELECT … FOR UPDATE / FOR SHARE` (acquires row locks)
- Multiple statements per request

Every endpoint that takes raw SQL (`/api/query/execute`, `/api/query/explain`, `/api/query/export`) routes through `guardSql()` before opening a cursor.

### Layer 3 — MySQL user privileges

The actual MySQL user is whatever Teleport's `--db-user` maps your SSO identity to. **This is org-managed and currently permissive** for DBA roles (full `INSERT/UPDATE/DELETE/CREATE/DROP` plus `RELOAD`, `LOCK TABLES`, etc.). Layer 2 stops these from being executed *through Query Hub*, but the same MySQL user can still be used to write via direct `tsh db connect` + mysql client.

To verify your effective grants in Query Hub, run:

```sql
SHOW GRANTS FOR CURRENT_USER();
```

If you want absolute Layer-3 enforcement (e.g. to share the tool with non-DBA users without trusting the app guard), request a separate read-only Teleport role from the DBA team (only `SELECT, SHOW VIEW, EXECUTE`) and point Query Hub at that db-user.

---

## AI features

Sub-tabs inside the AI panel (one per workflow):

| Tab | What it does | Required input |
|---|---|---|
| **Explain** | Plain-English breakdown of the query in the editor | Editor has SQL |
| **EXPLAIN** | Interprets MySQL's `EXPLAIN` output (access types, keys, row estimates) | Run `EXPLAIN` from the toolbar first |
| **Results** | Summarizes the first 25 rows of the last `SELECT` result | Run a `SELECT` first |
| **Ask** | Free-form chat. The active database schema is included as context. | Connection + database selected |

Each sub-tab keeps its own response history. **Run again** appends a new response, **Clear** resets. SQL fenced inside markdown responses (e.g. ` ```sql … ``` `) renders with a Copy / Insert affordance — Insert pastes into the SQL editor.

---

## Common scripts

```bash
npm run dev                    # server + client with HMR (default during dev)
npm run build                  # production build of both workspaces
npm run dev -w server          # API only
npm run dev -w client          # client only
```

---

## Troubleshooting

**`AccessDeniedException: bedrock:InvokeModel`**
Wrong AWS account / role. Switch to `PAR-AI-Development-PARAILabEngineer`. The `PAR-AI-Nonprod` `ai_developer` role is read-only by design.

**`ValidationException: on-demand throughput isn't supported`**
You used the bare foundation model ID. Add the `us.` prefix (cross-region inference profile).

**`remote cluster "<host>" is not found` from `tsh login`**
You're authenticated to a different root cluster. The login button uses `--proxy=` to disambiguate; if you call `tsh` manually, do the same: `tsh login --proxy=par-nonprod.teleport.sh`.

**"Query Hub is read-only — only SELECT/WITH/SHOW/DESCRIBE/DESC/EXPLAIN statements are allowed"**
Working as intended. The guard rejected a non-read-only statement. If you genuinely need to run a write outside this tool, use `tsh db connect` directly with the mysql client.

**Port `3004` or `5192` already in use**
Stale dev process. On Windows: `netstat -ano | findstr :3004` then `taskkill /PID <pid> /F`. On macOS/Linux: `lsof -ti :3004 | xargs kill -9`.

**Scrollbar in the AI panel won't drag**
Hard-refresh the browser (Ctrl+Shift+R) — the CSS for the scrollbar is in `globals.css` and Vite HMR sometimes leaves stale scrollbar styles attached to existing DOM nodes.

---

## Cost note

Sonnet 4.6 on Bedrock: **$3 per 1M input tokens, $15 per 1M output tokens**. Typical DBA usage of Query Hub is around `$15–$70/month` per user. Schema context is the biggest input cost — adding prompt caching could cut that by ~10× for repeat queries against the same database. Not currently wired up; consider it if monthly spend exceeds `$50`.
