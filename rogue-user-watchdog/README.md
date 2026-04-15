# Rogue User Watchdog

Standalone audit tool for detecting rogue or over-privileged MySQL users on RDS instances via Teleport.

## What it does

Connects to an RDS MySQL instance through a Teleport tunnel and audits all non-system users against a rules engine. Flags users with dangerous privileges, expired passwords, wildcard hosts, and other security risks — ranked HIGH / MEDIUM / LOW / CLEAN.

**Checks include:**
- `SUPER` privilege globally
- `ALL PRIVILEGES` on `*.*`
- `GRANT OPTION` on `*.*`
- `FILE` privilege (data exfiltration risk)
- Dangerous infra privs (`SHUTDOWN`, `PROCESS`, `REPLICATION SLAVE`) on non-DBA accounts
- Wildcard host `%` on non-read-only accounts
- Expired passwords
- `ALL PRIVILEGES` on specific schemas
- User management privileges (`CREATE USER`, `DROP USER`)
- No password rotation policy
- Duplicate usernames across multiple hosts

## Prerequisites

- [tsh (Teleport CLI)](https://goteleport.com/docs/installation/) installed and in PATH
- Node.js 18+

## Setup

```bash
cd rogue-user-watchdog
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5178 in your browser.

## Stack

- **Server:** Node.js + Express + TypeScript + mysql2
- **Client:** React + Vite + Tailwind CSS + Zustand

## Ports

| Service | Port |
|---------|------|
| API server | 3012 |
| Vite dev server | 5178 |
