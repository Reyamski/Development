# Database Service Implementation Summary

## Changes Completed

Replaced all mock data in `server/src/services/database.ts` with real MySQL queries to the `dba schema`.

### 1. Connection Manager (`connection-manager.ts`)

**Updated to match rds-replica-lag pattern:**
- Added `getConnection()` function that returns active MySQL connection
- Added `setConnection()` to establish connection with metadata
- Added `getActiveSession()` to check connection status
- Removed stub tunnel management code

### 2. Database Service (`database.ts`)

**Implemented real queries for all three functions:**

#### `getDatabaseChanges(dbInstance, startTime, endTime)`
- Combines results from `getQueryDigestChanges()` and `getSchemaChanges()`
- Converts query digest changes into `DatabaseChange` objects with severity levels
- Converts schema changes into `DatabaseChange` objects
- Returns sorted list by timestamp (newest first)

#### `getQueryDigestChanges(dbInstance, startTime, endTime)`
- Queries `dba.events_statements_summary_by_digest_history`
- Compares snapshots **before** the incident (30min lookback) vs **during** the time window
- Detects **new queries**: queries that first appeared during the incident window
- Detects **query spikes**: queries with >50% increase in execution count
- Extracts affected tables from query text using regex patterns
- Returns up to 50 most active query changes

**Key features:**
- Time offset handling (converts DB time to UI time)
- Fallback to `DIGEST_TEXT` if `QUERY_SAMPLE_TEXT` doesn't exist
- Filters out noise (`SHOW%`, `SELECT @@%`)
- Calculates percent change in execution count

#### `getSchemaChanges(dbInstance, startTime, endTime)`
- **Two data sources:**
  1. `information_schema.TABLES` - detects CREATE/ALTER via timestamps
  2. `dba.events_statements_summary_by_digest_history` - captures actual DDL statements

- Detects:
  - CREATE TABLE (new tables)
  - ALTER TABLE (table modifications)
  - DROP TABLE (deleted tables)
  - INDEX operations (CREATE/DROP INDEX)

- Deduplicates results from both sources
- Returns up to 50 schema changes sorted by timestamp

**Key features:**
- Uses `CREATE_TIME` and `UPDATE_TIME` from information_schema
- Extracts DDL statements from query digest history
- Pattern matching to classify change types (CREATE/ALTER/DROP/INDEX)
- Filters out system schemas (information_schema, mysql, performance_schema, sys, dba)

### 3. Helper Functions

**`getDbTimeOffset()`**
- Synchronizes server time with database time
- Returns offset in milliseconds for timestamp conversion

**`toUiIso(value, offsetMs)`**
- Converts database timestamps to UI-friendly ISO format
- Adjusts for time offset between server and database

**`extractTables(queryText)`**
- Parses SQL query text to extract table names
- Handles FROM, JOIN, INTO, UPDATE clauses
- Returns array of affected table names

## Database Schema Requirements

The implementation assumes the following schema exists:

### Required Tables:
1. **`dba.events_statements_summary_by_digest_history`**
   - Columns: `SCHEMA_NAME`, `DIGEST`, `DIGEST_TEXT`, `QUERY_SAMPLE_TEXT`, `AsOfDate`, `COUNT_STAR`, `AVG_TIMER_WAIT`, `SUM_TIMER_WAIT`
   - Used for: Query digest analysis and DDL statement history

2. **`information_schema.TABLES`** (Standard MySQL)
   - Columns: `TABLE_SCHEMA`, `TABLE_NAME`, `CREATE_TIME`, `UPDATE_TIME`, `TABLE_COMMENT`
   - Used for: Schema change detection

### Optional Columns:
- `QUERY_SAMPLE_TEXT` - If missing, falls back to `DIGEST_TEXT`

## Query Performance

All queries include:
- `MAX_EXECUTION_TIME` hints (5-15 seconds)
- `LIMIT` clauses to prevent large result sets
- Efficient WHERE clauses with indexed columns (AsOfDate, CREATE_TIME, UPDATE_TIME)
- Read-only operations (no writes to database)

## Usage Example

```typescript
// 1. Establish connection first (via Teleport tunnel)
import { setConnection } from './services/connection-manager.js';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: '127.0.0.1',
  port: tunnelPort,
  user: dbUser,
  database: 'dba',
});

await setConnection(connection, 'prod-cluster', 'prod-rds-1', 'dba');

// 2. Query for changes
const changes = await getDatabaseChanges(
  'prod-rds-1',
  '2024-03-19T10:00:00Z',
  '2024-03-19T11:00:00Z'
);

// 3. Close connection
await closeAllConnections();
```

## API Endpoints (Unchanged)

The existing routes continue to work:
- `GET /api/database/changes?dbInstance=X&startTime=Y&endTime=Z`
- `GET /api/database/query-digests?dbInstance=X&startTime=Y&endTime=Z`
- `GET /api/database/schema?dbInstance=X&startTime=Y&endTime=Z`

## Testing Checklist

- [ ] Verify connection to dba schema via Teleport tunnel
- [ ] Test `getDatabaseChanges()` with a recent incident time window
- [ ] Test `getQueryDigestChanges()` to detect query spikes
- [ ] Test `getSchemaChanges()` to detect DDL operations
- [ ] Verify time offset conversion is working correctly
- [ ] Check error handling when tables don't exist
- [ ] Verify empty result sets don't throw errors

## Dependencies

All required dependencies are already in `package.json`:
- `mysql2` v3.11.0 - MySQL client with Promise support
- `express` v4.18.2 - API server
- `cors` v2.8.5 - CORS middleware

## Notes

- All queries are **read-only** and safe to run on production replicas
- Time window comparisons use a **30-minute lookback** before the incident start
- Query spike threshold is **>50% increase** (1.5x multiplier)
- Maximum execution time is enforced via query hints (5-15 seconds)
- Results are limited to 30-50 items per query for performance
