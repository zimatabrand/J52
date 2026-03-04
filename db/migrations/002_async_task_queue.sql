-- J52 Migration 002: Async Task Queue
-- Adds columns to tasks table for async Claude Code execution

-- Drop existing CHECK constraint on status, add 'queued' and 'failed'
ALTER TABLE j5.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE j5.tasks ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'blocked', 'deferred', 'queued', 'failed'));

-- Add async execution columns
ALTER TABLE j5.tasks ADD COLUMN IF NOT EXISTS worker_id VARCHAR(100);
ALTER TABLE j5.tasks ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ;
ALTER TABLE j5.tasks ADD COLUMN IF NOT EXISTS started_at_worker TIMESTAMPTZ;
ALTER TABLE j5.tasks ADD COLUMN IF NOT EXISTS result_summary TEXT;
ALTER TABLE j5.tasks ADD COLUMN IF NOT EXISTS result_output TEXT;
ALTER TABLE j5.tasks ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE j5.tasks ADD COLUMN IF NOT EXISTS project_path VARCHAR(500);
ALTER TABLE j5.tasks ADD COLUMN IF NOT EXISTS claude_prompt TEXT;
ALTER TABLE j5.tasks ADD COLUMN IF NOT EXISTS execution_metadata JSONB;

-- Index for worker polling: find queued tasks quickly
CREATE INDEX IF NOT EXISTS idx_tasks_queued ON j5.tasks(status, queued_at) WHERE status = 'queued';

-- Index for notification polling: find recently updated tasks
CREATE INDEX IF NOT EXISTS idx_tasks_updated ON j5.tasks(updated_at);

-- Index for preventing duplicate project runs
CREATE INDEX IF NOT EXISTS idx_tasks_active_project ON j5.tasks(project_path, status)
    WHERE status IN ('queued', 'in_progress') AND project_path IS NOT NULL;

-- Record this migration
INSERT INTO j5.schema_migrations (version, name) VALUES (2, '002_async_task_queue');
