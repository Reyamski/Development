import { ChangesSummary } from './types';

const API_BASE = '/api';

export async function fetchChangesSummary(
  incidentTime: string,
  lookbackHours: number
): Promise<ChangesSummary> {
  const response = await fetch(
    `${API_BASE}/changes/summary?incidentTime=${encodeURIComponent(incidentTime)}&lookbackHours=${lookbackHours}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch changes summary: ${response.statusText}`);
  }
  return response.json();
}
