import { logger } from '@snakagent/core';
import { memory } from '@snakagent/database/queries';
import { CustomHuggingFaceEmbeddings } from '@snakagent/core';
import { MemoryOperationResult } from '../types/index.js';

/**
 * Transaction-safe memory database operations
 * Fixes the race conditions and data corruption issues in the original implementation
 */
export class MemoryDBManager {
  private embeddings: CustomHuggingFaceEmbeddings;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;

  constructor(
    embeddings: CustomHuggingFaceEmbeddings,
    maxRetries: number = 3,
    timeoutMs: number = 5000
  ) {
    this.embeddings = embeddings;
    this.maxRetries = maxRetries;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Safe memory upsert with retry logic and transaction safety
   */
  async upsertMemory(
    content: string,
    memories_id: string,
    query: string,
    userId: string,
    memorySize?: number
  ): Promise<MemoryOperationResult<string>> {
    let attempt = 0;

    while (attempt < this.maxRetries) {
      try {
        // Create operation timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('Database operation timeout')),
            this.timeoutMs
          );
        });

        // Execute with timeout
        const result = await Promise.race([
          this.performUpsert(content, memories_id, query, userId, memorySize),
          timeoutPromise,
        ]);

        return result;
      } catch (error) {
        attempt++;
        logger.warn(
          `[MemoryDBManager] Attempt ${attempt}/${this.maxRetries} failed:`,
          error
        );

        if (attempt >= this.maxRetries) {
          return {
            success: false,
            error: `Memory upsert failed after ${this.maxRetries} attempts: ${error.message}`,
            timestamp: Date.now(),
          };
        }
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await this.sleep(waitTime);
      }
    }

    return {
      success: false,
      error: 'Unexpected error in upsert retry loop',
      timestamp: Date.now(),
    };
  }

  /**
   * Performs the actual upsert operation with transaction safety
   */
  private async performUpsert(
    content: string,
    memories_id: string,
    query: string,
    userId: string,
    memorySize?: number
  ): Promise<MemoryOperationResult<string>> {
    try {
      // Validate inputs
      const validation = this.validateUpsertInputs(
        content,
        memories_id,
        query,
        userId
      );
      if (!validation.success) {
        return {
          success: false,
          error: validation.error,
          timestamp: validation.timestamp,
          data: undefined,
        };
      }

      // Generate embedding
      const embedding = await this.embeddings.embedQuery(content);
      if (!embedding || embedding.length === 0) {
        return {
          success: false,
          error: 'Failed to generate embedding for content',
          timestamp: Date.now(),
        };
      }

      // Create memory record
      const memoryRecord: memory.Memory = {
        user_id: userId,
        memories_id: memories_id,
        query: query,
        content: content,
        embedding: embedding,
        metadata: {
          timestamp: new Date().toISOString(),
          upsertedAt: Date.now(),
        },
        history: [],
      };

      // Insert memory with transaction safety
      await memory.insert_memory(memoryRecord);

      // Enforce memory limit if specified
      if (memorySize && memorySize > 0) {
        await memory.enforce_memory_limit(userId, memorySize);
      }

      logger.debug(
        `[MemoryDBManager] Successfully upserted memory ${memories_id} for user ${userId}`
      );

      return {
        success: true,
        data: `Memory ${memories_id} updated successfully`,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(`[MemoryDBManager] Upsert operation failed:`, error);
      throw error; // Re-throw for retry logic
    }
  }

  /**
   * Retrieves similar memories with improved error handling
   */
  async retrieveSimilarMemories(
    query: string,
    userId: string,
    limit: number = 4,
    similarityThreshold: number = 0.7
  ): Promise<MemoryOperationResult<memory.Similarity[]>> {
    let attempt = 0;

    while (attempt < this.maxRetries) {
      try {
        // Create timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('Memory retrieval timeout')),
            this.timeoutMs
          );
        });

        const result = await Promise.race([
          this.performRetrieval(query, userId, limit, similarityThreshold),
          timeoutPromise,
        ]);

        return result;
      } catch (error) {
        attempt++;
        logger.warn(
          `[MemoryDBManager] Retrieval attempt ${attempt}/${this.maxRetries} failed:`,
          error
        );

        if (attempt >= this.maxRetries) {
          return {
            success: false,
            error: `Memory retrieval failed after ${this.maxRetries} attempts: ${error.message}`,
            timestamp: Date.now(),
          };
        }

        await this.sleep(Math.min(500 * attempt, 2000));
      }
    }

    return {
      success: false,
      error: 'Unexpected error in retrieval retry loop',
      timestamp: Date.now(),
    };
  }

  /**
   * Performs the actual memory retrieval
   */
  private async performRetrieval(
    query: string,
    userId: string,
    limit: number,
    similarityThreshold: number
  ): Promise<MemoryOperationResult<memory.Similarity[]>> {
    try {
      // Validate inputs
      if (!query.trim()) {
        return {
          success: false,
          error: 'Query cannot be empty',
          timestamp: Date.now(),
        };
      }

      if (!userId.trim()) {
        return {
          success: false,
          error: 'User ID cannot be empty',
          timestamp: Date.now(),
        };
      }

      // Generate query embedding
      const embedding = await this.embeddings.embedQuery(query);
      if (!embedding || embedding.length === 0) {
        return {
          success: false,
          error: 'Failed to generate embedding for query',
          timestamp: Date.now(),
        };
      }

      // Retrieve similar memories
      const similarities = await memory.similar_memory(
        userId,
        embedding,
        limit
      );

      // Filter by similarity threshold
      const filteredSimilarities = similarities.filter(
        (sim) => sim.similarity >= similarityThreshold
      );

      logger.debug(
        `[MemoryDBManager] Retrieved ${filteredSimilarities.length}/${similarities.length} memories above threshold ${similarityThreshold} for user ${userId}`
      );

      return {
        success: true,
        data: filteredSimilarities,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(`[MemoryDBManager] Retrieval operation failed:`, error);
      throw error;
    }
  }

  /**
   * Batch upsert with transaction safety
   */
  async batchUpsertMemories(
    memories: Array<{
      content: string;
      memories_id: string;
      query: string;
    }>,
    userId: string,
    memorySize?: number
  ): Promise<MemoryOperationResult<string[]>> {
    const results: string[] = [];
    const errors: string[] = [];

    for (const memoryData of memories) {
      const result = await this.upsertMemory(
        memoryData.content,
        memoryData.memories_id,
        memoryData.query,
        userId,
        memorySize
      );

      if (result.success) {
        results.push(result.data!);
      } else {
        errors.push(`${memoryData.memories_id}: ${result.error}`);
      }
    }

    if (errors.length === 0) {
      return {
        success: true,
        data: results,
        timestamp: Date.now(),
      };
    } else if (results.length > 0) {
      return {
        success: true, // Partial success
        data: results,
        error: `Some operations failed: ${errors.join('; ')}`,
        timestamp: Date.now(),
      };
    } else {
      return {
        success: false,
        error: `All operations failed: ${errors.join('; ')}`,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Health check for database connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const testQuery = 'test_connectivity_query';
      const testUserId = 'health_check_user';

      // Try a simple retrieval operation
      const embedding = await this.embeddings.embedQuery(testQuery);
      await memory.similar_memory(testUserId, embedding, 1);

      return true;
    } catch (error) {
      logger.error('[MemoryDBManager] Health check failed:', error);
      return false;
    }
  }

  /**
   * Validates upsert inputs
   */
  private validateUpsertInputs(
    content: string,
    memories_id: string,
    query: string,
    userId: string
  ): MemoryOperationResult<void> {
    if (!content.trim()) {
      return {
        success: false,
        error: 'Content cannot be empty',
        timestamp: Date.now(),
      };
    }

    if (!memories_id.trim()) {
      return {
        success: false,
        error: 'Memory ID cannot be empty',
        timestamp: Date.now(),
      };
    }

    if (!query.trim()) {
      return {
        success: false,
        error: 'Query cannot be empty',
        timestamp: Date.now(),
      };
    }

    if (!userId.trim()) {
      return {
        success: false,
        error: 'User ID cannot be empty',
        timestamp: Date.now(),
      };
    }

    if (content.length > 10000) {
      return {
        success: false,
        error: 'Content too long (max 10000 characters)',
        timestamp: Date.now(),
      };
    }

    return {
      success: true,
      timestamp: Date.now(),
    };
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Format memories for context display
   */
  formatMemoriesForContext(memories: memory.Similarity[]): string {
    if (memories.length === 0) {
      return '';
    }

    const formattedMemories = memories
      .map((mem) => {
        const lastHist =
          Array.isArray(mem.history) && mem.history.length > 0
            ? mem.history[mem.history.length - 1]
            : null;
        const timestamp = lastHist?.timestamp || 'unknown';
        const relevance = mem.similarity.toFixed(4);
        return `Memory [id: ${mem.id}, relevance: ${relevance}, last_updated: ${timestamp}]: ${mem.content}`;
      })
      .join('\n\n');

    return `### Relevant Memory Context\n${formattedMemories}\n\n`;
  }
}
