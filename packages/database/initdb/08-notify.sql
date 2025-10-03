DROP TABLE IF EXISTS notify;

CREATE TABLE notify (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    agent_id UUID,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notify_user_id ON notify(user_id);
CREATE INDEX idx_notify_agent_id ON notify(agent_id);
CREATE INDEX idx_notify_read ON notify("read");
CREATE INDEX idx_notify_created_at ON notify(created_at);


-- ============================================================================
-- Notify Table
-- Tracks notifications for users related to agents and tasks
-- - Foreign key relationships to ensure data integrity
-- - Indexes for efficient querying based on user, agent, read status, and creation time
-- - Temporal tracking with timezone support
-- - Default values for read status and timestamps
-- - Primary key with auto-generated UUID
-- - Message field to store notification content
-- - User and agent references for context 
-- - Read status to track if notification has been seen
-- - Created_at timestamp for when the notification was generated
-- - CASCADE deletion to remove notifications when user or agent is deleted
-- - Performance indexes for common query patterns
-- ============================================================================