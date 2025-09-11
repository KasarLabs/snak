-- ============================================================================
-- AI MODEL CONFIGURATION SYSTEM
-- ============================================================================
-- This file manages AI model configurations and tiers for the agent system
-- Provides a flexible framework for different model types and capabilities
-- Supports multi-tier model selection for optimal cost/performance balance
-- ============================================================================

-- AI Models Configuration Table
-- Manages different tiers of AI models for various use cases
CREATE TABLE IF NOT EXISTS models_config (
    -- Unique identifier for each model configuration set
    -- UUID ensures global uniqueness across distributed systems
    id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Fast Model Configuration
    -- Optimized for: Quick responses, simple tasks, high throughput
    -- Use cases: Simple queries, formatting, basic classification
    -- Typical models: GPT-3.5-turbo, Claude Haiku, smaller local models
    -- Cost: Low, Speed: High, Capability: Basic
    fast  model NOT NULL,
    
    -- Smart Model Configuration  
    -- Optimized for: Complex reasoning, detailed analysis, accuracy
    -- Use cases: Complex problem solving, code generation, deep analysis
    -- Typical models: GPT-4, Claude Sonnet, larger reasoning models  
    -- Cost: Medium, Speed: Medium, Capability: High
    smart model NOT NULL,
    
    -- Cheap Model Configuration
    -- Optimized for: Cost efficiency, bulk operations, simple tasks
    -- Use cases: Data processing, simple transformations, batch jobs
    -- Typical models: Local models, older generations, specialized cheap models
    -- Cost: Very Low, Speed: Variable, Capability: Basic
    cheap model NOT NULL
);

-- ============================================================================
-- MODEL CONFIGURATION PATTERNS
-- ============================================================================
--
-- Example model configurations:
--
-- OpenAI Configuration:
--   fast:  ROW('openai', 'gpt-3.5-turbo', 'Fast general-purpose model')::model
--   smart: ROW('openai', 'gpt-4', 'Advanced reasoning and analysis')::model  
--   cheap: ROW('openai', 'gpt-3.5-turbo', 'Cost-optimized for bulk tasks')::model
--
-- Anthropic Configuration:
--   fast:  ROW('anthropic', 'claude-3-haiku', 'Quick responses and formatting')::model
--   smart: ROW('anthropic', 'claude-3-sonnet', 'Complex reasoning and coding')::model
--   cheap: ROW('anthropic', 'claude-3-haiku', 'Budget-friendly operations')::model
--
-- Mixed Provider Configuration:
--   fast:  ROW('openai', 'gpt-3.5-turbo', 'OpenAI fast model')::model
--   smart: ROW('anthropic', 'claude-3-sonnet', 'Anthropic reasoning model')::model
--   cheap: ROW('local', 'llama-2-7b', 'Local cost-free model')::model
--
-- Local Model Configuration:
--   fast:  ROW('ollama', 'llama3.1:8b', 'Local fast inference')::model
--   smart: ROW('ollama', 'llama3.1:70b', 'Local high-capability model')::model
--   cheap: ROW('ollama', 'tinyllama:1b', 'Minimal resource usage')::model
--
-- ============================================================================

-- ============================================================================
-- USAGE PATTERNS
-- ============================================================================
--
-- Inserting a new model configuration set:
--   INSERT INTO models_config (fast, smart, cheap) VALUES (
--     ROW('openai', 'gpt-3.5-turbo', 'Fast OpenAI model for quick responses')::model,
--     ROW('openai', 'gpt-4', 'Smart OpenAI model for complex reasoning')::model,
--     ROW('openai', 'gpt-3.5-turbo', 'Cheap OpenAI model for bulk operations')::model
--   );
--
-- Retrieving model configurations:
--   SELECT 
--     (fast).provider as fast_provider,
--     (fast).model_name as fast_model,
--     (smart).provider as smart_provider,
--     (smart).model_name as smart_model,
--     (cheap).provider as cheap_provider,
--     (cheap).model_name as cheap_model
--   FROM models_config 
--   WHERE id = $1;
--
-- Updating specific model tier:
--   UPDATE models_config 
--   SET smart = ROW('anthropic', 'claude-3-opus', 'Most advanced reasoning model')::model
--   WHERE id = $1;
--
-- Finding configurations by provider:
--   SELECT * FROM models_config 
--   WHERE (fast).provider = 'openai' 
--      OR (smart).provider = 'openai' 
--      OR (cheap).provider = 'openai';
--
-- ============================================================================

-- ============================================================================
-- MODEL SELECTION STRATEGY
-- ============================================================================
--
-- Agent Model Selection Logic:
-- 
-- 1. FAST Model Selection Criteria:
--    - Simple text formatting and cleanup
--    - Basic classification tasks
--    - Quick status updates and acknowledgments
--    - High-frequency, low-complexity operations
--    - Response time < 2 seconds preferred
--
-- 2. SMART Model Selection Criteria:
--    - Complex reasoning and problem-solving
--    - Code generation and debugging
--    - Detailed analysis and research
--    - Multi-step planning and strategy
--    - Critical decision-making tasks
--    - Quality over speed requirements
--
-- 3. CHEAP Model Selection Criteria:
--    - Bulk data processing operations
--    - Repetitive template-based tasks
--    - Non-critical background processing
--    - Cost-sensitive batch operations
--    - Resource-constrained environments
--
-- Implementation Notes:
-- - Agents should fallback: smart -> fast -> cheap on failures
-- - Model selection can be overridden per agent or per task
-- - Monitor costs and performance metrics for optimization
-- - Consider rate limits and availability when selecting models
--
-- ============================================================================

-- ============================================================================
-- CONFIGURATION MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to get default model configuration
-- Returns the first available model configuration or creates a default one
CREATE OR REPLACE FUNCTION get_default_models_config()
RETURNS models_config
LANGUAGE plpgsql
AS $$
DECLARE
    config models_config;
BEGIN
    -- Try to get existing configuration
    SELECT * INTO config FROM models_config LIMIT 1;
    
    -- If no configuration exists, return a default configuration
    -- This prevents system failures when no models are configured
    IF NOT FOUND THEN
        -- Create default configuration using OpenAI models
        -- This assumes OpenAI API access; modify as needed for your environment
        config.id := uuid_generate_v4();
        config.fast := ROW('openai', 'gpt-3.5-turbo', 'Default fast model for quick responses')::model;
        config.smart := ROW('openai', 'gpt-4', 'Default smart model for complex tasks')::model;
        config.cheap := ROW('openai', 'gpt-3.5-turbo', 'Default cheap model for bulk operations')::model;
    END IF;
    
    RETURN config;
END;
$$;

-- Function to validate model configuration
-- Ensures all required fields are present and properly formatted
CREATE OR REPLACE FUNCTION validate_model_config(config models_config)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check that all model tiers are defined
    IF config.fast IS NULL OR config.smart IS NULL OR config.cheap IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check that all models have required fields
    IF (config.fast).provider IS NULL OR (config.fast).model_name IS NULL OR
       (config.smart).provider IS NULL OR (config.smart).model_name IS NULL OR
       (config.cheap).provider IS NULL OR (config.cheap).model_name IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- All validations passed
    RETURN TRUE;
END;
$$;

-- ============================================================================
-- MONITORING AND ANALYTICS SUPPORT
-- ============================================================================
--
-- For production deployments, consider adding:
--
-- 1. Model Usage Tracking Table:
--    CREATE TABLE model_usage_stats (
--        id SERIAL PRIMARY KEY,
--        model_tier TEXT NOT NULL,  -- 'fast', 'smart', 'cheap'
--        provider TEXT NOT NULL,
--        model_name TEXT NOT NULL,
--        agent_id UUID,
--        request_count INTEGER DEFAULT 0,
--        total_tokens INTEGER DEFAULT 0,
--        total_cost DECIMAL(10,4) DEFAULT 0.00,
--        avg_response_time_ms INTEGER,
--        error_count INTEGER DEFAULT 0,
--        date_recorded DATE DEFAULT CURRENT_DATE
--    );
--
-- 2. Model Performance Metrics:
--    - Response time tracking
--    - Error rate monitoring  
--    - Cost per operation analysis
--    - Token usage patterns
--
-- 3. Automatic Model Selection:
--    - Load-based routing
--    - Cost optimization algorithms
--    - Performance-based fallbacks
--    - A/B testing frameworks
--
-- ============================================================================