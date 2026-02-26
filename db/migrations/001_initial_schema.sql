-- J52 Initial Schema Migration
-- PostgreSQL 15
-- Ported from SQL Server Enhanced_AI_Chat_Bot schema

-- ============================================
-- PUBLIC SCHEMA: Global tables
-- ============================================

-- Schema registry - tracks all project schemas
CREATE TABLE IF NOT EXISTS public.schema_registry (
    schema_code     VARCHAR(9) PRIMARY KEY,
    parent_schema_code VARCHAR(9) REFERENCES public.schema_registry(schema_code),
    schema_name     VARCHAR(255) NOT NULL,
    schema_level    INTEGER NOT NULL DEFAULT 1,
    has_project_manager_ai BOOLEAN NOT NULL DEFAULT FALSE,
    is_hidden       BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schema_registry_parent ON public.schema_registry(parent_schema_code);
CREATE INDEX idx_schema_registry_active ON public.schema_registry(is_active) WHERE is_active = TRUE;

-- Projects - one per schema
CREATE TABLE IF NOT EXISTS public.projects (
    project_id      SERIAL PRIMARY KEY,
    schema_code     VARCHAR(9) NOT NULL UNIQUE REFERENCES public.schema_registry(schema_code) ON DELETE CASCADE,
    project_name    VARCHAR(255) NOT NULL,
    project_type    VARCHAR(100) NOT NULL DEFAULT 'Software Development',
    base_directory  VARCHAR(500) NOT NULL,
    temp_directory  VARCHAR(500),
    description     TEXT,
    git_repository_url VARCHAR(500),
    primary_language VARCHAR(50),
    framework       VARCHAR(100),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_schema ON public.projects(schema_code);
CREATE INDEX idx_projects_active ON public.projects(is_active) WHERE is_active = TRUE;

-- AI sessions - conversation sessions across projects
CREATE TABLE IF NOT EXISTS public.ai_sessions (
    session_id      SERIAL PRIMARY KEY,
    schema_code     VARCHAR(9) REFERENCES public.schema_registry(schema_code) ON DELETE SET NULL,
    parent_session_id INTEGER REFERENCES public.ai_sessions(session_id),
    ai_provider     VARCHAR(50) NOT NULL DEFAULT 'claude',
    role            VARCHAR(50) NOT NULL DEFAULT 'assistant',
    session_name    VARCHAR(255),
    model           VARCHAR(100),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'paused', 'completed', 'error', 'terminated')),
    token_count_in  BIGINT NOT NULL DEFAULT 0,
    token_count_out BIGINT NOT NULL DEFAULT 0,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_schema ON public.ai_sessions(schema_code);
CREATE INDEX idx_sessions_status ON public.ai_sessions(status);
CREATE INDEX idx_sessions_active ON public.ai_sessions(status) WHERE status = 'active';

-- Chat I/O log - messages within sessions
CREATE TABLE IF NOT EXISTS public.chat_io_log (
    log_id          SERIAL PRIMARY KEY,
    session_id      INTEGER NOT NULL REFERENCES public.ai_sessions(session_id) ON DELETE CASCADE,
    io_type         VARCHAR(10) NOT NULL CHECK (io_type IN ('input', 'output', 'system', 'error')),
    content         TEXT NOT NULL,
    content_format  VARCHAR(20) NOT NULL DEFAULT 'text',
    token_count     INTEGER,
    model_used      VARCHAR(100),
    processing_time_ms INTEGER,
    metadata        JSONB,
    sequence_number INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_io_session ON public.chat_io_log(session_id);
CREATE INDEX idx_chat_io_session_seq ON public.chat_io_log(session_id, sequence_number);

-- Tasks - project tasks and to-dos
CREATE TABLE IF NOT EXISTS public.tasks (
    task_id         SERIAL PRIMARY KEY,
    schema_code     VARCHAR(9) REFERENCES public.schema_registry(schema_code) ON DELETE SET NULL,
    session_id      INTEGER REFERENCES public.ai_sessions(session_id) ON DELETE SET NULL,
    parent_task_id  INTEGER REFERENCES public.tasks(task_id),
    task_title      VARCHAR(500) NOT NULL,
    task_description TEXT,
    task_type       VARCHAR(50) NOT NULL DEFAULT 'general',
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'blocked', 'deferred')),
    priority        INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    assigned_to     VARCHAR(100),
    due_date        TIMESTAMPTZ,
    completed_date  TIMESTAMPTZ,
    estimated_hours NUMERIC(6,2),
    actual_hours    NUMERIC(6,2),
    tags            TEXT[] DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_schema ON public.tasks(schema_code);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_parent ON public.tasks(parent_task_id);
CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to) WHERE assigned_to IS NOT NULL;

-- User settings - key-value pairs per user
CREATE TABLE IF NOT EXISTS public.user_settings (
    setting_id      SERIAL PRIMARY KEY,
    user_id         VARCHAR(100) NOT NULL,
    key             VARCHAR(255) NOT NULL,
    value           TEXT NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, key)
);

-- Memory facts - persistent facts the AI remembers
CREATE TABLE IF NOT EXISTS public.memory_facts (
    fact_id         SERIAL PRIMARY KEY,
    content         VARCHAR(500) NOT NULL,
    category        VARCHAR(50) NOT NULL DEFAULT 'general',
    source          VARCHAR(100) NOT NULL DEFAULT 'user',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_memory_category ON public.memory_facts(category);

-- Audit log - tracks important system events
CREATE TABLE IF NOT EXISTS public.audit_log (
    log_id          SERIAL PRIMARY KEY,
    user_id         VARCHAR(100),
    action          VARCHAR(100) NOT NULL,
    resource_type   VARCHAR(50) NOT NULL,
    resource_id     VARCHAR(255),
    details         JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_action ON public.audit_log(action);
CREATE INDEX idx_audit_resource ON public.audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_created ON public.audit_log(created_at);

-- Session summaries - AI-generated session digests
CREATE TABLE IF NOT EXISTS public.session_summaries (
    summary_id      SERIAL PRIMARY KEY,
    session_id      INTEGER NOT NULL REFERENCES public.ai_sessions(session_id) ON DELETE CASCADE,
    summary_type    VARCHAR(20) NOT NULL DEFAULT 'session',
    summary_content TEXT NOT NULL,
    key_decisions   JSONB,
    key_actions     JSONB,
    files_modified  JSONB,
    log_id_start    INTEGER,
    log_id_end      INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_summaries_session ON public.session_summaries(session_id);

-- AI providers - registry of available AI tools
CREATE TABLE IF NOT EXISTS public.ai_providers (
    provider_id     SERIAL PRIMARY KEY,
    provider_name   VARCHAR(50) NOT NULL UNIQUE,
    display_name    VARCHAR(100) NOT NULL,
    launch_command  VARCHAR(500) NOT NULL,
    default_args    VARCHAR(500),
    api_endpoint    VARCHAR(500),
    model_name      VARCHAR(100),
    max_tokens      INTEGER,
    supports_streaming BOOLEAN NOT NULL DEFAULT TRUE,
    supports_vision BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- Migrations tracking
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version         INTEGER PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Record this migration
INSERT INTO public.schema_migrations (version, name) VALUES (1, '001_initial_schema');

-- ============================================
-- FUNCTION: Create per-project schema
-- ============================================
CREATE OR REPLACE FUNCTION public.create_project_schema(
    p_schema_code VARCHAR(9),
    p_schema_name VARCHAR(255),
    p_project_name VARCHAR(255),
    p_project_type VARCHAR(100),
    p_base_directory VARCHAR(500),
    p_temp_directory VARCHAR(500) DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_parent_schema_code VARCHAR(9) DEFAULT NULL,
    p_has_project_manager_ai BOOLEAN DEFAULT FALSE
) RETURNS TEXT AS $$
DECLARE
    v_schema_level INTEGER := 1;
BEGIN
    -- Calculate schema level
    IF p_parent_schema_code IS NOT NULL THEN
        SELECT schema_level + 1 INTO v_schema_level
        FROM public.schema_registry
        WHERE schema_code = p_parent_schema_code;

        IF v_schema_level IS NULL THEN
            RETURN 'ERROR: Parent schema not found: ' || p_parent_schema_code;
        END IF;
    END IF;

    -- Register in schema_registry
    INSERT INTO public.schema_registry (
        schema_code, parent_schema_code, schema_name, schema_level,
        has_project_manager_ai
    ) VALUES (
        UPPER(p_schema_code), p_parent_schema_code, p_schema_name, v_schema_level,
        p_has_project_manager_ai
    );

    -- Create project record
    INSERT INTO public.projects (
        schema_code, project_name, project_type, base_directory,
        temp_directory, description
    ) VALUES (
        UPPER(p_schema_code), p_project_name, p_project_type, p_base_directory,
        p_temp_directory, p_description
    );

    -- Create the actual PostgreSQL schema for project-specific tables
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', LOWER(p_schema_code));

    -- Create per-project tables in the new schema
    EXECUTE format('
        CREATE TABLE %I.project_files (
            file_id         SERIAL PRIMARY KEY,
            file_path       VARCHAR(500) NOT NULL,
            file_name       VARCHAR(255) NOT NULL,
            file_extension  VARCHAR(20),
            file_size_bytes BIGINT,
            content_hash    VARCHAR(64),
            is_tracked      BOOLEAN NOT NULL DEFAULT TRUE,
            last_modified   TIMESTAMPTZ,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )', LOWER(p_schema_code));

    EXECUTE format('
        CREATE TABLE %I.document_index (
            doc_id          SERIAL PRIMARY KEY,
            file_id         INTEGER,
            doc_type        VARCHAR(50) NOT NULL DEFAULT ''general'',
            title           VARCHAR(500),
            content         TEXT,
            summary         TEXT,
            tags            TEXT[] DEFAULT ''{}'',
            is_active       BOOLEAN NOT NULL DEFAULT TRUE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )', LOWER(p_schema_code));

    EXECUTE format('
        CREATE TABLE %I.project_context (
            context_id      SERIAL PRIMARY KEY,
            context_type    VARCHAR(50) NOT NULL,
            content         TEXT NOT NULL,
            version         INTEGER NOT NULL DEFAULT 1,
            change_reason   VARCHAR(500),
            is_current      BOOLEAN NOT NULL DEFAULT TRUE,
            created_by_session INTEGER,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )', LOWER(p_schema_code));

    EXECUTE format('
        CREATE TABLE %I.file_watch_events (
            event_id        SERIAL PRIMARY KEY,
            event_type      VARCHAR(20) NOT NULL,
            file_path       VARCHAR(500) NOT NULL,
            old_path        VARCHAR(500),
            file_name       VARCHAR(255),
            file_extension  VARCHAR(20),
            is_directory    BOOLEAN NOT NULL DEFAULT FALSE,
            is_processed    BOOLEAN NOT NULL DEFAULT FALSE,
            event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            processed_at    TIMESTAMPTZ
        )', LOWER(p_schema_code));

    RETURN 'OK: Schema ' || UPPER(p_schema_code) || ' created successfully';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER trg_schema_registry_updated BEFORE UPDATE ON public.schema_registry
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
CREATE TRIGGER trg_memory_facts_updated BEFORE UPDATE ON public.memory_facts
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
CREATE TRIGGER trg_user_settings_updated BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ============================================
-- Seed data: Default AI provider
-- ============================================
INSERT INTO public.ai_providers (provider_name, display_name, launch_command, model_name)
VALUES ('claude', 'Anthropic Claude', 'claude', 'claude-opus-4-6')
ON CONFLICT (provider_name) DO NOTHING;
