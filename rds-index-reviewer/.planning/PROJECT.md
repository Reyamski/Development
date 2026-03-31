# RDS Index Reviewer

## What This Is

A read-only MySQL index analysis tool for DBAs managing multiple AWS RDS instances via Teleport. It connects to a selected database, introspects index usage and schema metadata, and surfaces actionable recommendations — all with human-readable explanations. No auto-apply. Human decides what to act on.

## The Problem

DBAs managing many RDS instances rarely have time to audit indexes systematically. Unused indexes silently waste write overhead and storage. Missing indexes cause full scans nobody notices until there's an incident. Duplicate and overlapping indexes accumulate over years of migrations. Today this requires manually running 5-10 different `information_schema` and `performance_schema` queries per database, interpreting the output, and connecting the dots manually.

## Core Value

Instant, readable index health report for any RDS database — connected via existing Teleport infrastructure — with no ability to modify anything.

## Who It's For

DBAs and senior engineers at the company. Internal tool. Not customer-facing.

## What It Does

Connect to an RDS instance via Teleport (reuse existing connection infrastructure), select a database, run analysis, get a categorized report.

### Five Analysis Categories

1. **Missing Index Candidates** — queries from `performance_schema.events_statements_summary_by_digest` with high full-scan row counts that could benefit from an index. Explanation: "This query scans ~50,000 rows. Adding an index on (user_id, created_at) could reduce that to ~10 rows."

2. **Unused Indexes** — indexes in `performance_schema.table_io_waits_summary_by_index_usage` with zero reads since last restart. Explanation: "This index has never been used. It adds write overhead to every INSERT/UPDATE/DELETE on this table."

3. **Duplicate Indexes** — indexes with identical or prefix-identical column sets on the same table. Explanation: "idx_user_email duplicates the prefix of idx_user_email_status. One can be dropped."

4. **Overlapping Indexes** — indexes where one is a left-prefix subset of another (the shorter one is redundant). Explanation: "idx_created is a prefix of idx_created_user. MySQL can use the longer index for single-column lookups too."

5. **High-Write Tables with Index Bloat Risk** — tables with high write counts and many indexes. Explanation: "This table has 8 indexes and receives 2M writes/day. Each write updates all 8 indexes. Consider whether all are necessary."

## What It Does NOT Do

- No `ALTER TABLE` execution
- No index creation or dropping
- No schema modifications of any kind
- No write operations to the target database

## Stack

- **Client**: React + Tailwind (same pattern as Query Hub / What Changed)
- **Server**: Node/Express + TypeScript
- **DB Connection**: Teleport tunnel via `tsh proxy db` (reuse from existing codebase)
- **MySQL queries**: `mysql2/promise` — `information_schema`, `performance_schema`
- **Port**: TBD (3005 server / 5176 client)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Read-only only | Trust is built before action. Humans review before applying. | Final |
| Reuse Teleport infra | Already works, no need to rebuild | Final |
| No AI/LLM for recommendations | Deterministic SQL rules are more reliable for index analysis | Final |
| Human-readable explanations | DBAs need to explain decisions to devs, not just see flags | Final |
| performance_schema required | Tool only works if `performance_schema` is enabled (true for all RDS) | Final |

---
*Last updated: 2026-03-31 — project initialized*
