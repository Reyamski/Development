import express from 'express'
import cors from 'cors'
import colorizeRouter from './routes/colorize.js'
import healthRouter from './routes/health.js'

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: 'http://localhost:3000' }))
app.use(express.json())

// Static output files (colorized results)
app.use('/outputs', express.static('outputs'))

app.use('/api/colorize', colorizeRouter)
app.use('/api/health', healthRouter)

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
