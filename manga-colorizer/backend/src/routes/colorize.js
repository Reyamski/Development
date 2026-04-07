import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { upload } from '../services/uploadService.js'
import { colorizeImage } from '../services/colorizerClient.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.resolve(__dirname, '../../outputs')

const router = Router()

// In-memory job store — swap for SQLite (better-sqlite3) when persisting across restarts
const jobs = new Map()

// Concurrency guard — only one colorization at a time to avoid OOM on the GPU
let processing = false
const queue = []

function makeJob(file) {
  return {
    id: uuidv4(),
    filename: file.originalname,
    status: 'queued',
    outputUrl: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function touch(job, patch) {
  Object.assign(job, patch, { updatedAt: new Date().toISOString() })
}

function cleanupUpload(filePath) {
  fs.unlink(filePath, () => {}) // best-effort, ignore errors
}

async function runNext() {
  if (processing || queue.length === 0) return
  processing = true

  const { job, inputPath } = queue.shift()
  touch(job, { status: 'processing' })

  const outputPath = path.join(OUTPUT_DIR, `${job.id}.png`)

  try {
    await colorizeImage(inputPath, outputPath)
    touch(job, { status: 'done', outputUrl: `/outputs/${job.id}.png` })
  } catch (err) {
    touch(job, { status: 'error', error: err.message })
  } finally {
    cleanupUpload(inputPath)
    processing = false
    runNext() // process next in queue
  }
}

function enqueue(job, file) {
  jobs.set(job.id, job)
  queue.push({ job, inputPath: file.path })
  runNext()
}

// POST /api/colorize/single
router.post('/single', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image provided' })
  const job = makeJob(req.file)
  enqueue(job, req.file)
  res.status(202).json(job)
})

// POST /api/colorize/batch
router.post('/batch', upload.array('images', 50), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No images provided' })

  const newJobs = req.files.map(file => {
    const job = makeJob(file)
    enqueue(job, file)
    return job
  })

  res.status(202).json(newJobs)
})

// GET /api/colorize/job/:id
router.get('/job/:id', (req, res) => {
  const job = jobs.get(req.params.id)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  res.json(job)
})

// GET /api/colorize/jobs
router.get('/jobs', (_req, res) => {
  res.json([...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
})

// DELETE /api/colorize/jobs/completed — clear finished jobs and their output files
router.delete('/jobs/completed', (_req, res) => {
  const toDelete = [...jobs.values()].filter(j => j.status === 'done' || j.status === 'error')
  for (const job of toDelete) {
    if (job.outputUrl) {
      const filePath = path.join(OUTPUT_DIR, `${job.id}.png`)
      fs.unlink(filePath, () => {})
    }
    jobs.delete(job.id)
  }
  res.json({ deleted: toDelete.length })
})

// GET /api/colorize/queue — queue depth info
router.get('/queue', (_req, res) => {
  res.json({
    queued: queue.length,
    processing,
    total: jobs.size,
  })
})

export default router
