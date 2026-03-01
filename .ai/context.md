# Project Context

## Overview

J52 is the evolution of J5 (Johnny Five) voice assistant into a cloud-native, always-on platform. Instead of running everything on a local Electron desktop app, J52 runs 24/7 on GCP — accessible from desktop, mobile, and eventually phone calls. It combines voice assistant capabilities with autonomous project management (ported from the Enhanced AI Chat Bot Python/PyQt6 app).

## Tech Stack

- **Language:** TypeScript (Node.js 20)
- **API Framework:** Express.js
- **Database:** PostgreSQL 16 (Cloud SQL)
- **Deployment:** Google Cloud Run (API), GCE VM (Worker)
- **Auth:** Firestore device sessions + JWT
- **Voice:** OpenAI Realtime API via WebRTC
- **AI Backend:** Claude Code CLI on VM
- **Monorepo:** npm workspaces

## Architecture

```
Desktop/Mobile  <-->  j52-api (Cloud Run)  <-->  Worker (GCE VM)
Phone/Twilio    <-->       |                        |
                      Cloud SQL (PG16)          Claude Code CLI
                      Firestore (auth)          Git Repos (/opt/j52/repos/)
                      Secret Manager            Background Jobs
```

### Components

- **j52-api (Cloud Run):** REST API gateway — auth, OpenAI token minting, project/task/session/memory CRUD. Connects to Cloud SQL via Unix socket (Cloud SQL Auth Proxy). Scales to zero when idle.
- **j52-worker (GCE VM):** Always-on Linux daemon — runs Claude Code sessions, manages git repos, executes shell/file/web tools, monitors projects. Managed by systemd.
- **Cloud SQL:** `main-sql` instance (PG 16, db-custom-2-8192). Database `j52`. 11 tables + per-project dynamic schemas.
- **Desktop App:** Future Electron thin client — voice/audio only, all logic via API.

### Database Schema (11 tables)

- `schema_registry` — tracks per-project schemas
- `projects` — project metadata, repo URLs, status
- `ai_sessions` — Claude Code / AI session records
- `chat_io_log` — chat message history
- `tasks` — task tracking with status/priority
- `user_settings` — key-value user preferences
- `memory_facts` — persistent AI memory facts
- `audit_log` — action audit trail
- `session_summaries` — session summary storage
- `ai_providers` — AI provider configs
- `schema_migrations` — migration version tracking

Plus `create_project_schema()` function for dynamic per-project schemas.

## GCP Infrastructure

| Resource | Details |
|----------|---------|
| **GCP Project** | `radpowersports-458409` |
| **GCP Account** | `zimatabrand@gmail.com` |
| **Region** | us-east1 |
| **Cloud Run API** | `https://j52-api-520578646803.us-east1.run.app` |
| **GCE VM** | `j52-vm` — `35.211.50.24` (us-east1-b), e2-standard-2, Ubuntu 22.04 |
| **Cloud SQL** | `main-sql` instance, database `j52`, user `j52_user` |
| **SQL Connection** | `radpowersports-458409:us-east1:main-sql` |
| **Secrets** | `j52-database-url` (Unix socket), `j52-database-url-public` (TCP) |

## Key Decisions

- **Reused existing `main-sql` Cloud SQL instance** instead of creating a new db-f1-micro — saves $9/month, already provisioned
- **Cloud SQL Auth Proxy** for Cloud Run → PostgreSQL connectivity (Unix socket at `/cloudsql/CONNECTION_NAME`)
- **Non-fatal DB init** — API starts and serves auth/token routes even if DB connection is slow
- **Firestore for device auth** — reused from existing token-broker, proven pattern
- **npm workspaces monorepo** — shared types compiled with `composite: true` project references
- **systemd** for worker daemon management on VM
- **Per-project PostgreSQL schemas** — dynamic schema creation via SQL function, same pattern as Enhanced AI Chat Bot

## Known Issues

- **Worker not fully operational** — needs ANTHROPIC_API_KEY configured on VM for Claude Code
- **No tool proxy** — Cloud Run API cannot yet dispatch tool calls to the worker VM (need HTTP endpoint on worker or Pub/Sub bridge)
- **No projects cloned on VM** — `/opt/j52/repos/` is empty, need to clone repos and register projects
- **Desktop app not switched** — still using old token-broker, needs to point to j52-api
- **`tsconfig.tsbuildinfo` caching** — was causing stale builds on VM, fixed by adding to `.gitignore`

## Environment / Deployment

### Cloud Run (API)
```bash
# Deploy
gcloud run deploy j52-api \
  --source . \
  --region us-east1 \
  --allow-unauthenticated \
  --add-cloudsql-instances "radpowersports-458409:us-east1:main-sql" \
  --set-env-vars "CLOUD_SQL_CONNECTION_NAME=radpowersports-458409:us-east1:main-sql" \
  --clear-base-image
```

### VM (Worker)
```bash
# SSH to VM
gcloud compute ssh j52-vm --zone=us-east1-b --project=radpowersports-458409

# Worker service
sudo systemctl status j52-worker
sudo systemctl restart j52-worker
journalctl -u j52-worker -f

# Code location on VM
/opt/j52/app/          # Cloned repo
/opt/j52/repos/        # Project repos (empty, needs setup)
```

### GitHub
```bash
# Must switch to zimatabrand account for git/gh operations
gh auth switch --user zimatabrand
```

## API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/health` | Health check |
| POST | `/auth/register` | Register device |
| POST | `/auth/login` | PIN login |
| POST | `/auth/logout` | Logout |
| GET | `/auth/status` | Check auth status |
| POST | `/token/session` | Mint OpenAI Realtime token |
| GET/POST | `/projects` | List/create projects |
| GET/PUT/DELETE | `/projects/:id` | Project CRUD |
| GET/POST | `/sessions` | List/create sessions |
| GET/PUT | `/sessions/:id` | Session CRUD |
| POST/GET | `/sessions/:id/messages` | Chat messages |
| GET/POST | `/tasks` | List/create tasks |
| GET/PUT/DELETE | `/tasks/:id` | Task CRUD |
| GET/POST | `/memory` | List/create memory facts |
| DELETE | `/memory/:id` | Delete memory fact |

## Cost Estimate

~$65/month total: VM ~$50, Cloud SQL ~$9 (shared), Cloud Run ~$5, Secret Manager ~$0.50
