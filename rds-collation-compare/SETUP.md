# Setup Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   cd rds-collation-compare
   npm install
   ```

2. **Configure environment:**
   - Edit `.env` file if you need to change ports
   - Default ports: API (3011), Client (5178)

3. **Start development servers:**
   ```bash
   npm run dev
   ```

   This will start both the server and client concurrently.

4. **Open in browser:**
   - Navigate to http://localhost:5178

## How to Use

### Scanning a Database

1. Fill in the scan form:
   - **Cluster**: Teleport cluster name
   - **Database**: RDS database identifier
   - **DB User**: MySQL username (default: root)
   - **Stack Name**: Identifier for this stack (e.g., "production-us-east")
   - **Environment**: Environment name (e.g., "production")

2. Click **Scan** to analyze collations

3. Repeat for multiple stacks you want to compare

### Comparing Stacks

1. After scanning at least 2 instances, click **Compare All**

2. View results:
   - **Summary**: Overview of databases, stacks, and mismatches
   - **Mismatches**: Detailed list of collation differences across stacks

### Understanding Results

**Severity Levels:**
- **HIGH**: Non-UTF8MB4 character sets (potential data loss risk)
- **MEDIUM**: Non-standard collations or mixed collations within database
- **LOW**: Minor issues
- **INFO**: Informational messages

**Collation Levels:**
- **Database**: Default collation for the database
- **Table**: Collation set on table level
- **Column**: Collation set on column level

## Prerequisites

- Node.js 18 or higher
- Teleport CLI (tsh) installed and configured
- Access to RDS instances via Teleport

## Project Structure

```
rds-collation-compare/
├── server/              # Express API backend
│   └── src/
│       ├── routes/      # API endpoints
│       ├── services/    # Business logic
│       └── shared/      # Shared utilities
├── client/              # React frontend
│   └── src/
│       ├── api/         # API client
│       ├── store/       # Zustand state management
│       └── CollationCompare.tsx
└── package.json         # Workspace root
```

## Troubleshooting

**Teleport connection fails:**
- Ensure tsh is in your PATH
- Verify you're logged into Teleport: `tsh login`
- Check database name in Teleport: `tsh db ls`

**Port already in use:**
- Edit `.env` file and change SERVER_PORT or CLIENT_PORT
- Make sure to update vite.config.ts proxy if you change SERVER_PORT

**Dependencies installation fails:**
- Delete `node_modules` folders in root, server, and client
- Delete all `package-lock.json` files
- Run `npm install` again
