import { useState } from 'react'
import type { Job } from '../services/api'
import StatusBadge from './StatusBadge'

interface Props {
  job: Job
  originalUrl?: string // blob URL of the original file for compare view
}

type ViewMode = 'colorized' | 'original' | 'split'

export default function ImagePreview({ job, originalUrl }: Props) {
  const [view, setView] = useState<ViewMode>('colorized')
  const canCompare = job.status === 'done' && !!originalUrl

  const displayUrl =
    view === 'original' ? originalUrl
    : view === 'colorized' ? (job.outputUrl ? `${job.outputUrl}?t=${job.updatedAt}` : undefined)
    : undefined // split handled separately

  return (
    <div style={{
      background: '#1a1a1a',
      borderRadius: '10px',
      overflow: 'hidden',
      border: '1px solid #2a2a2a',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Image area */}
      <div style={{ position: 'relative', minHeight: '160px', background: '#111' }}>
        {view === 'split' && canCompare ? (
          <div style={{ display: 'flex', height: '100%' }}>
            <div style={{ flex: 1, overflow: 'hidden', borderRight: '2px solid #7c3aed' }}>
              <img src={originalUrl} alt="original"
                style={{ width: '100%', display: 'block', objectFit: 'contain', maxHeight: '280px' }} />
              <div style={{ position: 'absolute', top: 6, left: 6, fontSize: '10px',
                background: '#0009', color: '#aaa', padding: '2px 6px', borderRadius: '4px' }}>
                Original
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <img src={`${job.outputUrl}?t=${job.updatedAt}`} alt="colorized"
                style={{ width: '100%', display: 'block', objectFit: 'contain', maxHeight: '280px' }} />
              <div style={{ position: 'absolute', top: 6, right: 6, fontSize: '10px',
                background: '#7c3aed99', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>
                Colorized
              </div>
            </div>
          </div>
        ) : displayUrl ? (
          <img src={displayUrl} alt={job.filename}
            style={{ width: '100%', display: 'block', objectFit: 'contain', maxHeight: '280px' }} />
        ) : (
          <div style={{ height: '160px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#444', fontSize: '13px', gap: '8px' }}>
            {job.status === 'processing' ? (
              <>
                <span style={{ display: 'inline-block', width: '16px', height: '16px',
                  border: '2px solid #3b82f6', borderTopColor: 'transparent',
                  borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Colorizing...
              </>
            ) : job.status === 'queued' ? (
              'In queue...'
            ) : job.status === 'error' ? (
              <span style={{ color: '#ef4444' }}>Failed</span>
            ) : null}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#888', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
            {job.filename}
          </span>
          <StatusBadge status={job.status} />
        </div>

        {canCompare && (
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['colorized', 'original', 'split'] as ViewMode[]).map(m => (
              <button key={m} onClick={() => setView(m)} style={{
                flex: 1,
                padding: '3px 0',
                fontSize: '10px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                background: view === m ? '#7c3aed' : '#2a2a2a',
                color: view === m ? '#fff' : '#666',
                fontWeight: view === m ? 600 : 400,
                textTransform: 'capitalize',
              }}>
                {m}
              </button>
            ))}
          </div>
        )}

        {job.status === 'done' && job.outputUrl && (
          <a href={`${job.outputUrl}?t=${job.updatedAt}`} download={`colorized_${job.filename}`}
            style={{ fontSize: '11px', color: '#7c3aed', textDecoration: 'none' }}>
            Download PNG
          </a>
        )}

        {job.error && (
          <p style={{ fontSize: '11px', color: '#ef4444', wordBreak: 'break-word' }}>
            {job.error}
          </p>
        )}
      </div>
    </div>
  )
}
