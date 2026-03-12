import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface CloudWatchLagPoint {
  timestamp: string;
  lagSeconds: number;
}

/**
 * Fetch ReplicaLag from CloudWatch for an RDS instance.
 * Uses AWS CLI with SSO credentials.
 */
export async function getCloudWatchLag(
  instanceId: string,
  region: string,
  profileName: string,
  since: string,
  until: string,
): Promise<CloudWatchLagPoint[]> {
  // Determine period: CloudWatch allows max 1440 datapoints per request, minimum 60s.
  // Calculate the minimum period to stay under the limit, then round up to a clean interval.
  const rangeMs = new Date(until).getTime() - new Date(since).getTime();
  const rangeSec = rangeMs / 1000;
  const rangeMins = rangeSec / 60;
  const minPeriodForLimit = Math.ceil(rangeSec / 1440); // ensure <= 1440 points
  // Round up to nearest multiple of 60 (CloudWatch requires period to be a multiple of 60)
  const minPeriod = Math.ceil(Math.max(60, minPeriodForLimit) / 60) * 60;
  // Pick the largest of: minimum required, and a density-based preference
  let period: number;
  if (rangeMins <= 360) period = Math.max(minPeriod, 60);       // <=6h  → 1-min resolution
  else if (rangeMins <= 1440) period = Math.max(minPeriod, 300); // <=24h → 5-min resolution
  else period = Math.max(minPeriod, 900);                        // >24h  → 15-min resolution

  const { stdout } = await execFileAsync('aws', [
    'cloudwatch', 'get-metric-statistics',
    '--namespace', 'AWS/RDS',
    '--metric-name', 'ReplicaLag',
    '--dimensions', `Name=DBInstanceIdentifier,Value=${instanceId}`,
    '--start-time', since,
    '--end-time', until,
    '--period', String(period),
    '--statistics', 'Average',
    '--region', region,
    '--profile', profileName,
    '--output', 'json',
  ], { timeout: 30_000 });

  const data = JSON.parse(stdout);

  const points: CloudWatchLagPoint[] = (data.Datapoints || []).map((p: any) => ({
    timestamp: new Date(p.Timestamp).toISOString(),
    lagSeconds: Math.round((p.Average || 0) * 10) / 10,
  }));

  // Sort by timestamp
  points.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return points;
}
