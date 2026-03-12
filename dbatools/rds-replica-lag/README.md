# RDS Replica Lag

A tool that shows you how far behind your RDS MySQL replica is from the main database. It displays a chart of the lag over time and helps you find out why lag spikes happen.

---

## Before You Start

Make sure these are already set up on your machine:

| What | Why you need it |
|------|-----------------|
| **AWS profile** | The app uses your AWS account to read CloudWatch and RDS data. Your AWS profile must be configured and ready to use. |
| **Teleport** | The app connects to RDS through Teleport. You need Teleport installed and logged in to your cluster. |
| **Node.js** (v18 or newer) | The app runs on Node.js. |

**Checklist before running:**

- [ ] AWS profile is configured (you can run `aws sso login` and it works)
- [ ] Teleport is installed (`tsh` command works in Terminal)
- [ ] You are logged in to your Teleport cluster
- [ ] Node.js is installed (`node --version` shows v18 or higher)

---

## How to Run

### Step 1: Open Terminal

Open PowerShell or Command Prompt on your computer.

### Step 2: Go to the project folder

Type this (change the path if your folder is somewhere else):

```
cd c:\Users\cruzr\Downloads\Cursor\dbatools\rds-replica-lag
```

Press Enter.

### Step 3: Install dependencies (first time only)

Type:

```
npm install
```

Press Enter. Wait until it finishes. You only need to do this once, or when you pull new changes.

### Step 4: Start the app

Type:

```
npm run dev
```

Press Enter. The app will start and your browser should open automatically.

### Step 5: Use the app

1. **Login** — Click your Teleport cluster and complete the login in the browser that opens.
2. **Select instance** — Pick your RDS replica from the dropdown.

3. **View lag** — You will see:
   - A chart showing how the lag changes over time
   - A sidebar with live status (IO thread, SQL thread, etc.)

4. **Investigate a spike** — Click and drag across a lag spike on the chart to zoom in and see more details.

---

## When Something Goes Wrong

### "Port already in use"

The app might already be running. Try opening:

- http://localhost:5174
- or http://localhost:5178

If one of these opens the app, you are good. If you want to stop the old process and restart:

1. Find what is using the port:

   ```
   netstat -ano | findstr ":3002"
   ```

2. Note the PID (last number) and stop it:

   ```
   taskkill /PID <PID> /F
   ```

   Replace `<PID>` with the number you saw.

### "Teleport not found" or "tsh binary not available"

Teleport is not installed or not in your PATH. Install it from [Teleport docs](https://goteleport.com/docs/installation/) and make sure it works before running the app again.

### CloudWatch or AWS errors

- Run `aws sso login` and complete the login in the browser.
- Check that your AWS profile has permissions to read CloudWatch and RDS.
- Make sure your environment variables are set (see below).

---

## Environment Variables

The app needs these to talk to AWS:

| Variable | Required? | What it does |
|----------|-----------|--------------|
| `AWS_SSO_START_URL` | Yes (for CloudWatch) | Your AWS SSO portal URL |
| `AWS_SSO_REGION` | No | AWS SSO region (default: `us-east-1`) |

You can set these in a `.env` file in the project folder, or in your system environment.

---

## FAQ

**Q: Why do I need an AWS profile?**

A: The app reads CloudWatch metrics from AWS to show how lag changes over time. It also uses your AWS account to get RDS instance details. Without a configured AWS profile, it cannot fetch this data.

**Q: Why do I need Teleport?**

A: RDS databases are usually not reachable directly from your laptop. Teleport creates a secure tunnel so the app can connect to the database and run queries like `SHOW REPLICA STATUS`.

**Q: What if the browser does not open automatically?**

A: Open your browser and go to http://localhost:5174 or http://localhost:5178 (Vite may use a different port if 5174 is busy).

**Q: What if I see "lag N/A" or no data?**

A: Make sure you are logged in to Teleport, selected an instance, and that the app has connected. The instance must be a replica (read replica) for lag data to show.

---

## Quick Reference

| Command | What it does |
|---------|--------------|
| `npm install` | Install dependencies (first time or after updates) |
| `npm run dev` | Start the app (server + client, opens browser) |
| `npm run dev -w server` | Start only the backend (port 3002) |
| `npm run dev -w client` | Start only the frontend (port 5174) |
| `npm run build` | Build for production |

| Port | What runs there |
|------|-----------------|
| 3002 | Backend API |
| 5174 | Frontend (Vite dev server) |
