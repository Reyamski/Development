import { execFile } from 'child_process';
import { promisify } from 'util';
import { ConfigChange, RdsParameterChange } from '../types.js';
import { getAwsProfile } from './aws-rds.js';

const execFileAsync = promisify(execFile);

export async function getConfigChanges(
  startTime: string,
  endTime: string,
  accountId?: string,
  region?: string,
  parameterGroupName?: string
): Promise<ConfigChange[]> {
  console.log(`[config] Fetching config changes from ${startTime} to ${endTime}`);
  
  const changes: ConfigChange[] = [];

  try {
    // For now, return empty array
    // In production, this would query:
    // 1. RDS parameter changes (via getRdsParameterChanges)
    // 2. Feature flags (LaunchDarkly API, etc.)
    // 3. Environment variables (from config management system)
    
    // Note: Without a specific RDS instance, we can't query parameters yet
    // This will be populated when user selects a DB instance in the UI
    
  } catch (error: any) {
    console.error('[config] Error fetching config changes:', error.message);
  }

  // Return empty for now - will be populated via specific endpoints
  return changes;
}

/**
 * Get RDS parameter changes for a specific instance.
 * Hybrid approach: current state + CloudTrail events if available.
 */
export async function getRdsParameterChanges(
  dbInstanceId: string,
  accountId: string,
  region: string,
  startTime: string,
  endTime: string
): Promise<RdsParameterChange[]> {
  console.log(`[config] Fetching RDS parameter changes for ${dbInstanceId}`);
  
  try {
    const profileName = await getAwsProfile(accountId, region);

    // Step 1: Get current parameter group name
    const { stdout: instanceInfo } = await execFileAsync('aws', [
      'rds', 'describe-db-instances',
      '--db-instance-identifier', dbInstanceId,
      '--region', region,
      '--profile', profileName,
      '--query', 'DBInstances[0].DBParameterGroups[0].DBParameterGroupName',
      '--output', 'text',
    ], { timeout: 15_000 });

    const paramGroupName = instanceInfo.trim();
    if (!paramGroupName || paramGroupName === 'None') {
      console.warn('[config] No parameter group found');
      return [];
    }

    // Step 2: Get user-modified parameters (source=user means DBA changed it)
    const { stdout } = await execFileAsync('aws', [
      'rds', 'describe-db-parameters',
      '--db-parameter-group-name', paramGroupName,
      '--source', 'user',
      '--region', region,
      '--profile', profileName,
      '--output', 'json',
    ], { timeout: 30_000 });

    const data = JSON.parse(stdout);
    const parameters = data.Parameters || [];

    // Step 3: Try to get CloudTrail events for parameter modifications (best effort)
    let cloudTrailChanges: any[] = [];
    try {
      const { stdout: eventsJson } = await execFileAsync('aws', [
        'cloudtrail', 'lookup-events',
        '--lookup-attributes', 'AttributeKey=EventName,AttributeValue=ModifyDBParameterGroup',
        '--start-time', startTime,
        '--end-time', endTime,
        '--region', region,
        '--profile', profileName,
        '--output', 'json',
      ], { timeout: 30_000 });

      const eventsData = JSON.parse(eventsJson);
      cloudTrailChanges = eventsData.Events || [];
    } catch (cloudTrailError: any) {
      console.warn('[config] CloudTrail query failed (continuing with current state only):', cloudTrailError.message);
    }

    // Step 4: Map parameters to ConfigChange format
    const changes: RdsParameterChange[] = parameters.map((param: any) => {
      // Try to find matching CloudTrail event for this parameter
      const relatedEvent = cloudTrailChanges.find((event: any) => {
        try {
          const cloudTrailEvent = JSON.parse(event.CloudTrailEvent || '{}');
          const requestParams = cloudTrailEvent.requestParameters || {};
          return requestParams.dBParameterGroupName === paramGroupName;
        } catch {
          return false;
        }
      });

      const modifiedDate = relatedEvent ? relatedEvent.EventTime : new Date().toISOString();

      return {
        parameterName: param.ParameterName,
        oldValue: null, // AWS doesn't provide old values easily
        newValue: param.ParameterValue,
        applyType: param.ApplyMethod === 'pending-reboot' ? 'PENDING_REBOOT' : 'IMMEDIATE',
        modifiedDate,
      };
    });

    return changes;

  } catch (error: any) {
    console.error('[config] Error fetching RDS parameters:', error.message);
    return [];
  }
}
