# Manga Colorizer — Handover Document

> **For the next AI or developer picking this up.**
> Read this fully before touching any code.

---

## What this project is

A web app where users upload manga panels (single or batch) and receive colorized versions automatically.

**Colorization engine:** [manga-colorization-v2](https://github.com/qweasdd/manga-colorization-v2) by qweasdd — a two-stage `Generator + Denoiser` model. The generator colorizes; FFDNet denoises the input first for better results.

---

## Architecture

```
Browser (React + Vite)  :3000
    │  HTTP  /api/*  (proxied by Vite in dev)
    ▼
Express.js backend      :4000
    │  HTTP  /colorize  (node-fetch)
    ▼
Flask inference service :5000
    │  Python call
    ▼
MangaColorizator (colorizator.py from manga-colorization-v2)
```

**Rules:**
- No subprocess calls anywhere
- No Docker
- Each layer talks to the next via HTTP only
- Backend holds a concurrency lock — only 1 colorization at a time (GPU memory safety)

---

## Directory structure

```
manga-colorizer/
├── frontend/                        # React 18 + Vite + TypeScript
│   ├── src/
│   │   ├── App.tsx                  # Shell: job state, polling, blob URL lifecycle
│   │   ├── index.css                # Base reset + dark theme
│   │   ├── main.tsx                 # React entry
│   │   ├── services/
│   │   │   └── api.ts               # Typed API client (all fetch calls here)
│   │   └── components/
│   │       ├── UploadZone.tsx       # Drag-and-drop, single/batch mode toggle
│   │       ├── BatchQueue.tsx       # Grid + progress bar + clear button
│   │       ├── ImagePreview.tsx     # Per-job card: compare view, download
│   │       ├── StatusBadge.tsx      # Animated status pill
│   │       └── InferenceStatus.tsx  # Live health indicator (polls /api/health)
│   ├── vite.config.ts               # /api proxied to :4000
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                         # Express.js (ESM)
│   ├── src/
│   │   ├── index.js                 # Entry: CORS, static /outputs, route mounting
│   │   ├── routes/
│   │   │   ├── colorize.js          # Upload, job queue, job CRUD
│   │   │   └── health.js            # Health check (backend + inference)
│   │   └── services/
│   │       ├── uploadService.js     # multer: 20MB limit, PNG/JPG/WEBP
│   │       └── colorizerClient.js   # HTTP client to Flask :5000, 2-min timeout
│   ├── uploads/                     # Temp upload storage — deleted after processing
│   ├── outputs/                     # Colorized PNG files served statically
│   └── package.json
│
├── inference/                       # Python Flask
│   ├── app.py                       # Flask server: /health + /colorize
│   ├── colorizator_stub.py          # STUB: mirrors real API, returns image unchanged
│   ├── networks/                    # Model weights (gitignored — download separately)
│   └── requirements.txt
│
└── agents/                          # AI team (load in Claude Code)
    ├── manga-pm.md                  # Project manager / architect
    ├── manga-frontend.md            # React specialist
    ├── manga-backend.md             # Express specialist
    └── manga-ml-engineer.md        # ML / inference specialist
```

---

## Build status

| Layer | Status | Blocking? |
|-------|--------|-----------|
| Frontend scaffold | Complete | npm install needed |
| Backend scaffold | Complete | npm install needed |
| Inference Flask app | Complete | pip install + weights needed |
| Model weights | Not downloaded | YES — needed for real colorization |
| Stub mode | Working | Passes images through unchanged |
| Job persistence | In-memory Map | Resets on restart — add SQLite later |

---

## How to run (first time — GPU machine)

### Step 1 — Install dependencies

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install

# Inference (Python 3.10 recommended)
cd ../inference
pip install -r requirements.txt
```

### Step 2 — Get model source files

Clone manga-colorization-v2 and copy these into `inference/`:

```bash
git clone https://github.com/qweasdd/manga-colorization-v2 /tmp/mcv2

# Copy source modules
cp /tmp/mcv2/colorizator.py inference/
cp -r /tmp/mcv2/networks    inference/
cp -r /tmp/mcv2/denoising   inference/
cp -r /tmp/mcv2/utils       inference/
```

### Step 3 — Download model weights

From the links in the manga-colorization-v2 README (Google Drive):

```
inference/networks/generator.zip    ← Generator weights
inference/networks/extractor.pth    ← SEResNeXt extractor
inference/denoising/models/net_rgb.pth  ← FFDNet denoiser
```

### Step 4 — Start all three services

```bash
# Terminal 1
cd inference && python app.py

# Terminal 2
cd backend && npm run dev

# Terminal 3
cd frontend && npm run dev
```

Open **http://localhost:3000**

---

## API reference

### Backend (Express :4000)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | /api/colorize/single | multipart: `image` | `Job` |
| POST | /api/colorize/batch | multipart: `images[]` (max 50) | `Job[]` |
| GET | /api/colorize/job/:id | — | `Job` |
| GET | /api/colorize/jobs | — | `Job[]` |
| DELETE | /api/colorize/jobs/completed | — | `{ deleted: number }` |
| GET | /api/colorize/queue | — | `{ queued, processing, total }` |
| GET | /api/health | — | `{ backend, inference, inferenceDetail }` |
| GET | /outputs/:filename | — | PNG file |

### Job object

```ts
{
  id: string           // uuid v4
  filename: string     // original upload filename
  status: 'queued' | 'processing' | 'done' | 'error'
  outputUrl: string | null   // "/outputs/<id>.png" when done
  error: string | null       // error message when status === 'error'
  createdAt: string          // ISO 8601
  updatedAt: string          // ISO 8601 (updated on every status change)
}
```

### Inference service (Flask :5000)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | /health | — | `{ status, colorizer_loaded, using_stub, weights }` |
| POST | /colorize | multipart: `image`, `output_path`, `size?`, `denoise?`, `denoise_sigma?` | `{ output_path, status, stub }` |

**Colorize params:**

| Param | Default | Notes |
|-------|---------|-------|
| `size` | 576 | Must be divisible by 32. Higher = better quality, more VRAM |
| `denoise` | true | Apply FFDNet before colorizing |
| `denoise_sigma` | 25 | Denoiser strength (10–50 range) |

---

## Real MangaColorizator API (important)

The class from manga-colorization-v2 uses a **two-call pattern** — NOT a single `colorize(image)` call:

```python
from colorizator import MangaColorizator

colorizer = MangaColorizator(device='cuda',
                             generator_path='networks/generator.zip',
                             extractor_path='networks/extractor.pth')

# Step 1: preprocess + load into GPU
colorizer.set_image(numpy_image_float32,   # shape (H, W, 3), values 0-1
                    size=576,
                    apply_denoise=True,
                    denoise_sigma=25)

# Step 2: run inference
result = colorizer.colorize()  # returns numpy float32 (H, W, 3), values 0-1
```

`inference/app.py` implements this correctly. `colorizator_stub.py` mirrors the same interface.

---

## Environment variables

| Variable | Service | Default | Description |
|----------|---------|---------|-------------|
| `PORT` | backend | `4000` | Express port |
| `INFERENCE_URL` | backend | `http://localhost:5000` | Flask service URL |
| `INFERENCE_TIMEOUT_MS` | backend | `120000` | Per-request timeout (ms) |
| `PORT` | inference | `5000` | Flask port |
| `DEVICE` | inference | `cuda` | `cuda` or `cpu` |

---

## What to build next (priority order)

1. **SQLite job persistence** — `better-sqlite3` in backend; jobs survive restarts
2. **Side-by-side compare slider** — drag-to-reveal instead of toggle buttons in ImagePreview
3. **File cleanup** — purge `uploads/` and old `outputs/` on a schedule
4. **Batch GPU optimization** — send multiple images per inference call for throughput
5. **Rate limiting** — `express-rate-limit` on upload endpoints
6. **Auth** — API key or session if exposed publicly
7. **Mobile layout** — BatchQueue grid needs breakpoint adjustments at < 480px

---

## Known limitations

- **Job store is in-memory** — all jobs lost on backend restart
- **Sequential batch** — images colorized one at a time (safe for GPU memory, slow for large batches)
- **Upload files not cleaned up on error** — cleanup only happens on success path
- **No retry logic** — errored jobs must be re-uploaded manually
- **Python 3.12 on dev laptop** — manga-colorization-v2 tested on 3.10; use pyenv/conda on GPU machine

---

## AI team agents

Stored in `agents/`. Load into Claude Code for context-aware help:

| Agent | Use when |
|-------|----------|
| `manga-pm` | Starting a session, unsure where to begin |
| `manga-frontend` | Working on React UI (frontend/) |
| `manga-backend` | Working on Express routes/services (backend/) |
| `manga-ml-engineer` | Working on inference/model (inference/) |

---

## Reference repos

| Repo | Decision |
|------|---------|
| [manga-colorization-v2](https://github.com/qweasdd/manga-colorization-v2) | **Engine** — `MangaColorizator` class, `set_image()` → `colorize()` API |
| [Manga-Colorizer](https://github.com/BinitDOX/Manga-Colorizer) | Architecture reference only (browser extension, built on v2) |
| [MangaNinjia](https://github.com/ali-vilab/MangaNinjia) | Not used — diffusion model, needs conda + 6GB VRAM, too heavy |

---

*Built: 2026-04-07 | Branch: `manga-colorizer` | Repo: `Reyamski/Development`*
