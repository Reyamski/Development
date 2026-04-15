# State - RDS Index Reviewer

## Current Position
- **Phase:** Integration / handoff
- **Status:** Core app is implemented. Confluence export wiring is in place. Remaining work is fresh-process end-to-end verification of the app export endpoint.
- **Last updated:** 2026-03-31

## Phase Progress
| Phase | Name | Status |
|-------|------|--------|
| 1 | Connection & Project Foundation | Implemented |
| 2 | High-Value Query Analysis (Missing & Unused Indexes) | Implemented |
| 3 | Structural Index Analysis (Duplicates, Overlaps, Bloat Risk) | Implemented |
| 4 | Report UI & Copy Actions | Implemented |
| 5 | Integration, Hardening & End-to-End Validation | In progress |

## Verified This Session
- Client TypeScript build passed with `npx tsc -b`
- Server build passed with `npm run build -w server`
- Full project build passed earlier with `npm run build`
- AWS CLI is available locally
- AWS Secrets Manager secret `jira_token` exists in `us-east-1`
- Secret format is JSON and contains key `jira_token`
- Direct authenticated Confluence GET to `https://partechnology.atlassian.net/wiki/rest/api/space?spaceKey=EDT` returned HTTP 200
- Direct authenticated Confluence GET to the content lookup endpoint returned HTTP 200
- Direct authenticated Confluence POST created the tool landing page successfully

## Confluence Decisions
- Save exports under POCs page: `https://partechnology.atlassian.net/wiki/spaces/EDT/pages/7493847876/POCs`
- Tool landing page title: `RDS Index Reviewer`
- Tool landing page was created successfully by direct API test
- Tool landing page page id: `7531266187`
- Child report naming: `RDS Index Report_YYYYMMDD`
- Use Atlassian account email: `reyam.cruz@partech.com`
- Use AWS Secrets Manager token source:
  - secret name: `jira_token`
  - region: `us-east-1`

## Local Runtime Config
- Root `.env` was created and is now the active local config source
- `.env` contains:
  - `CONFLUENCE_URL=https://partechnology.atlassian.net`
  - `CONFLUENCE_EMAIL=reyam.cruz@partech.com`
  - `CONFLUENCE_API_TOKEN_SECRET_NAME=jira_token`
  - `CONFLUENCE_API_TOKEN_SECRET_REGION=us-east-1`
  - `CONFLUENCE_SPACE_KEY=EDT`
  - `CONFLUENCE_PARENT_PAGE_ID=7493847876`
- Server now loads `.env` automatically from repo root or server dir
- `.env` and `.env.local` are ignored in `.gitignore`

## Important Files Changed
- `client/src/api/client.ts`
- `client/src/App.tsx`
- `client/src/components/ResultsPanel.tsx`
- `server/src/index.ts`
- `server/src/services/confluence.ts`
- `.env`
- `.env.example`
- `.gitignore`
- `README.md`

## Current Open Issue
- Real export tests through the app endpoint `POST /api/confluence/export` still showed the old generic HTML parse error during local testing.
- Strong suspicion: requests were hitting a stale older server process already bound to port `3005`, not the freshly rebuilt server.
- Evidence:
  - `server/dist/services/confluence.js` contains the newer diagnostics and page naming logic
  - direct Confluence API GET/POST tests work with the same email/token combo
  - many `node` processes were already running locally during testing

## Best Next Step For Claude
1. Check which process owns port `3005`
2. Stop or avoid the stale process
3. Start the fresh built server on a clean port like `3011`
4. Re-run a real POST to `/api/confluence/export`
5. Confirm that the child report is created under page `7531266187`

## Suggested Commands For Claude
- `Get-NetTCPConnection -LocalPort 3005 | Select-Object LocalAddress,LocalPort,State,OwningProcess`
- `Get-Process -Id <pid>`
- Start a clean server on another port:
  - PowerShell: set `PORT=3011` for the server process before `npm run start -w server`
- Test payload should include:
  - `database`
  - `instance`
  - `results.missingIndexes`
  - `results.analyzedAt`

## Notes
- The direct landing-page creation succeeded, so Confluence auth and page permissions appear valid.
- The likely remaining problem is local process routing during the API smoke test, not Atlassian credentials.
- Repo is still untracked at the monorepo root (`?? rds-index-reviewer/` from `dbatools` root), so nothing here is committed yet.
