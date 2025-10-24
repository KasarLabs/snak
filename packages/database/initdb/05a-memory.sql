-- ============================================================================
-- HOLISTIC MEMORY SYSTEM
-- ============================================================================
-- Unified memory table storing vectorized content with automatic access tracking
-- Combines aspects of episodic and semantic memory in a single structure
-- ============================================================================
CREATE TYPE memory_holistic_type AS ENUM (
    'tool',
    'ai_request',
    'human_request',
    'ai_response'
);

-- Holistic Memory Table
-- Stores all types of agent memory with vector embeddings for semantic search
CREATE TABLE IF NOT EXISTS holistic_memories (
    -- UUID primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- User/agent context identifier
    user_id VARCHAR(100) NOT NULL,

    -- Task identifier linking memory to specific tasks
    task_id UUID NOT NULL,

    -- Step identifier linking memory to specific steps within a task
    step_id UUID NOT NULL,

    -- Thread identifier linking memory to specific conversation threads
    thread_id UUID NOT NULL,

    type memory_holistic_type NOT NULL,

    -- The actual memory content - what was remembered
    content TEXT NOT NULL,

    -- 384-dimensional vector embedding for semantic similarity search
    embedding vector(384) NOT NULL,

    -- The original request that triggered this memory
    request TEXT NOT NULL,

    -- Usage tracking - incremented automatically on retrieval
    access_count INTEGER DEFAULT 0,

    -- Temporal tracking
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- MEMORY INSERTION WITH SMART DEDUPLICATION
-- ============================================================================
-- Inserts new memory or updates existing similar memory based on threshold

CREATE OR REPLACE FUNCTION insert_holistic_memory_smart(
    p_user_id VARCHAR(100),
    p_task_id UUID,
    p_step_id UUID,
    p_thread_id UUID,
    p_type memory_holistic_type,
    p_content TEXT,
    p_embedding vector(384),
    p_request TEXT,
    p_similarity_threshold FLOAT
)
RETURNS TABLE (
    memory_id UUID,
    operation TEXT,
    similarity_score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_existing_memory RECORD;
    v_memory_id UUID;
    v_operation TEXT;
    v_similarity FLOAT;
BEGIN
    -- Input validation
    IF p_user_id IS NULL OR p_task_id IS NULL OR p_step_id IS NULL OR p_thread_id IS NULL OR
       p_type IS NULL OR p_content IS NULL OR p_embedding IS NULL OR p_request IS NULL THEN
        RAISE EXCEPTION 'Required fields cannot be null'
            USING ERRCODE = '23502';
    END IF;

    -- Search for similar existing memory of the same type
    SELECT
        id,
        content,
        1 - (embedding <=> p_embedding) as similarity
    INTO v_existing_memory
    FROM holistic_memories
    WHERE user_id = p_user_id
        AND task_id = p_task_id
        AND step_id = p_step_id
        AND thread_id = p_thread_id
        AND type = p_type
        AND 1 - (embedding <=> p_embedding) >= p_similarity_threshold
    ORDER BY embedding <=> p_embedding
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        -- Update existing similar memory
        UPDATE holistic_memories
        SET
            content = p_content,
            embedding = p_embedding,
            request = p_request,
            updated_at = NOW()
        WHERE id = v_existing_memory.id
        RETURNING id INTO v_memory_id;

        v_operation := 'UPDATE_SIMILAR';
        v_similarity := v_existing_memory.similarity;
    ELSE
        -- Insert new memory
        INSERT INTO holistic_memories (
            user_id,
            task_id,
            step_id,
            thread_id,
            type,
            content,
            embedding,
            request,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            p_task_id,
            p_step_id,
            p_thread_id,
            p_type,
            p_content,
            p_embedding,
            p_request,
            NOW(),
            NOW()
        )
        RETURNING id INTO v_memory_id;

        v_operation := 'INSERT_NEW';
        v_similarity := NULL;
    END IF;

    RETURN QUERY SELECT v_memory_id, v_operation, v_similarity;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error in insert_holistic_memory_smart: %', SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

-- ============================================================================
-- MEMORY RETRIEVAL WITH AUTOMATIC ACCESS TRACKING
-- ============================================================================
-- Searches for similar memories and updates access_count automatically

CREATE OR REPLACE FUNCTION retrieve_similar_holistic_memories(
    p_user_id VARCHAR(100),
    p_thread_id UUID,
    p_embedding vector(384),
    p_similarity_threshold FLOAT,
    p_limit INTEGER
)
RETURNS TABLE (
    memory_type TEXT,
    memory_id UUID,
    task_id UUID,
    step_id UUID,
    thread_id UUID,
    content TEXT,
    similarity FLOAT,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_memory RECORD;
BEGIN
    -- Retrieve similar memories across all tasks and update access count
    FOR v_memory IN
        SELECT
            id,
            hm.task_id,
            hm.step_id,
            hm.thread_id,
            hm.type,
            hm.content,
            hm.request,
            1 - (embedding <=> p_embedding) as sim,
            hm.access_count,
            hm.created_at,
            hm.updated_at
        FROM holistic_memories hm
        WHERE user_id = p_user_id
            AND thread_id = p_thread_id
            AND 1 - (embedding <=> p_embedding) >= p_similarity_threshold
        ORDER BY embedding <=> p_embedding
        LIMIT p_limit
    LOOP
        -- Increment access count for retrieved memory
        UPDATE holistic_memories
        SET
            access_count = access_count + 1,
            updated_at = NOW()
        WHERE id = v_memory.id;

        -- Return the memory with updated access count in the expected format
        RETURN QUERY
        SELECT
            'holistic'::TEXT,
            v_memory.id,
            v_memory.task_id,
            v_memory.step_id,
            v_memory.thread_id,
            v_memory.content,
            v_memory.sim,
            jsonb_build_object(
                'type', v_memory.type,
                'request', v_memory.request,
                'access_count', v_memory.access_count + 1,
                'created_at', v_memory.created_at,
                'updated_at', v_memory.updated_at
            );
    END LOOP;
END;
$$;

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Composite index for thread-based queries
CREATE INDEX IF NOT EXISTS idx_holistic_user_thread
    ON holistic_memories(user_id, thread_id);

-- Composite index for task-based queries
CREATE INDEX IF NOT EXISTS idx_holistic_user_task
    ON holistic_memories(user_id, task_id);

-- Composite index for step-based queries
CREATE INDEX IF NOT EXISTS idx_holistic_user_task_step
    ON holistic_memories(user_id, task_id, step_id);

-- Composite index for thread, task and step-based queries
CREATE INDEX IF NOT EXISTS idx_holistic_user_thread_task_step
    ON holistic_memories(user_id, thread_id, task_id, step_id);

-- Index for type-based filtering
CREATE INDEX IF NOT EXISTS idx_holistic_type
    ON holistic_memories(user_id, task_id, type);

-- Vector similarity search index using IVFFlat
CREATE INDEX IF NOT EXISTS idx_holistic_embedding
    ON holistic_memories USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Time-based retrieval index
CREATE INDEX IF NOT EXISTS idx_holistic_created
    ON holistic_memories(user_id, created_at DESC);

-- Access frequency index for popularity analysis
CREATE INDEX IF NOT EXISTS idx_holistic_access
    ON holistic_memories(user_id, access_count DESC);

-- ============================================================================
-- DATABASE STATISTICS UPDATE
-- ============================================================================

ANALYZE holistic_memories;

-- ============================================================================
-- USAGE PATTERNS
-- ============================================================================
--
-- Insert or update memory:
--   SELECT * FROM insert_holistic_memory_smart(
--       'user123',
--       'task-uuid'::UUID,
--       'step-uuid'::UUID,
--       'ai_request'::memory_holistic_type,
--       'Memory content here',
--       '[0.1, 0.2, ...]'::vector(384),
--       'Original request text',
--       0.85
--   );
--
-- Retrieve similar memories across all tasks (automatically tracks access):
--   SELECT * FROM retrieve_similar_holistic_memories(
--       'user123',
--       '[0.5, 0.6, ...]'::vector(384),
--       0.7,
--       10
--   );
--
-- ============================================================================