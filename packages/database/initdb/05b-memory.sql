-- ============================================================================
-- AI MEMORY MANAGEMENT SYSTEM
-- ============================================================================
-- This file implements a dual-memory system for AI agents:
-- 1. Episodic Memory: Specific events and experiences with temporal context
-- 2. Semantic Memory: Factual knowledge and learned information
-- Both use vector embeddings for semantic similarity search
-- ============================================================================

-- Episodic Memory Table
-- Stores specific events, experiences, and contextual memories
-- These memories have temporal significance and can expire
CREATE TABLE IF NOT EXISTS episodic_memories (
    -- Auto-incrementing primary key for efficient indexing
    id SERIAL PRIMARY KEY,
    
    -- Identifier for the user/agent context
    -- Allows multiple users/agents to maintain separate memory spaces
    -- VARCHAR(100) provides reasonable length for user identifiers
    user_id VARCHAR(100) NOT NULL,

    -- Task identifier linking memory to specific tasks
    -- UUID format ensures global uniqueness across system
    task_id UUID NOT NULL,

    -- Step identifier linking memory to specific steps within a task
    -- UUID format for consistency, mandatory field
    step_id UUID NOT NULL,
    
    -- The actual memory content - what happened or was experienced
    -- Stored as TEXT to accommodate detailed descriptions
    -- Examples: "User asked about weather", "Successfully completed task X"
    content TEXT NOT NULL,
    
    -- 384-dimensional vector embedding for semantic similarity search
    -- Generated from content using embedding models (e.g., sentence transformers)
    -- Enables finding similar experiences through vector operations
    embedding vector(384) NOT NULL,
    
    -- Source attribution for the memory
    -- Array of sources that contributed to this memory
    -- Examples: ["conversation_log", "task_execution", "user_feedback"]
    sources TEXT[] DEFAULT '{}',
    
    -- Usage tracking for memory importance assessment
    -- Incremented each time this memory is retrieved/accessed
    -- Higher counts indicate more important/relevant memories
    access_count INTEGER DEFAULT 0,
    
    -- Temporal tracking fields
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Last modification timestamp - updated when memory is accessed or modified
    -- Used for recency calculations and memory refresh
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Confidence score for memory accuracy (0.0 to 10.0 scale)
    -- Higher values indicate more reliable memories
    -- Can be adjusted based on source reliability and verification
    confidence FLOAT DEFAULT 1.0,
    
    -- Automatic expiration timestamp for temporal memory management
    -- Episodic memories fade over time (default: 30 days)
    -- Prevents infinite memory accumulation and mimics human memory decay
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days')
);

-- Semantic Memory Table
-- Stores factual knowledge, learned information, and persistent insights
-- Unlike episodic memories, these don't expire and represent learned facts
CREATE TABLE IF NOT EXISTS semantic_memories (
    -- Auto-incrementing primary key
    id SERIAL PRIMARY KEY,
    
    -- User/agent context identifier (consistent with episodic memories)
    user_id VARCHAR(100) NOT NULL,

    -- Task identifier linking memory to specific tasks
    -- UUID format ensures global uniqueness across system
    task_id UUID NOT NULL,

    -- Step identifier linking memory to specific steps within a task
    -- UUID format for consistency, mandatory field
    step_id UUID NOT NULL,
    
    -- The factual information or learned insight
    -- Examples: "User prefers JSON format", "API endpoint X requires authentication"
    fact TEXT NOT NULL,
    
    -- Vector embedding for semantic similarity matching
    -- 384 dimensions matching episodic memory system
    embedding vector(384) NOT NULL,
    
    -- Confidence level for this piece of knowledge (0.0 to 1.0 scale)
    -- Lower default than episodic (0.5) as facts need verification over time
    confidence FLOAT DEFAULT 0.5,
    
    -- Access frequency tracking
    -- Starts at 1 (accessed when created) vs 0 for episodic
    access_count INTEGER DEFAULT 1,
    
    -- Temporal tracking
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Knowledge categorization for better organization and retrieval
    -- Categories help filter and prioritize different types of knowledge
    -- Common values: 'preference', 'fact', 'skill', 'relationship'
    category VARCHAR(50),
    
    -- References to episodic memories that contributed to this knowledge
    -- Array of episodic_memories.id values showing evidence trail
    -- Enables traceability from facts back to experiences
    source_events INTEGER[] DEFAULT '{}'
);

-- Memory Management Functions
-- ============================================================================

-- Smart Semantic Memory Upsert Function
-- Intelligently handles semantic memory storage with similarity detection
CREATE OR REPLACE FUNCTION upsert_semantic_memory_smart(
    -- Required parameters
    p_user_id VARCHAR(100),         -- User/agent identifier
    p_task_id UUID,                 -- Task identifier
    p_step_id UUID,                 -- Step identifier
    p_fact TEXT,                    -- Knowledge to store
    p_embedding vector(384),        -- Vector representation of the fact
    p_similarity_threshold FLOAT,   -- Similarity cutoff for updates vs inserts

    -- Optional parameters with defaults
    p_category VARCHAR(50) DEFAULT NULL,            -- Knowledge category
    p_source_events INTEGER[] DEFAULT '{}'         -- Contributing episodic memories
)
RETURNS TABLE (
    memory_id INTEGER,          -- ID of created/updated memory
    operation TEXT,             -- What operation was performed
    similarity_score FLOAT,     -- Similarity to existing memory (if found)
    matched_fact TEXT           -- Content of matched memory (if found)
)
LANGUAGE plpgsql
SECURITY DEFINER                -- Run with elevated privileges for data integrity
SET search_path = public, pg_catalog    -- Prevent search path manipulation attacks
AS $$
DECLARE
    -- Variables for storing found memory information
    v_existing_memory RECORD;
    v_memory_id INTEGER;
    v_operation TEXT;
    v_similarity FLOAT;
    v_matched_fact TEXT;
    v_created_at TIMESTAMP;
BEGIN
    -- Input validation to prevent null pointer errors
    IF p_user_id IS NULL OR p_fact IS NULL OR p_task_id IS NULL OR p_step_id IS NULL OR p_embedding IS NULL THEN
        RAISE EXCEPTION 'Required fields cannot be null'
            USING ERRCODE = '23502';  -- NOT NULL violation code
    END IF;

    -- Search for similar existing memories
    -- Uses cosine similarity via <=> operator (1 - cosine_distance)
    -- FOR UPDATE ensures consistency during concurrent access
    SELECT
        id,
        fact,
        1 - (embedding <=> p_embedding) as similarity,  -- Convert distance to similarity
        access_count,
        source_events
    INTO v_existing_memory
    FROM semantic_memories
    WHERE user_id = p_user_id
        AND task_id = p_task_id
        AND step_id = p_step_id
        AND 1 - (embedding <=> p_embedding) >= p_similarity_threshold
    ORDER BY embedding <=> p_embedding  -- Closest match first
    LIMIT 1
    FOR UPDATE;
    
    IF FOUND THEN
        -- Update existing similar memory
        -- Merge information and boost confidence/access count
        UPDATE semantic_memories
        SET 
            -- Update with new embedding and fact (refinement)
            embedding = p_embedding,
            fact = p_fact,
            updated_at = NOW(),
            
            -- Increment access count to show increased relevance
            access_count = v_existing_memory.access_count + 1,
            
            -- Preserve existing category unless new one provided
            category = COALESCE(p_category, category),
            
            -- Merge source events arrays and remove duplicates
            source_events = ARRAY(
                SELECT DISTINCT unnest(
                    v_existing_memory.source_events || p_source_events
                )
            ),
            
            -- Incrementally increase confidence (cap at 0.99)
            -- Repeated similar inputs increase confidence in the knowledge
            confidence = LEAST(confidence + 0.1, 0.99)
        WHERE id = v_existing_memory.id
        RETURNING id INTO v_memory_id;
        
        -- Prepare return values for update case
        v_operation := 'UPDATE_SIMILAR';
        v_similarity := v_existing_memory.similarity;
        v_matched_fact := v_existing_memory.fact;
        
    ELSE
        -- Insert new memory (no similar memory found)
        v_created_at := NOW();
        INSERT INTO semantic_memories (
            user_id,
            task_id,
            step_id,
            fact,
            embedding,
            category,
            source_events,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            p_task_id,
            p_step_id,
            p_fact,
            p_embedding,
            p_category,
            p_source_events,
            v_created_at,
            v_created_at
        )
        RETURNING id INTO v_memory_id;
        
        -- Prepare return values for insert case
        v_operation := 'INSERT_NEW';
        v_similarity := NULL;
        v_matched_fact := NULL;
    END IF;
    
    -- Return operation results
    RETURN QUERY SELECT v_memory_id, v_operation, v_similarity, v_matched_fact;
    
EXCEPTION
    -- Comprehensive error handling
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error in upsert_semantic_memory_smart: %', SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

-- Smart Episodic Memory Insertion Function
-- Handles episodic memory storage with duplicate detection
CREATE OR REPLACE FUNCTION insert_episodic_memory_smart(
    -- Required parameters
    p_user_id VARCHAR(100),
    p_task_id UUID,
    p_step_id UUID,
    p_content TEXT,
    p_embedding vector(384),
    p_similarity_threshold FLOAT,    -- Higher threshold - episodic memories are more specific

    -- Optional parameters
    p_sources TEXT[] DEFAULT '{}',
    p_confidence FLOAT DEFAULT 1.0
)
RETURNS TABLE (
    memory_id INTEGER,
    operation TEXT,
    similar_memory_id INTEGER,
    similar_memory_content TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_similar_memory RECORD;
    v_memory_id INTEGER;
    v_operation TEXT;
    v_similar_id INTEGER;
    v_similar_content TEXT;
    v_created_at TIMESTAMP;
BEGIN
    -- Input validation
    IF p_user_id IS NULL OR p_task_id IS NULL OR p_step_id IS NULL OR
       p_content IS NULL OR p_embedding IS NULL THEN
        RAISE EXCEPTION 'Required fields cannot be null'
            USING ERRCODE = '23502';
    END IF;

    -- Check for very similar existing episodic memories
    -- Higher similarity threshold prevents duplicate experiences
    SELECT
        id,
        content,
        1 - (embedding <=> p_embedding) as similarity
    INTO v_similar_memory
    FROM episodic_memories
    WHERE user_id = p_user_id
        AND task_id = p_task_id
        AND step_id = p_step_id
        AND 1 - (embedding <=> p_embedding) >= p_similarity_threshold
    ORDER BY embedding <=> p_embedding
    LIMIT 1;
    
    IF FOUND THEN
        -- Very similar memory exists - boost its importance instead of duplicating
        UPDATE episodic_memories
        SET 
            -- Significantly boost confidence for repeated similar experiences
            confidence = LEAST(confidence + 0.5, 10.0),
            access_count = access_count + 1,
            updated_at = NOW() 
        WHERE id = v_similar_memory.id
        RETURNING id INTO v_memory_id;
        
        -- Return skip operation details
        v_operation := 'SKIP_DUPLICATE';
        v_similar_id := v_similar_memory.id;
        v_similar_content := v_similar_memory.content;
        
    ELSE
        -- Insert new episodic memory
        v_created_at := NOW();
        INSERT INTO episodic_memories (
            user_id,
            task_id,
            step_id,
            content,
            embedding,
            sources,
            created_at,
            updated_at,
            confidence
        ) VALUES (
            p_user_id,
            p_task_id,
            p_step_id,
            p_content,
            p_embedding,
            p_sources,
            v_created_at,
            v_created_at,
            p_confidence
        )
        RETURNING id INTO v_memory_id;
        
        -- Return insert operation details
        v_operation := 'INSERT_NEW';
        v_similar_id := NULL;
        v_similar_content := NULL;
    END IF;
    
    RETURN QUERY SELECT v_memory_id, v_operation, v_similar_id, v_similar_content;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error in insert_episodic_memory_smart: %', SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

-- Unified Memory Retrieval Function
-- Searches both episodic and semantic memories for relevant information
CREATE OR REPLACE FUNCTION retrieve_similar_categorized_memories(
    p_user_id VARCHAR(100),
    p_task_id UUID,
    p_embedding vector(384),
    p_threshold FLOAT,    -- Lower threshold allows broader retrieval
    p_limit INTEGER
)
RETURNS TABLE (
    memory_type TEXT,
    memory_id INTEGER,
    task_id UUID,
    step_id UUID,
    content TEXT,
    similarity FLOAT,
    metadata JSONB
)
LANGUAGE plpgsql
STABLE    -- Function doesn't modify data, allows query optimization
AS $$
BEGIN
    RETURN QUERY
    WITH similar_semantic AS (
        -- Retrieve relevant semantic memories (facts/knowledge)
        SELECT
            'semantic'::TEXT as type,
            sm.id,
            sm.task_id,
            sm.step_id,
            sm.fact as content,
            1 - (sm.embedding <=> p_embedding) as sim,
            jsonb_build_object(
                'confidence', sm.confidence,
                'access_count', sm.access_count,
                'category', sm.category,
                'updated_at', sm.updated_at
            ) as meta
        FROM semantic_memories sm
        WHERE sm.user_id = p_user_id
            AND sm.task_id = p_task_id
            AND 1 - (sm.embedding <=> p_embedding) >= p_threshold
    ),
    similar_episodic AS (
        -- Retrieve relevant episodic memories (experiences)
        SELECT
            'episodic'::TEXT as type,
            em.id,
            em.task_id,
            em.step_id,
            em.content as content,
            1 - (em.embedding <=> p_embedding) as sim,
            jsonb_build_object(
                'created_at', em.created_at,
                'confidence', em.confidence,
                'updated_at', em.updated_at
            ) as meta
        FROM episodic_memories em
        WHERE em.user_id = p_user_id
            AND em.task_id = p_task_id
            AND 1 - (em.embedding <=> p_embedding) >= p_threshold
            AND em.expires_at > NOW()  -- Only non-expired memories
    )
    -- Combine and sort by relevance
    SELECT * FROM (
        SELECT * FROM similar_semantic
        UNION ALL
        SELECT * FROM similar_episodic
    ) combined
    ORDER BY sim DESC  -- Most similar first
    LIMIT p_limit;
END;
$$;

-- New Memory Retrieval Functions by ID
-- ============================================================================

-- Get All Memories by Task ID
-- Retrieves both episodic and semantic memories for a specific task
CREATE OR REPLACE FUNCTION get_memories_by_task_id(
    p_user_id VARCHAR(100),
    p_task_id UUID,
    p_limit INTEGER DEFAULT NULL
)
RETURNS TABLE (
    memory_type TEXT,
    memory_id INTEGER,
    content TEXT,
    step_id UUID,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    confidence FLOAT,
    metadata JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH task_semantic AS (
        -- Retrieve all semantic memories for the task
        SELECT
            'semantic'::TEXT as type,
            id,
            fact as content,
            sm.step_id,
            sm.created_at,
            sm.updated_at,
            sm.confidence,
            jsonb_build_object(
                'access_count', access_count,
                'category', category
            ) as meta
        FROM semantic_memories sm
        WHERE user_id = p_user_id
        AND task_id = p_task_id
    ),
    task_episodic AS (
        -- Retrieve all episodic memories for the task
        SELECT
            'episodic'::TEXT as type,
            id,
            em.content as content,
            em.step_id,
            em.created_at,
            em.updated_at,
            em.confidence,
            jsonb_build_object(
                'access_count', access_count,
                'sources', sources,
                'expires_at', expires_at
            ) as meta
        FROM episodic_memories em
        WHERE user_id = p_user_id
            AND task_id = p_task_id
            AND expires_at > NOW()  -- Only non-expired memories
    )
    -- Combine and sort by creation time (most recent first)
    SELECT * FROM (
        SELECT * FROM task_semantic
        UNION ALL
        SELECT * FROM task_episodic
    ) combined
    ORDER BY created_at DESC
    LIMIT COALESCE(p_limit, 2147483647);
END;
$$;

-- Get All Memories by Step ID
-- Retrieves both episodic and semantic memories for a specific step
CREATE OR REPLACE FUNCTION get_memories_by_step_id(
    p_user_id VARCHAR(100),
    p_step_id UUID,
    p_limit INTEGER DEFAULT NULL
)
RETURNS TABLE (
    memory_type TEXT,
    memory_id INTEGER,
    content TEXT,
    task_id UUID,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    confidence FLOAT,
    metadata JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH step_semantic AS (
        -- Retrieve all semantic memories for the step
        SELECT
            'semantic'::TEXT as type,
            id,
            fact as content,
            sm.task_id,
            sm.created_at,
            sm.updated_at,
            sm.confidence,
            jsonb_build_object(
                'access_count', access_count,
                'category', category
            ) as meta
        FROM semantic_memories sm
        WHERE user_id = p_user_id AND step_id = p_step_id
    ),
    step_episodic AS (
        -- Retrieve all episodic memories for the step
        SELECT
            'episodic'::TEXT as type,
            id,
            em.content as content,
            em.task_id,
            em.created_at,
            em.updated_at,
            em.confidence,
            jsonb_build_object(
                'access_count', access_count,
                'sources', sources,
                'expires_at', expires_at
            ) as meta
        FROM episodic_memories em
        WHERE user_id = p_user_id
            AND step_id = p_step_id
            AND expires_at > NOW()  -- Only non-expired memories
    )
    -- Combine and sort by creation time (most recent first)
    SELECT * FROM (
        SELECT * FROM step_semantic
        UNION ALL
        SELECT * FROM step_episodic
    ) combined
    ORDER BY created_at DESC
    LIMIT COALESCE(p_limit, 2147483647);
END;
$$;

-- Utility Functions
-- ============================================================================

-- Array Flattening Utility
-- Removes duplicates from arrays - useful for merging source_events
CREATE OR REPLACE FUNCTION flatten_array(anyarray)
RETURNS anyarray
LANGUAGE sql IMMUTABLE    -- Pure function - same input always produces same output
AS $$
    SELECT ARRAY(SELECT DISTINCT unnest($1))
$$;

-- Memory System Performance Indexes
-- ============================================================================
-- Specialized indexes for vector similarity search and memory retrieval
-- All indexes are created with IF NOT EXISTS to prevent conflicts

-- Episodic Memory Indexes
-- ============================================================================

-- Time-based episodic memory retrieval index
-- Used for: Retrieving recent memories for a specific user
-- Query pattern: WHERE user_id = ? ORDER BY created_at DESC
-- Optimizes temporal memory access patterns
CREATE INDEX IF NOT EXISTS idx_episodic_time ON episodic_memories(user_id, created_at DESC);

-- Task-based episodic memory index
-- Used for: Retrieving all memories for a specific task
-- Query pattern: WHERE user_id = ? AND task_id = ?
-- Optimizes get_memories_by_task_id function performance
CREATE INDEX IF NOT EXISTS idx_episodic_task ON episodic_memories(user_id, task_id);

-- Step-based episodic memory index
-- Used for: Retrieving all memories for a specific step
-- Query pattern: WHERE user_id = ? AND step_id = ?
-- Optimizes get_memories_by_step_id function performance
CREATE INDEX IF NOT EXISTS idx_episodic_step ON episodic_memories(user_id, step_id);

-- Composite index for episodic similarity search with task/step context
-- Used for: Similarity search within specific task/step context
-- Query pattern: WHERE user_id = ? AND task_id = ? AND step_id = ? ORDER BY embedding <=> ?
-- Optimizes insert_episodic_memory_smart and retrieve_similar_categorized_memories functions
-- Note: Vector columns must use specialized vector indexes (ivfflat/hnsw), not btree
CREATE INDEX IF NOT EXISTS idx_episodic_task_step ON episodic_memories(user_id, task_id, step_id);

-- Vector similarity search index for episodic memories
-- Used for: Semantic similarity search in episodic memories
-- Query pattern: ORDER BY embedding <=> query_vector
-- Index type: IVFFlat (Inverted File with Flat Compression)
-- Distance function: vector_cosine_ops (cosine similarity)
-- Lists parameter: 100 provides good balance of speed vs accuracy
CREATE INDEX IF NOT EXISTS idx_episodic_embedding ON episodic_memories 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Semantic Memory Indexes
-- ============================================================================

-- Vector similarity search index for semantic memories
-- Used for: Semantic similarity search in factual knowledge
-- Same configuration as episodic for consistency
-- Critical for knowledge retrieval and fact-finding operations
CREATE INDEX IF NOT EXISTS idx_semantic_embedding ON semantic_memories 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Category-based semantic memory filtering index
-- Used for: Filtering semantic memories by knowledge category
-- Query pattern: WHERE user_id = ? AND category = ?
-- Enables efficient retrieval of specific knowledge types
-- Categories: 'preference', 'fact', 'skill', 'relationship'
CREATE INDEX IF NOT EXISTS idx_semantic_category ON semantic_memories(user_id, category);

-- Task-based semantic memory index
-- Used for: Retrieving all semantic memories for a specific task
-- Query pattern: WHERE user_id = ? AND task_id = ?
-- Optimizes get_memories_by_task_id function performance
CREATE INDEX IF NOT EXISTS idx_semantic_task ON semantic_memories(user_id, task_id);

-- Step-based semantic memory index
-- Used for: Retrieving all semantic memories for a specific step
-- Query pattern: WHERE user_id = ? AND step_id = ?
-- Optimizes get_memories_by_step_id function performance
CREATE INDEX IF NOT EXISTS idx_semantic_step ON semantic_memories(user_id, step_id);

-- Composite index for semantic similarity search with task/step context
-- Used for: Similarity search within specific task/step context
-- Query pattern: WHERE user_id = ? AND task_id = ? AND step_id = ? ORDER BY embedding <=> ?
-- Optimizes upsert_semantic_memory_smart and retrieve_similar_categorized_memories functions
-- Note: Vector columns must use specialized vector indexes (ivfflat/hnsw), not btree
CREATE INDEX IF NOT EXISTS idx_semantic_task_step ON semantic_memories(user_id, task_id, step_id);

-- Database Statistics Updates for Memory Tables
-- ============================================================================
-- ANALYZE commands update table statistics for query optimization
-- Should be run after bulk data operations or significant data changes

-- Update statistics for episodic memories table
-- Ensures PostgreSQL query planner has accurate data distribution information
-- Critical for vector index performance optimization
ANALYZE episodic_memories;

-- Update statistics for semantic memories table
-- Maintains optimal query plans for semantic memory operations
ANALYZE semantic_memories;

-- ============================================================================
-- USAGE PATTERNS
-- ============================================================================
--
-- Storing an episodic memory:
--   SELECT * FROM insert_episodic_memory_smart(
--       'user123', 'task-uuid'::UUID, 'step-uuid'::UUID, 'User completed registration process',
--       '[0.1, 0.2, ...]'::vector(384), 0.95, ARRAY['user_action'], 1.0
--   );
--
-- Storing semantic knowledge:
--   SELECT * FROM upsert_semantic_memory_smart(
--       'user123', 'task-uuid'::UUID, 'step-uuid'::UUID, 'User prefers dark theme',
--       '[0.3, 0.4, ...]'::vector(384), 0.85, 'preference', ARRAY[123]
--   );
--
-- Retrieving relevant memories:
--   SELECT * FROM retrieve_similar_categorized_memories(
--       'user123', 'task-uuid'::UUID, '[0.5, 0.6, ...]'::vector(384), 0.35, 5
--   );
--
-- Getting all memories for a task:
--   SELECT * FROM get_memories_by_task_id('user123', 'task-uuid'::UUID, 20);
--
-- Getting all memories for a step:
--   SELECT * FROM get_memories_by_step_id('user123', 'step-uuid'::UUID, 10);
--
-- High-Performance Query Patterns (using indexes):
--
-- 1. Vector similarity search (uses idx_episodic_embedding):
--    SELECT *, 1 - (embedding <=> $1) as similarity 
--    FROM episodic_memories 
--    WHERE user_id = $2 
--    ORDER BY embedding <=> $1 LIMIT 10;
--
-- 2. Category-filtered semantic search (uses idx_semantic_category):
--    SELECT * FROM semantic_memories 
--    WHERE user_id = $1 AND category = 'preference';
--
-- 3. Recent episodic memories (uses idx_episodic_time):
--    SELECT * FROM episodic_memories 
--    WHERE user_id = $1 
--    ORDER BY created_at DESC LIMIT 20;
--
-- ============================================================================
--
-- INDEX MAINTENANCE GUIDELINES FOR MEMORY SYSTEM
-- ============================================================================
--
-- Vector Index Maintenance:
-- - IVFFlat indexes may need rebuilding after significant data changes
-- - Monitor query performance and adjust 'lists' parameter if needed
-- - More lists = better accuracy, fewer lists = faster queries
-- - Recommended lists range: 50-200 depending on data size
--
-- Memory-Specific Considerations:
-- - Episodic memories expire automatically - indexes handle this efficiently
-- - Semantic memory updates through upsert_semantic_memory_smart() maintain index consistency
-- - Regular ANALYZE after bulk memory operations ensures optimal performance
-- - Monitor memory table growth and consider archiving expired episodic memories
--
-- ============================================================================