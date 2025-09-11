-- ============================================================================
-- CUSTOM COMPOSITE TYPES
-- ============================================================================
-- This file defines custom PostgreSQL composite types used throughout the system
-- Composite types group related fields together and ensure data consistency
-- They provide type safety and make the schema more maintainable
-- ============================================================================

-- Memory Configuration Type
-- Defines the memory system settings for AI agents
CREATE TYPE memory AS (
    -- Controls whether the agent has memory capabilities enabled
    -- When false, agent operates in stateless mode
    enabled                 BOOLEAN,
    
    -- Number of recent interactions kept in short-term memory
    -- Used for immediate context in conversations
    -- Typical range: 5-20 interactions
    short_term_memory_size  INTEGER,
    
    -- Total capacity of the agent's memory system
    -- Includes both short-term and long-term memory entries
    -- Typical range: 20-1000 entries depending on use case
    memory_size             INTEGER
);

-- Retrieval-Augmented Generation (RAG) Configuration Type
-- Controls how agents access and use external knowledge
CREATE TYPE rag AS (
    -- Controls whether RAG functionality is active for this agent
    -- When true, agent can search and retrieve relevant information
    enabled         BOOLEAN,
    
    -- Specifies which embedding model to use for semantic search
    -- Common values: 'text-embedding-ada-002', 'sentence-transformers/all-MiniLM-L6-v2'
    -- Must match available models in the system
    embedding_model TEXT
);

-- AI Model Configuration Type
-- Standardizes how AI models are referenced throughout the system
CREATE TYPE model AS (
    -- The AI service provider (e.g., 'openai', 'anthropic', 'local')
    -- Used for routing requests to appropriate API endpoints
    provider    TEXT,
    
    -- Specific model identifier within the provider's catalog
    -- Examples: 'gpt-4', 'claude-3-sonnet', 'llama-2-70b'
    model_name  TEXT,
    
    -- Human-readable description of model capabilities and use cases
    -- Helps administrators understand when to use each model
    description TEXT
);

-- ============================================================================
-- TYPE USAGE PATTERNS
-- ============================================================================
--
-- These composite types are used in table definitions as:
--
-- 1. Default values with ROW constructor:
--    memory NOT NULL DEFAULT ROW(false, 5, 20)::memory
--
-- 2. Field access in queries:
--    SELECT (agent_config.memory).enabled FROM agents;
--
-- 3. Updates of individual fields:
--    UPDATE agents SET memory.enabled = true WHERE id = $1;
--
-- 4. Complete type replacement:
--    UPDATE agents SET rag = ROW(true, 'text-embedding-ada-002')::rag;
--
-- ============================================================================