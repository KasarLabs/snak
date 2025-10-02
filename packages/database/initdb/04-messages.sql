-- ============================================================================
-- MESSAGE SYSTEM
-- ============================================================================
-- This file contains tables and functions for managing agent messages
-- Messages track all communications, actions, and state changes in the system
-- Provides comprehensive logging and replay capabilities
-- ============================================================================

-- Primary Message Storage Table
-- Records all agent interactions, communications, and state transitions
CREATE TABLE IF NOT EXISTS message (
    -- UUID primary key for message identification
    -- uuid_generate_v4() provides globally unique identifiers
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Reference to the agent that generated this message
    -- Links message to its originating agent for filtering and analysis
    agent_id UUID NOT NULL,

    -- User who owns or initiated the agent
    -- Ensures messages are associated with the correct user context
    user_id UUID NOT NULL,
    
    -- Core Message Event Fields
    -- These fields define the message structure and context
    
    -- Type of event being recorded
    -- Examples: 'user_input', 'agent_response', 'tool_call', 'state_change'
    -- Used for filtering and processing different message types
    event TEXT NOT NULL,
    
    -- Unique identifier for the execution run
    -- Groups related messages within a single agent execution cycle
    -- Useful for debugging and tracing agent behavior
    run_id TEXT NOT NULL,
    
    -- Conversation thread identifier
    -- Groups messages within a single conversation context
    -- Allows multiple simultaneous conversations per agent
    thread_id TEXT NOT NULL,
    
    -- State checkpoint identifier
    -- Marks specific points in conversation for state management
    -- Used for conversation resumption and rollback capabilities
    checkpoint_id TEXT NOT NULL,

    -- Task identifier for grouping related execution steps
    -- Links messages to specific tasks in agent workflow
    -- Enables task-level filtering and analysis
    -- UUID type for consistency with other identifiers
    task_id UUID,

    -- Step identifier within the execution flow
    -- Tracks individual steps in multi-step agent operations
    -- Useful for debugging and analyzing agent decision-making process
    -- UUID type for consistency with other identifiers
    step_id UUID,

    -- Message sender identification
    -- Quoted because 'from' is a PostgreSQL reserved word
    -- Values: 'user', 'agent', 'system', 'tool', etc.
    "from" TEXT NOT NULL,
        
    -- Optional Message Content
    -- Not all messages require text content (e.g., state changes)
    
    -- Primary text content of the message
    -- User input, agent responses, tool outputs, etc.
    -- NULL for non-text events like state transitions
    message TEXT,
    
    -- Complex Data Fields (JSONB for Performance)
    -- PostgreSQL documentation Section 8.14: "most applications should prefer jsonb"
    -- JSONB provides efficient storage, indexing, and querying of structured data
    
    -- Tool usage information stored as JSON
    -- Includes: tool_name, parameters, execution_time, results
    -- NULL when message doesn't involve tool usage
    tools JSONB,
    
    
    -- Flexible metadata storage for extensibility
    -- Any additional context, debugging info, or custom data
    -- Never NULL - defaults to empty JSON object
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    
    -- Timestamp Fields
    -- All timestamps use TIMESTAMP WITH TIME ZONE for proper timezone handling
    
    -- When the actual event occurred
    -- May differ from created_at for delayed processing
    -- Used for accurate chronological ordering
    "timestamp" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- When this record was inserted into the database
    -- Used for database maintenance and audit trails
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Referential Integrity
    -- Foreign key constraint ensures data consistency
    -- CASCADE delete removes messages when agent is deleted (per Section 5.5.5)
    -- "CASCADE specifies that when a referenced row is deleted, 
    --  row(s) referencing it should be automatically deleted as well"
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Message Retrieval Functions
-- ============================================================================

-- Simple Message Retrieval by Agent ID
-- Provides efficient message querying with optional limit
-- If limit is NULL, returns all messages for the agent
CREATE OR REPLACE FUNCTION get_messages_by_agent(
    -- Required: Which agent's messages to retrieve
    p_agent_id UUID,
    -- Optional: Maximum number of messages to return
    -- NULL means no limit (returns all matching messages)
    p_limit INTEGER DEFAULT NULL
)
-- Return Type: Table with all message fields including ID
RETURNS TABLE (
    id UUID,
    agent_id UUID,
    user_id UUID,
    event TEXT,
    run_id TEXT,
    thread_id TEXT,
    checkpoint_id TEXT,
    task_id UUID,
    step_id UUID,
    "from" TEXT,
    message TEXT,
    tools JSONB,
    metadata JSONB,
    "timestamp" TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Returns messages ordered by timestamp descending (newest first)
    -- If p_limit is NULL, COALESCE converts it to max INT value (all messages)
    RETURN QUERY
    SELECT
        m.id,
        m.agent_id,
        m.user_id,
        m.event,
        m.run_id,
        m.thread_id,
        m.checkpoint_id,
        m.task_id,
        m.step_id,
        m."from",
        m.message,
        m.tools,
        m.metadata,
        m."timestamp",
        m.created_at
    FROM message m
    WHERE m.agent_id = p_agent_id
    ORDER BY m."timestamp" DESC
    LIMIT COALESCE(p_limit, 2147483647);  -- Max INT when p_limit is NULL
END;
$$;

-- Optimized Message Retrieval Function
-- Provides efficient, flexible message querying with pagination and ordering
CREATE OR REPLACE FUNCTION get_messages_optimized(
    -- Required: Which agent's messages to retrieve
    p_agent_id UUID,
    
    -- Required: Which conversation thread to query
    p_thread_id TEXT,
    
    -- Required: User ID for access control verification
    -- Ensures user can only access messages from their own agents
    p_user_id UUID,
    
    -- Optional: Sort order (false = ascending, true = descending)
    -- Default ascending provides chronological conversation flow
    p_order_desc BOOLEAN DEFAULT FALSE,
    
    -- Optional: Maximum number of messages to return
    -- NULL means no limit (returns all matching messages)
    p_limit INTEGER DEFAULT NULL,
    
    -- Optional: Number of messages to skip
    -- Used for pagination in combination with p_limit
    p_offset INTEGER DEFAULT 0
)
-- Return Type: Table with all essential message fields
-- Excludes internal fields like 'id' and 'created_at' for cleaner API
RETURNS TABLE (
    agent_id UUID,
    user_id UUID,
    event TEXT,
    run_id TEXT,
    thread_id TEXT,
    checkpoint_id TEXT,
    task_id UUID,
    step_id UUID,
    "from" TEXT,
    message TEXT,
    tools JSONB,
    metadata JSONB,
    "timestamp" TIMESTAMP WITH TIME ZONE
    )
LANGUAGE plpgsql
AS $$
BEGIN
    -- Conditional execution based on requested sort order
    -- Separate queries optimize PostgreSQL's query planner performance
    
    IF p_order_desc THEN
        -- Descending order: Most recent messages first
        -- Useful for displaying latest conversation activity
        RETURN QUERY
        SELECT
            m.agent_id,
            a.user_id,
            m.event,
            m.run_id,
            m.thread_id,
            m.checkpoint_id,
            m.task_id,
            m.step_id,
            m."from",
            m.message,
            m.tools,
            m.metadata,
            m."timestamp"
        FROM message m
        INNER JOIN agents a ON m.agent_id = a.id
        WHERE m.agent_id = p_agent_id
          AND m.thread_id = p_thread_id
          AND a.user_id = p_user_id
        ORDER BY m."timestamp" DESC
        LIMIT COALESCE(p_limit, 2147483647)  -- Max INT when p_limit is NULL
        OFFSET p_offset;
    ELSE
        -- Ascending order: Chronological conversation flow
        -- Standard for displaying conversation history
        RETURN QUERY
        SELECT
            m.agent_id,
            a.user_id,
            m.event,
            m.run_id,
            m.thread_id,
            m.checkpoint_id,
            m.task_id,
            m.step_id,
            m."from",
            m.message,
            m.tools,
            m.metadata,
            m."timestamp"
        FROM message m
        INNER JOIN agents a ON m.agent_id = a.id
        WHERE m.agent_id = p_agent_id
          AND m.thread_id = p_thread_id
          AND a.user_id = p_user_id
        ORDER BY m."timestamp" ASC
        LIMIT COALESCE(p_limit, 2147483647)
        OFFSET p_offset;
    END IF;
END;
$$;

-- Message Table Performance Indexes
-- ============================================================================
-- These indexes support the primary access patterns and foreign key relationships
-- All indexes are created with IF NOT EXISTS to prevent conflicts

-- Agent-based message filtering index
-- Used for: Retrieving all messages for a specific agent
-- Query pattern: WHERE agent_id = ?
-- PostgreSQL Section 5.5.5: "it is often a good idea to index the referencing columns too"
CREATE INDEX IF NOT EXISTS idx_message_agent_id ON message(agent_id);

-- Run-based message grouping index
-- Used for: Grouping messages within a specific execution run
-- Query pattern: WHERE run_id = ?
-- Essential for debugging and tracing agent execution flows
CREATE INDEX IF NOT EXISTS idx_message_run_id ON message(run_id);

-- Thread-based conversation retrieval index
-- Used for: Retrieving all messages within a conversation thread
-- Query pattern: WHERE thread_id = ?
-- Critical for conversation history display
CREATE INDEX IF NOT EXISTS idx_message_thread_id ON message(thread_id);

-- Checkpoint-based state management index
-- Used for: State restoration and rollback operations
-- Query pattern: WHERE checkpoint_id = ?
-- Supports conversation state management features
CREATE INDEX IF NOT EXISTS idx_message_checkpoint_id ON message(checkpoint_id);

-- Task-based execution grouping index
-- Used for: Retrieving all messages for a specific task
-- Query pattern: WHERE task_id = ?
-- Enables task-level message filtering and analysis
CREATE INDEX IF NOT EXISTS idx_message_task_id ON message(task_id);

-- Step-based execution tracking index
-- Used for: Retrieving messages for specific execution steps
-- Query pattern: WHERE step_id = ?
-- Supports step-by-step debugging and analysis
CREATE INDEX IF NOT EXISTS idx_message_step_id ON message(step_id);

-- Temporal ordering index
-- Used for: Chronological message sorting and time-based queries
-- Query pattern: ORDER BY timestamp [ASC|DESC]
-- Essential for get_messages_optimized() function performance
CREATE INDEX IF NOT EXISTS idx_message_timestamp ON message("timestamp");

-- Composite index for optimized message retrieval
-- Used for: Primary query pattern in get_messages_optimized() function
-- Query pattern: WHERE agent_id = ? AND thread_id = ? ORDER BY timestamp
-- This composite index eliminates the need for separate sorts
-- Order: agent_id, thread_id, timestamp matches the function's WHERE clause and ORDER BY
CREATE INDEX IF NOT EXISTS idx_message_agent_thread_timestamp 
ON message(agent_id, thread_id, "timestamp");

-- JSONB Indexes for Complex Data Queries
-- ============================================================================
-- GIN (Generalized Inverted Index) indexes for efficient JSONB operations
-- PostgreSQL Section 8.14: "jsonb supports indexing"

-- Metadata search index
-- Used for: Searching within message metadata JSON
-- Query patterns: metadata @> '{"key": "value"}', metadata ? 'key'
-- Enables flexible metadata-based filtering and search
CREATE INDEX IF NOT EXISTS idx_message_metadata ON message USING GIN (metadata);

-- Tools usage analysis index  
-- Used for: Analyzing tool usage patterns and debugging tool calls
-- Query patterns: tools @> '{"tool": "name"}', tools ? 'tool'
-- Supports tool performance monitoring and usage analytics
CREATE INDEX IF NOT EXISTS idx_message_tools ON message USING GIN (tools);


-- ============================================================================
-- USAGE PATTERNS
-- ============================================================================
--
-- Recording a user message:
--   INSERT INTO message (agent_id, user_id, event, run_id, thread_id, checkpoint_id, "from", message)
--   VALUES ('agent-uuid', 'user-uuid', 'user_input', 'run-123', 'thread-456', 'checkpoint-789',
--           'user', 'Hello, can you help me?');
--
-- Recording an agent response with tool usage:
--   INSERT INTO message (agent_id, user_id, event, run_id, thread_id, checkpoint_id, "from",
--                       message, tools, metadata)
--   VALUES ('agent-uuid', 'user-uuid', 'agent_response', 'run-123', 'thread-456', 'checkpoint-790',
--           'agent', 'I can help! Let me search for information.',
--           '{"tool": "web_search", "query": "user question"}',
--           '{"confidence": 0.9, "processing_time_ms": 150}');
--
-- Retrieving conversation history:
--   SELECT * FROM get_messages_optimized('agent-uuid', 'thread-456', 'user-uuid', false, 50, 0);
--
-- Getting recent messages:
--   SELECT * FROM get_messages_optimized('agent-uuid', 'thread-456', 'user-uuid', true, 10, 0);
--
-- High-Performance Query Patterns (using indexes):
--
-- 1. Message retrieval (uses idx_message_agent_thread_timestamp):
--    SELECT * FROM message 
--    WHERE agent_id = $1 AND thread_id = $2 
--    ORDER BY timestamp ASC;
--
-- 2. JSONB metadata search (uses idx_message_metadata):
--    SELECT * FROM message 
--    WHERE metadata @> '{"type": "error"}'::jsonb;
--
-- 3. Tool usage analysis (uses idx_message_tools):
--    SELECT * FROM message 
--    WHERE tools @> '{"tool": "web_search"}'::jsonb;
--
-- ============================================================================