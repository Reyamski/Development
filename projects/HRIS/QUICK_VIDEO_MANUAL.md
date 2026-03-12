# Northstar HRIS Quick Video Manual

This guide is for a fast 2-4 minute walkthrough recording of the HRIS demo app, including the new biometrics module.

## Goal

Show that the system supports:
- HR dashboard monitoring
- employee management
- attendance tracking
- biometric enrollment and device sync
- leave approvals
- payroll progress
- reports and settings

## Before Recording

1. Open the app in the browser.
2. Use `http://localhost:5174/` if that is still the active Vite port.
3. Prepare a demo login:
   - Email: `hr@northstarhris.dev`
   - Password: any value
   - Role: `HR`
4. Make sure the browser window is clean and zoom is readable.

## Suggested Video Flow

### Scene 1: Login Screen

What to do:
- Show the login page.
- Click the `HR` role chip.
- Enter `hr@northstarhris.dev`.
- Enter any password.
- Click `Enter HRIS`.

Voiceover:
`This is the Northstar HRIS starter system. It includes a modern login experience with placeholder role-based access, so it can later be connected to real authentication.`

On-screen focus:
- branding
- role chips
- login form

### Scene 2: Dashboard

What to do:
- Pause briefly on the dashboard.
- Point out the key metrics and announcements.

Voiceover:
`The dashboard gives HR and operations teams an immediate overview of headcount, attendance, leave requests, and payroll readiness. It also highlights announcements and shows that the platform is ready for future backend integrations.`

On-screen focus:
- headcount
- present today
- pending leave
- payroll readiness

### Scene 3: Employees

What to do:
- Open `Employees`.
- Scroll through the employee directory.
- Add a sample employee using the form.
- Click `Save employee`.

Voiceover:
`The employee records module centralizes profile information such as department, position, location, manager, and leave balance. New employees can be added quickly through the form.`

Suggested sample data:
- Full name: `Jamie Carter`
- Work email: `jamie@northstarhris.dev`
- Department: `Operations`
- Position: `HR Coordinator`
- Location: `Manila`
- Manager: `Avery Morgan`

### Scene 4: Attendance

What to do:
- Open `Attendance`.
- Review the status cards.
- Show the daily attendance table.

Voiceover:
`The attendance module tracks shift schedules, check-in times, and employee status, including present, remote, late, and leave records.`

On-screen focus:
- attendance metrics
- daily records table

### Scene 5: Biometrics

What to do:
- Open `Biometrics`.
- Show the device cards.
- Click `Run sync` on one online device.
- Click `Toggle status` on another device.
- In the enrollment roster, click `Update` on one employee.
- Scroll down to the sync history and recent biometric logs.

Voiceover:
`The biometrics module simulates a biometric attendance setup with device monitoring, enrollment tracking, scan verification logs, and sync history. This is ideal for demonstrations and can be replaced later with real biometric hardware or API integrations.`

On-screen focus:
- online devices
- enrolled employees
- sync actions
- recent biometric logs

### Scene 6: Leave Management

What to do:
- Open `Leave`.
- Approve one pending request.
- Optionally decline another request.

Voiceover:
`The leave module allows HR to review requests, inspect employee reasons and dates, and approve or decline them directly from the interface.`

### Scene 7: Payroll

What to do:
- Open `Payroll`.
- Click `Advance status` on a payroll cycle.
- Show the payroll totals and completion bar.

Voiceover:
`Payroll is organized by cycles, with clear totals, status progression, and completion tracking. This structure is ready for integration with a real payroll engine later on.`

### Scene 8: Reports and Settings

What to do:
- Open `Reports`.
- Briefly show the report cards.
- Open `Settings`.
- Point out the environment notes and `Reset demo data` button.

Voiceover:
`The reporting section provides a starter analytics catalog, while settings explains the current demo architecture and offers a one-click demo data reset for repeat presentations.`

## Short Closing Line

`This Northstar HRIS starter demonstrates how employee management, attendance, biometrics, leave, payroll, and reporting can work together in one modern HR platform.`

## Fast Recording Tips

- Keep the recording between 2 and 4 minutes.
- Move the cursor slowly and pause after each click.
- Use one sample employee addition only.
- Use one biometric sync only.
- Avoid over-scrolling during the demo.

## Backup Demo Path

If something feels too long during recording, use this shorter path:

1. Login
2. Dashboard
3. Employees
4. Biometrics
5. Leave
6. Payroll
7. Settings

## If You Need a Voiceover-Free Version

You can also record this silently and use these short captions:

- `Login to the HRIS`
- `View live HR dashboard metrics`
- `Add and manage employee records`
- `Monitor attendance and biometric logs`
- `Approve leave requests`
- `Track payroll progress`
- `Review reports and reset demo data`
