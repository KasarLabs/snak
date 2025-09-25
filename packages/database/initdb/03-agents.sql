-- ============================================================================
-- ENUM TYPES
-- ============================================================================


-- Memory strategy enumeration
CREATE TYPE memory_strategy AS ENUM (
    'holistic',     -- Perfect for interactive agent or autonomous agent with short-life
    'categorized'   -- Perfect for long-life autonomous agent
);

-- ============================================================================
-- COMPOSITE TYPES
-- ============================================================================

-- Agent Profile composite type
-- As per manual 8.16: Composite types represent row/record structure
CREATE TYPE agent_profile AS (
    name VARCHAR(255),
    "group" VARCHAR(255),
    description TEXT,
    contexts TEXT[]
);

-- Model Level Configuration (nested in graph_config)
CREATE TYPE model_config AS (
    model_provider VARCHAR(50),  -- e.g., 'openai', 'azure', 'anthropic'
    model_name VARCHAR(255),
    temperature NUMERIC(3,2),
    max_tokens INTEGER
);


-- Graph execution configuration
CREATE TYPE graph_config AS (
    max_steps INTEGER,
    max_iterations INTEGER,
    max_retries INTEGER,
    execution_timeout_ms BIGINT,
    max_token_usage INTEGER,
    model model_config
);

-- Memory size limits configuration
CREATE TYPE memory_size_limits AS (
    short_term_memory_size INTEGER,
    max_insert_episodic_size INTEGER,
    max_insert_semantic_size INTEGER,
    max_retrieve_memory_size INTEGER,
    limit_before_summarization INTEGER
);

-- Memory thresholds configuration
CREATE TYPE memory_thresholds AS (
    insert_semantic_threshold NUMERIC(3,2),
    insert_episodic_threshold NUMERIC(3,2),
    retrieve_memory_threshold NUMERIC(3,2),
    hitl_threshold NUMERIC(3,2)
);

-- Memory timeout configuration
CREATE TYPE memory_timeouts AS (
    retrieve_memory_timeout_ms BIGINT,
    insert_memory_timeout_ms BIGINT
);

-- Memory configuration
CREATE TYPE memory_config AS (
    ltm_enabled BOOLEAN,
    size_limits memory_size_limits,
    thresholds memory_thresholds,
    timeouts memory_timeouts,
    strategy memory_strategy
);

-- RAG configuration
CREATE TYPE rag_config AS (
    enabled BOOLEAN,
    top_k INTEGER,
    embedding_model VARCHAR(255)
);

-- ============================================================================
-- MAIN AGENTS TABLE
-- ============================================================================

-- Drop existing table if exists (for clean recreation)
DROP TABLE IF EXISTS agents CASCADE;

-- Primary Agents Table with new structure
CREATE TABLE agents (
    -- Unique identifier for each agent (auto-generated)
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Reference to the user who owns this agent
    user_id UUID NOT NULL,
    
    -- Agent Profile (composite type) - MANDATORY
    profile agent_profile NOT NULL,
    
    -- MCP Servers configurations (using JSONB as per manual 8.14) - MANDATORY
    mcp_servers JSONB NOT NULL,
    
    -- Prompt configurations (composite type) - MANDATORY
    prompts_id UUID NOT NULL,
    
    -- Graph execution settings (composite type) - MANDATORY
    graph graph_config NOT NULL,
    
    -- Memory settings (composite type) - MANDATORY
    memory memory_config NOT NULL,
    
    -- RAG settings (composite type) - MANDATORY
    rag rag_config NOT NULL,
    
    -- Metadata fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Optional avatar fields (kept from original for UI purposes)
    avatar_image BYTEA,
    avatar_mime_type VARCHAR(50),
    
    -- Constraints (WITHOUT the problematic UNIQUE constraints)
    CONSTRAINT agents_name_not_empty CHECK (length(trim((profile).name)) > 0),
    CONSTRAINT agents_mcp_servers_not_null CHECK (mcp_servers IS NOT NULL),
    CONSTRAINT fk_agents_prompts_id FOREIGN KEY (prompts_id) REFERENCES prompts(id) ON DELETE CASCADE
);


-- Indexes for performance optimization
-- Unique index on (user_id, profile.name, profile.group) to enforce uniqueness per user
CREATE UNIQUE INDEX agents_user_name_group_unique 
    ON agents (user_id, ((profile).name), ((profile)."group"));
CREATE INDEX idx_agents_user_id ON agents (user_id);
CREATE INDEX idx_agents_name ON agents (((profile).name));
CREATE INDEX idx_agents_group ON agents (((profile)."group"));
CREATE INDEX idx_agents_created_at ON agents (created_at);
CREATE INDEX idx_agents_prompts_id ON agents (prompts_id);

-- GIN index for JSONB mcp_servers for efficient queries
CREATE INDEX idx_agents_mcp_servers ON agents USING GIN (mcp_servers);


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

-- Trigger to update updated_at on agents table
CREATE TRIGGER update_agents_updated_at 
    BEFORE UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VALIDATION FUNCTION
-- ============================================================================

-- Function to validate agent data completeness before insertion
-- This provides detailed error messages for missing fields
CREATE OR REPLACE FUNCTION validate_agent_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Check profile name
    IF (NEW.profile).name IS NULL OR length(trim((NEW.profile).name)) = 0 THEN
        RAISE EXCEPTION 'Agent profile.name is required and cannot be empty';
    END IF;

    -- Check profile group
    IF (NEW.profile)."group" IS NULL THEN
        RAISE EXCEPTION 'Agent profile.group is required';
    END IF;
    
    -- Check profile fields
    IF NEW.profile IS NULL THEN
        RAISE EXCEPTION 'Agent profile is required';
    END IF;
    
    IF (NEW.profile).description IS NULL THEN
        RAISE EXCEPTION 'Agent profile.description is required';
    END IF;
    
    IF (NEW.profile).contexts IS NULL THEN
        RAISE EXCEPTION 'Agent profile.contexts is required (can be empty array)';
    END IF;
    
    
    -- Check mcp_servers
    IF NEW.mcp_servers IS NULL THEN
        RAISE EXCEPTION 'Agent mcp_servers is required (can be empty object {})';
    END IF;
    
    
    -- Check prompts_id
    IF NEW.prompts_id IS NULL THEN
        RAISE EXCEPTION 'Agent prompts_id is required';
    END IF;
    
    -- Check graph configuration
    IF NEW.graph IS NULL THEN
        RAISE EXCEPTION 'Agent graph configuration is required';
    END IF;
    
    IF (NEW.graph).max_steps IS NULL THEN
        RAISE EXCEPTION 'Agent graph.max_steps is required';
    END IF;
    
    IF (NEW.graph).max_iterations IS NULL THEN
        RAISE EXCEPTION 'Agent graph.max_iterations is required';
    END IF;
    
    IF (NEW.graph).max_retries IS NULL THEN
        RAISE EXCEPTION 'Agent graph.max_retries is required';
    END IF;
    
    IF (NEW.graph).execution_timeout_ms IS NULL THEN
        RAISE EXCEPTION 'Agent graph.execution_timeout_ms is required';
    END IF;
    
    IF (NEW.graph).max_token_usage IS NULL THEN
        RAISE EXCEPTION 'Agent graph.max_token_usage is required';
    END IF;
    
    IF (NEW.graph).model IS NULL THEN
        RAISE EXCEPTION 'Agent graph.model configuration is required';
    END IF;
    
    -- Check memory configuration
    IF NEW.memory IS NULL THEN
        RAISE EXCEPTION 'Agent memory configuration is required';
    END IF;
    
    IF (NEW.memory).ltm_enabled IS NULL THEN
        RAISE EXCEPTION 'Agent memory.ltm_enabled is required';
    END IF;
    
    IF (NEW.memory).strategy IS NULL THEN
        RAISE EXCEPTION 'Agent memory.strategy is required';
    END IF;
    
    -- Check RAG configuration
    IF NEW.rag IS NULL THEN
        RAISE EXCEPTION 'Agent RAG configuration is required';
    END IF;
    
    IF (NEW.rag).enabled IS NULL THEN
        RAISE EXCEPTION 'Agent rag.enabled is required';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate agent data before insert or update
CREATE TRIGGER validate_agent_data_trigger
    BEFORE INSERT OR UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION validate_agent_data();

-- ============================================================================
-- CONVENIENCE FUNCTIONS
-- ============================================================================

-- Function to update agent memory strategy
CREATE OR REPLACE FUNCTION update_agent_memory_strategy(
    p_agent_id UUID,
    p_user_id UUID,
    p_strategy memory_strategy
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE agents
    SET memory.strategy = p_strategy
    WHERE id = p_agent_id AND user_id = p_user_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_agent_complete(
  p_agent_id UUID,
  p_user_id UUID,
  p_config JSONB
) RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  updated_agent_id UUID
) AS $$
BEGIN
  -- Update only provided fields
  UPDATE agents
  SET
    profile = CASE 
      WHEN p_config->'profile' IS NOT NULL THEN
        ROW(
          COALESCE(p_config->'profile'->>'name', (profile).name),
          COALESCE(p_config->'profile'->>'group', (profile)."group"),
          COALESCE(p_config->'profile'->>'description', (profile).description),
          COALESCE(
            CASE 
              WHEN p_config->'profile'->'contexts' IS NOT NULL THEN
                ARRAY(SELECT jsonb_array_elements_text(p_config->'profile'->'contexts'))
              ELSE NULL
            END,
            (profile).contexts
          )
        )::agent_profile
      ELSE profile
    END,
    mcp_servers = COALESCE(p_config->'mcp_servers', mcp_servers),
    prompts_id = COALESCE((p_config->>'prompts_id')::UUID, prompts_id),
    graph = CASE
      WHEN p_config->'graph' IS NOT NULL THEN
        ROW(
          COALESCE((p_config->'graph'->>'max_steps')::integer, (graph).max_steps),
          COALESCE((p_config->'graph'->>'max_iterations')::integer, (graph).max_iterations),
          COALESCE((p_config->'graph'->>'max_retries')::integer, (graph).max_retries),
          COALESCE((p_config->'graph'->>'execution_timeout_ms')::bigint, (graph).execution_timeout_ms),
          COALESCE((p_config->'graph'->>'max_token_usage')::integer, (graph).max_token_usage),
          ROW(
            COALESCE(p_config->'graph'->'model'->>'model_provider', ((graph).model).model_provider),
            COALESCE(p_config->'graph'->'model'->>'model_name', ((graph).model).model_name),
            COALESCE((p_config->'graph'->'model'->>'temperature')::numeric(3,2), ((graph).model).temperature),
            COALESCE((p_config->'graph'->'model'->>'max_tokens')::integer, ((graph).model).max_tokens)
          )::model_config
        )::graph_config
      ELSE graph
    END,
    memory = CASE
      WHEN p_config->'memory' IS NOT NULL THEN
        ROW(
          COALESCE((p_config->'memory'->>'ltm_enabled')::boolean, (memory).ltm_enabled),
          ROW(
            COALESCE((p_config->'memory'->'size_limits'->>'short_term_memory_size')::integer, ((memory).size_limits).short_term_memory_size),
            COALESCE((p_config->'memory'->'size_limits'->>'max_insert_episodic_size')::integer, ((memory).size_limits).max_insert_episodic_size),
            COALESCE((p_config->'memory'->'size_limits'->>'max_insert_semantic_size')::integer, ((memory).size_limits).max_insert_semantic_size),
            COALESCE((p_config->'memory'->'size_limits'->>'max_retrieve_memory_size')::integer, ((memory).size_limits).max_retrieve_memory_size),
            COALESCE((p_config->'memory'->'size_limits'->>'limit_before_summarization')::integer, ((memory).size_limits).limit_before_summarization)
          )::memory_size_limits,
          ROW(
            COALESCE((p_config->'memory'->'thresholds'->>'insert_semantic_threshold')::numeric(3,2), ((memory).thresholds).insert_semantic_threshold),
            COALESCE((p_config->'memory'->'thresholds'->>'insert_episodic_threshold')::numeric(3,2), ((memory).thresholds).insert_episodic_threshold),
            COALESCE((p_config->'memory'->'thresholds'->>'retrieve_memory_threshold')::numeric(3,2), ((memory).thresholds).retrieve_memory_threshold),
            COALESCE((p_config->'memory'->'thresholds'->>'hitl_threshold')::numeric(3,2), ((memory).thresholds).hitl_threshold)
          )::memory_thresholds,
          ROW(
            COALESCE((p_config->'memory'->'timeouts'->>'retrieve_memory_timeout_ms')::bigint, ((memory).timeouts).retrieve_memory_timeout_ms),
            COALESCE((p_config->'memory'->'timeouts'->>'insert_memory_timeout_ms')::bigint, ((memory).timeouts).insert_memory_timeout_ms)
          )::memory_timeouts,
          -- Fixed: Cast to memory_strategy first, then COALESCE with matching types
          COALESCE(
            (p_config->'memory'->>'strategy')::memory_strategy, 
            (memory).strategy
          )
        )::memory_config
      ELSE memory
    END,
    rag = CASE
      WHEN p_config->'rag' IS NOT NULL THEN
        ROW(
          COALESCE((p_config->'rag'->>'enabled')::boolean, (rag).enabled),
          COALESCE((p_config->'rag'->>'top_k')::integer, (rag).top_k),
          COALESCE(p_config->'rag'->>'embedding_model', (rag).embedding_model)
        )::rag_config
      ELSE rag
    END,
    avatar_image = CASE 
      WHEN p_config ? 'avatar_image' AND p_config->>'avatar_image' IS NOT NULL THEN
        decode(p_config->>'avatar_image', 'base64')
      ELSE avatar_image
    END,
    avatar_mime_type = COALESCE(p_config->>'avatar_mime_type', avatar_mime_type),
    updated_at = NOW()
  WHERE id = p_agent_id AND user_id = p_user_id;
  
  IF FOUND THEN
    RETURN QUERY SELECT TRUE, 'Agent updated successfully', p_agent_id;
  ELSE
    RETURN QUERY SELECT FALSE, 'Agent not found or unauthorized', NULL::UUID;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update agent with full replacement (all fields required)
-- This function requires ALL mandatory fields and completely replaces the record
CREATE OR REPLACE FUNCTION replace_agent_complete(
    p_agent_id UUID,
    p_user_id UUID,
    p_profile agent_profile,
    p_mcp_servers JSONB,
    p_prompts_id UUID,
    p_graph graph_config,
    p_memory memory_config,
    p_rag rag_config,
    p_avatar_image BYTEA DEFAULT NULL,
    p_avatar_mime_type VARCHAR(50) DEFAULT NULL
) RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    updated_agent_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
    rows_updated INTEGER;
BEGIN
    -- Check if agent exists and belongs to the user
    IF NOT EXISTS (SELECT 1 FROM agents WHERE id = p_agent_id AND user_id = p_user_id) THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Agent not found with ID: ' || p_agent_id::TEXT || ' for user: ' || p_user_id::TEXT AS message,
            NULL::UUID AS updated_agent_id;
        RETURN;
    END IF;

    -- Completely replace all fields (mandatory fields must be provided)
    UPDATE agents SET
        profile = p_profile,
        mcp_servers = p_mcp_servers,
        prompts_id = p_prompts_id,
        graph = p_graph,
        memory = p_memory,
        rag = p_rag,
        avatar_image = p_avatar_image,
        avatar_mime_type = p_avatar_mime_type,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_agent_id AND user_id = p_user_id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    IF rows_updated > 0 THEN
        RETURN QUERY SELECT
            TRUE AS success,
            'Agent completely replaced successfully' AS message,
            p_agent_id AS updated_agent_id;
    ELSE
        RETURN QUERY SELECT
            FALSE AS success,
            'Failed to replace agent' AS message,
            NULL::UUID AS updated_agent_id;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Error replacing agent: ' || SQLERRM AS message,
            NULL::UUID AS updated_agent_id;
END;
$$;
-- Function to enable/disable RAG for an agent
CREATE OR REPLACE FUNCTION toggle_agent_rag(
    p_agent_id UUID,
    p_user_id UUID,
    p_enabled BOOLEAN
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE agents
    SET rag.enabled = p_enabled
    WHERE id = p_agent_id AND user_id = p_user_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION insert_agent_from_json(
  p_user_id UUID,
  p_config JSONB
) RETURNS TABLE(
  id UUID,
  user_id UUID,
  profile JSONB,
  mcp_servers JSONB,
  prompts_id UUID,
  graph JSONB,
  memory JSONB,
  rag JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  avatar_image BYTEA,
  avatar_mime_type VARCHAR(50)
) AS $$
DECLARE
  v_prompts_id UUID;
  v_inserted_id UUID;
BEGIN
  -- Extract prompts_id, use NULL if not present
  v_prompts_id := (p_config->>'prompts_id')::UUID;

  -- If NULL, initialize default prompts
  IF v_prompts_id IS NULL THEN
    RAISE EXCEPTION 'prompts_id is required in the configuration JSON';
  END IF;

  INSERT INTO agents (
    user_id,
    profile,
    mcp_servers,
    prompts_id,
    graph,
    memory,
    rag,
    avatar_image,
    avatar_mime_type
  ) VALUES (
    p_user_id,
    ROW(
      p_config->'profile'->>'name',
      p_config->'profile'->>'group',
      p_config->'profile'->>'description',
      ARRAY(SELECT jsonb_array_elements_text(p_config->'profile'->'contexts'))
    )::agent_profile,
    p_config->'mcp_servers',
    v_prompts_id,
    ROW(
      (p_config->'graph'->>'max_steps')::integer,
      (p_config->'graph'->>'max_iterations')::integer,
      (p_config->'graph'->>'max_retries')::integer,
      (p_config->'graph'->>'execution_timeout_ms')::bigint,
      (p_config->'graph'->>'max_token_usage')::integer,
      ROW(
        p_config->'graph'->'model'->>'model_provider',
        p_config->'graph'->'model'->>'model_name',
        (p_config->'graph'->'model'->>'temperature')::numeric(3,2),
        (p_config->'graph'->'model'->>'max_tokens')::integer
      )::model_config
    )::graph_config,
    ROW(
      (p_config->'memory'->>'ltm_enabled')::boolean,
      ROW(
        (p_config->'memory'->'size_limits'->>'short_term_memory_size')::integer,
        (p_config->'memory'->'size_limits'->>'max_insert_episodic_size')::integer,
        (p_config->'memory'->'size_limits'->>'max_insert_semantic_size')::integer,
        (p_config->'memory'->'size_limits'->>'max_retrieve_memory_size')::integer,
        (p_config->'memory'->'size_limits'->>'limit_before_summarization')::integer
      )::memory_size_limits,
      ROW(
        (p_config->'memory'->'thresholds'->>'insert_semantic_threshold')::numeric(3,2),
        (p_config->'memory'->'thresholds'->>'insert_episodic_threshold')::numeric(3,2),
        (p_config->'memory'->'thresholds'->>'retrieve_memory_threshold')::numeric(3,2),
        (p_config->'memory'->'thresholds'->>'hitl_threshold')::numeric(3,2)
      )::memory_thresholds,
      ROW(
        (p_config->'memory'->'timeouts'->>'retrieve_memory_timeout_ms')::bigint,
        (p_config->'memory'->'timeouts'->>'insert_memory_timeout_ms')::bigint
      )::memory_timeouts,
      (p_config->'memory'->>'strategy')::memory_strategy
    )::memory_config,
    ROW(
      (p_config->'rag'->>'enabled')::boolean,
      (p_config->'rag'->>'top_k')::integer,
      p_config->'rag'->>'embedding_model'
    )::rag_config,
    CASE 
      WHEN p_config ? 'avatar_image' AND p_config->>'avatar_image' IS NOT NULL THEN
        decode(p_config->>'avatar_image', 'base64')
      ELSE NULL
    END,
    p_config->>'avatar_mime_type'
  ) RETURNING agents.id INTO v_inserted_id;  

  RETURN QUERY
  SELECT
    a.id,
    a.user_id,
    to_jsonb(a.profile) as profile,        
    a.mcp_servers as mcp_servers,
    a.prompts_id,
    to_jsonb(a.graph) as graph,           
    to_jsonb(a.memory) as memory,          
    to_jsonb(a.rag) as rag,          
    a.created_at,
    a.updated_at,
    a.avatar_image,
    a.avatar_mime_type
  FROM agents a
  WHERE a.id = v_inserted_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Example 1: Creating a new agent with COMPLETE configuration (ALL FIELDS REQUIRED)
/*
INSERT INTO agents (
    user_id,
    name,
    "group",
    profile,
    mcp_servers,
    plugins,
    prompts_id,
    graph,
    memory,
    rag
) VALUES (
    '123e4567-e89b-12d3-a456-426614174000'::UUID,  -- user_id (required)
    'Customer Service Bot',
    'support',
    ROW(
        'Handles customer inquiries and support tickets',
        ARRAY['Friendly and helpful', 'Patient with customers'],
        ARRAY['Resolve customer issues', 'Provide accurate information'],
        ARRAY['product-catalog', 'return-policy', 'shipping-info'],
        NULL
    )::agent_profile,
    '{"slack": {"url": "https://slack.api", "token": "xxx"}}'::jsonb,
    ARRAY['email-plugin', 'calendar-plugin'],
    '550e8400-e29b-41d4-a716-446655440001'::UUID,
    ROW(
        200, 30, 5, 600000, 150000,
        ROW('gpt-4-turbo', 0.8, 8192, 0.9, 0.1, 0.1)::model_config
    )::graph_config,
    ROW(
        true, 0.85,
        ROW(15, 100, 100, 30)::memory_size_limits,
        ROW(0.75, 0.65, 0.55, 0.85)::memory_thresholds,
        ROW(10000, 5000)::memory_timeouts,
        'categorized'::memory_strategy
    )::memory_config,
    ROW(true, 10, 'text-embedding-3-large')::rag_config
);
*/

-- Example 2: This will FAIL - missing required fields
/*
INSERT INTO agents (name) VALUES ('Test Bot');
-- ERROR: Agent profile is required
*/

-- Example 3: Minimal valid agent with empty arrays/objects where allowed
/*
INSERT INTO agents (
    user_id,
    name,
    profile,
    mcp_servers,
    plugins,
    prompts_id,
    graph,
    memory,
    rag
) VALUES (
    '123e4567-e89b-12d3-a456-426614174000'::UUID,  -- user_id (required)
    'Minimal Bot',
    ROW(
        'A minimal agent configuration',
        ARRAY[]::TEXT[],  -- empty lore
        ARRAY[]::TEXT[],  -- empty objectives
        ARRAY[]::TEXT[],  -- empty knowledge
        NULL
    )::agent_profile,
    '{}'::jsonb,  -- empty mcp_servers
    ARRAY[]::TEXT[],  -- empty plugins
    '550e8400-e29b-41d4-a716-446655440002'::UUID,
    ROW(
        100, 15, 3, 300000, 100000,
        ROW('gpt-4', 0.7, 4096, 0.95, 0.0, 0.0)::model_config
    )::graph_config,
    ROW(
        false, 0.8,
        ROW(10, 50, 50, 20)::memory_size_limits,
        ROW(0.7, 0.6, 0.5, 0.8)::memory_thresholds,
        ROW(5000, 3000)::memory_timeouts,
        'holistic'::memory_strategy
    )::memory_config,
    ROW(false, 5, 'text-embedding-ada-002')::rag_config
);
*/

-- Example 4: Querying agents by memory strategy for a specific user
/*
SELECT name, (memory).strategy, (memory).ltm_enabled
FROM agents
WHERE user_id = '123e4567-e89b-12d3-a456-426614174000'::UUID
AND (memory).strategy = 'categorized';
*/


-- Example 6: Updating MCP server configuration for a specific user's agent
/*
UPDATE agents
SET mcp_servers = mcp_servers || '{"github": {"token": "ghp_xxx"}}'::jsonb
WHERE user_id = '123e4567-e89b-12d3-a456-426614174000'::UUID
AND name = 'Development Assistant';
*/

-- Example 7: Partial agent update (only update specific fields)
/*
SELECT * FROM update_agent_complete(
    '456e7890-e89b-12d3-a456-426614174001'::UUID,  -- agent_id
    '123e4567-e89b-12d3-a456-426614174000'::UUID,  -- user_id
    ROW(
        'Updated Agent Name',
        'production',
        'Updated description',
        ARRAY['updated context']
    )::agent_profile,                               -- new profile
    NULL,                                           -- keep existing mcp_servers
    NULL,                                           -- keep existing prompts
    NULL,                                           -- keep existing graph config
    NULL,                                           -- keep existing memory config
    NULL                                            -- keep existing rag config
);
*/

-- Example 8: Complete agent replacement
/*
SELECT * FROM replace_agent_complete(
    '456e7890-e89b-12d3-a456-426614174001'::UUID,  -- agent_id
    '123e4567-e89b-12d3-a456-426614174000'::UUID,  -- user_id
    ROW(
        'Completely New Agent',
        'new_group',
        'Brand new description',
        ARRAY['New context']
    )::agent_profile,
    '{"newservice": {"url": "https://api.new", "key": "xxx"}}'::jsonb,
    '550e8400-e29b-41d4-a716-446655440003'::UUID,
    ROW(
        150, 25, 4, 500000, 120000,
        ROW('gpt-4', 0.7, 6144, 0.85, 0.2, 0.1)::model_config
    )::graph_config,
    ROW(
        true, 0.9,
        ROW(12, 80, 80, 25)::memory_size_limits,
        ROW(0.8, 0.7, 0.6, 0.9)::memory_thresholds,
        ROW(8000, 4000)::memory_timeouts,
        'holistic'::memory_strategy
    )::memory_config,
    ROW(true, 8, 'text-embedding-3-small')::rag_config
);
*/

-- ============================================================================