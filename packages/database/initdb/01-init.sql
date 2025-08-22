-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;


-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

CREATE TYPE memory AS (
    enabled                 BOOLEAN,
    short_term_memory_size  INTEGER,
    memory_size             INTEGER
);

CREATE TYPE rag AS (
    enabled         BOOLEAN,
    embedding_model TEXT
);

CREATE TYPE model AS (
    provider    TEXT,
    model_name  TEXT,
    description TEXT
);


-- ============================================================================
-- TABLES
-- ============================================================================

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name             VARCHAR(255) NOT NULL,
    "group"          VARCHAR(255) NOT NULL DEFAULT 'default_group',
    description      TEXT NOT NULL,
    lore             TEXT[] NOT NULL DEFAULT '{}',
    objectives       TEXT[] NOT NULL DEFAULT '{}',
    knowledge        TEXT[] NOT NULL DEFAULT '{}',
    system_prompt    TEXT,
    interval         INTEGER NOT NULL DEFAULT 5,
    plugins          TEXT[] NOT NULL DEFAULT '{}',
    memory           memory NOT NULL DEFAULT ROW(false, 5, 20)::memory,
    rag              rag NOT NULL DEFAULT ROW(false, NULL)::rag,
    mode             VARCHAR(50) NOT NULL DEFAULT 'interactive',
    max_iterations   INTEGER NOT NULL DEFAULT 15,
    "mcpServers"     JSONB DEFAULT '{}'::jsonb,
    avatar_image     BYTEA,       -- Binary data for the agent's avatar image
    avatar_mime_type VARCHAR(50)  -- Store the MIME type of the image (e.g., 'image/jpeg', 'image/png')
);

-- Agent iterations table
CREATE TABLE IF NOT EXISTS agent_iterations (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data       JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Thread ID table
CREATE TABLE IF NOT EXISTS thread_id (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id   UUID NOT NULL,
    name       TEXT NOT NULL DEFAULT 'default_conversation',
    thread_id  TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Message table
CREATE TABLE IF NOT EXISTS message (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id        UUID NOT NULL,
    user_request    TEXT NOT NULL,
    agent_iteration JSONB NOT NULL,
    status          VARCHAR(50) NOT NULL DEFAULT 'success',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Models configuration table
CREATE TABLE IF NOT EXISTS models_config (
    id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fast  model NOT NULL,
    smart model NOT NULL,
    cheap model NOT NULL
);

-- Agent memories table
CREATE TABLE IF NOT EXISTS agent_memories (
    id          SERIAL PRIMARY KEY,
    user_id     VARCHAR(100) NOT NULL,
    memories_id UUID NOT NULL,
    query       TEXT NOT NULL,
    content     TEXT NOT NULL,
    embedding   vector(384) NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metadata    JSONB NOT NULL,
    history     JSONB NOT NULL
);


-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS agent_memories_embedding_idx
    ON agent_memories 
    USING ivfflat (embedding vector_cosine_ops);

ANALYZE agent_memories;


-- ============================================================================
-- FUNCTIONS AND PROCEDURES
-- ============================================================================

-- Insert or update memory function
CREATE OR REPLACE FUNCTION insert_memory(
    p_id         INTEGER,
    p_user_id    VARCHAR(100),
    p_memories_id UUID,
    p_query      TEXT,
    p_content    TEXT,
    p_embedding  vector(384),
    p_created_at TIMESTAMP,
    p_updated_at TIMESTAMP,
    p_metadata   JSONB,
    p_history    JSONB
) RETURNS VOID AS $$
BEGIN
    INSERT INTO agent_memories (
        id,
        user_id,
        memories_id,
        query,
        content,
        embedding,
        created_at,
        updated_at,
        metadata,
        history
    ) VALUES (
        COALESCE(p_id, nextval('agent_memories_id_seq')),
        p_user_id,
        p_memories_id,
        p_query,
        p_content,
        p_embedding,
        COALESCE(p_created_at, CURRENT_TIMESTAMP),
        COALESCE(p_updated_at, CURRENT_TIMESTAMP),
        p_metadata,
        p_history
    ) 
    ON CONFLICT (id) 
    DO UPDATE SET
        query      = EXCLUDED.query,
        content    = EXCLUDED.content,
        embedding  = EXCLUDED.embedding,
        updated_at = COALESCE(EXCLUDED.updated_at, CURRENT_TIMESTAMP),
        metadata   = EXCLUDED.metadata,
        history    = EXCLUDED.history;
END;
$$ LANGUAGE plpgsql;


-- Select memory function
CREATE OR REPLACE FUNCTION select_memory(
    p_id INTEGER
) RETURNS TABLE (
    id          INTEGER,
    user_id     VARCHAR(100),
    memories_id UUID,
    query       TEXT,
    content     TEXT,
    embedding   vector(384),
    created_at  TIMESTAMP,
    updated_at  TIMESTAMP,
    metadata    JSONB,
    history     JSONB
) AS $$
    SELECT
        id,
        user_id,
        memories_id,
        query,
        content,
        embedding,
        created_at,
        updated_at,
        metadata,
        history
    FROM
        agent_memories
    WHERE
        id = p_id
$$ LANGUAGE sql;


-- Update memory function
CREATE OR REPLACE FUNCTION update_memory(
    p_id        INTEGER,
    p_content   TEXT,
    p_embedding vector(384)
) RETURNS VOID AS $$
DECLARE
    m           JSONB;
    t           TIMESTAMP;
    new_history JSONB;
BEGIN
    -- Récupérer la mémoire existante
    SELECT to_jsonb(mem.*) INTO m 
    FROM select_memory(p_id) mem;
    
    -- Si la mémoire n'existe pas, lever une erreur
    IF m IS NULL THEN
        RAISE EXCEPTION 'Memory with id % not found', p_id;
    END IF;

    t := CURRENT_TIMESTAMP;
    
    -- Construire l'historique mis à jour
    new_history := COALESCE(m->'history', '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
            'value',     m->>'content',
            'timestamp', to_char(t, 'YYYY-MM-DD"T"HH24:MI:SS.US'),
            'action',    'UPDATE'
        )
    );

    -- Mettre à jour la mémoire
    PERFORM insert_memory(
        p_id,
        (m->>'user_id')::varchar(100),
        (m->>'memories_id')::uuid,
        (m->>'query')::text,
        p_content,
        p_embedding,
        (m->>'created_at')::timestamp,
        t,
        m->'metadata',
        new_history
    );
END;
$$ LANGUAGE plpgsql;


-- Delete all agents function
CREATE OR REPLACE FUNCTION delete_all_agents()
RETURNS TABLE (
    deleted_count INTEGER,
    message       TEXT
) 
LANGUAGE plpgsql
AS $$
DECLARE
    agent_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO agent_count FROM agents;
    
    DELETE FROM agents;
    
    RETURN QUERY 
    SELECT 
        agent_count AS deleted_count,
        CASE 
            WHEN agent_count > 0 THEN 
                format('%s agent(s) supprimé(s) avec succès', agent_count)
            ELSE 
                'Aucun agent à supprimer'
        END AS message;
END;
$$;