-- ============================================================================
-- AGENT MANAGEMENT SYSTEM
-- ============================================================================
-- This file contains all tables and functions related to AI agent management
-- Agents are the core entities that perform tasks and interact with users
-- ============================================================================

-- Primary Agents Table
-- Central registry for all AI agents in the system
CREATE TABLE IF NOT EXISTS agents (
    -- Unique identifier for each agent (UUID v4)
    -- Primary key ensures each agent has a distinct identity
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Human-readable name for the agent
    -- Used in UI displays and logging
    -- Must be unique within a group for clarity
    name             VARCHAR(255) NOT NULL,

    -- Reference to the user who owns this agent
    -- Foreign key linking to the user who created and manages this agent
    -- Ensures proper access control and ownership tracking
    user_id          UUID NOT NULL,
    
    -- Organizational grouping for agents
    -- Allows logical separation of agents by purpose, team, or environment
    -- Default group handles ungrouped agents
    "group"          VARCHAR(255) NOT NULL DEFAULT 'default_group',
    
    -- Detailed description of the agent's purpose and capabilities
    -- Used by administrators to understand agent functionality
    -- Should explain what tasks the agent performs
    description      TEXT NOT NULL,
    
    -- Agent's background story and personality traits
    -- Array of text elements that define agent's character
    -- Used to maintain consistent personality in interactions
    lore             TEXT[] NOT NULL DEFAULT '{}',
    
    -- Primary goals and objectives for the agent
    -- Array defining what the agent is trying to achieve
    -- Guides decision-making and task prioritization
    objectives       TEXT[] NOT NULL DEFAULT '{}',
    
    -- Domain-specific knowledge and expertise areas
    -- Array of knowledge topics the agent specializes in
    -- Used for task routing and capability matching
    knowledge        TEXT[] NOT NULL DEFAULT '{}',
    
    -- Base system prompt that defines agent behavior
    -- Core instructions that shape how the agent responds
    -- Can be null to use system defaults
    system_prompt    TEXT,
    
    -- Processing interval in seconds
    -- How frequently the agent checks for new tasks
    -- Lower values = more responsive, higher resource usage
    interval         INTEGER NOT NULL DEFAULT 5,
    
    -- Array of enabled plugin names
    -- Defines additional capabilities available to the agent
    -- Plugin names must match registered plugin identifiers
    plugins          TEXT[] NOT NULL DEFAULT '{}',
    
    -- Memory system configuration (composite type)
    -- Controls how the agent stores and retrieves information
    -- See types.sql for memory type definition
    memory           memory NOT NULL DEFAULT ROW(false, 5, 20)::memory,
    
    -- Retrieval-Augmented Generation configuration (composite type)
    -- Controls access to external knowledge sources
    -- See types.sql for rag type definition
    rag              rag NOT NULL DEFAULT ROW(false, NULL)::rag,
    
    -- Agent execution mode
    -- 'interactive': Waits for user input between actions
    -- 'autonomous': Operates independently based on objectives
    -- 'scheduled': Runs on predetermined schedule
    mode             VARCHAR(50) NOT NULL DEFAULT 'interactive',
    
    -- Maximum iterations per execution cycle
    -- Prevents infinite loops and controls resource usage
    -- Agent will pause after this many consecutive actions
    max_iterations   INTEGER NOT NULL DEFAULT 15,
    
    -- MCP (Model Context Protocol) server configurations
    -- JSONB allows flexible configuration storage
    -- Each key represents a server name with its connection details
    "mcpServers"     JSONB DEFAULT '{}'::jsonb,
    
    -- Binary data for agent's avatar image
    -- Stored as BYTEA for efficient binary storage
    -- Used in UI displays and agent identification
    avatar_image     BYTEA,
    
    -- MIME type of the stored avatar image
    -- Examples: 'image/jpeg', 'image/png', 'image/gif'
    -- Required for proper image rendering in clients
    avatar_mime_type VARCHAR(50)
);

-- Agent Iteration Tracking Table
-- Records each execution cycle of agents for monitoring and debugging
CREATE TABLE IF NOT EXISTS agent_iterations (
    -- Unique identifier for each iteration record
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Complete execution data stored as JSON
    -- Includes: agent_id, start_time, end_time, actions_taken,
    --          results, errors, resource_usage, etc.
    -- Flexible structure allows evolution without schema changes
    data       JSONB NOT NULL,
    
    -- Timestamp when this iteration was recorded
    -- Used for performance analysis and debugging
    -- Automatically set to current time
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Thread Management Table
-- Manages conversation threads for agent interactions
CREATE TABLE IF NOT EXISTS thread_id (
    -- Unique identifier for each thread record
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Reference to the agent that owns this thread
    -- Foreign key ensures data integrity
    agent_id   UUID NOT NULL,
    
    -- Human-readable name for the conversation thread
    -- Helps users identify different conversation contexts
    -- Default name used when not specified
    name       TEXT NOT NULL DEFAULT 'default_conversation',
    
    -- External thread identifier
    -- Used to correlate with external chat systems or APIs
    -- May reference third-party conversation IDs
    thread_id  TEXT NOT NULL,
    
    -- When this thread was created
    -- Used for thread lifecycle management
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure referential integrity with agents table
    -- CASCADE delete removes threads when agent is deleted
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Agent Management Functions
-- ============================================================================

-- Bulk Agent Deletion Function
-- Safely removes all agents and their associated data
CREATE OR REPLACE FUNCTION delete_all_agents()
RETURNS TABLE (
    -- Number of agents that were deleted
    deleted_count INTEGER,
    -- Success/failure message for user feedback
    message       TEXT
) 
LANGUAGE plpgsql
AS $$
DECLARE
    -- Variable to store count before deletion
    agent_count INTEGER;
BEGIN
    -- Count existing agents before deletion
    -- This ensures accurate reporting even if deletion fails partially
    SELECT COUNT(*) INTO agent_count FROM agents;
    
    -- Perform the deletion
    -- CASCADE constraints will automatically remove:
    -- - Related threads (thread_id table)
    -- - Related messages (message table)
    -- - Any other tables with CASCADE foreign keys
    DELETE FROM agents;
    
    -- Return results to caller
    RETURN QUERY 
    SELECT 
        agent_count AS deleted_count,
        CASE 
            WHEN agent_count > 0 THEN 
                -- Success message with count (in French as per original)
                format('%d agent(s) removed successfully', agent_count)
            ELSE 
                -- No agents to delete message
                'No agent to remove'
        END AS message;
END;
$$;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index on user_id for efficient user-based agent queries
-- Improves performance when filtering agents by owner
-- Essential for access control and user dashboard queries
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);

-- ============================================================================
-- USAGE PATTERNS
-- ============================================================================
--
-- Creating a new agent:
--   INSERT INTO agents (name, description, objectives, system_prompt)
--   VALUES ('Customer Service Bot', 'Handles customer inquiries', 
--           ARRAY['Resolve customer issues', 'Provide accurate information'],
--           'You are a helpful customer service representative...');
--
-- Updating agent memory configuration:
--   UPDATE agents SET memory = ROW(true, 10, 50)::memory WHERE name = 'MyAgent';
--
-- Enabling RAG for an agent:
--   UPDATE agents SET rag = ROW(true, 'text-embedding-ada-002')::rag 
--   WHERE id = 'agent-uuid';
--
-- Finding agents by capability:
--   SELECT * FROM agents WHERE 'customer-service' = ANY(knowledge);
--
-- ============================================================================