# Northstar HRIS

Northstar HRIS is a frontend-first Human Resource Information System demo built with React and Vite. It is designed as a polished starter application for presentations, demos, and future backend integration.

## Features

- placeholder role-based login for `Admin`, `HR`, and `Employee`
- executive dashboard with operational metrics and announcements
- employee directory with add-employee form
- attendance tracker with daily status records
- biometrics module with device monitoring, enrollment states, sync history, and verification logs
- leave request review and approval actions
- payroll cycle tracking with progress states
- reports catalog and demo settings

## Tech Stack

- React
- Vite
- ESLint
- local browser storage for demo persistence

## Getting Started

### 1. Install dependencies

```powershell
npm install
```

### 2. Start the development server

```powershell
npm run dev
```

Open the local URL printed by Vite. If port `5173` is already in use, Vite will automatically choose another port such as `5174`.

### 3. Build for production

```powershell
npm run build
```

### 4. Preview the production build

```powershell
npm run preview
```

## Demo Login

The login is intentionally a placeholder for demo purposes.

- Email: any non-empty email, example `hr@northstarhris.dev`
- Password: any value
- Role: `ADMIN`, `HR`, or `EMPLOYEE`

## Main Modules

### Dashboard

Shows headcount, attendance, leave, payroll readiness, and announcements.

### Employees

Create and review employee profiles with department, role, manager, location, and leave balance.

### Attendance

Displays attendance status cards and a daily attendance table.

### Biometrics

Simulates biometric attendance with:
- device cards
- online and maintenance states
- sync actions
- enrollment status updates
- recent biometric logs

### Leave

Allows pending leave requests to be approved or declined.

### Payroll

Tracks payroll cycles, totals, status progression, and completion percentage.

### Reports

Lists starter reports for headcount, leave utilization, and payroll variance.

### Settings

Includes environment notes and a `Reset demo data` action.

## Project Structure

```text
projects/HRIS/
  public/
  src/
    data/
    services/
  QUICK_VIDEO_MANUAL.md
  README.md
```

## Scripts

- `npm run dev` starts the local Vite server
- `npm run build` creates the production build
- `npm run preview` previews the built app
- `npm run lint` runs ESLint checks

## Demo Notes

- App state and session data are stored in local storage.
- The biometrics module is simulated and does not connect to real hardware yet.
- Use `Settings > Reset demo data` to restore the original seeded records.
- A recording guide is available in `QUICK_VIDEO_MANUAL.md`.
