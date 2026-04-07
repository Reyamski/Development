import type { JobStatus } from '../services/api'

const CONFIG: Record<JobStatus, { color: string; label: string }> = {
  queued:     { color: '#f59e0b', label: 'Queued' },
  processing: { color: '#3b82f6', label: 'Processing' },
  done:       { color: '#22c55e', label: 'Done' },
  error:      { color: '#ef4444', label: 'Error' },
}

export default function StatusBadge({ status }: { status: JobStatus }) {
  const { color, label } = CONFIG[status]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '2px 10px',
      borderRadius: '99px',
      fontSize: '11px',
      fontWeight: 600,
      background: color + '22',
      color,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      whiteSpace: 'nowrap',
    }}>
      {status === 'processing' && (
        <span style={{
          display: 'inline-block',
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: color,
          animation: 'pulse 1s ease-in-out infinite',
        }} />
      )}
      {label}
    </span>
  )
}
