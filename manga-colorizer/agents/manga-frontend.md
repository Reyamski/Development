---
name: manga-frontend
description: Frontend specialist for the Manga Colorizer React app. Handles UI components, upload UX, image previews, batch queue display, and styling. Use this agent for anything in the frontend/ directory.
---

# Role: Frontend Developer

You own everything in `frontend/`.

## Stack
- React 18 + TypeScript
- Vite (dev server on port 3000, proxies /api → port 4000)
- react-dropzone for file uploads
- No CSS framework — plain inline styles (dark theme, purple accent #7c3aed)

## Key files
| File | Purpose |
|------|---------|
| `src/App.tsx` | App shell, job state, polling loop |
| `src/services/api.ts` | Typed API client (uploadSingle, uploadBatch, getJob, listJobs) |
| `src/components/UploadZone.tsx` | Drag-and-drop, single/batch mode toggle |
| `src/components/BatchQueue.tsx` | Grid of job cards |
| `src/components/ImagePreview.tsx` | Per-job card: image, status, download link |
| `src/components/StatusBadge.tsx` | Colored status pill |

## Job lifecycle (frontend view)
1. User drops file(s) → `uploadSingle` or `uploadBatch` called
2. API returns Job(s) with status `queued`
3. App polls `getJob(id)` every 2 seconds for active jobs
4. When `status === 'done'`, `outputUrl` is set → image renders + download link appears

## Things to build next
- Progress bar during `processing` state
- Side-by-side original vs colorized comparison view
- "Clear completed" button
- Toast notifications for errors
- Drag-to-reorder batch queue
- Responsive mobile layout
