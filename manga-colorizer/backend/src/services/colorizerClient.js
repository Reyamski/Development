import fetch from 'node-fetch'
import FormData from 'form-data'
import fs from 'fs'
import path from 'path'

const INFERENCE_URL = process.env.INFERENCE_URL || 'http://localhost:5000'
const TIMEOUT_MS = parseInt(process.env.INFERENCE_TIMEOUT_MS || '120000') // 2 min default

/**
 * Send a single image to the inference service and wait for the result.
 * @param {string} inputPath  - Absolute path to the uploaded image
 * @param {string} outputPath - Absolute path where colorized PNG should be saved
 * @param {object} options    - Optional params forwarded to inference service
 */
export async function colorizeImage(inputPath, outputPath, options = {}) {
  const {
    size = 576,
    denoise = true,
    denoiseSignma = 25,
  } = options

  const form = new FormData()
  form.append('image', fs.createReadStream(inputPath), {
    filename: path.basename(inputPath),
    contentType: 'image/png',
  })
  form.append('output_path', outputPath)
  form.append('size', String(size))
  form.append('denoise', String(denoise))
  form.append('denoise_sigma', String(denoiseSignma))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${INFERENCE_URL}/colorize`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Inference error ${res.status}: ${text}`)
    }

    return await res.json()
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Inference timed out after ${TIMEOUT_MS / 1000}s`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Check if the inference service is reachable and report its state.
 */
export async function pingInference() {
  try {
    const res = await fetch(`${INFERENCE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return { up: false }
    const data = await res.json()
    return { up: true, ...data }
  } catch {
    return { up: false }
  }
}
