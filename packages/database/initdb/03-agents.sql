-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Agent execution mode enumeration
-- As per PostgreSQL manual 8.7: Enums are static, ordered sets of values
CREATE TYPE agent_mode AS ENUM (
    'autonomous',
    'interactive', 
    'hybrid'
);

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
    description TEXT,
    "group" VARCHAR(255),
    lore TEXT[],
    objectives TEXT[],
    knowledge TEXT[],
    merged_profile TEXT  -- Can be null, system-generated
);

-- Agent Prompts configuration
CREATE TYPE agent_prompts AS (
    id VARCHAR(255)
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
    max_retrieve_memory_size INTEGER
);

-- Memory thresholds configuration
CREATE TYPE memory_thresholds AS (
    insert_semantic_threshold NUMERIC(3,2),
    insert_episodic_threshold NUMERIC(3,2),
    retrieve_memory_threshold NUMERIC(3,2),
    summarization_threshold NUMERIC(3,2)
);

-- Memory timeout configuration
CREATE TYPE memory_timeouts AS (
    retrieve_memory_timeout_ms BIGINT,
    insert_memory_timeout_ms BIGINT
);

-- Memory configuration
CREATE TYPE memory_config AS (
    ltm_enabled BOOLEAN,
    summarization_threshold NUMERIC(3,2),
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
-- ALL FIELDS ARE MANDATORY (NOT NULL) except id and group
CREATE TABLE agents (
    -- Unique identifier for each agent (auto-generated)
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Core identification (from AgentConfigBase)
    name VARCHAR(255) NOT NULL,
    "group" VARCHAR(255) NOT NULL DEFAULT 'default_group',
    
    -- Agent Profile (composite type) - MANDATORY
    profile agent_profile NOT NULL,
    
    -- System configuration - MANDATORY
    mode agent_mode NOT NULL,
    
    -- MCP Servers configurations (using JSONB as per manual 8.14) - MANDATORY
    mcp_servers JSONB NOT NULL,
    
    -- Plugins configurations (array of strings) - MANDATORY
    plugins TEXT[] NOT NULL,
    
    -- Prompt configurations (composite type) - MANDATORY
    prompts agent_prompts NOT NULL,
    
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
    
    -- Constraints
    CONSTRAINT agents_name_group_unique UNIQUE (name, "group"),
    CONSTRAINT agents_name_not_empty CHECK (length(trim(name)) > 0),
    -- Ensure mcp_servers is at least an empty object, not null
    CONSTRAINT agents_mcp_servers_not_null CHECK (mcp_servers IS NOT NULL)
);

-- Create indexes for better query performance
CREATE INDEX idx_agents_name ON agents (name);
CREATE INDEX idx_agents_group ON agents ("group");
CREATE INDEX idx_agents_mode ON agents (mode);
CREATE INDEX idx_agents_created_at ON agents (created_at);

-- GIN index for JSONB mcp_servers for efficient queries
CREATE INDEX idx_agents_mcp_servers ON agents USING GIN (mcp_servers);

-- GIN index for plugins array
CREATE INDEX idx_agents_plugins ON agents USING GIN (plugins);

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
    -- Check name
    IF NEW.name IS NULL OR length(trim(NEW.name)) = 0 THEN
        RAISE EXCEPTION 'Agent name is required and cannot be empty';
    END IF;
    
    -- Check profile fields
    IF NEW.profile IS NULL THEN
        RAISE EXCEPTION 'Agent profile is required';
    END IF;
    
    IF (NEW.profile).description IS NULL THEN
        RAISE EXCEPTION 'Agent profile.description is required';
    END IF;
    
    IF (NEW.profile).lore IS NULL THEN
        RAISE EXCEPTION 'Agent profile.lore is required (can be empty array)';
    END IF;
    
    IF (NEW.profile).objectives IS NULL THEN
        RAISE EXCEPTION 'Agent profile.objectives is required (can be empty array)';
    END IF;
    
    IF (NEW.profile).knowledge IS NULL THEN
        RAISE EXCEPTION 'Agent profile.knowledge is required (can be empty array)';
    END IF;
    
    -- Check mode
    IF NEW.mode IS NULL THEN
        RAISE EXCEPTION 'Agent mode is required';
    END IF;
    
    -- Check mcp_servers
    IF NEW.mcp_servers IS NULL THEN
        RAISE EXCEPTION 'Agent mcp_servers is required (can be empty object {})';
    END IF;
    
    -- Check plugins
    IF NEW.plugins IS NULL THEN
        RAISE EXCEPTION 'Agent plugins is required (can be empty array)';
    END IF;
    
    -- Check prompts
    IF NEW.prompts IS NULL THEN
        RAISE EXCEPTION 'Agent prompts configuration is required';
    END IF;

    IF (NEW.prompts).id IS NULL THEN
        RAISE EXCEPTION 'Agent prompts.id is required';
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
    p_strategy memory_strategy
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE agents 
    SET memory.strategy = p_strategy
    WHERE id = p_agent_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to completely update an agent record
-- This function allows updating ALL fields of an agent in a single transaction
CREATE OR REPLACE FUNCTION update_agent_complete(
    p_agent_id UUID,
    p_name VARCHAR(255) DEFAULT NULL,
    p_group VARCHAR(255) DEFAULT NULL,
    p_profile agent_profile DEFAULT NULL,
    p_mode agent_mode DEFAULT NULL,
    p_mcp_servers JSONB DEFAULT NULL,
    p_plugins TEXT[] DEFAULT NULL,
    p_prompts agent_prompts DEFAULT NULL,
    p_graph graph_config DEFAULT NULL,
    p_memory memory_config DEFAULT NULL,
    p_rag rag_config DEFAULT NULL,
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
    existing_agent agents%ROWTYPE;
    rows_updated INTEGER;
BEGIN
    -- Check if agent exists
    SELECT * INTO existing_agent FROM agents WHERE id = p_agent_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Agent not found with ID: ' || p_agent_id::TEXT AS message,
            NULL::UUID AS updated_agent_id;
        RETURN;
    END IF;

    -- Perform the update with COALESCE to keep existing values when NULL is passed
    UPDATE agents SET
        name = COALESCE(p_name, name),
        "group" = COALESCE(p_group, "group"),
        profile = COALESCE(p_profile, profile),
        mode = COALESCE(p_mode, mode),
        mcp_servers = COALESCE(p_mcp_servers, mcp_servers),
        plugins = COALESCE(p_plugins, plugins),
        prompts = COALESCE(p_prompts, prompts),
        graph = COALESCE(p_graph, graph),
        memory = COALESCE(p_memory, memory),
        rag = COALESCE(p_rag, rag),
        avatar_image = COALESCE(p_avatar_image, avatar_image),
        avatar_mime_type = COALESCE(p_avatar_mime_type, avatar_mime_type),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_agent_id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    IF rows_updated > 0 THEN
        RETURN QUERY SELECT
            TRUE AS success,
            'Agent updated successfully' AS message,
            p_agent_id AS updated_agent_id;
    ELSE
        RETURN QUERY SELECT
            FALSE AS success,
            'Failed to update agent' AS message,
            NULL::UUID AS updated_agent_id;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Error updating agent: ' || SQLERRM AS message,
            NULL::UUID AS updated_agent_id;
END;
$$;

-- Function to update agent with full replacement (all fields required)
-- This function requires ALL mandatory fields and completely replaces the record
CREATE OR REPLACE FUNCTION replace_agent_complete(
    p_agent_id UUID,
    p_name VARCHAR(255),
    p_group VARCHAR(255),
    p_profile agent_profile,
    p_mode agent_mode,
    p_mcp_servers JSONB,
    p_plugins TEXT[],
    p_prompts agent_prompts,
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
    -- Check if agent exists
    IF NOT EXISTS (SELECT 1 FROM agents WHERE id = p_agent_id) THEN
        RETURN QUERY SELECT
            FALSE AS success,
            'Agent not found with ID: ' || p_agent_id::TEXT AS message,
            NULL::UUID AS updated_agent_id;
        RETURN;
    END IF;

    -- Completely replace all fields (mandatory fields must be provided)
    UPDATE agents SET
        name = p_name,
        "group" = p_group,
        profile = p_profile,
        mode = p_mode,
        mcp_servers = p_mcp_servers,
        plugins = p_plugins,
        prompts = p_prompts,
        graph = p_graph,
        memory = p_memory,
        rag = p_rag,
        avatar_image = p_avatar_image,
        avatar_mime_type = p_avatar_mime_type,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_agent_id;

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
    p_enabled BOOLEAN
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE agents 
    SET rag.enabled = p_enabled
    WHERE id = p_agent_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to add a plugin to an agent
CREATE OR REPLACE FUNCTION add_agent_plugin(
    p_agent_id UUID,
    p_plugin_name TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE agents 
    SET plugins = array_append(plugins, p_plugin_name)
    WHERE id = p_agent_id 
    AND NOT (p_plugin_name = ANY(plugins));  -- Prevent duplicates
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to remove a plugin from an agent
CREATE OR REPLACE FUNCTION remove_agent_plugin(
    p_agent_id UUID,
    p_plugin_name TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE agents 
    SET plugins = array_remove(plugins, p_plugin_name)
    WHERE id = p_agent_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Bulk Agent Deletion Function
CREATE OR REPLACE FUNCTION delete_all_agents()
RETURNS TABLE (
    deleted_count INTEGER,
    message TEXT
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
                format('%s agent(s) deleted successfully', agent_count)
            ELSE 
                'No agents to delete'
        END AS message;
END;
$$;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Example 1: Creating a new agent with COMPLETE configuration (ALL FIELDS REQUIRED)
/*
INSERT INTO agents (
    name,
    "group",
    profile,
    mode,
    mcp_servers,
    plugins,
    prompts,
    graph,
    memory,
    rag
) VALUES (
    'Customer Service Bot',
    'support',
    ROW(
        'Handles customer inquiries and support tickets',
        'support',
        ARRAY['Friendly and helpful', 'Patient with customers'],
        ARRAY['Resolve customer issues', 'Provide accurate information'],
        ARRAY['product-catalog', 'return-policy', 'shipping-info'],
        NULL
    )::agent_profile,
    'interactive'::agent_mode,
    '{"slack": {"url": "https://slack.api", "token": "xxx"}}'::jsonb,
    ARRAY['email-plugin', 'calendar-plugin'],
    ROW('prompt_config_001')::agent_prompts,
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
    name,
    profile,
    mode,
    mcp_servers,
    plugins,
    prompts,
    graph,
    memory,
    rag
) VALUES (
    'Minimal Bot',
    ROW(
        'A minimal agent configuration',
        'default_group',
        ARRAY[]::TEXT[],  -- empty lore
        ARRAY[]::TEXT[],  -- empty objectives
        ARRAY[]::TEXT[],  -- empty knowledge
        NULL
    )::agent_profile,
    'interactive'::agent_mode,
    '{}'::jsonb,  -- empty mcp_servers
    ARRAY[]::TEXT[],  -- empty plugins
    ROW('minimal_prompt_config')::agent_prompts,
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

-- Example 4: Querying agents by memory strategy
/*
SELECT name, (memory).strategy, (memory).ltm_enabled 
FROM agents 
WHERE (memory).strategy = 'categorized';
*/

-- Example 5: Finding agents with specific plugins
/*
SELECT name, plugins 
FROM agents 
WHERE 'email-plugin' = ANY(plugins);
*/

-- Example 6: Updating MCP server configuration
/*
UPDATE agents
SET mcp_servers = mcp_servers || '{"github": {"token": "ghp_xxx"}}'::jsonb
WHERE name = 'Development Assistant';
*/

-- Example 7: Partial agent update (only update specific fields)
/*
SELECT * FROM update_agent_complete(
    '123e4567-e89b-12d3-a456-426614174000'::UUID,  -- agent_id
    'Updated Agent Name',                            -- new name
    'production',                                    -- new group
    NULL,                                           -- keep existing profile
    'autonomous'::agent_mode,                       -- change mode
    NULL,                                           -- keep existing mcp_servers
    ARRAY['new-plugin', 'another-plugin'],          -- update plugins
    NULL,                                           -- keep existing prompts
    NULL,                                           -- keep existing graph config
    NULL,                                           -- keep existing memory config
    NULL                                            -- keep existing rag config
);
*/

-- Example 8: Complete agent replacement
/*
SELECT * FROM replace_agent_complete(
    '123e4567-e89b-12d3-a456-426614174000'::UUID,
    'Completely New Agent',
    'new_group',
    ROW(
        'Brand new description',
        'new_group',
        ARRAY['New personality trait'],
        ARRAY['New objective'],
        ARRAY['New knowledge'],
        NULL
    )::agent_profile,
    'interactive'::agent_mode,
    '{"newservice": {"url": "https://api.new", "key": "xxx"}}'::jsonb,
    ARRAY['plugin1', 'plugin2'],
    ROW('complete_prompt_config')::agent_prompts,
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