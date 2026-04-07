import { useState, useEffect, useCallback, useRef } from 'react'
import UploadZone from './components/UploadZone'
import BatchQueue from './components/BatchQueue'
import InferenceStatus from './components/InferenceStatus'
import { uploadSingle, uploadBatch, getJob, clearCompleted, type Job } from './services/api'

const POLL_INTERVAL = 2000

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [originalUrls, setOriginalUrls] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track blob URLs so we can revoke them on cleanup
  const blobRefs = useRef<Map<string, string>>(new Map())

  // Revoke blob URLs when jobs are cleared
  const revoke = useCallback((jobId: string) => {
    const url = blobRefs.current.get(jobId)
    if (url) {
      URL.revokeObjectURL(url)
      blobRefs.current.delete(jobId)
    }
  }, [])

  // Poll in-flight jobs
  useEffect(() => {
    const active = jobs.filter(j => j.status === 'queued' || j.status === 'processing')
    if (!active.length) return

    const timer = setInterval(async () => {
      const updated = await Promise.all(
        active.map(j => getJob(j.id).catch(() => j))
      )
      setJobs(prev => prev.map(j => updated.find(u => u.id === j.id) ?? j))
    }, POLL_INTERVAL)

    return () => clearInterval(timer)
  }, [jobs])

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      blobRefs.current.forEach(url => URL.revokeObjectURL(url))
    }
  }, [])

  const addOriginalUrls = useCallback((files: File[], jobIds: string[]) => {
    const updates = new Map<string, string>()
    files.forEach((file, i) => {
      const id = jobIds[i]
      if (!id) return
      const url = URL.createObjectURL(file)
      updates.set(id, url)
      blobRefs.current.set(id, url)
    })
    setOriginalUrls(prev => new Map([...prev, ...updates]))
  }, [])

  const handleUpload = useCallback(async (files: File[]) => {
    setError(null)
    setLoading(true)
    try {
      const newJobs = files.length === 1
        ? [await uploadSingle(files[0])]
        : await uploadBatch(files)

      addOriginalUrls(files, newJobs.map(j => j.id))
      setJobs(prev => [...newJobs, ...prev])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }, [addOriginalUrls])

  const handleClearCompleted = useCallback(async () => {
    try {
      const { deleted } = await clearCompleted()
      if (deleted === 0) return
      setJobs(prev => {
        const remaining = prev.filter(j => j.status !== 'done' && j.status !== 'error')
        prev.filter(j => j.status === 'done' || j.status === 'error').forEach(j => revoke(j.id))
        return remaining
      })
      setOriginalUrls(prev => {
        const next = new Map(prev)
        jobs.filter(j => j.status === 'done' || j.status === 'error').forEach(j => next.delete(j.id))
        return next
      })
    } catch {
      // non-critical
    }
  }, [jobs, revoke])

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px' }}>
        <header style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>
            Manga Colorizer
          </h1>
          <p style={{ color: '#555', marginTop: '4px', fontSize: '13px' }}>
            Upload manga panels — get them colorized automatically
          </p>
        </header>

        <InferenceStatus />

        <UploadZone onUpload={handleUpload} loading={loading} />

        {loading && (
          <p style={{ marginTop: '14px', color: '#7c3aed', fontSize: '13px' }}>
            Uploading...
          </p>
        )}

        {error && (
          <p style={{ marginTop: '14px', color: '#ef4444', fontSize: '13px' }}>
            {error}
          </p>
        )}

        <BatchQueue
          jobs={jobs}
          originalUrls={originalUrls}
          onClearCompleted={handleClearCompleted}
        />
      </div>
    </>
  )
}
