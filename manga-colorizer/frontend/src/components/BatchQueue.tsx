import type { Job } from '../services/api'
import ImagePreview from './ImagePreview'

interface Props {
  jobs: Job[]
  originalUrls: Map<string, string>  // job.id → blob URL
  onClearCompleted: () => void
}

export default function BatchQueue({ jobs, originalUrls, onClearCompleted }: Props) {
  if (!jobs.length) return null

  const done = jobs.filter(j => j.status === 'done').length
  const errors = jobs.filter(j => j.status === 'error').length
  const active = jobs.filter(j => j.status === 'queued' || j.status === 'processing').length
  const canClear = done > 0 || errors > 0

  return (
    <div style={{ marginTop: '28px' }}>
      {/* Queue header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#ccc' }}>
            {jobs.length} image{jobs.length !== 1 ? 's' : ''}
          </h2>
          <span style={{ fontSize: '12px', color: '#555' }}>
            {done} done · {errors > 0 ? `${errors} failed · ` : ''}{active} in progress
          </span>
        </div>
        {canClear && (
          <button onClick={onClearCompleted} style={{
            fontSize: '11px',
            padding: '4px 10px',
            borderRadius: '6px',
            border: '1px solid #3a3a3a',
            background: 'transparent',
            color: '#666',
            cursor: 'pointer',
          }}>
            Clear completed
          </button>
        )}
      </div>

      {/* Progress bar */}
      {jobs.length > 1 && (
        <div style={{ height: '3px', background: '#2a2a2a', borderRadius: '2px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(done / jobs.length) * 100}%`,
            background: 'linear-gradient(90deg, #7c3aed, #3b82f6)',
            transition: 'width 0.4s ease',
            borderRadius: '2px',
          }} />
        </div>
      )}

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '12px',
      }}>
        {jobs.map(job => (
          <ImagePreview
            key={job.id}
            job={job}
            originalUrl={originalUrls.get(job.id)}
          />
        ))}
      </div>
    </div>
  )
}
