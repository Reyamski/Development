---
status: testing
phase: 05-integration
source: ROADMAP.md (all phases)
started: 2026-03-31T00:00:00Z
updated: 2026-03-31T00:00:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running server. Start fresh with: cd rds-index-reviewer && npm run dev
  Server boots on port 3005, client on 5175, no errors in terminal.
  Opening http://localhost:5175 shows the app — not a blank page or error screen.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: npm run dev starts clean, app loads at http://localhost:5175
result: [pending]

### 2. Teleport Cluster Picker
expected: App shows a cluster dropdown populated from ~/.tsh. Selecting a cluster shows a login status.
result: [pending]

### 3. SSO Login
expected: If not logged in, clicking Login triggers tsh login SSO flow (browser opens or terminal prompt). Status updates to logged in after completion.
result: [pending]

### 4. RDS Instance List
expected: After login, a list of RDS/Aurora MySQL instances appears. Selecting one shows its name in the UI.
result: [pending]

### 5. Database Picker
expected: After selecting an instance, a list of databases (schemas) loads. User can pick one.
result: [pending]

### 6. Connect + Read-only Badge
expected: Clicking Connect establishes the Teleport tunnel. A persistent "Read-only analysis" badge appears in the header on every screen thereafter.
result: [pending]

### 7. Run Analysis
expected: Clicking "Run Analysis" triggers all 5 categories. A loading state appears, then results are shown across 5 tabs.
result: [pending]

### 8. Missing Index Candidates Tab
expected: Tab shows findings from performance_schema with table name, rows examined, exec count, and a human-readable explanation like "Query filters on X but no index exists..."
result: [pending]

### 9. Unused Indexes Tab
expected: Tab shows indexes with zero reads, write count, and explanation like "This index has never been read but is updated N times..."
result: [pending]

### 10. Duplicate Indexes Tab
expected: Tab shows pairs of identical-column indexes on the same table with which one to drop and a DROP INDEX suggestion.
result: [pending]

### 11. Overlapping Indexes Tab
expected: Tab shows indexes where one is a left-prefix subset of another, labels the redundant one, includes DROP INDEX suggestion.
result: [pending]

### 12. Bloat Risk Tables Tab
expected: Tab shows tables with ≥5 indexes and high write counts, with index count and total writes displayed.
result: [pending]

### 13. Finding Count Badges
expected: Each tab header shows a count badge (e.g. "Missing (3)"). Empty tabs show "0" badge and an empty state message, not a blank screen.
result: [pending]

### 14. Summary Banner
expected: Top of results shows total finding count with per-category breakdown (e.g. "7 findings: 2 missing, 3 unused, 1 duplicate, 0 overlapping, 1 bloat risk").
result: [pending]

### 15. Copy SQL Button
expected: Finding cards with a suggested SQL (e.g. DROP INDEX) show a copy button. Clicking it copies the SQL to clipboard. There is NO "Execute" or "Apply" button anywhere.
result: [pending]

### 16. Re-analyze Button
expected: Clicking "Re-analyze" reruns all 5 categories and refreshes results without requiring reconnection (tunnel stays open).
result: [pending]

### 17. Export to Confluence
expected: "Export to Confluence" button appears (when Confluence is configured). Clicking it creates a new dated child page under RDS Index Reviewer in Confluence and returns a clickable link.
result: [pending]

## Summary

total: 17
passed: 0
issues: 0
pending: 17
skipped: 0

## Gaps

[none yet]
