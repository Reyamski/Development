# Testing Guide: Database Query Implementation

## Prerequisites

1. **Teleport connection** to a MySQL instance with `dba schema`
2. **Active MySQL connection** established via Teleport tunnel
3. **dba.events_statements_summary_by_digest_history** table exists and has data

## Quick Test Steps

### 1. Start the Server

```bash
cd what-changed-assistant
npm install
npm run dev
```

Server will start on `http://localhost:4000`

### 2. Establish Database Connection

You'll need to integrate with the Teleport connection flow (similar to rds-replica-lag and rds-iop-killer).

**Option A: Copy Teleport routes from rds-replica-lag**
```bash
# Copy these files:
cp ../rds-replica-lag/server/src/services/teleport.ts ./server/src/services/
cp ../rds-replica-lag/server/src/routes/teleport.ts ./server/src/routes/
cp ../rds-replica-lag/server/src/types.ts ./server/src/types.ts
```

**Option B: Manual connection for testing**
```typescript
// In server/src/index.ts (temporary test code)
import mysql from 'mysql2/promise';
import { setConnection } from './services/connection-manager.js';

// After app.listen()
const testConnection = async () => {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306, // Your Teleport tunnel port
    user: 'your_username',
    database: 'dba',
  });
  
  await setConnection(conn, 'test-cluster', 'test-instance', 'dba');
  console.log('✓ Test connection established');
};

// testConnection(); // Uncomment to test
```

### 3. Test Endpoints

#### Test Query Digest Changes
```bash
curl "http://localhost:4000/api/database/query-digests?dbInstance=prod-rds-1&startTime=2024-03-19T10:00:00Z&endTime=2024-03-19T12:00:00Z"
```

**Expected response:**
```json
[
  {
    "digest": "abc123...",
    "queryText": "SELECT * FROM users WHERE ...",
    "schema": "production",
    "firstSeen": "2024-03-19T10:30:00Z",
    "lastSeen": "2024-03-19T11:45:00Z",
    "executionCount": 15000,
    "avgLatency": 125.5,
    "totalLatency": 1882500,
    "affectedTables": ["users"],
    "changeType": "spike",
    "comparisonMetric": {
      "before": 5000,
      "after": 15000,
      "percentChange": 200
    }
  }
]
```

#### Test Schema Changes
```bash
curl "http://localhost:4000/api/database/schema?dbInstance=prod-rds-1&startTime=2024-03-19T10:00:00Z&endTime=2024-03-19T12:00:00Z"
```

**Expected response:**
```json
[
  {
    "table": "production.user_events",
    "changeType": "INDEX",
    "statement": "ALTER TABLE user_events ADD INDEX idx_user_id (user_id)",
    "timestamp": "2024-03-19T10:15:00Z"
  }
]
```

#### Test Combined Database Changes
```bash
curl "http://localhost:4000/api/database/changes?dbInstance=prod-rds-1&startTime=2024-03-19T10:00:00Z&endTime=2024-03-19T12:00:00Z"
```

**Expected response:**
```json
[
  {
    "id": "query-abc123...",
    "timestamp": "2024-03-19T10:30:00Z",
    "changeType": "query_pattern",
    "database": "production",
    "table": "users",
    "description": "Query spike detected: 200% increase in executions",
    "severity": "medium",
    "details": {
      "digest": "abc123...",
      "queryText": "SELECT * FROM users WHERE ...",
      "executionCount": 15000,
      "avgLatency": 125.5
    }
  },
  {
    "id": "schema-production.user_events-2024-03-19T10:15:00Z",
    "timestamp": "2024-03-19T10:15:00Z",
    "changeType": "schema",
    "database": "prod-rds-1",
    "table": "production.user_events",
    "description": "INDEX on production.user_events",
    "severity": "medium",
    "details": {
      "statement": "ALTER TABLE user_events ADD INDEX idx_user_id (user_id)",
      "changeType": "INDEX"
    }
  }
]
```

## Verification Checklist

### ✓ Connection Tests
- [ ] Server starts without errors
- [ ] MySQL connection established via Teleport tunnel
- [ ] `getConnection()` returns valid connection object
- [ ] No "No active database connection" errors

### ✓ Query Digest Tests
- [ ] Returns array of query changes (can be empty if no spikes)
- [ ] Detects "new" queries (first_seen during window)
- [ ] Detects "spike" queries (>50% increase)
- [ ] Extracts table names correctly
- [ ] Calculates percent change accurately
- [ ] Filters out SHOW and SELECT @@ queries

### ✓ Schema Change Tests
- [ ] Detects CREATE TABLE operations
- [ ] Detects ALTER TABLE operations
- [ ] Detects INDEX operations
- [ ] Extracts DDL statements from digest history
- [ ] Deduplicates results from both sources
- [ ] Returns empty array if no changes (not error)

### ✓ Combined Changes Tests
- [ ] Combines query digests and schema changes
- [ ] Assigns correct severity levels (low/medium/high)
- [ ] Sorts by timestamp (newest first)
- [ ] Maps changeType correctly (schema/migration/query_pattern)
- [ ] Includes all required fields in DatabaseChange interface

### ✓ Error Handling
- [ ] Graceful handling when connection not established
- [ ] Returns empty array on query errors (doesn't throw)
- [ ] Handles missing QUERY_SAMPLE_TEXT column
- [ ] Handles invalid time ranges
- [ ] Logs errors to console

### ✓ Performance
- [ ] Queries complete within timeout (5-15 seconds)
- [ ] No memory leaks from unclosed connections
- [ ] Results limited to reasonable sizes (30-50 items)
- [ ] Time offset calculation is fast (<100ms)

## Troubleshooting

### Error: "No active database connection"
**Solution:** Call `setConnection()` before querying, or integrate Teleport connection flow.

### Error: "Table 'dba.events_statements_summary_by_digest_history' doesn't exist"
**Solution:** Verify your dba schema has this table. Check with:
```sql
SHOW TABLES FROM dba LIKE 'events%';
```

### Empty results despite expecting changes
**Solution:** 
- Check time range is correct (use recent dates)
- Verify dba schema has recent snapshots:
  ```sql
  SELECT MAX(AsOfDate) FROM dba.events_statements_summary_by_digest_history;
  ```
- Try wider time window (e.g., last 24 hours)

### Query timeout errors
**Solution:**
- Reduce time window
- Check database performance
- Verify indexes exist on AsOfDate column

## Integration with Existing Tools

To fully integrate with Teleport like other tools:

1. Copy `teleport.ts` service from rds-replica-lag
2. Copy `teleport.ts` routes from rds-replica-lag  
3. Update `index.ts` to include teleport routes
4. Add connection establishment logic in routes
5. Test full flow: login → connect → query → disconnect

Example:
```typescript
// In routes/database.ts
import { getConnection } from '../services/connection-manager.js';

router.get('/changes', async (req, res) => {
  try {
    // Verify connection exists
    const session = getActiveSession();
    if (!session?.connected) {
      return res.status(400).json({ 
        error: 'No active database connection. Connect via /api/teleport/connect first.' 
      });
    }
    
    // ... rest of handler
  } catch (error) {
    // ... error handling
  }
});
```
