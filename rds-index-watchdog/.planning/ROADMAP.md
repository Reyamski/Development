# Roadmap — RDS Index Reviewer

## Overview
5 phases | 27 requirements | Read-only MySQL index analysis tool for RDS instances accessed via Teleport, surfacing actionable recommendations with human-readable explanations.

## Phases

### Phase 1: Connection & Project Foundation
**Goal:** Stand up the project scaffold and deliver a working Teleport-connected database selector so a DBA can authenticate, pick a cluster, pick an instance, and pick a schema — with the read-only constraint enforced from day one.
**Requirements:** CONN-01, CONN-02, CONN-03, CONN-04, CONN-05, SAFE-01, SAFE-03
**Success Criteria:**
1. User can select a Teleport cluster, trigger SSO login if needed, and list available RDS instances without error.
2. User can select a database schema and the server establishes a tunnel connection via the existing Teleport service.
3. No write query of any kind is ever sent to the target database; the server enforces read-only mode at the query layer.
4. The UI displays a persistent "Read-only analysis" label on every screen after connection.

---

### Phase 2: High-Value Query Analysis (Missing & Unused Indexes)
**Goal:** Implement the two highest-signal analysis categories — missing index candidates derived from statement digests and unused indexes identified via I/O wait statistics — so the tool immediately delivers actionable findings after connection.
**Requirements:** MISS-01, MISS-02, MISS-03, UNUS-01, UNUS-02, UNUS-03
**Success Criteria:**
1. The server queries `performance_schema.events_statements_summary_by_digest` and returns findings with table name, estimated rows scanned, and suggested column set.
2. The server queries `performance_schema.table_io_waits_summary_by_index_usage` and returns all indexes with zero reads, excluding PRIMARY keys.
3. Every finding in both categories includes a human-readable explanation string (not a raw metric dump).
4. Results are returned as structured JSON consumable by the UI layer.

---

### Phase 3: Structural Index Analysis (Duplicates, Overlaps, Bloat Risk)
**Goal:** Implement the three schema-structural analysis categories — duplicate indexes, overlapping (prefix-subset) indexes, and high-write tables with index bloat risk — completing the full five-category analysis engine.
**Requirements:** DUPL-01, DUPL-02, OVER-01, OVER-02, BLOT-01, BLOT-02
**Success Criteria:**
1. The server detects indexes with identical column sets on the same table and identifies which candidate to drop.
2. The server detects indexes where one is a strict left-prefix of another and correctly labels the shorter index as redundant.
3. The server identifies tables with ≥5 indexes and high write counts from `performance_schema`, and returns write count, index count, and an overhead explanation.
4. All three categories return findings in the same structured format as Phase 2.

---

### Phase 4: Report UI & Copy Actions
**Goal:** Build the full results UI — five tabbed sections, finding cards with severity badges, summary banner, copy-to-clipboard for recommended SQL, re-analyze trigger, and empty states — so DBAs can read and act on findings without leaving the tool.
**Requirements:** UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, SAFE-02
**Success Criteria:**
1. Results are presented in five tabs (one per category), each with a finding count badge in the header and a correct empty state when no findings exist.
2. Every finding card shows a severity badge (warning/info), table name, index name(s), and human-readable explanation.
3. The summary banner at the top shows total finding count with a per-category breakdown.
4. Generated SQL (e.g. `DROP INDEX idx_x ON table_y`) is copyable via a copy button and has no execute button anywhere in the UI.

---

### Phase 5: Integration, Hardening & End-to-End Validation
**Goal:** Wire all phases together into a cohesive, tested application — validate full connection-to-report flow against a real or representative RDS instance, confirm the safety constraints hold end-to-end, and ensure the tool is ready for DBA use.
**Requirements:** (All 27 requirements validated as a system — no new requirements; this phase covers cross-cutting integration and verification of CONN-01–05, MISS-01–03, UNUS-01–03, DUPL-01–02, OVER-01–02, BLOT-01–02, UI-01–07, SAFE-01–03)
**Success Criteria:**
1. A DBA can complete the full workflow — authenticate, select cluster/instance/schema, run analysis, read findings, copy SQL — without any unhandled errors.
2. All five analysis categories return correct results against a known test database with seeded index conditions.
3. A manual review confirms no write query is issued to the target database at any point in any code path.
4. The "Re-analyze" button refreshes all five categories without requiring reconnection.
