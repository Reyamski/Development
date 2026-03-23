import { JiraRelease, DatabaseChange, ConfigChange, RiskAssessment, RiskFlag } from '../types.js';

/**
 * Risk Detection Service
 * Analyzes changes and assigns risk scores based on patterns and rules.
 */

const BUSINESS_HOURS_START = 8; // 8 AM
const BUSINESS_HOURS_END = 18; // 6 PM
const COLLISION_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const HIGH_IMPACT_TABLES = [
  'users', 'accounts', 'transactions', 'payments', 'orders',
  'customers', 'subscriptions', 'invoices', 'billing'
];

const CRITICAL_PARAMETERS = [
  'max_connections', 'innodb_buffer_pool_size', 'query_cache_size',
  'max_allowed_packet', 'thread_cache_size'
];

function calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function isOffHours(timestamp: string): boolean {
  const date = new Date(timestamp);
  const hour = date.getHours();
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Weekend or outside business hours
  return day === 0 || day === 6 || hour < BUSINESS_HOURS_START || hour >= BUSINESS_HOURS_END;
}

/**
 * Assess risk for Jira releases/deployments
 */
export function assessJiraRisk(
  release: JiraRelease,
  allReleases: JiraRelease[]
): RiskAssessment {
  let score = 0;
  const reasons: string[] = [];
  const flags: RiskFlag[] = [];

  // Rule 1: Hotfix deployments are inherently risky (rushed, less tested)
  if (release.deploymentType === 'hotfix') {
    score += 30;
    reasons.push('Hotfix deployment (potentially rushed)');
  }

  // Rule 2: Off-hours deployment (less support available)
  if (isOffHours(release.releaseDate)) {
    score += 20;
    flags.push('off_hours');
    reasons.push('Deployed outside business hours');
  }

  // Rule 3: No approval labels
  const hasApproval = release.labels.some(l => 
    l.toLowerCase().includes('approved') || 
    l.toLowerCase().includes('reviewed')
  );
  if (!hasApproval && release.deploymentType === 'production') {
    score += 25;
    flags.push('no_approval');
    reasons.push('Production deployment without approval label');
  }

  // Rule 4: Missing critical labels
  const hasRollback = release.labels.some(l => l.toLowerCase().includes('rollback'));
  if (!hasRollback && release.deploymentType === 'production') {
    score += 15;
    flags.push('missing_rollback');
    reasons.push('No rollback plan mentioned');
  }

  // Rule 5: Collision risk - multiple deployments within 1 hour
  const releaseTime = new Date(release.releaseDate).getTime();
  const nearbyReleases = allReleases.filter(r => {
    if (r.id === release.id) return false;
    const otherTime = new Date(r.releaseDate).getTime();
    return Math.abs(releaseTime - otherTime) <= COLLISION_WINDOW_MS;
  });

  if (nearbyReleases.length > 0) {
    score += 20;
    flags.push('collision_risk');
    reasons.push(`${nearbyReleases.length} other deployment(s) within 1 hour`);
  }

  // Rule 6: Direct to production (not staged)
  if (release.deploymentType === 'production' && 
      !release.labels.some(l => l.toLowerCase().includes('staging') || l.toLowerCase().includes('tested'))) {
    score += 15;
    flags.push('production_direct');
    reasons.push('Direct to production without staging mention');
  }

  return {
    score: Math.min(100, score),
    level: calculateRiskLevel(score),
    reasons,
    flags,
  };
}

/**
 * Assess risk for database changes
 */
export function assessDatabaseRisk(
  change: DatabaseChange,
  allJiraReleases: JiraRelease[]
): RiskAssessment {
  let score = 0;
  const reasons: string[] = [];
  const flags: RiskFlag[] = [];

  // Rule 1: Schema changes without matching Jira ticket
  if (change.changeType === 'schema' || change.changeType === 'migration') {
    const changeTime = new Date(change.timestamp).getTime();
    const matchingJira = allJiraReleases.find(jira => {
      const jiraTime = new Date(jira.releaseDate).getTime();
      const timeDiff = Math.abs(changeTime - jiraTime);
      const isMigration = jira.labels.some(l => 
        l.toLowerCase().includes('migration') || 
        l.toLowerCase().includes('schema') ||
        l.toLowerCase().includes('database')
      );
      return timeDiff <= COLLISION_WINDOW_MS && isMigration;
    });

    if (!matchingJira) {
      score += 40;
      flags.push('no_jira_ticket');
      reasons.push('Schema change without matching Jira deployment ticket');
    }
  }

  // Rule 2: High-impact table modifications
  if (change.table && HIGH_IMPACT_TABLES.includes(change.table.toLowerCase())) {
    score += 25;
    flags.push('high_impact_table');
    reasons.push(`Critical table affected: ${change.table}`);
  }

  // Rule 3: DROP operations are always high risk
  if (change.details?.changeType === 'DROP') {
    score += 50;
    flags.push('breaking_change');
    reasons.push('DROP operation (potentially destructive)');
  }

  // Rule 4: Off-hours changes
  if (isOffHours(change.timestamp)) {
    score += 15;
    flags.push('off_hours');
    reasons.push('Database change outside business hours');
  }

  // Rule 5: New query patterns with high execution count
  if (change.changeType === 'query_pattern' && change.details?.executionCount > 10000) {
    score += 20;
    flags.push('production_direct');
    reasons.push(`High-volume new query: ${change.details.executionCount} executions`);
  }

  // Rule 6: High severity already flagged
  if (change.severity === 'high') {
    score += 15;
    reasons.push('Flagged as high severity');
  }

  return {
    score: Math.min(100, score),
    level: calculateRiskLevel(score),
    reasons,
    flags,
  };
}

/**
 * Assess risk for config changes
 */
export function assessConfigRisk(
  change: ConfigChange,
  allJiraReleases: JiraRelease[]
): RiskAssessment {
  let score = 0;
  const reasons: string[] = [];
  const flags: RiskFlag[] = [];

  // Rule 1: Config change without matching Jira ticket
  const changeTime = new Date(change.timestamp).getTime();
  const matchingJira = allJiraReleases.find(jira => {
    const jiraTime = new Date(jira.releaseDate).getTime();
    const timeDiff = Math.abs(changeTime - jiraTime);
    const isConfigRelated = jira.labels.some(l => 
      l.toLowerCase().includes('config') || 
      l.toLowerCase().includes('parameter') ||
      l.toLowerCase().includes('settings')
    );
    return timeDiff <= COLLISION_WINDOW_MS && isConfigRelated;
  });

  if (!matchingJira && change.source.toLowerCase().includes('prod')) {
    score += 35;
    flags.push('no_jira_ticket');
    reasons.push('Production config change without matching ticket');
  }

  // Rule 2: Critical parameter changes
  if (CRITICAL_PARAMETERS.some(param => change.parameter.toLowerCase().includes(param.toLowerCase()))) {
    score += 30;
    flags.push('high_impact_table');
    reasons.push(`Critical parameter modified: ${change.parameter}`);
  }

  // Rule 3: Requires restart/reboot
  if (change.requiresReboot) {
    score += 25;
    reasons.push('Change requires database restart');
  }

  // Rule 4: Off-hours changes
  if (isOffHours(change.timestamp)) {
    score += 15;
    flags.push('off_hours');
    reasons.push('Config change outside business hours');
  }

  // Rule 5: No "appliedBy" (unknown who made the change)
  if (!change.appliedBy) {
    score += 20;
    flags.push('no_approval');
    reasons.push('Change author unknown');
  }

  return {
    score: Math.min(100, score),
    level: calculateRiskLevel(score),
    reasons,
    flags,
  };
}

/**
 * Apply risk assessment to all changes
 */
export function assessAllRisks(
  jiraChanges: JiraRelease[],
  databaseChanges: DatabaseChange[],
  configChanges: ConfigChange[]
): {
  jiraChanges: JiraRelease[];
  databaseChanges: DatabaseChange[];
  configChanges: ConfigChange[];
} {
  // Assess Jira risks
  const assessedJira = jiraChanges.map(jira => ({
    ...jira,
    risk: assessJiraRisk(jira, jiraChanges),
  }));

  // Assess Database risks
  const assessedDatabase = databaseChanges.map(db => ({
    ...db,
    risk: assessDatabaseRisk(db, jiraChanges),
  }));

  // Assess Config risks
  const assessedConfig = configChanges.map(config => ({
    ...config,
    risk: assessConfigRisk(config, jiraChanges),
  }));

  return {
    jiraChanges: assessedJira,
    databaseChanges: assessedDatabase,
    configChanges: assessedConfig,
  };
}
