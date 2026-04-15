import fs from 'fs'
import path from 'path'
import express from 'express'
import cors from 'cors'
import teleportRouter from './routes/teleport.js'
import auditRouter from './routes/audit.js'
import grantsRouter from './routes/grants.js'
import reportRouter from './routes/report.js'
import { cleanupAll } from './shared/teleport.js'

function loadEnvFile() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env'),
  ]

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue

    const content = fs.readFileSync(filePath, 'utf8')
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue

      const separatorIndex = line.indexOf('=')
      if (separatorIndex === -1) continue

      const key = line.slice(0, separatorIndex).trim()
      let value = line.slice(separatorIndex + 1).trim()

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      if (!(key in process.env)) {
        process.env[key] = value
      }
    }

    return
  }
}

loadEnvFile()

const app = express()
const PORT = process.env.PORT || 3012

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'rogue-user-watchdog' })
})

app.use('/api/teleport', teleportRouter)
app.use('/api/rogue-user-watchdog/audit', auditRouter)
app.use('/api/rogue-user-watchdog/grants', grantsRouter)
app.use('/api/rogue-user-watchdog/report', reportRouter)

app.listen(PORT, () => {
  console.log(`Rogue User Watchdog server running on http://localhost:${PORT}`)
})

async function shutdown(signal: string) {
  console.log(`\n[${signal}] Cleaning up tunnels...`)
  await cleanupAll()
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
