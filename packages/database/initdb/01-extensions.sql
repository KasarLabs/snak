-- ============================================================================
-- DATABASE EXTENSIONS
-- ============================================================================
-- This file contains all PostgreSQL extensions required for the Snak Agent system
-- Extensions provide additional functionality beyond the core PostgreSQL features
-- ============================================================================

-- UUID Extension
-- Provides UUID generation functions for unique identifiers
-- Used throughout the system for primary keys and foreign key relationships
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Vector Extension (pgvector)
-- Enables vector data types and similarity operations for AI embeddings
-- Essential for semantic search and memory similarity calculations
-- Supports operations like cosine distance, dot product, and L2 distance
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- EXTENSION USAGE NOTES
-- ============================================================================
-- 
-- uuid-ossp functions used in this system:
--   - uuid_generate_v4(): Generates random UUIDs for primary keys
--
-- vector extension features used:
--   - vector(384): 384-dimensional embedding vectors
--   - Cosine similarity operator (<=>): For memory similarity calculations
--   - IVFFlat indexes: For efficient approximate nearest neighbor search
--
-- ============================================================================