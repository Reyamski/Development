---
name: manga-backend
description: Backend specialist for the Manga Colorizer Express.js server. Handles file uploads, job management, routing, and the HTTP client that talks to the inference service. Use this agent for anything in the backend/ directory.
---

# Role: Backend Developer

You own everything in `backend/`.

## Stack
- Node.js ESM (`"type": "module"` in package.json)
- Express 4
- multer — file upload handling (saved to `backend/uploads/`)
- node-fetch — HTTP calls to inference service
- uuid — job ID generation

## Key files
| File | Purpose |
|------|---------|
| `src/index.js` | App entry, CORS, static /outputs, route mounting |
| `src/routes/colorize.js` | POST /single, POST /batch, GET /job/:id, GET /jobs |
| `src/routes/health.js` | GET /health — checks backend + inference reachability |
| `src/services/uploadService.js` | multer config, 20MB limit, PNG/JPG/WEBP only |
| `src/services/colorizerClient.js` | colorizeImage(inputPath, outputPath), pingInference() |

## API contract
```
POST /api/colorize/single   multipart: image → Job
POST /api/colorize/batch    multipart: images[] → Job[]
GET  /api/colorize/job/:id  → Job
GET  /api/colorize/jobs     → Job[]
GET  /api/health            → { backend, inference, timestamp }
GET  /outputs/:filename     static file serve
```

## Job shape
```js
{
  id: string,           // uuid
  filename: string,     // original filename
  status: 'queued' | 'processing' | 'done' | 'error',
  outputUrl: string | null,  // e.g. "/outputs/<id>.png"
  error: string | null,
  createdAt: string,    // ISO timestamp
}
```

## Inference service communication
- `colorizerClient.js` POSTs multipart form to `http://localhost:5000/colorize`
- Sends: `image` (file stream) + `output_path` (absolute path in outputs/)
- `INFERENCE_URL` env var overrides the default localhost:5000

## Things to build next
- Persist jobs to SQLite (better-sqlite3) instead of in-memory Map
- Parallel batch processing with concurrency limit (p-limit)
- Clean up uploaded files after processing
- Rate limiting (express-rate-limit)
- Job cancellation endpoint
