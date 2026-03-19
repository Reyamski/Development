import { DatabaseChange, QueryDigestChange, SchemaChange } from '../types.js';

export async function getDatabaseChanges(
  dbInstance: string,
  startTime: string,
  endTime: string
): Promise<DatabaseChange[]> {
  console.log(`Fetching database changes for ${dbInstance} from ${startTime} to ${endTime}`);
  
  const start = new Date(startTime);
  const mockChanges: DatabaseChange[] = [
    {
      id: 'db-change-1',
      timestamp: new Date(start.getTime() + 5 * 60 * 60 * 1000).toISOString(),
      changeType: 'schema',
      database: 'analytics_db',
      table: 'user_events',
      description: 'Added composite index on (user_id, event_type, created_at)',
      severity: 'medium',
      details: {
        statement: 'ALTER TABLE user_events ADD INDEX idx_user_events_composite (user_id, event_type, created_at)',
        executionTime: '12.4s',
        rowsAffected: 15000000,
      },
    },
    {
      id: 'db-change-2',
      timestamp: new Date(start.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      changeType: 'query_pattern',
      database: 'prod_db',
      table: 'sessions',
      description: 'New query pattern detected: Scanning sessions table without index',
      severity: 'high',
      details: {
        digest: 'abc123def456',
        queryText: 'SELECT * FROM sessions WHERE last_activity > ?',
        executionCount: 4521,
        avgLatency: 850,
      },
    },
    {
      id: 'db-change-3',
      timestamp: new Date(start.getTime() + 5.2 * 60 * 60 * 1000).toISOString(),
      changeType: 'migration',
      database: 'analytics_db',
      description: 'Migration: Create new analytics tables (user_analytics, event_analytics, session_analytics)',
      severity: 'high',
      details: {
        tables: ['user_analytics', 'event_analytics', 'session_analytics'],
        backfillRows: 2500000,
        duration: '8m 42s',
      },
    },
  ];

  return mockChanges.filter(change => {
    const changeTime = new Date(change.timestamp);
    return changeTime >= new Date(startTime) && changeTime <= new Date(endTime);
  });
}

export async function getQueryDigestChanges(
  dbInstance: string,
  startTime: string,
  endTime: string
): Promise<QueryDigestChange[]> {
  console.log(`Fetching query digest changes for ${dbInstance}`);
  
  const start = new Date(startTime);
  const mockDigests: QueryDigestChange[] = [
    {
      digest: 'abc123def456',
      queryText: 'SELECT * FROM sessions WHERE last_activity > ?',
      schema: 'prod_db',
      firstSeen: new Date(start.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date(start.getTime() + 5 * 60 * 60 * 1000).toISOString(),
      executionCount: 4521,
      avgLatency: 850,
      totalLatency: 3843850,
      affectedTables: ['sessions'],
      changeType: 'new',
      comparisonMetric: {
        before: 0,
        after: 4521,
        percentChange: 100,
      },
    },
    {
      digest: 'xyz789abc012',
      queryText: 'INSERT INTO user_analytics (user_id, event_type, created_at) VALUES (?, ?, ?)',
      schema: 'analytics_db',
      firstSeen: new Date(start.getTime() + 5.2 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date(start.getTime() + 6 * 60 * 60 * 1000).toISOString(),
      executionCount: 125000,
      avgLatency: 12,
      totalLatency: 1500000,
      affectedTables: ['user_analytics'],
      changeType: 'spike',
      comparisonMetric: {
        before: 0,
        after: 125000,
        percentChange: 100,
      },
    },
  ];

  return mockDigests;
}

export async function getSchemaChanges(
  dbInstance: string,
  startTime: string,
  endTime: string
): Promise<SchemaChange[]> {
  console.log(`Fetching schema changes for ${dbInstance}`);
  
  const start = new Date(startTime);
  const mockSchema: SchemaChange[] = [
    {
      table: 'user_events',
      changeType: 'INDEX',
      statement: 'ALTER TABLE user_events ADD INDEX idx_user_events_composite (user_id, event_type, created_at)',
      timestamp: new Date(start.getTime() + 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      table: 'user_analytics',
      changeType: 'CREATE',
      statement: 'CREATE TABLE user_analytics (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT, event_type VARCHAR(50), created_at DATETIME)',
      timestamp: new Date(start.getTime() + 5.2 * 60 * 60 * 1000).toISOString(),
    },
  ];

  return mockSchema;
}
