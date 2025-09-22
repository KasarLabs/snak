-- ============================================================================
-- PROMPTS TABLE AND FUNCTIONS
-- ============================================================================

-- Prompts table to store different types of prompts for agents
CREATE TABLE prompts (
    -- Unique identifier for each prompt record
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- User who owns these prompts
    user_id UUID NOT NULL,

    -- Agent this prompt configuration belongs to (foreign key to agents table)
    agent_id UUID NOT NULL,

    -- Different prompt types for agent operations
    task_executor_prompt TEXT NOT NULL,
    task_manager_prompt TEXT NOT NULL,
    task_verifier_prompt TEXT NOT NULL,
    task_memory_manager_prompt TEXT NOT NULL,

    -- Public/private visibility
    public BOOLEAN NOT NULL DEFAULT FALSE,

    -- Community voting system
    upvote INTEGER NOT NULL DEFAULT 0,
    downvote INTEGER NOT NULL DEFAULT 0,

    -- Metadata fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT prompts_user_id_not_null CHECK (user_id IS NOT NULL),
    CONSTRAINT prompts_agent_id_not_null CHECK (agent_id IS NOT NULL),
    CONSTRAINT prompts_task_executor_not_empty CHECK (length(trim(task_executor_prompt)) > 0),
    CONSTRAINT prompts_task_manager_not_empty CHECK (length(trim(task_manager_prompt)) > 0),
    CONSTRAINT prompts_task_verifier_not_empty CHECK (length(trim(task_verifier_prompt)) > 0),
    CONSTRAINT prompts_task_memory_manager_not_empty CHECK (length(trim(task_memory_manager_prompt)) > 0),
    CONSTRAINT prompts_upvote_non_negative CHECK (upvote >= 0),
    CONSTRAINT prompts_downvote_non_negative CHECK (downvote >= 0),

    -- Foreign key constraint to agents table
    CONSTRAINT fk_prompts_agent_id FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for user_id queries
CREATE INDEX idx_prompts_user_id ON prompts (user_id);

-- Index for agent_id queries
CREATE INDEX idx_prompts_agent_id ON prompts (agent_id);

-- Index for public prompts
CREATE INDEX idx_prompts_public ON prompts (public);

-- Index for creation date ordering
CREATE INDEX idx_prompts_created_at ON prompts (created_at);

-- Index for popularity sorting (upvotes - downvotes)
CREATE INDEX idx_prompts_popularity ON prompts ((upvote - downvote) DESC);

-- Composite index for user's agent prompts
CREATE INDEX idx_prompts_user_agent ON prompts (user_id, agent_id);

-- Composite index for public prompts with popularity
CREATE INDEX idx_prompts_public_popularity ON prompts (public, (upvote - downvote) DESC);

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================

-- Trigger to update updated_at on prompts table
CREATE TRIGGER update_prompts_updated_at
    BEFORE UPDATE ON prompts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INDIVIDUAL UPDATE FUNCTIONS
-- ============================================================================

-- Function to update task executor prompt
CREATE OR REPLACE FUNCTION update_task_executor_prompt(
    p_prompt_id UUID,
    p_task_executor_prompt TEXT
) RETURNS TABLE (
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    rows_updated INTEGER;
BEGIN
    -- Validate input
    IF p_task_executor_prompt IS NULL OR length(trim(p_task_executor_prompt)) = 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Task executor prompt cannot be empty' AS message;
        RETURN;
    END IF;

    -- Update the specific field
    UPDATE prompts
    SET task_executor_prompt = p_task_executor_prompt,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_prompt_id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    IF rows_updated > 0 THEN
        RETURN QUERY SELECT
            TRUE AS success,
            'Task executor prompt updated successfully' AS message;
    ELSE
        RETURN QUERY SELECT
            FALSE AS success,
            'Prompt not found with ID: ' || p_prompt_id::TEXT AS message;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Error updating task executor prompt: ' || SQLERRM AS message;
END;
$$;

-- Function to update task manager prompt
CREATE OR REPLACE FUNCTION update_task_manager_prompt(
    p_prompt_id UUID,
    p_task_manager_prompt TEXT
) RETURNS TABLE (
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    rows_updated INTEGER;
BEGIN
    -- Validate input
    IF p_task_manager_prompt IS NULL OR length(trim(p_task_manager_prompt)) = 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Task manager prompt cannot be empty' AS message;
        RETURN;
    END IF;

    -- Update the specific field
    UPDATE prompts
    SET task_manager_prompt = p_task_manager_prompt,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_prompt_id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    IF rows_updated > 0 THEN
        RETURN QUERY SELECT
            TRUE AS success,
            'Task manager prompt updated successfully' AS message;
    ELSE
        RETURN QUERY SELECT
            FALSE AS success,
            'Prompt not found with ID: ' || p_prompt_id::TEXT AS message;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Error updating task manager prompt: ' || SQLERRM AS message;
END;
$$;

-- Function to update task verifier prompt
CREATE OR REPLACE FUNCTION update_task_verifier_prompt(
    p_prompt_id UUID,
    p_task_verifier_prompt TEXT
) RETURNS TABLE (
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    rows_updated INTEGER;
BEGIN
    -- Validate input
    IF p_task_verifier_prompt IS NULL OR length(trim(p_task_verifier_prompt)) = 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Task verifier prompt cannot be empty' AS message;
        RETURN;
    END IF;

    -- Update the specific field
    UPDATE prompts
    SET task_verifier_prompt = p_task_verifier_prompt,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_prompt_id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    IF rows_updated > 0 THEN
        RETURN QUERY SELECT
            TRUE AS success,
            'Task verifier prompt updated successfully' AS message;
    ELSE
        RETURN QUERY SELECT
            FALSE AS success,
            'Prompt not found with ID: ' || p_prompt_id::TEXT AS message;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Error updating task verifier prompt: ' || SQLERRM AS message;
END;
$$;

-- Function to update task memory manager prompt
CREATE OR REPLACE FUNCTION update_task_memory_manager_prompt(
    p_prompt_id UUID,
    p_task_memory_manager_prompt TEXT
) RETURNS TABLE (
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    rows_updated INTEGER;
BEGIN
    -- Validate input
    IF p_task_memory_manager_prompt IS NULL OR length(trim(p_task_memory_manager_prompt)) = 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Task memory manager prompt cannot be empty' AS message;
        RETURN;
    END IF;

    -- Update the specific field
    UPDATE prompts
    SET task_memory_manager_prompt = p_task_memory_manager_prompt,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_prompt_id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    IF rows_updated > 0 THEN
        RETURN QUERY SELECT
            TRUE AS success,
            'Task memory manager prompt updated successfully' AS message;
    ELSE
        RETURN QUERY SELECT
            FALSE AS success,
            'Prompt not found with ID: ' || p_prompt_id::TEXT AS message;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Error updating task memory manager prompt: ' || SQLERRM AS message;
END;
$$;

-- Function to update public visibility
CREATE OR REPLACE FUNCTION update_prompt_visibility(
    p_prompt_id UUID,
    p_public BOOLEAN
) RETURNS TABLE (
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    rows_updated INTEGER;
BEGIN
    -- Update the visibility field
    UPDATE prompts
    SET public = p_public,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_prompt_id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    IF rows_updated > 0 THEN
        RETURN QUERY SELECT
            TRUE AS success,
            'Prompt visibility updated successfully' AS message;
    ELSE
        RETURN QUERY SELECT
            FALSE AS success,
            'Prompt not found with ID: ' || p_prompt_id::TEXT AS message;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Error updating prompt visibility: ' || SQLERRM AS message;
END;
$$;

-- Function to update upvote count
CREATE OR REPLACE FUNCTION update_prompt_upvote(
    p_prompt_id UUID,
    p_upvote INTEGER
) RETURNS TABLE (
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    rows_updated INTEGER;
BEGIN
    -- Validate input
    IF p_upvote < 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Upvote count cannot be negative' AS message;
        RETURN;
    END IF;

    -- Update the upvote field
    UPDATE prompts
    SET upvote = p_upvote,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_prompt_id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    IF rows_updated > 0 THEN
        RETURN QUERY SELECT
            TRUE AS success,
            'Prompt upvote count updated successfully' AS message;
    ELSE
        RETURN QUERY SELECT
            FALSE AS success,
            'Prompt not found with ID: ' || p_prompt_id::TEXT AS message;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Error updating prompt upvote: ' || SQLERRM AS message;
END;
$$;

-- Function to update downvote count
CREATE OR REPLACE FUNCTION update_prompt_downvote(
    p_prompt_id UUID,
    p_downvote INTEGER
) RETURNS TABLE (
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    rows_updated INTEGER;
BEGIN
    -- Validate input
    IF p_downvote < 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Downvote count cannot be negative' AS message;
        RETURN;
    END IF;

    -- Update the downvote field
    UPDATE prompts
    SET downvote = p_downvote,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_prompt_id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    IF rows_updated > 0 THEN
        RETURN QUERY SELECT
            TRUE AS success,
            'Prompt downvote count updated successfully' AS message;
    ELSE
        RETURN QUERY SELECT
            FALSE AS success,
            'Prompt not found with ID: ' || p_prompt_id::TEXT AS message;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Error updating prompt downvote: ' || SQLERRM AS message;
END;
$$;

-- ============================================================================
-- BULK UPDATE FUNCTIONS
-- ============================================================================

-- Function to update all prompt fields at once
CREATE OR REPLACE FUNCTION update_all_prompts(
    p_prompt_id UUID,
    p_task_executor_prompt TEXT DEFAULT NULL,
    p_task_manager_prompt TEXT DEFAULT NULL,
    p_task_verifier_prompt TEXT DEFAULT NULL,
    p_task_memory_manager_prompt TEXT DEFAULT NULL,
    p_public BOOLEAN DEFAULT NULL,
    p_upvote INTEGER DEFAULT NULL,
    p_downvote INTEGER DEFAULT NULL
) RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    updated_prompt_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
    existing_prompt prompts%ROWTYPE;
    rows_updated INTEGER;
BEGIN
    -- Check if prompt exists
    SELECT * INTO existing_prompt FROM prompts WHERE id = p_prompt_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Prompt not found with ID: ' || p_prompt_id::TEXT AS message,
            NULL::UUID AS updated_prompt_id;
        RETURN;
    END IF;

    -- Validate non-null prompt fields if provided
    IF p_task_executor_prompt IS NOT NULL AND length(trim(p_task_executor_prompt)) = 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Task executor prompt cannot be empty' AS message,
            NULL::UUID AS updated_prompt_id;
        RETURN;
    END IF;

    IF p_task_manager_prompt IS NOT NULL AND length(trim(p_task_manager_prompt)) = 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Task manager prompt cannot be empty' AS message,
            NULL::UUID AS updated_prompt_id;
        RETURN;
    END IF;

    IF p_task_verifier_prompt IS NOT NULL AND length(trim(p_task_verifier_prompt)) = 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Task verifier prompt cannot be empty' AS message,
            NULL::UUID AS updated_prompt_id;
        RETURN;
    END IF;

    IF p_task_memory_manager_prompt IS NOT NULL AND length(trim(p_task_memory_manager_prompt)) = 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Task memory manager prompt cannot be empty' AS message,
            NULL::UUID AS updated_prompt_id;
        RETURN;
    END IF;

    -- Validate vote counts if provided
    IF p_upvote IS NOT NULL AND p_upvote < 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Upvote count cannot be negative' AS message,
            NULL::UUID AS updated_prompt_id;
        RETURN;
    END IF;

    IF p_downvote IS NOT NULL AND p_downvote < 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Downvote count cannot be negative' AS message,
            NULL::UUID AS updated_prompt_id;
        RETURN;
    END IF;

    -- Perform the update with COALESCE to keep existing values when NULL is passed
    UPDATE prompts SET
        task_executor_prompt = COALESCE(p_task_executor_prompt, task_executor_prompt),
        task_manager_prompt = COALESCE(p_task_manager_prompt, task_manager_prompt),
        task_verifier_prompt = COALESCE(p_task_verifier_prompt, task_verifier_prompt),
        task_memory_manager_prompt = COALESCE(p_task_memory_manager_prompt, task_memory_manager_prompt),
        public = COALESCE(p_public, public),
        upvote = COALESCE(p_upvote, upvote),
        downvote = COALESCE(p_downvote, downvote),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_prompt_id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    IF rows_updated > 0 THEN
        RETURN QUERY SELECT
            TRUE AS success,
            'All prompt fields updated successfully' AS message,
            p_prompt_id AS updated_prompt_id;
    ELSE
        RETURN QUERY SELECT
            FALSE AS success,
            'Failed to update prompt' AS message,
            NULL::UUID AS updated_prompt_id;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Error updating prompt: ' || SQLERRM AS message,
            NULL::UUID AS updated_prompt_id;
END;
$$;

-- Function to completely replace all prompt fields (all required)
CREATE OR REPLACE FUNCTION replace_all_prompts(
    p_prompt_id UUID,
    p_task_executor_prompt TEXT,
    p_task_manager_prompt TEXT,
    p_task_verifier_prompt TEXT,
    p_task_memory_manager_prompt TEXT,
    p_public BOOLEAN,
    p_upvote INTEGER,
    p_downvote INTEGER
) RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    updated_prompt_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
    rows_updated INTEGER;
BEGIN
    -- Check if prompt exists
    IF NOT EXISTS (SELECT 1 FROM prompts WHERE id = p_prompt_id) THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Prompt not found with ID: ' || p_prompt_id::TEXT AS message,
            NULL::UUID AS updated_prompt_id;
        RETURN;
    END IF;

    -- Validate all required fields
    IF p_task_executor_prompt IS NULL OR length(trim(p_task_executor_prompt)) = 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Task executor prompt is required and cannot be empty' AS message,
            NULL::UUID AS updated_prompt_id;
        RETURN;
    END IF;

    IF p_task_manager_prompt IS NULL OR length(trim(p_task_manager_prompt)) = 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Task manager prompt is required and cannot be empty' AS message,
            NULL::UUID AS updated_prompt_id;
        RETURN;
    END IF;

    IF p_task_verifier_prompt IS NULL OR length(trim(p_task_verifier_prompt)) = 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Task verifier prompt is required and cannot be empty' AS message,
            NULL::UUID AS updated_prompt_id;
        RETURN;
    END IF;

    IF p_task_memory_manager_prompt IS NULL OR length(trim(p_task_memory_manager_prompt)) = 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Task memory manager prompt is required and cannot be empty' AS message,
            NULL::UUID AS updated_prompt_id;
        RETURN;
    END IF;

    IF p_upvote < 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Upvote count cannot be negative' AS message,
            NULL::UUID AS updated_prompt_id;
        RETURN;
    END IF;

    IF p_downvote < 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Downvote count cannot be negative' AS message,
            NULL::UUID AS updated_prompt_id;
        RETURN;
    END IF;

    -- Completely replace all fields
    UPDATE prompts SET
        task_executor_prompt = p_task_executor_prompt,
        task_manager_prompt = p_task_manager_prompt,
        task_verifier_prompt = p_task_verifier_prompt,
        task_memory_manager_prompt = p_task_memory_manager_prompt,
        public = p_public,
        upvote = p_upvote,
        downvote = p_downvote,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_prompt_id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    IF rows_updated > 0 THEN
        RETURN QUERY SELECT
            TRUE AS success,
            'All prompt fields replaced successfully' AS message,
            p_prompt_id AS updated_prompt_id;
    ELSE
        RETURN QUERY SELECT
            FALSE AS success,
            'Failed to replace prompt' AS message,
            NULL::UUID AS updated_prompt_id;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Error replacing prompt: ' || SQLERRM AS message,
            NULL::UUID AS updated_prompt_id;
END;
$$;

-- ============================================================================
-- VOTING HELPER FUNCTIONS
-- ============================================================================

-- Function to increment upvote
CREATE OR REPLACE FUNCTION increment_upvote(
    p_prompt_id UUID
) RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_upvote_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    rows_updated INTEGER;
    current_upvote INTEGER;
BEGIN
    -- Update upvote count by incrementing
    UPDATE prompts
    SET upvote = upvote + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_prompt_id
    RETURNING upvote INTO current_upvote;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    IF rows_updated > 0 THEN
        RETURN QUERY SELECT
            TRUE AS success,
            'Upvote incremented successfully' AS message,
            current_upvote AS new_upvote_count;
    ELSE
        RETURN QUERY SELECT
            FALSE AS success,
            'Prompt not found with ID: ' || p_prompt_id::TEXT AS message,
            0 AS new_upvote_count;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Error incrementing upvote: ' || SQLERRM AS message,
            0 AS new_upvote_count;
END;
$$;

-- Function to increment downvote
CREATE OR REPLACE FUNCTION increment_downvote(
    p_prompt_id UUID
) RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_downvote_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    rows_updated INTEGER;
    current_downvote INTEGER;
BEGIN
    -- Update downvote count by incrementing
    UPDATE prompts
    SET downvote = downvote + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_prompt_id
    RETURNING downvote INTO current_downvote;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    IF rows_updated > 0 THEN
        RETURN QUERY SELECT
            TRUE AS success,
            'Downvote incremented successfully' AS message,
            current_downvote AS new_downvote_count;
    ELSE
        RETURN QUERY SELECT
            FALSE AS success,
            'Prompt not found with ID: ' || p_prompt_id::TEXT AS message,
            0 AS new_downvote_count;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Error incrementing downvote: ' || SQLERRM AS message,
            0 AS new_downvote_count;
END;
$$;

-- ============================================================================
-- QUERY HELPER FUNCTIONS
-- ============================================================================

-- Function to get prompts by user
CREATE OR REPLACE FUNCTION get_prompts_by_user(
    p_user_id UUID
) RETURNS TABLE (
    id UUID,
    user_id UUID,
    agent_id UUID,
    task_executor_prompt TEXT,
    task_manager_prompt TEXT,
    task_verifier_prompt TEXT,
    task_memory_manager_prompt TEXT,
    public BOOLEAN,
    upvote INTEGER,
    downvote INTEGER,
    popularity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.user_id,
        p.agent_id,
        p.task_executor_prompt,
        p.task_manager_prompt,
        p.task_verifier_prompt,
        p.task_memory_manager_prompt,
        p.public,
        p.upvote,
        p.downvote,
        (p.upvote - p.downvote) AS popularity,
        p.created_at,
        p.updated_at
    FROM prompts p
    WHERE p.user_id = p_user_id
    ORDER BY p.created_at DESC;
END;
$$;

-- Function to get public prompts ordered by popularity
CREATE OR REPLACE FUNCTION get_public_prompts_by_popularity(
    p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
    id UUID,
    user_id UUID,
    agent_id UUID,
    task_executor_prompt TEXT,
    task_manager_prompt TEXT,
    task_verifier_prompt TEXT,
    task_memory_manager_prompt TEXT,
    public BOOLEAN,
    upvote INTEGER,
    downvote INTEGER,
    popularity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.user_id,
        p.agent_id,
        p.task_executor_prompt,
        p.task_manager_prompt,
        p.task_verifier_prompt,
        p.task_memory_manager_prompt,
        p.public,
        p.upvote,
        p.downvote,
        (p.upvote - p.downvote) AS popularity,
        p.created_at,
        p.updated_at
    FROM prompts p
    WHERE p.public = TRUE
    ORDER BY (p.upvote - p.downvote) DESC, p.created_at DESC
    LIMIT p_limit;
END;
$$;

-- ============================================================================
-- DEFAULT SYSTEM PROMPTS SEEDING
-- ============================================================================
--
-- This file seeds the prompts table with default system prompts.
-- Run this AFTER 07-prompts.sql to populate with default values.
--
-- Prerequisites:
-- - prompts table must exist (created by 07-prompts.sql)
-- - agents table must exist with system agent UUID
-- - system user UUID should exist
--
-- ============================================================================

-- Function to insert or update default prompt with conflict resolution
CREATE OR REPLACE FUNCTION upsert_default_prompt(
    p_id UUID,
    p_user_id UUID,
    p_agent_id UUID,
    p_task_executor_prompt TEXT,
    p_task_manager_prompt TEXT,
    p_task_verifier_prompt TEXT,
    p_task_memory_manager_prompt TEXT,
    p_public BOOLEAN DEFAULT TRUE,
    p_upvote INTEGER DEFAULT 0,
    p_downvote INTEGER DEFAULT 0
) RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    prompt_id UUID,
    action_taken TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    existing_prompt_id UUID;
    rows_affected INTEGER;
BEGIN
    -- Check if prompt already exists
    SELECT id INTO existing_prompt_id FROM prompts WHERE id = p_id;

    IF existing_prompt_id IS NOT NULL THEN
        -- Prompt exists, return success without updating
        RETURN QUERY SELECT
            TRUE AS success,
            'Default prompt already exists, no action needed' AS message,
            p_id AS prompt_id,
            'EXISTS' AS action_taken;
        RETURN;
    END IF;

    -- Validate input parameters
    IF p_task_executor_prompt IS NULL OR length(trim(p_task_executor_prompt)) = 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Task executor prompt cannot be empty' AS message,
            NULL::UUID AS prompt_id,
            'VALIDATION_ERROR' AS action_taken;
        RETURN;
    END IF;

    IF p_task_manager_prompt IS NULL OR length(trim(p_task_manager_prompt)) = 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Task manager prompt cannot be empty' AS message,
            NULL::UUID AS prompt_id,
            'VALIDATION_ERROR' AS action_taken;
        RETURN;
    END IF;

    IF p_task_verifier_prompt IS NULL OR length(trim(p_task_verifier_prompt)) = 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Task verifier prompt cannot be empty' AS message,
            NULL::UUID AS prompt_id,
            'VALIDATION_ERROR' AS action_taken;
        RETURN;
    END IF;

    IF p_task_memory_manager_prompt IS NULL OR length(trim(p_task_memory_manager_prompt)) = 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Task memory manager prompt cannot be empty' AS message,
            NULL::UUID AS prompt_id,
            'VALIDATION_ERROR' AS action_taken;
        RETURN;
    END IF;

    IF p_upvote < 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Upvote count cannot be negative' AS message,
            NULL::UUID AS prompt_id,
            'VALIDATION_ERROR' AS action_taken;
        RETURN;
    END IF;

    IF p_downvote < 0 THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Downvote count cannot be negative' AS message,
            NULL::UUID AS prompt_id,
            'VALIDATION_ERROR' AS action_taken;
        RETURN;
    END IF;

    -- Insert the new prompt
    INSERT INTO prompts (
        id,
        user_id,
        agent_id,
        task_executor_prompt,
        task_manager_prompt,
        task_verifier_prompt,
        task_memory_manager_prompt,
        public,
        upvote,
        downvote
    ) VALUES (
        p_id,
        p_user_id,
        p_agent_id,
        p_task_executor_prompt,
        p_task_manager_prompt,
        p_task_verifier_prompt,
        p_task_memory_manager_prompt,
        p_public,
        p_upvote,
        p_downvote
    );

    GET DIAGNOSTICS rows_affected = ROW_COUNT;

    IF rows_affected > 0 THEN
        RETURN QUERY SELECT
            TRUE AS success,
            'Default prompt created successfully' AS message,
            p_id AS prompt_id,
            'CREATED' AS action_taken;
    ELSE
        RETURN QUERY SELECT
            FALSE AS success,
            'Failed to create default prompt' AS message,
            NULL::UUID AS prompt_id,
            'INSERT_FAILED' AS action_taken;
    END IF;

EXCEPTION
    WHEN foreign_key_violation THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Foreign key violation: agent_id or user_id does not exist' AS message,
            NULL::UUID AS prompt_id,
            'FK_ERROR' AS action_taken;
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Error creating default prompt: ' || SQLERRM AS message,
            NULL::UUID AS prompt_id,
            'ERROR' AS action_taken;
END;
$$;

-- ============================================================================
-- HELPER FUNCTION FOR DEFAULT PROMPT ACCESS
-- ============================================================================

-- Function to get the default system prompt ID
CREATE OR REPLACE FUNCTION get_default_system_prompt_id()
RETURNS UUID
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN '00000000-0000-4000-8000-000000000001'::UUID;
END;
$$;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Example 1: Call the function to create default prompt (from SQL)
/*
SELECT * FROM upsert_default_prompt(
    '00000000-0000-4000-8000-000000000001'::UUID,
    '00000000-0000-4000-8000-000000000000'::UUID,
    '00000000-0000-4000-8000-000000000000'::UUID,
    'Task executor prompt text...',
    'Task manager prompt text...',
    'Task verifier prompt text...',
    'Task memory manager prompt text...',
    TRUE,
    0,
    0
);
*/

-- Example 2: Get the default system prompts
/*
SELECT * FROM prompts WHERE id = get_default_system_prompt_id();
*/

-- Example 3: Reference default prompts in agent configuration
/*
UPDATE agents
SET prompts = ROW(get_default_system_prompt_id()::TEXT)::agent_prompts
WHERE name = 'DefaultAgent';
*/

-- ============================================================================

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Example 1: Creating a new prompt record
/*
INSERT INTO prompts (
    user_id,
    agent_id,
    task_executor_prompt,
    task_manager_prompt,
    task_verifier_prompt,
    task_memory_manager_prompt,
    public
) VALUES (
    'user123-456-789'::UUID,
    'agent123-456-789'::UUID,
    'You are a task executor. Execute the given task efficiently and accurately.',
    'You are a task manager. Coordinate and manage multiple tasks effectively.',
    'You are a task verifier. Verify that tasks have been completed correctly.',
    'You are a memory manager. Manage and organize task-related memories.',
    TRUE
);
*/

-- Example 2: Update individual prompt fields
/*
SELECT * FROM update_task_executor_prompt(
    'prompt123-456-789'::UUID,
    'Updated task executor prompt with new instructions.'
);
*/

-- Example 3: Update all fields at once
/*
SELECT * FROM update_all_prompts(
    'prompt123-456-789'::UUID,
    'New executor prompt',
    'New manager prompt',
    'New verifier prompt',
    'New memory manager prompt',
    TRUE,
    10,
    2
);
*/

-- Example 4: Increment upvote
/*
SELECT * FROM increment_upvote('prompt123-456-789'::UUID);
*/

-- Example 5: Get user's prompts
/*
SELECT * FROM get_prompts_by_user('user123-456-789'::UUID);
*/

-- Example 6: Get popular public prompts
/*
SELECT * FROM get_public_prompts_by_popularity(20);
*/

-- ============================================================================