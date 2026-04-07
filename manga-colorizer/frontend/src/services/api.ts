const BASE = '/api'

export type JobStatus = 'queued' | 'processing' | 'done' | 'error'

export interface Job {
  id: string
  filename: string
  status: JobStatus
  outputUrl?: string
  error?: string
  createdAt: string
  updatedAt: string
}

export interface QueueInfo {
  queued: number
  processing: boolean
  total: number
}

export interface HealthInfo {
  backend: string
  inference: string
  inferenceDetail?: {
    up: boolean
    colorizer_loaded?: boolean
    using_stub?: boolean
    weights?: { networks: boolean; denoiser: boolean }
  }
}

export async function uploadSingle(file: File): Promise<Job> {
  const form = new FormData()
  form.append('image', file)
  const res = await fetch(`${BASE}/colorize/single`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function uploadBatch(files: File[]): Promise<Job[]> {
  const form = new FormData()
  files.forEach(f => form.append('images', f))
  const res = await fetch(`${BASE}/colorize/batch`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getJob(id: string): Promise<Job> {
  const res = await fetch(`${BASE}/colorize/job/${id}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function listJobs(): Promise<Job[]> {
  const res = await fetch(`${BASE}/colorize/jobs`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function clearCompleted(): Promise<{ deleted: number }> {
  const res = await fetch(`${BASE}/colorize/jobs/completed`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getQueue(): Promise<QueueInfo> {
  const res = await fetch(`${BASE}/colorize/queue`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getHealth(): Promise<HealthInfo> {
  const res = await fetch(`${BASE}/health`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
