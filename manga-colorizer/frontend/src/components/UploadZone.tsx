import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'

interface Props {
  onUpload: (files: File[]) => void
  loading: boolean
}

const ACCEPTED = { 'image/png': [], 'image/jpeg': [], 'image/webp': [] }

export default function UploadZone({ onUpload, loading }: Props) {
  const [mode, setMode] = useState<'single' | 'batch'>('single')

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (!accepted.length) return
      const files = mode === 'single' ? [accepted[0]] : accepted
      onUpload(files)
    },
    [mode, onUpload]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: mode === 'batch',
    disabled: loading,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        {(['single', 'batch'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: mode === m ? '#7c3aed' : '#2a2a2a',
              color: '#fff',
              fontWeight: mode === m ? 600 : 400,
            }}
          >
            {m === 'single' ? 'Single' : 'Batch'}
          </button>
        ))}
      </div>

      <div
        {...getRootProps()}
        style={{
          border: `2px dashed ${isDragActive ? '#7c3aed' : '#3a3a3a'}`,
          borderRadius: '12px',
          padding: '48px 24px',
          textAlign: 'center',
          cursor: loading ? 'not-allowed' : 'pointer',
          background: isDragActive ? '#1a1030' : '#1a1a1a',
          transition: 'all 0.2s',
        }}
      >
        <input {...getInputProps()} />
        <p style={{ color: '#888', fontSize: '15px' }}>
          {isDragActive
            ? 'Drop it!'
            : mode === 'single'
            ? 'Drop a manga panel here, or click to select'
            : 'Drop multiple panels here, or click to select'}
        </p>
        <p style={{ color: '#555', fontSize: '12px', marginTop: '8px' }}>
          PNG, JPG, WEBP supported
        </p>
      </div>
    </div>
  )
}
