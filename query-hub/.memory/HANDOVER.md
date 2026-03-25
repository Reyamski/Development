# Query Hub — session handover (rolling)

**Update after each meaningful task** on this tool. Next session reads this first for Query Hub work.

**Last updated:** 2026-03-25

---

## Branch

- (e.g. `feature/query-hub-…`)

## Where we left off

- Schema **Refs** button opens a modal: **tables** + **views** for views/routines; **events** add **stored routines** (`CALL` + backtick heuristics). API **`/api/schema/object-dependencies`** returns `{ views, routines, events }` with structured refs (not flat string arrays).
- **ER diagram**, **Ins** at cursor, **DDL** modal, workspace tabs, docs in `README.md` (Windows/macOS, routes).

## Next steps

- (Optional — what to do first next time.)

## Open / risks

- Large schemas: ER diagram caps FK edges; Refs depend on MySQL version / `information_schema` privileges.

## Scope reminder

- Nested app: `client/` + `server/` workspaces; dev **`npm run dev`** from this folder (UI 5180, API 3003).

---

*Keep short; replace stale bullets.*
