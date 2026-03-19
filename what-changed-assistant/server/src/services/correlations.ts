import { JiraRelease, DatabaseChange, ConfigChange, Correlation } from '../types.js';

export function detectCorrelations(
  jiraChanges: JiraRelease[],
  databaseChanges: DatabaseChange[],
  configChanges: ConfigChange[]
): Correlation[] {
  const correlations: Correlation[] = [];

  const jiraByTime = jiraChanges.reduce((acc, change) => {
    acc.set(change.id, new Date(change.releaseDate).getTime());
    return acc;
  }, new Map<string, number>());

  const dbByTime = databaseChanges.reduce((acc, change) => {
    acc.set(change.id, new Date(change.timestamp).getTime());
    return acc;
  }, new Map<string, number>());

  const configByTime = configChanges.reduce((acc, change) => {
    acc.set(change.id, new Date(change.timestamp).getTime());
    return acc;
  }, new Map<string, number>());

  for (const jira of jiraChanges) {
    const jiraTime = new Date(jira.releaseDate).getTime();
    
    for (const db of databaseChanges) {
      const dbTime = new Date(db.timestamp).getTime();
      const timeDiff = Math.abs(jiraTime - dbTime);
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      if (hoursDiff < 1) {
        const hasKeywordMatch = 
          (jira.summary.toLowerCase().includes('migration') && db.changeType === 'migration') ||
          (jira.summary.toLowerCase().includes('schema') && db.changeType === 'schema') ||
          (jira.summary.toLowerCase().includes('database') && db.changeType === 'schema') ||
          (jira.labels.includes('analytics') && db.database.includes('analytics'));

        if (hasKeywordMatch) {
          correlations.push({
            id: `corr-${jira.id}-${db.id}`,
            type: 'jira_to_db',
            strength: 'strong',
            description: `Jira ticket "${jira.summary}" deployed ${Math.round(hoursDiff * 60)} minutes before database change "${db.description}"`,
            relatedChangeIds: [jira.id, db.id],
          });
        } else if (hoursDiff < 0.5) {
          correlations.push({
            id: `corr-${jira.id}-${db.id}`,
            type: 'jira_to_db',
            strength: 'medium',
            description: `Jira deployment and database change occurred within 30 minutes of each other`,
            relatedChangeIds: [jira.id, db.id],
          });
        }
      }
    }

    for (const config of configChanges) {
      const configTime = new Date(config.timestamp).getTime();
      const timeDiff = Math.abs(jiraTime - configTime);
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      if (hoursDiff < 0.5) {
        correlations.push({
          id: `corr-${jira.id}-${config.id}`,
          type: 'multi',
          strength: 'medium',
          description: `Jira deployment and config change (${config.parameter}) occurred within 30 minutes`,
          relatedChangeIds: [jira.id, config.id],
        });
      }
    }
  }

  for (const db of databaseChanges) {
    if (db.changeType === 'schema') {
      for (const other of databaseChanges) {
        if (other.changeType === 'query_pattern' && db.table === other.table) {
          correlations.push({
            id: `corr-${db.id}-${other.id}`,
            type: 'query_to_schema',
            strength: 'strong',
            description: `Schema change on ${db.table} detected, followed by new query pattern on same table`,
            relatedChangeIds: [db.id, other.id],
          });
        }
      }
    }
  }

  return correlations;
}
