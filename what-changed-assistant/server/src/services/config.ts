import { ConfigChange, RdsParameterChange } from '../types.js';

export async function getConfigChanges(
  startTime: string,
  endTime: string
): Promise<ConfigChange[]> {
  console.log(`Fetching config changes from ${startTime} to ${endTime}`);
  
  const start = new Date(startTime);
  const mockChanges: ConfigChange[] = [
    {
      id: 'config-1',
      timestamp: new Date(start.getTime() + 1 * 60 * 60 * 1000).toISOString(),
      changeType: 'parameter',
      source: 'RDS Parameter Group',
      parameter: 'max_connections',
      oldValue: '500',
      newValue: '1000',
      appliedBy: 'dba.team@company.com',
      requiresReboot: true,
    },
    {
      id: 'config-2',
      timestamp: new Date(start.getTime() + 2.5 * 60 * 60 * 1000).toISOString(),
      changeType: 'feature_flag',
      source: 'LaunchDarkly',
      parameter: 'enable_api_rate_limiting',
      oldValue: 'false',
      newValue: 'true',
      appliedBy: 'backend.team@company.com',
      requiresReboot: false,
    },
    {
      id: 'config-3',
      timestamp: new Date(start.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      changeType: 'parameter',
      source: 'RDS Parameter Group',
      parameter: 'innodb_buffer_pool_size',
      oldValue: '8G',
      newValue: '12G',
      appliedBy: 'dba.team@company.com',
      requiresReboot: true,
    },
  ];

  return mockChanges.filter(change => {
    const changeTime = new Date(change.timestamp);
    return changeTime >= new Date(startTime) && changeTime <= new Date(endTime);
  });
}

export async function getRdsParameterChanges(
  dbInstance: string,
  startTime: string,
  endTime: string
): Promise<RdsParameterChange[]> {
  console.log(`Fetching RDS parameter changes for ${dbInstance}`);
  
  const start = new Date(startTime);
  const mockParams: RdsParameterChange[] = [
    {
      parameterName: 'max_connections',
      oldValue: '500',
      newValue: '1000',
      applyType: 'PENDING_REBOOT',
      modifiedDate: new Date(start.getTime() + 1 * 60 * 60 * 1000).toISOString(),
    },
    {
      parameterName: 'innodb_buffer_pool_size',
      oldValue: '{DBInstanceClassMemory*3/4}',
      newValue: '{DBInstanceClassMemory*7/8}',
      applyType: 'PENDING_REBOOT',
      modifiedDate: new Date(start.getTime() + 4 * 60 * 60 * 1000).toISOString(),
    },
  ];

  return mockParams;
}
