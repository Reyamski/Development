# What Changed? Assistant

**Incident forensics tool** that answers: *"What changed 1-24 hours before the spike?"*

Pulls Jira releases, database migrations, config changes, schema diffs, deployment tickets, and query pattern shifts to help you quickly identify the root cause of incidents.

---

## Why Build This?

This is the **first question** asked in almost every incident investigation. Instead of manually checking Jira, database logs, config management tools, and query digests across multiple systems, this tool aggregates everything into a single timeline view with automatic correlation detection.

---

## Features

### 📊 Multi-Source Change Detection
- **Jira Releases**: Deployment tickets, hotfixes, migrations
- **Database Changes**: Schema changes, migrations, new query patterns
- **Config Changes**: RDS parameter changes, feature flags, environment variables

### 🔗 Automatic Correlation Detection
- Correlates changes across different sources based on:
  - **Time proximity**: Changes within 30-60 minutes of each other
  - **Keyword matching**: Jira descriptions matching database/config changes
  - **Query-to-schema correlation**: Schema changes followed by new query patterns on the same table
- **Strength scoring**: Weak, Medium, Strong correlations

### 🎯 Tabbed Interface
- **Summary Tab**: Overview with change counts and detected correlations
- **Jira Tab**: Deployment tickets with labels, components, and descriptions
- **Database Tab**: Schema changes, migrations, and query digest diffs
- **Config Tab**: Parameter changes with old/new value comparison

### 🔍 Correlation Panel
- Click any change to see related correlations
- Side-by-side comparison of correlated changes
- Visual indicators for correlation strength

### ⏰ Flexible Time Window
- Select incident timestamp with quick presets (Now, 1 hour ago)
- Configurable lookback: 1, 3, 6, 12, or 24 hours

---

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + TypeScript
- **Backend**: Node.js + Express + TypeScript
- **State Management**: Zustand
- **Integrations**: 
  - Jira REST API (for releases/deployments)
  - MySQL via Teleport tunnels (for query digests and schema changes)
  - AWS RDS CLI (for parameter changes)
  - Confluence API (planned for runbooks)

---

## Setup

### Prerequisites
- Node.js 18+
- npm 8+
- **AWS CLI configured with SSO** (`aws sso login`)
- **Teleport CLI** (`tsh`) installed and configured
- **Database Access** via Teleport to MySQL instances with `dba` schema
- **AWS Secrets Manager** (production) OR local `.env` file (local dev)

### Installation

1. **Navigate to project**:
   ```bash
   cd dbatools/what-changed-assistant
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure credentials** (Choose A or B):

   #### **Option A: Local Development (.env file)**
   
   Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

   Edit `.env`:
   ```env
   # Jira Configuration
   JIRA_URL=https://your-company.atlassian.net
   JIRA_EMAIL=your-email@company.com
   JIRA_API_TOKEN=your-jira-api-token

   # Confluence Configuration (optional)
   CONFLUENCE_URL=https://your-company.atlassian.net/wiki
   CONFLUENCE_API_TOKEN=your-confluence-api-token

   # AWS Configuration (auto-detected from ~/.aws/config)
   # AWS_REGION=us-east-1  # Optional override
   ```

   **Important:** `.env` file is git-ignored and never committed.

   #### **Option B: Production (AWS Secrets Manager)**
   
   Create secrets in AWS Secrets Manager:
   ```bash
   # Run these once in your AWS account
   aws secretsmanager create-secret \
     --name prod/jira/api-token \
     --secret-string "your-jira-token" \
     --region us-east-1

   aws secretsmanager create-secret \
     --name prod/jira/url \
     --secret-string "https://your-company.atlassian.net" \
     --region us-east-1

   aws secretsmanager create-secret \
     --name prod/jira/email \
     --secret-string "your-email@company.com" \
     --region us-east-1
   ```

   The app automatically uses Secrets Manager if `.env` is not present.

4. **Set up AWS SSO** (one-time):
   ```bash
   aws sso login --sso-session your-session-name
   ```

   The app auto-detects SSO config from `~/.aws/config` and creates profiles as needed.

5. **Set up Teleport** (one-time):
   ```bash
   tsh login your-cluster.teleport.example.com
   ```

   The app auto-detects `tsh` binary and uses browser-based SSO.

6. **Run the app**:
   ```bash
   npm run dev
   ```

   This starts:
   - Backend server on `http://localhost:4000`
   - Frontend dev server on `http://localhost:5175` (auto-opens in browser)

### First-Time Setup Checklist

- [ ] AWS SSO configured in `~/.aws/config` with an `[sso-session]` block
- [ ] Run `aws sso login --sso-session <name>` at least once
- [ ] Teleport CLI (`tsh`) installed (auto-detects from PATH or standard locations)
- [ ] Run `tsh login <cluster>` at least once
- [ ] Jira API token created (Admin → API tokens → Create)
- [ ] Either `.env` file created OR AWS Secrets Manager configured
- [ ] Dependencies installed (`npm install`)

---

## Systematic Testing Guide

### 🧪 Test 1: Teleport Connection (Database Access)

**Purpose:** Verify Teleport SSO and MySQL tunnel work correctly.

**Steps:**
1. Open app at `http://localhost:5175`
2. Check Teleport sidebar (should show cluster selector)
3. Select your Teleport cluster → Browser opens for SSO login
4. After login, select a MySQL database instance
5. Click "Connect" → Should see "Connected" status

**Expected Result:** 
- ✅ Teleport login via browser SSO (no manual credentials)
- ✅ MySQL tunnel established on random localhost port
- ✅ Connection status shows "Connected"

**Troubleshooting:**
- If `tsh` not found: Install Teleport CLI or Teleport Connect app
- If login fails: Run `tsh login <cluster>` manually first
- If connection fails: Check database permissions

---

### 🧪 Test 2: Database Queries (DBA Schema)

**Purpose:** Verify we can query `dba.events_statements_summary_by_digest_history`.

**Steps:**
1. After connecting (Test 1), set incident time to "1 hour ago"
2. Set lookback to "6 hours"
3. Click "Fetch Changes"
4. Go to "Database" tab

**Expected Result:**
- ✅ Shows real query digest changes from `dba schema`
- ✅ SQL queries have syntax highlighting
- ✅ Execution counts and latencies are real data
- ✅ "New" or "Spike" badges on query patterns

**Troubleshooting:**
- If empty results: Check if `dba.events_statements_summary_by_digest_history` table exists
- If error: Check database permissions for `dba` schema
- If slow: Query has 10s timeout, check DB performance

---

### 🧪 Test 3: AWS SSO + CloudWatch

**Purpose:** Verify AWS SSO auto-login and CloudWatch metric fetching.

**Steps:**
1. Run `aws sso login --sso-session <your-session>` (one-time)
2. In app, the backend auto-detects SSO from `~/.aws/config`
3. Fetch changes for an RDS instance
4. Go to "Config" tab

**Expected Result:**
- ✅ No AWS credentials in code (auto-detected from SSO)
- ✅ Profile `rds-dba-{accountId}` auto-created if needed
- ✅ CloudWatch metrics fetched successfully
- ✅ RDS parameter changes displayed

**Troubleshooting:**
- If "Not logged in": Run `aws sso login`
- If profile error: Check `~/.aws/config` has `[sso-session]` block
- If permissions error: Ensure role has CloudWatch/RDS read access

---

### 🧪 Test 4: Jira API (Hybrid Auth)

**Purpose:** Verify Jira integration with hybrid auth (env + Secrets Manager).

**Steps:**
1. **Local dev:** Set `JIRA_API_TOKEN` in `.env`
2. **Production:** Ensure AWS Secrets Manager has `prod/jira/api-token`
3. Click "Fetch Changes"
4. Go to "Jira" tab

**Expected Result:**
- ✅ Local: Uses `.env` token
- ✅ Production: Uses Secrets Manager
- ✅ Real Jira deployments/releases shown
- ✅ Labels, components, assignees populated

**Troubleshooting:**
- If 401 error: Check Jira API token validity
- If empty: Adjust JQL query or time window
- If using mock data: Token not configured (expected fallback behavior)

---

### 🧪 Test 5: Timeline Visualization

**Purpose:** Verify interactive timeline works with real data.

**Steps:**
1. After fetching changes, check the timeline above tabs
2. Hover over colored dots
3. Click a dot

**Expected Result:**
- ✅ Dots positioned correctly by timestamp
- ✅ Tooltips show change details
- ✅ Clicking jumps to relevant tab
- ✅ Color-coded: Purple (Jira), Red (Database), Yellow (Config)

---

### 🧪 Test 6: Root Cause Suggestions

**Purpose:** Verify correlation detection and AI suggestions.

**Steps:**
1. After fetching changes with multiple sources
2. Check "AI Root Cause Suggestions" panel
3. Review suggested causal chain

**Expected Result:**
- ✅ Shows confidence percentage
- ✅ Lists correlated changes in chronological order
- ✅ Explains why they're correlated (time proximity, keywords)

---

### 🧪 Test 7: Search & Filters

**Purpose:** Verify filtering works correctly.

**Steps:**
1. Type "migration" in search box
2. Click "High Severity Only"
3. Click "Show Correlated Only"
4. Click "Export JSON"

**Expected Result:**
- ✅ Search filters visible changes (future: highlights matches)
- ✅ Filters toggle active/inactive
- ✅ Export downloads JSON file with all data
- ✅ Reset button clears all filters

---

## Usage

### Basic Flow

1. **Connect to Teleport**: Select cluster → Login via browser → Select DB instance
2. **Set Incident Time**: Use datetime picker or quick presets
3. **Choose Lookback Window**: 1-24 hours before the incident
4. **Fetch Changes**: Click "Fetch Changes" to aggregate all data
5. **Review Summary**: See counts and detected correlations
6. **Check Timeline**: Visual overview of when changes occurred
7. **Review AI Suggestions**: Check root cause panel
8. **Explore Tabs**: Drill down into Jira, Database, or Config changes
9. **Click Changes**: Select any change to see correlations in the side panel

### Example Workflow

**Scenario**: CPU spike on `prod-db-primary` at 2:30 PM

1. Set incident time to `2026-03-19 14:30`
2. Set lookback to `6 hours`
3. Click "Fetch Changes"
4. Summary shows:
   - 3 Jira deployments
   - 2 Database changes (1 migration, 1 new query pattern)
   - 1 Config change (max_connections increased)
5. Click on the database migration → Correlation panel shows:
   - **Strong correlation** with Jira ticket "Deploy analytics tables"
   - **Medium correlation** with new query pattern on `user_analytics` table
6. **Root cause identified**: Analytics migration added 2.5M rows, triggering new queries without indexes

---

## Current Status: MVP with Mock Data

This is a **working MVP** with realistic mock data to demonstrate the UI/UX and correlation logic.

### What's Working
✅ Full tabbed UI with time window selector  
✅ Mock data for Jira releases, database changes, config changes  
✅ Automatic correlation detection  
✅ Click-to-view correlation panel  
✅ Responsive layout with Tailwind styling

### Next Steps (Real Integrations)
✅ Connect to real Jira API (**COMPLETED**)  
🔲 Connect to MySQL via Teleport for query digest diffs (replace `server/src/services/database.ts` mock)  
✅ Integrate AWS RDS CLI for parameter history (**COMPLETED**)  
🔲 Add Confluence integration for runbook changes  
🔲 Add feature flag service integration (LaunchDarkly, etc.)  
🔲 Implement query digest comparison logic (before/after)  
🔲 Add export to PDF/CSV functionality  

---

## Project Structure

```
what-changed-assistant/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── TimeWindowSelector.tsx
│   │   │   ├── SummaryTab.tsx
│   │   │   ├── JiraTab.tsx
│   │   │   ├── DatabaseTab.tsx
│   │   │   ├── ConfigTab.tsx
│   │   │   └── CorrelationPanel.tsx
│   │   ├── store/           # Zustand state management
│   │   ├── api/             # API client + types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   └── package.json
├── server/                  # Express backend
│   ├── src/
│   │   ├── routes/          # API routes
│   │   │   ├── changes.ts
│   │   │   ├── jira.ts
│   │   │   ├── database.ts
│   │   │   └── config.ts
│   │   ├── services/        # Business logic
│   │   │   ├── changes-summary.ts
│   │   │   ├── jira.ts      # Jira API integration
│   │   │   ├── database.ts  # MySQL/Teleport integration
│   │   │   ├── config.ts    # AWS RDS CLI integration
│   │   │   └── correlations.ts
│   │   ├── types.ts
│   │   └── index.ts
│   └── package.json
└── README.md
```

---

## API Reference

### GET `/api/changes/summary`
Fetch aggregated changes for a time window.

**Query Parameters**:
- `incidentTime` (required): ISO 8601 timestamp
- `lookbackHours` (required): Number (1-24)

**Response**:
```json
{
  "timeWindow": { ... },
  "jiraChanges": [ ... ],
  "databaseChanges": [ ... ],
  "configChanges": [ ... ],
  "correlations": [ ... ]
}
```

### GET `/api/jira/releases`
Fetch Jira releases/deployments in time window.

### GET `/api/database/changes`
Fetch database schema changes, migrations, and query digest diffs.

### GET `/api/config/changes`
Fetch config changes (RDS parameters, feature flags, etc.).

**Query Parameters**:
- `startTime` (required): ISO 8601 timestamp
- `endTime` (required): ISO 8601 timestamp
- `accountId` (optional): AWS account ID
- `region` (optional): AWS region (e.g., `us-east-1`)
- `parameterGroupName` (optional): RDS parameter group name

**Response**:
```json
[
  {
    "id": "rds-param-max_connections-2026-03-19T14:30:00Z",
    "timestamp": "2026-03-19T14:30:00Z",
    "changeType": "parameter",
    "source": "RDS Parameter Group",
    "parameter": "max_connections",
    "oldValue": "500",
    "newValue": "1000",
    "appliedBy": "arn:aws:sts::123456789012:assumed-role/DBARole/john.doe",
    "requiresReboot": true
  }
]
```

### GET `/api/config/rds-parameters`
Fetch RDS parameter changes for a specific instance.

**Query Parameters**:
- `dbInstance` (required): Format `{accountId}-{region}-{parameterGroupName}`
- `startTime` (required): ISO 8601 timestamp
- `endTime` (required): ISO 8601 timestamp

**Response**:
```json
[
  {
    "parameterName": "max_connections",
    "oldValue": "500",
    "newValue": "1000",
    "applyType": "PENDING_REBOOT",
    "modifiedDate": "2026-03-19T14:30:00Z"
  }
]
```

---

## AWS RDS Integration Details

### How It Works

The AWS RDS parameter change detection uses a **hybrid approach**:

1. **Primary Source: CloudTrail** (if available)
   - Queries `ModifyDBParameterGroup` events within the time window
   - Extracts parameter name, new value, timestamp, and user from event details
   - Provides true historical change tracking with exact timestamps

2. **Fallback: Current Parameter State**
   - If CloudTrail is unavailable or returns no events, falls back to current state
   - Queries `describe-db-parameters --source user` to get user-modified parameters
   - Returns current values with current timestamp (best-effort detection)

3. **AWS SSO Integration**
   - Auto-detects AWS SSO configuration from `~/.aws/config`
   - Reuses existing profiles or creates temporary profiles (`rds-dba-{accountId}`)
   - Assumes user is already logged in via `aws sso login`

### Prerequisites

1. **AWS CLI installed** and configured with SSO
2. **Valid SSO session**: Run `aws sso login --profile <profile-name>` first
3. **IAM permissions**:
   - `rds:DescribeDBParameters` (minimum)
   - `cloudtrail:LookupEvents` (optional, for historical tracking)
4. **CloudTrail enabled** (recommended but not required)

### Usage Example

**Via `/api/config/changes` endpoint**:
```bash
curl "http://localhost:4000/api/config/changes?\
startTime=2026-03-19T08:00:00Z&\
endTime=2026-03-19T14:00:00Z&\
accountId=123456789012&\
region=us-east-1&\
parameterGroupName=prod-mysql-params"
```

**Via `/api/config/rds-parameters` endpoint**:
```bash
curl "http://localhost:4000/api/config/rds-parameters?\
dbInstance=123456789012-us-east-1-prod-mysql-params&\
startTime=2026-03-19T08:00:00Z&\
endTime=2026-03-19T14:00:00Z"
```

### Limitations

- **Without CloudTrail**: Can only detect that parameters are currently modified, not when they were changed
- **CloudTrail Delay**: Events may take 5-15 minutes to appear in CloudTrail
- **90-day retention**: CloudTrail `lookup-events` only queries last 90 days (use CloudTrail S3 exports for older data)

---

## Contributing

To add a new change source (e.g., Kubernetes deployments, CDN config):

1. Add new types to `server/src/types.ts` and `client/src/api/types.ts`
2. Create service file in `server/src/services/your-service.ts`
3. Add route in `server/src/routes/your-route.ts`
4. Update correlation logic in `server/src/services/correlations.ts`
5. Create React component in `client/src/components/YourTab.tsx`
6. Add tab to `App.tsx`

---

## License

Internal tool for DBA operations.

---

## Feedback & Support

Slack: `#dba-tools`  
Maintainer: DBA Team
