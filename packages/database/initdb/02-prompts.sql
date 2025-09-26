-- ============================================================================
-- PROMPTS TABLE AND FUNCTIONS
-- ============================================================================

-- Prompts table to store different types of prompts for agents
CREATE TABLE prompts (
    -- Unique identifier for each prompt record
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- User who owns these prompts
    user_id UUID NOT NULL,


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
    CONSTRAINT prompts_task_executor_not_empty CHECK (length(trim(task_executor_prompt)) > 0),
    CONSTRAINT prompts_task_manager_not_empty CHECK (length(trim(task_manager_prompt)) > 0),
    CONSTRAINT prompts_task_verifier_not_empty CHECK (length(trim(task_verifier_prompt)) > 0),
    CONSTRAINT prompts_task_memory_manager_not_empty CHECK (length(trim(task_memory_manager_prompt)) > 0),
    CONSTRAINT prompts_upvote_non_negative CHECK (upvote >= 0),
    CONSTRAINT prompts_downvote_non_negative CHECK (downvote >= 0)

    -- Note: user_id references will be validated at application level
    -- TODO: Create proper users table and add FK constraint
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for user_id queries
CREATE INDEX idx_prompts_user_id ON prompts (user_id);


-- Index for public prompts
CREATE INDEX idx_prompts_public ON prompts (public);

-- Index for creation date ordering
CREATE INDEX idx_prompts_created_at ON prompts (created_at);

-- Index for popularity sorting (upvotes - downvotes)
CREATE INDEX idx_prompts_popularity ON prompts ((upvote - downvote) DESC);


-- Composite index for public prompts with popularity
CREATE INDEX idx_prompts_public_popularity ON prompts (public, (upvote - downvote) DESC);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================

-- Trigger to update updated_at on prompts table
CREATE TRIGGER update_prompts_updated_at
    BEFORE UPDATE ON prompts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


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
-- USAGE EXAMPLES
-- ============================================================================

-- Example 1: Creating a new prompt record
/*
INSERT INTO prompts (
    user_id,
    task_executor_prompt,
    task_manager_prompt,
    task_verifier_prompt,
    task_memory_manager_prompt,
    public
) VALUES (
    '123e4567-e89b-12d3-a456-426614174000'::UUID,
    'You are a task executor. Execute the given task efficiently and accurately.',
    'You are a task manager. Coordinate and manage multiple tasks effectively.',
    'You are a task verifier. Verify that tasks have been completed correctly.',
    'You are a memory manager. Manage and organize task-related memories.',
    TRUE
);
*/

-- Example 2: Update all fields at once (partial update)
/*
SELECT * FROM update_all_prompts(
    'prompt123-456-789'::UUID,
    'New executor prompt',
    NULL,  -- keep existing manager prompt
    'New verifier prompt',
    NULL,  -- keep existing memory manager prompt
    TRUE,
    10,
    2
);
*/

-- Example 3: Increment upvote
/*
SELECT * FROM increment_upvote('prompt123-456-789'::UUID);
*/

-- Example 4: Get user's prompts
/*
SELECT * FROM get_prompts_by_user('123e4567-e89b-12d3-a456-426614174000'::UUID);
*/

-- Example 5: Get popular public prompts
/*
SELECT * FROM get_public_prompts_by_popularity(20);
*/

-- ============================================================================