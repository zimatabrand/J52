# Active Tasks

## Current Priority

1. [HIGH] Wire up tool proxy between Cloud Run API and worker VM — Need HTTP endpoint on worker so API can dispatch tool calls (shell, file-ops, git, Claude Code) to the VM
2. [HIGH] Configure ANTHROPIC_API_KEY on VM — Claude Code CLI needs API key to run sessions
3. [HIGH] Clone first project repo to VM — `/opt/j52/repos/` is empty, need to register a project and clone its repo

## Backlog

- [ ] Switch desktop app from old token-broker to j52-api endpoints
- [ ] Build desktop Electron thin client (`packages/desktop/`)
- [ ] Add mobile web interface
- [ ] Set up Twilio integration for phone call access
- [ ] Add Pub/Sub for async task dispatch (alternative to direct HTTP proxy)
- [ ] Add rate limiting middleware to API
- [ ] Add structured logging (Cloud Logging integration)
- [ ] Set up monitoring/alerting for VM and Cloud Run
- [ ] Add CI/CD workflow for worker deployment to VM
- [ ] Implement project watcher (fs.watch) on VM for auto-detecting changes

## Completed

- [DONE] Create GitHub repo `zimatabrand/J52` — 2026-02-26
- [DONE] Scaffold monorepo with npm workspaces (shared, api, worker, desktop) — 2026-02-26
- [DONE] Port auth/token routes from token-broker — 2026-02-26
- [DONE] Port DB schema from Enhanced AI Chat Bot (SQL Server → PostgreSQL) — 2026-02-26
- [DONE] Write project/session/task/memory CRUD routes — 2026-02-26
- [DONE] Write worker tool implementations (shell, file-ops, web-search, git-ops) — 2026-02-26
- [DONE] Provision GCP infrastructure (Cloud SQL, GCE VM, secrets) — 2026-02-26
- [DONE] Run database migrations (11 tables) — 2026-02-26
- [DONE] Deploy j52-api to Cloud Run with Cloud SQL Auth Proxy — 2026-02-26
- [DONE] Verify all API endpoints working end-to-end — 2026-02-26
- [DONE] Set up systemd service for worker on VM — 2026-02-26
- [DONE] Migrate to standard `.ai/` context system — 2026-02-26
