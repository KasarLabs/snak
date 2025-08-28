CREATE TABLE IF NOT EXISTS episodic_memories (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    run_id UUID NOT NULL,
    content TEXT NOT NULL,
    embedding vector(384) NOT NULL,
    sources TEXT[] DEFAULT '{}',
    access_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),  -- Corrigé: updated_at avec DEFAULT
    confidence FLOAT DEFAULT 1.0,
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE TABLE IF NOT EXISTS semantic_memories (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    run_id UUID NOT NULL,
    fact TEXT NOT NULL,
    embedding vector(384) NOT NULL,
    confidence FLOAT DEFAULT 0.5,
    access_count INTEGER DEFAULT 1, 
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),  -- Corrigé: updated_at
    category VARCHAR(50),  -- 'preference', 'fact', 'skill', 'relationship'
    source_events INTEGER[] DEFAULT '{}'
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- EPISODIC
CREATE INDEX IF NOT EXISTS episodic_time_idx ON episodic_memories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS episodic_embedding_idx ON episodic_memories 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
ANALYZE episodic_memories;

-- SEMANTIC
CREATE INDEX IF NOT EXISTS semantic_embedding_idx ON semantic_memories 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS semantic_category_idx ON semantic_memories(user_id, category);
ANALYZE semantic_memories;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION upsert_semantic_memory_smart(
    p_user_id VARCHAR(100),
    p_run_id UUID,
    p_fact TEXT,
    p_embedding vector(384),
    p_category VARCHAR(50) DEFAULT NULL,
    p_source_events INTEGER[] DEFAULT '{}',
    p_similarity_threshold FLOAT DEFAULT 0.85
)
RETURNS TABLE (
    memory_id INTEGER,
    operation TEXT,
    similarity_score FLOAT,
    matched_fact TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_existing_memory RECORD;
    v_memory_id INTEGER;
    v_operation TEXT;
    v_similarity FLOAT;
    v_matched_fact TEXT;
    v_created_at TIMESTAMP;
BEGIN
    IF p_user_id IS NULL OR p_fact IS NULL OR p_run_id IS NULL OR p_embedding IS NULL THEN
        RAISE EXCEPTION 'Required fields cannot be null'
            USING ERRCODE = '23502';
    END IF;
    
    SELECT 
        id,
        fact,
        1 - (embedding <=> p_embedding) as similarity,
        access_count,
        source_events
    INTO v_existing_memory
    FROM semantic_memories
    WHERE user_id = p_user_id
        AND run_id = p_run_id
        AND 1 - (embedding <=> p_embedding) >= p_similarity_threshold
    ORDER BY embedding <=> p_embedding
    LIMIT 1
    FOR UPDATE;
    
    IF FOUND THEN
        UPDATE semantic_memories
        SET 
            embedding = p_embedding,
            fact = p_fact,
            updated_at = NOW(),
            access_count = v_existing_memory.access_count + 1,
            category = COALESCE(p_category, category),
            source_events = ARRAY(
                SELECT DISTINCT unnest(
                    v_existing_memory.source_events || p_source_events
                )
            ),
            confidence = LEAST(confidence + 0.1, 0.99)
        WHERE id = v_existing_memory.id
        RETURNING id INTO v_memory_id;
        
        v_operation := 'UPDATE_SIMILAR';
        v_similarity := v_existing_memory.similarity;
        v_matched_fact := v_existing_memory.fact;
        
    ELSE
        v_created_at := NOW();
        INSERT INTO semantic_memories (
            user_id,
            run_id,
            fact,
            embedding,
            category,
            source_events,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            p_run_id,
            p_fact,
            p_embedding,
            p_category,
            p_source_events,
            v_created_at,
            v_created_at 
        )
        RETURNING id INTO v_memory_id;
        
        v_operation := 'INSERT_NEW';
        v_similarity := NULL;
        v_matched_fact := NULL;
    END IF;
    
    RETURN QUERY SELECT v_memory_id, v_operation, v_similarity, v_matched_fact;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error in upsert_semantic_memory_smart: %', SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

CREATE OR REPLACE FUNCTION insert_episodic_memory_smart(
    p_user_id VARCHAR(100),
    p_run_id UUID,
    p_content TEXT,
    p_embedding vector(384),
    p_sources TEXT[] DEFAULT '{}',
    p_confidence FLOAT DEFAULT 1.0,
    p_similarity_threshold FLOAT DEFAULT 0.95
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
    IF p_user_id IS NULL OR p_run_id IS NULL OR 
       p_content IS NULL OR p_embedding IS NULL THEN
        RAISE EXCEPTION 'Required fields cannot be null'
            USING ERRCODE = '23502';
    END IF;

    SELECT 
        id,
        content, 
        1 - (embedding <=> p_embedding) as similarity
    INTO v_similar_memory
    FROM episodic_memories
    WHERE user_id = p_user_id
        AND run_id = p_run_id
        AND 1 - (embedding <=> p_embedding) >= p_similarity_threshold
    ORDER BY embedding <=> p_embedding
    LIMIT 1;
    
    IF FOUND THEN
        UPDATE episodic_memories
        SET 
            confidence = LEAST(confidence + 0.5, 10.0),
            access_count = access_count + 1,
            updated_at = NOW() 
        WHERE id = v_similar_memory.id
        RETURNING id INTO v_memory_id;
        
        v_operation := 'SKIP_DUPLICATE';
        v_similar_id := v_similar_memory.id;
        v_similar_content := v_similar_memory.content;
        
    ELSE
        v_created_at := NOW();
        INSERT INTO episodic_memories (
            user_id,
            run_id,
            content,
            embedding,
            sources,
            created_at,
            updated_at,
            confidence
        ) VALUES (
            p_user_id,
            p_run_id,
            p_content,
            p_embedding,
            p_sources,
            v_created_at,
            v_created_at,
            p_confidence
        )
        RETURNING id INTO v_memory_id;
        
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

CREATE OR REPLACE FUNCTION retrieve_similar_memories(
    p_user_id VARCHAR(100),
    p_run_id UUID,
    p_embedding vector(384),
    p_threshold FLOAT DEFAULT 0.35,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    memory_type TEXT,
    memory_id INTEGER,
    content TEXT,
    similarity FLOAT,
    metadata JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH similar_semantic AS (
        SELECT 
            'semantic'::TEXT as type,
            id,
            fact as content,
            1 - (embedding <=> p_embedding) as sim,
            jsonb_build_object(
                'confidence', confidence,
                'access_count', access_count,
                'category', category,
                'updated_at', updated_at
            ) as meta
        FROM semantic_memories
        WHERE user_id = p_user_id
            AND run_id = p_run_id
            AND 1 - (embedding <=> p_embedding) >= p_threshold
    ),
    similar_episodic AS (
        SELECT 
            'episodic'::TEXT as type,
            id,
            em.content as content,  -- Added table alias for clarity
            1 - (embedding <=> p_embedding) as sim,
            jsonb_build_object(
                'run_id', run_id,
                'created_at', created_at,
                'confidence', confidence,
                'updated_at', updated_at
            ) as meta
        FROM episodic_memories em  -- Added table alias
        WHERE user_id = p_user_id
            AND run_id = p_run_id
            AND 1 - (embedding <=> p_embedding) >= p_threshold
            AND expires_at > NOW()
    )
    SELECT * FROM (
        SELECT * FROM similar_semantic
        UNION ALL
        SELECT * FROM similar_episodic
    ) combined
    ORDER BY sim DESC
    LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION flatten_array(anyarray)
RETURNS anyarray
LANGUAGE sql IMMUTABLE
AS $$
    SELECT ARRAY(SELECT DISTINCT unnest($1))
$$;