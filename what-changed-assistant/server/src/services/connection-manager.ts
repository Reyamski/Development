import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let activeTunnels: Map<string, any> = new Map();

export async function closeAllConnections() {
  console.log('Closing all active connections...');
  for (const [key, tunnel] of activeTunnels) {
    try {
      if (tunnel.process) {
        tunnel.process.kill();
      }
    } catch (err) {
      console.error(`Failed to close tunnel ${key}:`, err);
    }
  }
  activeTunnels.clear();
}

export function registerTunnel(key: string, tunnel: any) {
  activeTunnels.set(key, tunnel);
}

export function unregisterTunnel(key: string) {
  activeTunnels.delete(key);
}
