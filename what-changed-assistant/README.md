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
- AWS CLI configured with SSO
- Teleport CLI (`tsh`) configured
- Access to Jira and Confluence APIs

### Installation

1. **Clone the repo** (if not already):
   ```bash
   cd dbatools/what-changed-assistant
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables** (create `.env` in `server/` folder):
   ```env
   # Jira Configuration
   JIRA_URL=https://your-company.atlassian.net
   JIRA_EMAIL=your-email@company.com
   JIRA_API_TOKEN=your-jira-api-token

   # Confluence Configuration (optional)
   CONFLUENCE_URL=https://your-company.atlassian.net/wiki
   CONFLUENCE_API_TOKEN=your-confluence-api-token

   # Database Configuration
   TELEPORT_PROXY=teleport.your-company.com:443
   DB_USER=dba_user
   DB_PASSWORD=your-db-password

   # AWS Configuration
   AWS_PROFILE=your-aws-profile
   AWS_REGION=us-east-1
   ```

4. **Run the app**:
   ```bash
   npm run dev
   ```

   This starts:
   - Backend server on `http://localhost:4000`
   - Frontend dev server on `http://localhost:5175` (auto-opens in browser)

---

## Usage

### Basic Flow

1. **Select Incident Time**: Use the datetime picker or quick presets
2. **Choose Lookback Window**: 1-24 hours before the incident
3. **Fetch Changes**: Click "Fetch Changes" to aggregate all data
4. **Review Summary**: See counts and detected correlations
5. **Explore Tabs**: Drill down into Jira, Database, or Config changes
6. **Click Changes**: Select any change to see correlations in the side panel

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
🔲 Connect to real Jira API (replace `server/src/services/jira.ts` mock)  
🔲 Connect to MySQL via Teleport for query digest diffs (replace `server/src/services/database.ts` mock)  
🔲 Integrate AWS RDS CLI for parameter history (replace `server/src/services/config.ts` mock)  
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
