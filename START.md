# J52 — Cloud-Native Voice Assistant + Project Manager

**Last Updated:** 2026-02-26
**Version:** 0.1
**Status:** Active

---

## Quick Summary

J52 is the evolution of J5 (Johnny Five) into a cloud-native, always-on AI assistant that manages multiple projects autonomously. Runs 24/7 on GCP — Express API on Cloud Run, Claude Code worker on a GCE VM, PostgreSQL on Cloud SQL.

---

## Read These Files In Order

1. `START.md` — You are here
2. `.ai/context.md` — Architecture, tech stack, GCP infrastructure, API endpoints
3. `.ai/active_tasks.md` — Current task list and priorities
4. `.ai/session_log.md` — What happened in previous sessions

---

## Tech Stack

- **Language:** TypeScript (Node.js 20)
- **API Framework:** Express.js
- **Database:** PostgreSQL 16 (Google Cloud SQL)
- **Deployment:** Cloud Run (API), GCE VM (Worker)
- **Auth:** Firestore + JWT
- **Voice:** OpenAI Realtime API via WebRTC
- **AI:** Claude Code CLI on VM

---

## Project Structure

```
J52/
├── START.md                  # This file
├── CLAUDE.md                 # Claude Code instructions
├── .ai/
│   ├── context.md            # Architecture, infra, decisions
│   ├── active_tasks.md       # Task list and priorities
│   └── session_log.md        # Session history
├── packages/
│   ├── shared/               # TypeScript types (Project, Session, Task, Tool, Memory, Auth)
│   ├── api/                  # Express API → Cloud Run
│   │   └── src/
│   │       ├── routes/       # auth, token, projects, sessions, tasks, memory
│   │       ├── middleware/    # JWT auth, Firestore sessions
│   │       ├── db/           # PostgreSQL pool, queries
│   │       └── services/     # Secret Manager
│   ├── worker/               # Background daemon → GCE VM
│   │   └── src/
│   │       ├── tools/        # shell, file-ops, web-search, git-ops
│   │       ├── claude-runner/ # Claude Code session management
│   │       ├── scheduler/    # Cron-like jobs
│   │       └── monitors/     # Project watcher
│   └── desktop/              # Electron thin client (future)
├── db/
│   └── migrations/           # PostgreSQL migration scripts
├── infra/scripts/            # VM bootstrap, deploy scripts
├── .github/workflows/        # CI/CD
├── Dockerfile                # Cloud Run container
└── .gitignore
```

---

## How to Run

```bash
# Install all packages
npm install

# Build everything
npm run build

# Run API locally (needs env vars)
npm run dev:api

# Run worker locally
npm run dev:worker

# Run database migrations
npm run db:migrate
```

---

## Current Priorities

1. Wire up tool proxy between Cloud Run API and worker VM
2. Configure Claude Code API key on VM
3. Clone first project repo and register it in the database

---

## GCP Infrastructure

| Resource | Details |
|----------|---------|
| **API URL** | `https://j52-api-520578646803.us-east1.run.app` |
| **VM** | `j52-vm` at `35.211.50.24` (us-east1-b) |
| **Cloud SQL** | `main-sql`, database `j52`, connection `radpowersports-458409:us-east1:main-sql` |
| **GCP Project** | `radpowersports-458409` |
| **GCP Account** | `zimatabrand@gmail.com` |

---

## Git / Deployment

- **Repo:** `https://github.com/zimatabrand/J52`
- **Branch:** `main`
- **API Deploy:** Cloud Run (auto via GitHub Actions on push to main)
- **Worker Deploy:** SSH to VM, git pull, rebuild, restart systemd

Always verify GitHub auth before pushing:
```bash
gh auth switch --user zimatabrand
```

---

## Context Commands

- **`xx.save`** — Save all current work context to `.ai/` files so the next session can resume seamlessly. See `E:\2026_Code\000_chat_instructions\context_system.md` for full details.

---

## Resume Instructions

Next AI session: read the files listed above in order. Check `.ai/active_tasks.md` for what to work on. Check `.ai/session_log.md` for what was done last.
