# dbatools

Personal / shared DBA tooling.

## Query Hub (full copy)

Standalone app folder: **[`query-hub/`](./query-hub/)**

- Copied from EDT Hub: `edt-hub/server/src/tools/query-hub/`
- **No `node_modules`** in the copy — after clone, run:

  ```powershell
  cd query-hub
  npm install
  copy .env.example .env
  npm run dev
  ```

- Docs: [`query-hub/README.md`](./query-hub/README.md)

To refresh the copy from EDT Hub, re-run the same `robocopy` (or ask your agent) from `edt-hub\server\src\tools\query-hub` → `dbatools\query-hub`.
