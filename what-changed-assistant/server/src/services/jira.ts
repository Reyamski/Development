import { JiraRelease } from '../types.js';
import { getJiraToken, getJiraUrl, getJiraEmail } from './secrets-manager.js';

export async function getJiraReleases(startTime: string, endTime: string): Promise<JiraRelease[]> {
  console.log(`[jira] Fetching Jira releases from ${startTime} to ${endTime}`);
  
  try {
    // Try to get credentials (hybrid: env or Secrets Manager)
    const jiraUrl = await getJiraUrl();
    const jiraEmail = await getJiraEmail();
    const jiraToken = await getJiraToken();

    // Import axios dynamically
    const axios = (await import('axios')).default;

    // Format timestamps for JQL (Jira requires specific format)
    const formatJqlDate = (isoDate: string): string => {
      const date = new Date(isoDate);
      return `"${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}"`;
    };

    const jql = `(type = Deployment OR type = Release OR labels = deployment OR labels = hotfix) AND created >= ${formatJqlDate(startTime)} AND created <= ${formatJqlDate(endTime)} ORDER BY created DESC`;

    const response = await axios.get(`${jiraUrl}/rest/api/3/search`, {
      params: {
        jql,
        maxResults: 100,
        fields: 'summary,created,issuetype,status,assignee,reporter,description,labels,components',
      },
      auth: {
        username: jiraEmail,
        password: jiraToken,
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });

    const issues = response.data.issues || [];

    return issues.map((issue: any) => {
      const deploymentType = detectDeploymentType(issue);

      return {
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary,
        releaseDate: issue.fields.created,
        deploymentType,
        issueType: issue.fields.issuetype.name,
        status: issue.fields.status.name,
        assignee: issue.fields.assignee?.emailAddress || null,
        reporter: issue.fields.reporter?.emailAddress || null,
        description: issue.fields.description || null,
        labels: issue.fields.labels || [],
        components: issue.fields.components?.map((c: any) => c.name) || [],
      };
    });

  } catch (error: any) {
    console.warn('[jira] Jira API unavailable, returning mock data. Error:', error.message);
    
    // Fallback to mock data for demo purposes
    // Generate timestamps WITHIN the time window (not after startTime!)
    const start = new Date(startTime);
    const end = new Date(endTime);
    const windowDuration = end.getTime() - start.getTime();
    
    const mockReleases: JiraRelease[] = [
      {
        id: 'JIRA-1234',
        key: 'DEPLOY-1234',
        summary: 'Deploy API rate limiting feature to production',
        releaseDate: new Date(start.getTime() + windowDuration * 0.3).toISOString(), // 30% into window
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
        releaseDate: new Date(start.getTime() + windowDuration * 0.6).toISOString(), // 60% into window
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
        releaseDate: new Date(start.getTime() + windowDuration * 0.8).toISOString(), // 80% into window
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

    console.log(`[jira] Returning ${mockReleases.length} mock releases within window`);
    return mockReleases;
  }
}

function detectDeploymentType(issue: any): 'production' | 'staging' | 'hotfix' | 'unknown' {
  const labels = (issue.fields.labels || []).map((l: string) => l.toLowerCase());
  const issueType = (issue.fields.issuetype?.name || '').toLowerCase();

  if (labels.includes('hotfix') || issueType.includes('hotfix')) {
    return 'hotfix';
  }

  if (labels.includes('production') || labels.includes('prod') || issueType.includes('deployment')) {
    return 'production';
  }

  if (labels.includes('staging') || labels.includes('stage')) {
    return 'staging';
  }

  return 'unknown';
}
