CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE memory AS (
    enabled BOOLEAN,
    short_term_memory_size INTEGER
);

CREATE TYPE rag AS (
    enabled BOOLEAN,
    embedding_model TEXT
);

CREATE TYPE model AS (
              provider TEXT,
              model_name TEXT,
              description TEXT
          );


CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    "group" VARCHAR(255) NOT NULL DEFAULT 'default_group',
    description TEXT NOT NULL,
    lore TEXT[] NOT NULL DEFAULT '{}',
    objectives TEXT[] NOT NULL DEFAULT '{}',
    knowledge TEXT[] NOT NULL DEFAULT '{}',
    system_prompt TEXT, -- Prompt pré-construit
    interval INTEGER NOT NULL DEFAULT 5,
    plugins TEXT[] NOT NULL DEFAULT '{}',
    memory memory NOT NULL DEFAULT ROW(false, 5)::memory,
    rag rag NOT NULL DEFAULT ROW(false, NULL)::rag,
    mode VARCHAR(50) NOT NULL DEFAULT 'interactive',
    max_iterations INTEGER NOT NULL DEFAULT 15,
    "mcpServers" JSONB DEFAULT '{}'::jsonb,
    avatar_image BYTEA, -- Binary data for the agent's avatar image
    avatar_mime_type VARCHAR(50) -- Store the MIME type of the image (e.g., 'image/jpeg', 'image/png')
);

CREATE TABLE IF NOT EXISTS agent_iterations (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

CREATE TABLE IF NOT EXISTS message (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            agent_id UUID NOT NULL,
            user_request TEXT NOT NULL,
            agent_iteration JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
        );

CREATE TABLE IF NOT EXISTS models_config (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            fast model NOT NULL,
            smart model NOT NULL,
            cheap model NOT NULL
        );
