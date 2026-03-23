# Query Hub

Internal **DBA query workspace**: connect to MySQL through **Teleport** (`tsh`), run **guarded SQL**, **EXPLAIN**, browse **schema**, **history / saved queries**, **CSV export**, and optional **AI** (Claude and/or GPT via API).

---

## Prerequisites

| Requirement | Why |
|-------------|-----|
| **Node.js 18+** and **npm** | Build & run client + API |
| **Teleport CLI `tsh`** on the **same machine that runs the Query Hub API** | Cluster list comes from `~/.tsh/*.yaml` on that host; tunnels run there too |
| **Teleport login** (`tsh login <proxy>`) on that machine | So profiles exist and SSO works |
| **Network** to your Teleport proxy / RDS (as usual for `tsh db`) | Same as any Teleport DB workflow |

> **Important:** The browser only talks to the Query Hub UI. **Clusters and `tsh` are resolved on the API server** (default port **3003**), not magically from your laptop unless the API runs on your laptop.

---

## Install on your local machine (one-time)

### 1. Get the code

Clone or pull the **EDT Hub** monorepo and stay on the branch your team uses for Query Hub.

### 2. Install Node.js

- Install **Node.js 18 or newer** (LTS recommended) from [nodejs.org](https://nodejs.org/).  
- Verify:

```powershell
node -v
npm -v
```

### 3. Install Teleport CLI (`tsh`) on the same PC you’ll run the API

Query Hub’s backend runs `tsh` on **this machine** to list clusters and open DB tunnels.

- **Windows:** [Teleport Windows tsh](https://goteleport.com/docs/installation/) or your org’s installer (Teleport Connect often includes `tsh`).  
- **macOS:** `brew install teleport` (or Connect app bundle).  
- Add `tsh` to **PATH**, then:

```powershell
tsh version
```

### 4. Install npm dependencies (Query Hub workspace)

**Windows (PowerShell)** — from repo root `edt-hub`:

```powershell
cd server\src\tools\query-hub
npm install
copy .env.example .env
```

**macOS / Linux** — same folder:

```bash
cd server/src/tools/query-hub
npm install
cp .env.example .env
```

(Optional) Edit **`.env`** in that folder if you use team AI keys on the API (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.).

---

## Run locally (every day)

From **`server/src/tools/query-hub`** (same folder as `package.json` for the `query-hub` workspace):

**Windows:**

```powershell
npm run dev
```

**macOS / Linux:**

```bash
npm run dev
```

This starts **both**:

| Service | URL / port |
|---------|------------|
| **Web UI** (Vite) | http://localhost:5180 |
| **API** (Express) | http://localhost:3003 |

Sanity checks:

- Browser: **http://localhost:5180**  
- API: **http://localhost:3003/api/health** → should return JSON `status: ok`

Stop with **Ctrl+C** in that terminal (helps clean up Teleport tunnels).

**Ports busy?** Change UI port in `client/vite.config.ts` (`server.port`) and update EDT Hub `tools-registry` iframe URL if you embed the hub. Change API port with `PORT=` in `.env` and match Vite `proxy.target` in `vite.config.ts`.

---

## How to use (first-time checklist)

### 1. Teleport on the API host

On the machine where **`npm run dev`** runs for Query Hub:

```powershell
tsh version
tsh login your-cluster.teleport.sh
```

After login, you should have files under **user profile** `\.tsh\` (Windows) or `~/.tsh/` (Mac/Linux), e.g. `*.yaml` profiles.

### 2. Open the app (local)

1. In **`server/src/tools/query-hub`**, run **`npm run dev`** (API + UI).
2. Sa browser, buksan **http://localhost:5180** (hindi direkta ang 3003 para sa UI — ang Vite ang nag-proxy ng `/api` sa API).

### 3. Sidebar → **Connection**

1. If you see **“No Teleport clusters found”**, complete step 1 on the API host, then click **Refresh clusters**.
2. If you see **“tsh not found on the API server”**, install Teleport / add `tsh` to PATH on **that** machine.
3. Choose **Cluster** from the dropdown.
4. Click **Login via SSO** if prompted; finish login in the browser / device flow Teleport opens.
5. Choose **MySQL instance**, wait for **Connected** (databases load from the instance).

### 4. Main area

1. Pick **Active database** from the dropdown.
2. Write SQL in the editor (**Ctrl+Enter** / **Cmd+Enter** to run).
3. Use **Run**, **EXPLAIN**, **Export CSV**, **Save** as needed.

### 5. Sidebar → **Schema**

Browse tables; use **Load SELECT template into editor** to pull a starter query.

### 6. Sidebar → **History & saved**

Click any row to reload SQL into the editor.

### 7. **AI** (optional)

1. Click **Open AI** (top right).
2. Expand **Connection** and pick:
   - **Server default** — uses team keys from `.env` on the API server (`ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY`).
   - **Team — work email** — only if your admin enabled `QUERY_HUB_EMAIL_AUTH` (OTP shown in API terminal in dev).
   - **My Claude / My OpenAI** — paste your **API key** (from [Anthropic Console](https://console.anthropic.com/settings/keys) or [OpenAI API keys](https://platform.openai.com/api-keys)); keys stay in **browser local storage** only.
3. Use **Ask**, **Explain SQL**, **Optimize**, **Generate**, or the **AI** buttons on the results toolbar (interpret EXPLAIN / summarize sample / explain query).

**Note:** ChatGPT **Plus** (consumer) is **not** the same as the **OpenAI API**; you need an API key for “My OpenAI”.

---

## Using inside EDT Hub (iframe)

The main hub can load Query Hub in an iframe at **http://localhost:5180**.

1. Start Query Hub **`npm run dev`** first.
2. Open EDT Hub and select the **Query Hub** tool.

If the iframe is blank, confirm **5180** is free and the dev server is running.

---

## Environment variables (API / `.env`)

| Variable | Required | Notes |
|----------|----------|--------|
| `PORT` | No | API port (default **3003**) |
| `ANTHROPIC_API_KEY` | Optional | Team AI — **Server default** mode (preferred if set) |
| `OPENAI_API_KEY` | Optional | Team AI if no Anthropic key |
| `OPENAI_MODEL` | No | e.g. `gpt-4o-mini` |
| `QUERY_HUB_EMAIL_AUTH` | No | `true` to enable team email OTP |
| `QUERY_HUB_JWT_SECRET` | If email auth | Strong secret for session tokens |
| `QUERY_HUB_EMAIL_DOMAIN` | If email auth | e.g. `partech.com` |
| `QUERY_HUB_ALLOWED_EMAILS` | Alt. | Comma-separated emails |
| `QUERY_HUB_EMAIL_LOG_CODES` | No | Log OTP to API console in prod (dev logs by default) |

See **`.env.example`** in this folder.

---

## Troubleshooting (share this with teammates)

| Symptom | What to check |
|---------|----------------|
| Cluster dropdown only shows “Select a cluster…” | On the **API host**: `tsh login …` then **Refresh clusters** in the UI. Confirm `~/.tsh` (or Windows profile `.tsh`) has `*.yaml` profiles. |
| “Could not load cluster list” + Retry | API not running (**3003**), or Vite not proxying `/api` — use **`npm run dev`** from `query-hub` root (starts both). |
| `tsh` not found | Install Teleport CLI on the machine running the **Query Hub server**, not only on your PC if the server is remote. |
| AI returns **503** | No team keys in `.env` and no personal key in AI settings — add one or ask admin. |
| SQL blocked | **SQL guard** blocks DDL, dangerous DML, etc. — adjust query or ask the team for policy. |

---

## Development commands

```powershell
cd server\src\tools\query-hub
npm run dev          # API + UI
npm run build        # Production build
npx -w client tsc --noEmit
npx -w server tsc --noEmit
```

---

## Repo location in EDT Hub

```
edt-hub/server/src/tools/query-hub/
├── client/          # Vite + React UI
├── server/          # Express API
├── .env.example
└── README.md        # this file
```

More internal detail: **`CLAUDE.md`**, **`ARCHITECTURE.md`** in this folder when present.

---

*PAR Enterprise Data Team — internal tool. Do not expose the API to untrusted networks without proper auth and review.*
