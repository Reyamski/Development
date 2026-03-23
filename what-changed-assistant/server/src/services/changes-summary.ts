import { ChangesSummary, TimeWindow } from '../types.js';
import { getJiraReleases } from './jira.js';
import { getDatabaseChanges } from './database.js';
import { getConfigChanges } from './config.js';
import { detectCorrelations } from './correlations.js';
import { assessAllRisks } from './risk-detector.js';

export async function getSummary(
  incidentTime: string,
  lookbackHours: number
): Promise<ChangesSummary> {
  const incidentDate = new Date(incidentTime);
  const startDate = new Date(incidentDate.getTime() - lookbackHours * 60 * 60 * 1000);

  const timeWindow: TimeWindow = {
    incidentTime,
    lookbackHours,
    startTime: startDate.toISOString(),
    endTime: incidentDate.toISOString(),
  };

  const [jiraChanges, databaseChanges, configChanges] = await Promise.all([
    getJiraReleases(timeWindow.startTime, timeWindow.endTime),
    getDatabaseChanges('prod-db-primary', timeWindow.startTime, timeWindow.endTime),
    getConfigChanges(timeWindow.startTime, timeWindow.endTime),
  ]);

  // Apply risk assessment to all changes
  const riskyChanges = assessAllRisks(jiraChanges, databaseChanges, configChanges);

  const correlations = detectCorrelations(
    riskyChanges.jiraChanges,
    riskyChanges.databaseChanges,
    riskyChanges.configChanges
  );

  return {
    timeWindow,
    jiraChanges: riskyChanges.jiraChanges,
    databaseChanges: riskyChanges.databaseChanges,
    configChanges: riskyChanges.configChanges,
    correlations,
  };
}
