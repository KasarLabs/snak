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
    user_id TEXT NOT NULL ,
    model model_config NOT NULL
);

-- ============================================================================
-- MODEL CONFIGURATION PATTERNS
-- ============================================================================
--
-- Example model configurations:
--
-- OpenAI GPT-4 Configuration:
--   ROW('openai', 'gpt-4', 0.7, 8192)::model_config
--
-- OpenAI GPT-3.5 Turbo Configuration:
--   ROW('openai', 'gpt-3.5-turbo', 0.7, 4096)::model_config
--
-- Anthropic Claude-3 Sonnet Configuration:
--   ROW('anthropic', 'claude-3-sonnet-20240229', 0.7, 8192)::model_config
--
-- Anthropic Claude-3 Haiku Configuration:
--   ROW('anthropic', 'claude-3-haiku-20240307', 0.7, 4096)::model_config
--
-- Local Ollama Configuration:
--   ROW('ollama', 'llama3.1:8b', 0.7, 4096)::model_config
--
-- Azure OpenAI Configuration:
--   ROW('azure', 'gpt-4', 0.7, 8192)::model_config
--
-- ============================================================================

-- ============================================================================
-- USAGE PATTERNS
-- ============================================================================
--
-- Inserting a new model configuration:
--   INSERT INTO models_config (user_id, model) VALUES (
--     'user123',
--     ROW('openai', 'gpt-4', 0.7, 8192)::model_config
--   );
--
-- Retrieving model configurations:
--   SELECT
--     id,
--     user_id,
--     (model).model_provider as provider,
--     (model).model_name as model_name,
--     (model).temperature as temperature,
--     (model).max_tokens as max_tokens
--   FROM models_config
--   WHERE user_id = $1;
--
-- Updating model configuration:
--   UPDATE models_config
--   SET model = ROW('anthropic', 'claude-3-sonnet-20240229', 0.7, 8192)::model_config
--   WHERE user_id = $1;
--
-- Finding configurations by provider:
--   SELECT * FROM models_config
--   WHERE (model).model_provider = 'openai';
--
-- Finding configurations by model name:
--   SELECT * FROM models_config
--   WHERE (model).model_name = 'gpt-4';
--
-- ============================================================================

-- ============================================================================
-- MODEL SELECTION STRATEGY
-- ============================================================================
--
-- Agent Model Selection Guidelines:
--
-- Model Configuration Considerations:
--    - Choose appropriate provider based on requirements and availability
--    - Set temperature based on desired creativity vs consistency
--      * Lower (0.0-0.3): More deterministic, consistent outputs
--      * Medium (0.4-0.7): Balanced creativity and consistency
--      * Higher (0.8-2.0): More creative, varied outputs
--    - Set max_tokens based on expected response length needs
--      * Short responses: 1024-2048 tokens
--      * Medium responses: 4096-8192 tokens
--      * Long responses: 8192+ tokens
--
-- Provider Selection Guidelines:
--    - OpenAI: General-purpose, well-documented APIs
--    - Anthropic: Strong reasoning, safety-focused
--    - Azure: Enterprise integration, compliance features
--    - Ollama: Local deployment, privacy, cost control
--
-- Implementation Notes:
-- - Each user/agent should have their own model configuration
-- - Model configuration can be updated per user requirements
-- - Monitor costs and performance metrics for optimization
-- - Consider rate limits and availability when selecting providers
-- - Validate all required fields before creating configurations
--
-- ============================================================================

-- ============================================================================
-- CONFIGURATION MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to get default model configuration
-- Returns the first available model configuration or raises an error if none exists
CREATE OR REPLACE FUNCTION get_default_models_config()
RETURNS models_config
LANGUAGE plpgsql
AS $$
DECLARE
    config models_config;
BEGIN
    -- Try to get existing configuration
    SELECT * INTO config FROM models_config LIMIT 1;

    -- If no configuration exists, raise an error instead of creating defaults
    -- This forces proper configuration setup
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No model configuration found. Please create a model configuration first.';
    END IF;

    RETURN config;
END;
$$;

-- Function to validate model configuration
-- Raises specific errors for missing fields instead of returning boolean
CREATE OR REPLACE FUNCTION validate_models_config_record()
RETURNS TRIGGER AS $$
BEGIN
    -- Check that model configuration is defined
    IF NEW.model IS NULL THEN
        RAISE EXCEPTION 'Model configuration is required';
    END IF;

    -- Check that all model fields are present
    IF (NEW.model).model_provider IS NULL OR length(trim((NEW.model).model_provider)) = 0 THEN
        RAISE EXCEPTION 'Model configuration missing: model_provider is required';
    END IF;

    IF (NEW.model).model_name IS NULL OR length(trim((NEW.model).model_name)) = 0 THEN
        RAISE EXCEPTION 'Model configuration missing: model_name is required';
    END IF;

    IF (NEW.model).temperature IS NULL THEN
        RAISE EXCEPTION 'Model configuration missing: temperature is required';
    END IF;

    IF (NEW.model).max_tokens IS NULL THEN
        RAISE EXCEPTION 'Model configuration missing: max_tokens is required';
    END IF;

    -- Validate temperature range (0.0 to 2.0 for most models)
    IF (NEW.model).temperature < 0.0 OR (NEW.model).temperature > 2.0 THEN
        RAISE EXCEPTION 'Model temperature must be between 0.0 and 2.0, got: %', (NEW.model).temperature;
    END IF;

    -- Validate max_tokens (must be positive)
    IF (NEW.model).max_tokens <= 0 THEN
        RAISE EXCEPTION 'Model max_tokens must be positive, got: %', (NEW.model).max_tokens;
    END IF;

    -- All validations passed
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate models on insert/update
CREATE TRIGGER validate_models_config_before_insert_update
    BEFORE INSERT OR UPDATE ON models_config
    FOR EACH ROW
    EXECUTE FUNCTION validate_models_config_record();

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