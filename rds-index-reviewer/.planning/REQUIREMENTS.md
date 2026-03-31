# Requirements — RDS Index Reviewer

## v1 Requirements

### Connection
- [ ] **CONN-01**: User can select a Teleport cluster from a dropdown
- [ ] **CONN-02**: User can initiate Teleport SSO login if not authenticated
- [ ] **CONN-03**: User can list and select an RDS database instance for the selected cluster
- [ ] **CONN-04**: User can select a database (schema) to analyze
- [ ] **CONN-05**: System connects via Teleport tunnel (reuse existing teleport service)

### Analysis — Missing Indexes
- [ ] **MISS-01**: System queries `performance_schema.events_statements_summary_by_digest` for high-scan-count queries
- [ ] **MISS-02**: System extracts tables referenced in digest queries and checks for missing indexes on filter/sort columns
- [ ] **MISS-03**: Each finding shows: table name, estimated rows scanned, suggested column set, human-readable explanation

### Analysis — Unused Indexes
- [ ] **UNUS-01**: System queries `performance_schema.table_io_waits_summary_by_index_usage` for indexes with zero reads
- [ ] **UNUS-02**: System excludes PRIMARY keys from unused index flagging
- [ ] **UNUS-03**: Each finding shows: table, index name, write count (cost being paid), human-readable explanation

### Analysis — Duplicate Indexes
- [ ] **DUPL-01**: System detects indexes with identical column sets on the same table
- [ ] **DUPL-02**: Each finding shows: table, both index names, column overlap, which one to consider dropping

### Analysis — Overlapping Indexes
- [ ] **OVER-01**: System detects indexes where one is a left-prefix subset of another on the same table
- [ ] **OVER-02**: Each finding shows: table, redundant index, covering index, explanation of why shorter is redundant

### Analysis — High-Write Bloat Risk
- [ ] **BLOT-01**: System identifies tables with high write counts (from `performance_schema`) and high index count (≥5)
- [ ] **BLOT-02**: Each finding shows: table, write count, index count, estimated overhead explanation

### Report UI
- [ ] **UI-01**: Results grouped into 5 tabs/sections (one per category)
- [ ] **UI-02**: Each finding card shows: severity badge (warning/info), table name, index name(s), human-readable explanation
- [ ] **UI-03**: Finding count badge per section in the tab header
- [ ] **UI-04**: Empty state when no findings in a category ("No unused indexes found ✓")
- [ ] **UI-05**: User can copy the recommended action text (e.g. `DROP INDEX idx_x ON table_y`)
- [ ] **UI-06**: "Re-analyze" button to refresh results without reconnecting
- [ ] **UI-07**: Summary banner at top: total findings count, breakdown by category

### Safety
- [ ] **SAFE-01**: No write queries executed against target database under any condition
- [ ] **SAFE-02**: All generated SQL shown as copy-only — no execute button
- [ ] **SAFE-03**: Clear "Read-only analysis" label visible in UI at all times

## v2 (Deferred)

- Export findings as Markdown or CSV report
- Multi-database scan (analyze all schemas in one run)
- Historical snapshots (compare index health over time)
- Slack/email notification of new findings
- Estimated storage savings from dropping unused indexes

## Out of Scope

- Index auto-creation or auto-drop — humans decide
- Query plan visualization — that's Query Hub's job
- Non-MySQL databases — RDS MySQL/Aurora MySQL only
- Index cardinality tuning suggestions — out of scope for v1

## Traceability

| Requirement | Phase |
|-------------|-------|
| CONN-01–05 | Phase 1 |
| MISS-01–03 | Phase 2 |
| UNUS-01–03 | Phase 2 |
| DUPL-01–02 | Phase 3 |
| OVER-01–02 | Phase 3 |
| BLOT-01–02 | Phase 3 |
| UI-01–07 | Phase 4 |
| SAFE-01–03 | Phase 1 + 4 |
