import { useEffect, useState } from 'react'
import { getHealth, type HealthInfo } from '../services/api'

export default function InferenceStatus() {
  const [health, setHealth] = useState<HealthInfo | null>(null)

  useEffect(() => {
    const check = () => getHealth().then(setHealth).catch(() => setHealth(null))
    check()
    const t = setInterval(check, 10000)
    return () => clearInterval(t)
  }, [])

  if (!health) return null

  const inferenceUp = health.inference === 'ok'
  const detail = health.inferenceDetail
  const stubMode = detail?.using_stub === true
  const weightsOk = detail?.weights?.networks && detail?.weights?.denoiser

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      fontSize: '11px',
      color: '#555',
      marginBottom: '20px',
      flexWrap: 'wrap',
    }}>
      <Dot ok={inferenceUp} label={inferenceUp ? 'Inference online' : 'Inference offline'} />
      {inferenceUp && stubMode && (
        <Dot ok={false} label="Stub mode — no weights loaded" warn />
      )}
      {inferenceUp && !stubMode && weightsOk && (
        <Dot ok={true} label="Model weights loaded" />
      )}
      {inferenceUp && !stubMode && !weightsOk && (
        <Dot ok={false} label="Weights missing" warn />
      )}
    </div>
  )
}

function Dot({ ok, label, warn }: { ok: boolean; label: string; warn?: boolean }) {
  const color = warn ? '#f59e0b' : ok ? '#22c55e' : '#ef4444'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}
