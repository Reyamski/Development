import { JiraRelease } from '../types.js';

export async function getJiraReleases(startTime: string, endTime: string): Promise<JiraRelease[]> {
  console.log(`Fetching Jira releases from ${startTime} to ${endTime}`);
  
  const start = new Date(startTime);
  const mockReleases: JiraRelease[] = [
    {
      id: 'JIRA-1234',
      key: 'DEPLOY-1234',
      summary: 'Deploy API rate limiting feature to production',
      releaseDate: new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      deploymentType: 'production',
      issueType: 'Deployment',
      status: 'Done',
      assignee: 'john.doe@company.com',
      reporter: 'jane.smith@company.com',
      description: 'Rolling out new rate limiting middleware to all API endpoints. Expected impact: reduced DB connection spikes.',
      labels: ['backend', 'api', 'rate-limiting'],
      components: ['API Gateway', 'Authentication'],
    },
    {
      id: 'JIRA-1235',
      key: 'HOTFIX-789',
      summary: 'Emergency patch for user session timeout',
      releaseDate: new Date(start.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      deploymentType: 'hotfix',
      issueType: 'Hotfix',
      status: 'Done',
      assignee: 'bob.wilson@company.com',
      reporter: 'alice.chen@company.com',
      description: 'Fixed critical bug causing premature session timeouts. Increased timeout from 30min to 2hrs.',
      labels: ['hotfix', 'critical', 'sessions'],
      components: ['User Service'],
    },
    {
      id: 'JIRA-1236',
      key: 'DEPLOY-1240',
      summary: 'Database schema migration for new analytics tables',
      releaseDate: new Date(start.getTime() + 5 * 60 * 60 * 1000).toISOString(),
      deploymentType: 'production',
      issueType: 'Migration',
      status: 'Done',
      assignee: 'dba.team@company.com',
      reporter: 'analytics.lead@company.com',
      description: 'Added 3 new analytics tables with indexes. Migration includes backfill of last 30 days of data.',
      labels: ['database', 'migration', 'analytics'],
      components: ['Database', 'Analytics'],
    },
  ];

  return mockReleases.filter(release => {
    const releaseTime = new Date(release.releaseDate);
    return releaseTime >= new Date(startTime) && releaseTime <= new Date(endTime);
  });
}
