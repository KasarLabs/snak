# SQL Database Documentation

## Overview

This document provides a comprehensive overview of the database schema for the Snak Agent system, consisting of two main initialization files that establish the core database structure and memory management capabilities.

## Database Files Structure

### 1. Main Database Schema (`01-init.sql`)
- **Purpose**: Core application database schema
- **Primary Focus**: Agent management, message handling, and configuration
- **File Size**: 228 lines

### 2. Memory Management Schema (`memory-init.sql`) 
- **Purpose**: AI agent memory system implementation
- **Primary Focus**: Episodic and semantic memory storage with vector embeddings
- **File Size**: 318 lines

---

## 01-init.sql - Core Database Schema

### Extensions
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
```
- **uuid-ossp**: Enables UUID generation functions
- **vector**: Provides vector data type support for AI embeddings

### Custom Types

#### Memory Type
```sql
CREATE TYPE memory AS (
    enabled                 BOOLEAN,
    short_term_memory_size  INTEGER,
    memory_size             INTEGER
);
```
- Composite type for agent memory configuration
- Controls memory enablement and sizing parameters

#### RAG Type  
```sql
CREATE TYPE rag AS (
    enabled         BOOLEAN,
    embedding_model TEXT
);
```
- Composite type for Retrieval-Augmented Generation configuration
- Manages RAG feature toggles and model selection

#### Model Type
```sql
CREATE TYPE model AS (
    provider    TEXT,
    model_name  TEXT,
    description TEXT
);
```
- Composite type for AI model configuration
- Standardizes model provider and naming conventions

### Core Tables

#### Agents Table
- **Primary Key**: `id` (UUID)
- **Purpose**: Central agent registry and configuration
- **Key Fields**:
  - `name`: Agent identifier
  - `group`: Organizational grouping (default: 'default_group')
  - `description`, `lore`, `objectives`, `knowledge`: Agent personality and capabilities
  - `system_prompt`: AI system instructions
  - `interval`: Processing interval in seconds
  - `plugins`: Array of enabled plugin names
  - `memory`: Memory configuration (composite type)
  - `rag`: RAG configuration (composite type)
  - `mode`: Agent execution mode ('interactive' default)
  - `max_iterations`: Processing limit (15 default)
  - `mcpServers`: MCP server configuration (JSONB)
  - `avatar_image`, `avatar_mime_type`: Agent visual representation

#### Agent Iterations Table
- **Purpose**: Tracking agent processing cycles
- **Key Fields**:
  - `data`: JSONB storage for iteration details
  - `created_at`: Timestamp tracking

#### Thread ID Table
- **Purpose**: Managing conversation threads
- **Key Fields**:
  - `agent_id`: Foreign key to agents table
  - `name`: Thread identifier
  - `thread_id`: External thread reference
- **Constraints**: CASCADE delete with agents

#### Message Table
- **Purpose**: Comprehensive message logging and tracking
- **Key Fields**:
  - `agent_id`: Links to agents table
  - `event`: Message event type
  - `run_id`: Execution run identifier
  - `thread_id`: Conversation thread reference  
  - `checkpoint_id`: State checkpoint reference
  - `from`: Message sender (quoted - SQL reserved word)
  - `content`: Message text content
  - `tools`: JSONB tool usage data
  - `plan`: JSONB planning data
  - `metadata`: JSONB flexible metadata storage
  - `timestamp`: Message creation time
- **Constraints**: CASCADE delete with agents

#### Models Config Table
- **Purpose**: AI model configuration management
- **Key Fields**:
  - `fast`, `smart`, `cheap`: Model configurations using custom model type
- **Usage**: Defines model tiers for different processing needs

### Functions

#### get_messages_optimized()
```sql
get_messages_optimized(
    p_agent_id UUID,
    p_thread_id TEXT,
    p_user_id UUID,
    p_order_desc BOOLEAN DEFAULT FALSE,
    p_limit INTEGER DEFAULT NULL,
    p_offset INTEGER DEFAULT 0
)
```
- **Purpose**: Efficient message retrieval with flexible ordering and pagination
- **Features**: 
  - Ascending/descending order support
  - Configurable limits and offsets
  - Optimized for thread-based message queries

#### delete_all_agents()
```sql
delete_all_agents() RETURNS TABLE (deleted_count INTEGER, message TEXT)
```
- **Purpose**: Bulk agent removal with reporting
- **Safety**: Returns deletion count and status message
- **Behavior**: Triggers CASCADE deletions for related data

### Performance Optimization

#### Standard Indexes
```sql
CREATE INDEX idx_message_agent_id ON message(agent_id);
CREATE INDEX idx_message_run_id ON message(run_id);
CREATE INDEX idx_message_thread_id ON message(thread_id);
CREATE INDEX idx_message_checkpoint_id ON message(checkpoint_id);
CREATE INDEX idx_message_timestamp ON message("timestamp");
```

#### Composite Index
```sql
CREATE INDEX idx_message_agent_thread_timestamp 
ON message(agent_id, thread_id, "timestamp");
```
- **Purpose**: Optimizes the primary query pattern in get_messages_optimized()

#### JSONB Indexes
```sql
CREATE INDEX idx_message_metadata ON message USING GIN (metadata);
CREATE INDEX idx_message_tools ON message USING GIN (tools);
CREATE INDEX idx_message_plan ON message USING GIN (plan);
```
- **Type**: GIN (Generalized Inverted Index)
- **Purpose**: Efficient querying of JSONB columns

---

## memory-init.sql - Memory Management Schema

### Core Tables

#### Episodic Memories Table
```sql
CREATE TABLE IF NOT EXISTS episodic_memories (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    run_id UUID NOT NULL,
    content TEXT NOT NULL,
    embedding vector(384) NOT NULL,
    sources TEXT[] DEFAULT '{}',
    access_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    confidence FLOAT DEFAULT 1.0,
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days')
);
```
- **Purpose**: Stores specific events and experiences
- **Key Features**:
  - Vector embeddings (384 dimensions)
  - Automatic expiration (30 days default)
  - Access tracking and confidence scoring
  - Source attribution support

#### Semantic Memories Table
```sql
CREATE TABLE IF NOT EXISTS semantic_memories (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    run_id UUID NOT NULL,
    fact TEXT NOT NULL,
    embedding vector(384) NOT NULL,
    confidence FLOAT DEFAULT 0.5,
    access_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    category VARCHAR(50),  -- 'preference', 'fact', 'skill', 'relationship'
    source_events INTEGER[] DEFAULT '{}'
);
```
- **Purpose**: Stores factual knowledge and learned information
- **Key Features**:
  - Categorization support (preference, fact, skill, relationship)
  - Source event tracking via integer array
  - Confidence-based knowledge management
  - No automatic expiration (persistent knowledge)

### Vector Search Optimization

#### Vector Indexes
```sql
-- Episodic memories vector index
CREATE INDEX episodic_embedding_idx ON episodic_memories 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Semantic memories vector index  
CREATE INDEX semantic_embedding_idx ON semantic_memories 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```
- **Type**: IVFFlat (Inverted File with Flat Compression)
- **Distance**: Cosine similarity
- **Configuration**: 100 lists for balanced performance/accuracy

#### Supporting Indexes
```sql
-- Time-based episodic retrieval
CREATE INDEX episodic_time_idx ON episodic_memories(user_id, created_at DESC);

-- Category-based semantic retrieval
CREATE INDEX semantic_category_idx ON semantic_memories(user_id, category);
```

### Memory Management Functions

#### upsert_semantic_memory_smart()
```sql
upsert_semantic_memory_smart(
    p_user_id VARCHAR(100),
    p_run_id UUID,
    p_fact TEXT,
    p_embedding vector(384),
    p_category VARCHAR(50) DEFAULT NULL,
    p_source_events INTEGER[] DEFAULT '{}',
    p_similarity_threshold FLOAT DEFAULT 0.85
)
```
- **Purpose**: Intelligent semantic memory storage with duplicate detection
- **Features**:
  - Similarity-based duplicate detection (0.85 threshold)
  - Automatic confidence boosting for similar memories
  - Source event aggregation
  - Update vs. insert logic based on similarity
- **Security**: SECURITY DEFINER with explicit search_path
- **Returns**: Operation type, similarity score, and matched content

#### insert_episodic_memory_smart()
```sql
insert_episodic_memory_smart(
    p_user_id VARCHAR(100),
    p_run_id UUID,
    p_content TEXT,
    p_embedding vector(384),
    p_sources TEXT[] DEFAULT '{}',
    p_confidence FLOAT DEFAULT 1.0,
    p_similarity_threshold FLOAT DEFAULT 0.95
)
```
- **Purpose**: Smart episodic memory insertion with high similarity filtering
- **Features**:
  - High similarity threshold (0.95) prevents near-duplicates
  - Confidence boosting for similar memories
  - Access count tracking
  - Skip duplicate detection and reporting
- **Returns**: Operation result and similar memory information

#### retrieve_similar_memories()
```sql
retrieve_similar_memories(
    p_user_id VARCHAR(100),
    p_run_id UUID,
    p_embedding vector(384),
    p_threshold FLOAT DEFAULT 0.35,
    p_limit INTEGER DEFAULT 10
)
```
- **Purpose**: Unified similar memory retrieval across both memory types
- **Features**:
  - Combined episodic and semantic memory search
  - Configurable similarity threshold (0.35 default)
  - Rich metadata return including confidence, access counts, categories
  - Expiration filtering for episodic memories
  - Similarity-based result ordering
- **Performance**: STABLE function designation for query optimization

#### flatten_array()
```sql
flatten_array(anyarray) RETURNS anyarray
```
- **Purpose**: Utility function for array deduplication
- **Type**: Polymorphic (works with any array type)
- **Designation**: IMMUTABLE for maximum optimization

### Memory System Architecture

#### Data Flow
1. **Input Processing**: New memories processed through smart insertion functions
2. **Similarity Analysis**: Vector similarity calculated using cosine distance
3. **Deduplication**: Similar memories merged or skipped based on thresholds
4. **Retrieval**: Combined search across both memory types with relevance scoring
5. **Maintenance**: Automatic expiration for episodic memories, confidence updates

#### Performance Considerations
- **Vector Operations**: Optimized through IVFFlat indexes
- **Query Patterns**: Indexes designed for user_id + similarity searches
- **Memory Management**: Automatic cleanup through episodic expiration
- **Scalability**: Configurable similarity thresholds for precision/recall tuning

---

## Database Design Patterns

### 1. **Composite Types**
- Used for structured configuration data (memory, rag, model types)
- Provides type safety and schema consistency
- Enables atomic updates of related configuration parameters

### 2. **JSONB Storage**
- Flexible metadata storage without schema constraints
- GIN indexes for efficient querying
- Used for tools, plans, and configuration data

### 3. **Vector Similarity Search**
- 384-dimensional embeddings for semantic similarity
- Cosine distance for relevance calculation
- IVFFlat indexes for scalable approximate search

### 4. **Security Patterns**
- SECURITY DEFINER functions with explicit search_path
- Input validation and null checking
- Comprehensive error handling with proper SQLSTATE codes

### 5. **Performance Optimization**
- Strategic indexing for common query patterns
- Composite indexes for multi-column searches
- Function stability declarations (STABLE, IMMUTABLE)
- ANALYZE commands for statistics updates

## Maintenance Recommendations

### 1. **Regular Maintenance**
- Run ANALYZE on memory tables after bulk operations
- Monitor vector index performance and rebuild if needed
- Review episodic memory expiration patterns

### 2. **Monitoring**
- Track similarity threshold effectiveness
- Monitor memory table growth rates
- Analyze query performance on message retrieval

### 3. **Scaling Considerations**
- Adjust IVFFlat list counts based on data volume
- Consider partitioning strategies for large message tables
- Implement archiving for expired episodic memories

This documentation serves as a comprehensive reference for understanding, maintaining, and extending the Snak Agent database system.