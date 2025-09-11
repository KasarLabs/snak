-- ============================================================================
-- JOBS MANAGEMENT SYSTEM
-- ============================================================================
-- This file implements a job management system for tracking agent tasks:
-- - Job lifecycle management (pending, running, completed, failed, canceled)
-- - Temporal tracking with proper ordering constraints
-- - User and agent association with foreign key relationships
-- - Performance indexes for efficient querying
-- ============================================================================

-- Jobs Table
-- Tracks the lifecycle and execution status of agent tasks
CREATE TABLE IF NOT EXISTS jobs (
    -- Primary key with auto-generated UUID
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- External job identifier for system integration
    -- VARCHAR(255) provides sufficient length for various job ID formats
    job_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- Reference to the agent executing this job
    -- Foreign key ensures data integrity and enables cascade deletion
    agent_id UUID NOT NULL,
    
    -- User who initiated or owns this job
    -- UUID format for consistency with user management system
    user_id UUID NOT NULL,
    
    -- Job execution status with constraint validation
    -- Default 'pending' for new jobs
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    CONSTRAINT jobs_status_chk CHECK (status IN ('pending','running','completed','failed','canceled')),
    
    -- Error information for failed jobs
    -- TEXT type accommodates detailed error messages and stack traces
    error TEXT,
    
    -- Temporal tracking fields with timezone support
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Temporal ordering constraint ensures logical time progression
    -- Prevents invalid states like completed_at before started_at
    CONSTRAINT jobs_time_order_chk
    CHECK (
      (started_at IS NULL OR started_at >= created_at) AND
      (completed_at IS NULL OR completed_at >= COALESCE(started_at, created_at))
    ),
    
    -- Foreign key relationship to agents table
    -- CASCADE deletion removes jobs when agent is deleted
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Performance Indexes
-- ============================================================================
-- Optimized indexes for common query patterns in job management

-- Agent-based job lookup index
-- Used for: Finding all jobs for a specific agent
-- Query pattern: WHERE agent_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_jobs_agent_id ON jobs(agent_id);

-- User status and time-based job filtering index
-- Used for: Dashboard queries showing user's jobs by status and time
-- Query pattern: WHERE user_id = ? AND status = ? ORDER BY created_at DESC
-- Composite index optimizes multi-column filtering and sorting
CREATE INDEX IF NOT EXISTS idx_jobs_user_status_created_at ON jobs(user_id, status, created_at DESC);

-- ============================================================================
-- USAGE PATTERNS
-- ============================================================================
--
-- Common query patterns optimized by indexes:
--
-- 1. Get all jobs for an agent (uses idx_jobs_agent_id):
--    SELECT * FROM jobs WHERE agent_id = $1 ORDER BY created_at DESC;
--
-- 2. Get user's jobs by status (uses idx_jobs_user_status_created_at):
--    SELECT * FROM jobs WHERE user_id = $1 AND status = 'running' ORDER BY created_at DESC;
--
-- 3. Get recent jobs for user (uses idx_jobs_user_status_created_at):
--    SELECT * FROM jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10;
--
-- 4. Job status transitions:
--    UPDATE jobs SET status = 'running', started_at = NOW() WHERE id = $1;
--    UPDATE jobs SET status = 'completed', completed_at = NOW() WHERE id = $1;
--
-- ============================================================================
