# Claude Code Instructions - J52

> Cloud-Native Voice Assistant + Project Manager

## Project Overview

J52 is the evolution of J5 (Johnny Five) voice assistant into a cloud-native platform.
Instead of running everything on a local Electron desktop app, J52 runs 24/7 on GCP:

- **j52-api** (Cloud Run): REST API gateway - auth, tokens, project/task CRUD, tool proxy
- **j52-worker** (GCE VM): Always-on Linux box - Claude Code, git, background jobs
- **Cloud SQL**: PostgreSQL 15 - replaces local SQL Server
- **Desktop App**: Thin client - voice/audio only, everything else via API

## Architecture

```
Desktop/Mobile  <-->  j52-api (Cloud Run)  <-->  Worker (GCE VM)
                           |                        |
                      Cloud SQL (PG)           Claude Code CLI
                                               Git Repos
```

## GCP Project
- **Project ID**: radpowersports-458409
- **Region**: us-east1
- **VM Zone**: us-east1-b

## Monorepo Structure
- `packages/shared/` - TypeScript types shared across all packages
- `packages/api/` - Express API for Cloud Run
- `packages/worker/` - Background daemon for GCE VM
- `packages/desktop/` - Electron thin client (future)
- `db/` - PostgreSQL migrations

## Critical Rules

### NEVER KILL NODE/ELECTRON PROCESSES BY NAME
Claude Code runs on Node.js. Killing all node processes kills Claude Code sessions.

### Commit Before Testing
```bash
git add -A && git commit -m "checkpoint: [what]" && git push
```

## Development

```bash
# Install all packages
npm install

# Build shared types first
npm run build:shared

# Run API locally
npm run dev:api

# Run worker locally
npm run dev:worker

# Run database migrations
npm run db:migrate
```
