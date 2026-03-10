# Session Log

## Session 1 — 2026-02-26
- **Model:** Claude Opus 4.6
- **What was done:**
  1. Created GitHub repo `zimatabrand/J52` (public)
  2. Scaffolded monorepo with npm workspaces: shared, api, worker, desktop (placeholder)
  3. Wrote 47 files (~5800 lines) — ported auth/token from token-broker, DB schema from Enhanced AI Chat Bot Python app, tool implementations from desktop-app
  4. Created PostgreSQL migration with 11 tables + `create_project_schema()` function
  5. Provisioned GCP infrastructure:
     - Reused existing `main-sql` Cloud SQL instance (PG 16), created `j52` database and `j52_user`
     - Created `j52-vm` (e2-standard-2, Ubuntu 22.04, us-east1-b, 50GB SSD)
     - Installed Node.js 20, Claude Code CLI, PostgreSQL client on VM
     - Ran database migrations (11 tables created)
     - Set up systemd service for worker
  6. Deployed j52-api to Cloud Run (3 attempts — fixed Buildpacks issue, then DB connection timeout, then succeeded with Cloud SQL Auth Proxy)
  7. Verified all API endpoints working end-to-end (health, auth, projects, tasks, memory)
  8. Migrated project to standard `.ai/` context system
- **Key decisions:**
  - Reused existing Cloud SQL instance instead of new db-f1-micro (saves $9/month)
  - Cloud SQL Auth Proxy with Unix socket for Cloud Run connectivity
  - Non-fatal DB init so API serves auth/token even if DB is slow
  - `tsconfig.tsbuildinfo` added to `.gitignore` to prevent stale build cache on VM
- **Files modified:** 47 files created (full monorepo scaffold), plus `.ai/` context files
- **Next priority:** Wire up tool proxy between API and worker VM, configure Claude Code API key on VM, clone first project repo

## Session 2 — 2026-02-26
- **Model:** Claude Opus 4.6
- **What was done:**
  1. Continued from previous context (context window ran out mid-migration)
  2. Completed `.ai/` context system migration — created `context.md`, `session_log.md`, `active_tasks.md`, `START.md`
  3. Updated `xx.save` description in `START.md` to match updated template (now mentions git commit + push)
- **Key decisions:** None — minor template wording update
- **Files modified:** `START.md` (xx.save description updated)
- **Next priority:** Wire up tool proxy between API and worker VM

## Session 3 — 2026-03-10
- **Model:** Claude Opus 4.6
- **What was done:** Fixed J5 → Claude Code git pipeline on VM
  1. **VM: Fixed Dixmont repo ownership** — `chown -R j52:j52` (was owned by `zimatabrand` from manual SSH)
  2. **VM: Multi-account SSH** — Copied dixmontselect-sys key as `id_dixmont`, created `/home/j52/.ssh/config` with `github-dixmont` host alias
  3. **VM: Updated Dixmont remote** — `git@github-dixmont:dixmontselect-sys/dixmont-site.git`
  4. **VM: Git global config** — Set `user.name`, `user.email`, `safe.directory *` for j52 user
  5. **Runner: Added `prepareProject()`** — Best-effort `git pull --ff-only` before running Claude Code
  6. **Runner: Git info in prompt** — Reads `git remote -v` + `git branch` and includes as `=== GIT INFO ===` section so Claude Code knows which account/branch to push to
  7. **Deployed** — Pushed, pulled on VM, built, restarted worker. Verified it immediately worked on a queued Dixmont task.
- **Key decisions:**
  - Wildcard `safe.directory *` — j52 only accesses its own repos, no security risk
  - Best-effort pull — failures don't block the task, just log a warning
  - SSH host aliases for multi-account GitHub — each project repo uses the correct alias in its remote URL
- **Files modified:** `packages/worker/src/claude-runner/runner.ts`, VM files (`/home/j52/.ssh/config`, `/home/j52/.ssh/id_dixmont`)
- **Next priority:** End-to-end voice test via J5 desktop app on Dixmont project
