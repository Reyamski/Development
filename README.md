# Development

Private multi-project repository for personal builds, demos, and experiments.

## Repository Layout

```text
development/
  .cursor/
    rules/
  projects/
    HRIS/
```

## Projects

### `projects/HRIS`

Northstar HRIS is a React + Vite demo application that includes:
- placeholder role-based login
- dashboard and employee records
- attendance and biometrics simulation
- leave management
- payroll tracking
- reports, settings, and demo reset tools

Project-specific instructions live in `projects/HRIS/README.md`.

## How To Use This Repo

Each project is kept in its own folder under `projects/` so new apps can be added later without mixing files together.

To work on the HRIS project:

```powershell
cd projects/HRIS
npm install
npm run dev
```

## Notes

- This repo includes Cursor rules under `.cursor/rules/`.
- Generated folders such as `node_modules`, `dist`, and `.vite` are ignored.
