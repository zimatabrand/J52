# Active Tasks

## Current Priority

1. [HIGH] End-to-end voice test — Use J5 desktop app to set Dixmont working dir and ask for a change, verify full pipeline works
2. [MED] Document multi-account SSH setup for new projects — When cloning new repos that use non-default GitHub accounts, their remote needs the correct host alias
3. [MED] Install gh CLI on VM — Useful for PR creation from Claude Code sessions

## Backlog

- [ ] Switch desktop app from old token-broker to j52-api endpoints
- [ ] Build desktop Electron thin client (`packages/desktop/`)
- [ ] Add mobile web interface
- [ ] Set up Twilio integration for phone call access
- [ ] Add Pub/Sub for async task dispatch (alternative to direct HTTP proxy)
- [ ] Add rate limiting middleware to API
- [ ] Add structured logging (Cloud Logging integration)
- [ ] Set up monitoring/alerting for VM and Cloud Run
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
- [DONE] Wire up tool proxy (worker HTTP server on port 9000) — 2026-03-04
- [DONE] Configure ANTHROPIC_API_KEY on VM — 2026-03-04
- [DONE] Clone Dixmont project repo to VM — 2026-03-04
- [DONE] Context-aware Claude Code runner with xx.save protocol — 2026-03-06
- [DONE] Add CI/CD workflow for worker deployment — 2026-03-06
- [DONE] Fix git pipeline: ownership, SSH multi-account, git config, safe.directory — 2026-03-10
- [DONE] Runner: prepareProject() with git pull + git info in prompt — 2026-03-10
