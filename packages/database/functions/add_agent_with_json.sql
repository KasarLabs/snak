-- Function to add an agent and return properly formatted JSON
CREATE OR REPLACE FUNCTION add_agent_with_json(
    p_name VARCHAR(255),
    p_group VARCHAR(255),
    p_profile_description TEXT,
    p_profile_group VARCHAR(255),
    p_profile_lore TEXT[],
    p_profile_objectives TEXT[],
    p_profile_knowledge TEXT[],
    p_profile_merged_profile TEXT,
    p_mode agent_mode,
    p_mcp_servers JSONB,
    p_plugins TEXT[],
    p_prompts_id VARCHAR(255),
    p_graph_max_steps INTEGER,
    p_graph_max_iterations INTEGER,
    p_graph_max_retries INTEGER,
    p_graph_execution_timeout_ms BIGINT,
    p_graph_max_token_usage INTEGER,
    p_model_provider VARCHAR(50),
    p_model_name VARCHAR(255),
    p_model_temperature NUMERIC(3,2),
    p_model_max_tokens INTEGER,
    p_memory_ltm_enabled BOOLEAN,
    p_memory_summarization_threshold NUMERIC(3,2),
    p_memory_short_term_size INTEGER,
    p_memory_max_insert_episodic INTEGER,
    p_memory_max_insert_semantic INTEGER,
    p_memory_max_retrieve INTEGER,
    p_memory_insert_semantic_threshold NUMERIC(3,2),
    p_memory_insert_episodic_threshold NUMERIC(3,2),
    p_memory_retrieve_threshold NUMERIC(3,2),
    p_memory_summarization_threshold_config NUMERIC(3,2),
    p_memory_retrieve_timeout_ms BIGINT,
    p_memory_insert_timeout_ms BIGINT,
    p_memory_strategy memory_strategy,
    p_rag_enabled BOOLEAN,
    p_rag_top_k INTEGER,
    p_rag_embedding_model VARCHAR(255)
) RETURNS JSON AS $$
DECLARE
    new_agent_id UUID;
    result_json JSON;
BEGIN
    -- Insert the agent and get the ID
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
        p_name,
        p_group,
        ROW(p_profile_description, p_profile_group, p_profile_lore, p_profile_objectives, p_profile_knowledge, p_profile_merged_profile)::agent_profile,
        p_mode,
        p_mcp_servers,
        p_plugins,
        ROW(p_prompts_id)::agent_prompts,
        ROW(p_graph_max_steps, p_graph_max_iterations, p_graph_max_retries, p_graph_execution_timeout_ms, p_graph_max_token_usage,
            ROW(p_model_provider, p_model_name, p_model_temperature, p_model_max_tokens)::model_config)::graph_config,
        ROW(p_memory_ltm_enabled, p_memory_summarization_threshold,
            ROW(p_memory_short_term_size, p_memory_max_insert_episodic, p_memory_max_insert_semantic, p_memory_max_retrieve)::memory_size_limits,
            ROW(p_memory_insert_semantic_threshold, p_memory_insert_episodic_threshold, p_memory_retrieve_threshold, p_memory_summarization_threshold_config)::memory_thresholds,
            ROW(p_memory_retrieve_timeout_ms, p_memory_insert_timeout_ms)::memory_timeouts,
            p_memory_strategy)::memory_config,
        ROW(p_rag_enabled, p_rag_top_k, p_rag_embedding_model)::rag_config
    ) RETURNING id INTO new_agent_id;

    -- Return the complete agent data with JSON formatting
    SELECT json_build_object(
        'id', id,
        'name', name,
        'group', "group",
        'profile', row_to_json(profile),
        'mode', mode,
        'mcp_servers', mcp_servers,
        'plugins', plugins,
        'prompts', row_to_json(prompts),
        'graph', row_to_json(graph),
        'memory', row_to_json(memory),
        'rag', row_to_json(rag),
        'created_at', created_at,
        'updated_at', updated_at,
        'avatar_image', avatar_image,
        'avatar_mime_type', avatar_mime_type
    ) INTO result_json
    FROM agents
    WHERE id = new_agent_id;

    RETURN result_json;
END;
$$ LANGUAGE plpgsql;