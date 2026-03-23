# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (starts both server and client concurrently)
npm run dev

# Server only (port 3001, tsx watch mode)
npm run dev -w server

# Client only (port 5173, Vite, proxies /api to localhost:3001)
npm run dev -w client

# Build both
npm run build

# Type-check without emitting
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit
```

No test suite or linter is configured yet.

## Architecture

npm workspaces monorepo with two packages: `server` (Express + TypeScript) and `client` (React 18 + Vite + Tailwind + Zustand).

**Purpose:** Compare two `rds-schema-exporter` dump directories (source vs target), show a visual diff, and generate MySQL migration SQL to bring the target in line with the source.

### Server (`server/src/`)

Express on port 3001 with five routes:

| Route | Purpose |
|-------|---------|
| `POST /api/compare` | Scan + parse + diff both folders |
| `POST /api/generate` | Write migration SQL to output dir |
| `POST /api/generate/preview` | Return migration SQL for a single item (no file write) |
| `POST /api/validate-path` | Check if directory exists |
| `POST /api/browse` | List subdirectories for folder picker UI |

**Service pipeline:** Scanner -> Parser -> Differ -> Generator

- **Scanner** (`services/scanner.ts`) - Recursively walks directories, classifies `.sql` files by parent folder name matching known object types (`tables`, `views`, `procedures`, `functions`, `triggers`, `events`, `indexes`). Keys files as `{objectType}/{name}` and matches source/target pairs.

- **Parser** (`services/parser/`) - Hybrid strategy dispatched by object type:
  - Tables: `node-sql-parser` into structured `ParsedTable` (columns, indexes, FKs, PK, options)
  - Indexes: Regex-based `CREATE INDEX` parsing
  - Everything else: Text normalization (strip DEFINER, normalize whitespace)

- **Differ** (`services/differ/`) - Tables get structural diff (column-by-column, index-by-index, FK comparison). Everything else uses normalized text equality. Supports three exclusion flags passed via `DiffOptions`:
  - `ignoreFkNameOnly` - Match foreign keys by structure (columns, reference table, actions) instead of by name
  - `ignoreIndexNameOnly` - Match indexes by structure (uniqueness + columns) instead of by name
  - `ignoreCollation` - Strip COLLATE/CHARACTER SET/CHARSET from column definitions and skip collation-related table options

- **Generator** (`services/generator/`) - Produces migration SQL with correct ordering:
  1. DROP dependent objects (triggers/events/views/procs/functions)
  2. DROP TABLE (removed), CREATE TABLE (added), ALTER TABLE (modified)
  3. Index changes
  4. CREATE dependent objects

  ALTER TABLE internals follow: drop FKs -> drop indexes -> drop PK -> drop columns -> add columns -> modify columns -> add PK -> add indexes -> add FKs -> table options.

### Client (`client/src/`)

- **State** - Single Zustand store (`store/comparison-store.ts`) holds paths, comparison results, export selection set, and async state.
- **API client** (`api/client.ts`) - Typed fetch wrappers for all server endpoints.
- **Layout** - Sidebar (path inputs + compare + generate), file list panel (categorized by status), diff viewer panel (react-diff-viewer-continued), migration SQL preview panel (bottom).
- **File selection** - Changed files have checkboxes for selective export. `selectedForExport` Set in store controls which items go to generation.
- **Directory browser** - Modal component (`DirectoryBrowser.tsx`) used by all three path inputs (source, target, output) via the `/api/browse` endpoint.

### Key Types

`DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged'`

`ComparisonResult` is the core data structure flowing from server to client - contains `key`, `objectType`, `name`, `status`, raw SQL strings, and optional `TableDiffDetail` for structural table diffs.

Server types in `services/parser/types.ts` and `services/differ/types.ts`. Client mirrors in `api/types.ts`.
