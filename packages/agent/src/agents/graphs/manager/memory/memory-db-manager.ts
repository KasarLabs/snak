import {
  logger,
  MemoryConfig,
  MemorySizeLimits,
  MemoryTimeouts,
  MemoryThresholds,
  CustomHuggingFaceEmbeddings,
} from '@snakagent/core';
import { memory } from '@snakagent/database/queries';

import {
  EpisodicMemoryContext,
  MemoryOperationResult,
  SemanticMemoryContext,
} from '../../../../shared/types/memory.types.js';

export const embeddingModel = new CustomHuggingFaceEmbeddings({
  model: 'Xenova/all-MiniLM-L6-v2',
  dtype: 'fp32',
});

/**
 * Transaction-safe memory database operations
 * Fixes the race conditions and data corruption issues in the original implementation
 */
export class MemoryDBManager {
  private embeddings: CustomHuggingFaceEmbeddings;
  private readonly max_retries: number = 3; // Make configurable later
  private readonly memoryTimeouts: MemoryTimeouts;
  private readonly memorySizeLimit: MemorySizeLimits;
  private readonly memoryThreshold: MemoryThresholds;
  constructor(memoryConfig: MemoryConfig) {
    this.embeddings = embeddingModel;
    this.memoryTimeouts = memoryConfig.timeouts;
    this.memorySizeLimit = memoryConfig.size_limits;
    this.memoryThreshold = memoryConfig.thresholds;
  }

  /**
   * Safe memory upsert with retry logic and transaction safety
   */
  async upsertMemory(
    semantic_memories: SemanticMemoryContext[],
    episodic_memories: EpisodicMemoryContext[]
  ): Promise<MemoryOperationResult<string>> {
    try {
      // Create operation timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Database operation timeout')),
          this.memoryTimeouts.insert_memory_timeout_ms
        );
      });

      // Execute with timeout
      const result = await Promise.race([
        this.performUpsert(semantic_memories, episodic_memories),
        timeoutPromise,
      ]);

      return result;
    } catch (error) {
      logger.error(`[MemoryDBManager] Upsert attempt failed:`, error);
      return {
        success: false,
        error: 'Unexpected error in upsert retry loop',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Performs the actual upsert operation with transaction safety
   */
  private async performUpsert(
    semantic_memories: SemanticMemoryContext[],
    episodic_memories: EpisodicMemoryContext[]
  ): Promise<MemoryOperationResult<string>> {
    try {
      // Validate inputs
      const episodic_validation =
        this.validateEpisodicUpsertInputs(episodic_memories);
      const semantic_validation =
        this.validateSemanticUpsertInputs(semantic_memories);
      if (!episodic_validation.success || !semantic_validation) {
        return {
          success: false,
          error: episodic_validation.error || semantic_validation.error,
          timestamp:
            episodic_validation.timestamp || semantic_validation.timestamp,
          data: undefined,
        };
      }
      const event_ids: Array<number> = [];

      for (const e_memory of episodic_memories) {
        const embedding = await this.embeddings.embedQuery(e_memory.content);
        if (!embedding || embedding.length === 0) {
          return {
            success: false,
            error: 'Failed to generate embedding for content',
            timestamp: Date.now(),
          };
        }

        const episodicRecord: memory.EpisodicMemory = {
          user_id: e_memory.user_id,
          run_id: e_memory.run_id,
          task_id: e_memory.task_id,
          step_id: e_memory.step_id,
          content: e_memory.content,
          embedding: embedding,
          sources: e_memory.sources,
        };

        const result = await memory.insert_episodic_memory(episodicRecord);
        event_ids.push(result.memory_id);
        logger.debug(
          `[MemoryDBManager] Successfully ${result.operation} memory_id : ${result.memory_id} for user : ${e_memory.user_id}`
        );
      }

      for (const s_memory of semantic_memories) {
        const embedding = await this.embeddings.embedQuery(s_memory.fact);
        if (!embedding || embedding.length === 0) {
          return {
            success: false,
            error: 'Failed to generate embedding for fact',
            timestamp: Date.now(),
          };
        }

        const semanticRecord: memory.SemanticMemory = {
          user_id: s_memory.user_id,
          run_id: s_memory.run_id,
          task_id: s_memory.task_id,
          step_id: s_memory.step_id,
          fact: s_memory.fact,
          embedding: embedding,
          category: s_memory.category,
          source_events: event_ids,
        };
        const result = await memory.insert_semantic_memory(semanticRecord);
        logger.debug(
          `[MemoryDBManager] Successfully ${result.operation} memory_id : ${result.memory_id} for user : ${s_memory.user_id}`
        );
      }

      return {
        success: true,
        data: `Memory updated successfully`,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(`[MemoryDBManager] Upsert operation failed:`, error);
      throw error;
    }
  }

  /**
   * Retrieves similar memories with improved error handling
   */
  async retrieveSimilarMemories(
    query: string,
    userId: string,
    runId: string
  ): Promise<MemoryOperationResult<memory.Similarity[]>> {
    let attempt = 0;
    while (attempt < this.max_retries) {
      try {
        // Create timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('Memory retrieval timeout')),
            this.memoryTimeouts.retrieve_memory_timeout_ms
          );
        });

        const result = await Promise.race([
          this.performRetrieval(query, userId, runId),
          timeoutPromise,
        ]);

        return result;
      } catch (error) {
        attempt++;
        logger.warn(
          `[MemoryDBManager] Retrieval attempt ${attempt}/${this.max_retries} failed:`,
          error
        );

        if (attempt >= this.max_retries) {
          return {
            success: false,
            error: `Memory retrieval failed after ${this.max_retries} attempts: ${error.message}`,
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
    runId: string
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
      const similarities = await memory.retrieve_memory(
        userId,
        runId,
        embedding,
        this.memorySizeLimit.max_retrieve_memory_size,
        this.memoryThreshold.retrieve_memory_threshold
      );

      logger.debug(
        `[MemoryDBManager] Retrieved ${similarities.length} similar memories for user: ${userId}`
      );
      return {
        success: true,
        data: similarities,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(`[MemoryDBManager] Retrieval operation failed:`, error);
      throw error;
    }
  }
  /**
   * Validates upsert inputs
   */
  private validateEpisodicUpsertInputs(
    episodic_memories: EpisodicMemoryContext[]
  ): MemoryOperationResult<void> {
    for (const memory of episodic_memories) {
      if (!memory.content.trim()) {
        return {
          success: false,
          error: 'Content cannot be empty',
          timestamp: Date.now(),
        };
      }

      if (memory.content.length > 10000) {
        return {
          success: false,
          error: 'Content too long (max 10000 characters)',
          timestamp: Date.now(),
        };
      }

      if (!memory.user_id.trim()) {
        return {
          success: false,
          error: 'User ID cannot be empty',
          timestamp: Date.now(),
        };
      }

      if (!memory.run_id.trim()) {
        return {
          success: false,
          error: 'User ID cannot be empty',
          timestamp: Date.now(),
        };
      }

      if (memory.sources.length <= 0) {
        return {
          success: false,
          error: 'Sources Array cannot be empty',
          timestamp: Date.now(),
        };
      }
    }

    return {
      success: true,
      timestamp: Date.now(),
    };
  }

  private validateSemanticUpsertInputs(
    semantic_memories: SemanticMemoryContext[]
  ): MemoryOperationResult<void> {
    for (const memory of semantic_memories) {
      if (!memory.fact.trim()) {
        return {
          success: false,
          error: 'Content cannot be empty',
          timestamp: Date.now(),
        };
      }

      if (memory.fact.length > 10000) {
        return {
          success: false,
          error: 'Content too long (max 10000 characters)',
          timestamp: Date.now(),
        };
      }

      if (!memory.user_id.trim()) {
        return {
          success: false,
          error: 'User ID cannot be empty',
          timestamp: Date.now(),
        };
      }

      if (!memory.run_id.trim()) {
        return {
          success: false,
          error: 'User ID cannot be empty',
          timestamp: Date.now(),
        };
      }

      if (!memory.category.trim()) {
        return {
          success: false,
          error: 'Sources Array cannot be empty',
          timestamp: Date.now(),
        };
      }
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
  /**
   * Format memories for inclusion in a context
   * @param memories The memories to format
   */
  formatMemoriesForContext(memories: memory.Similarity[]): string {
    if (memories.length === 0) {
      return '';
    }

    const s_memories: memory.Similarity[] = [];
    const e_memories: memory.Similarity[] = [];
    for (const memory of memories) {
      if (memory.memory_type === 'semantic') {
        s_memories.push(memory);
      } else if (memory.memory_type === 'episodic') {
        e_memories.push(memory);
      }
    }

    const formattedEpisodicMemories = e_memories
      .map((mem) => {
        return `Episodic Memory [id: ${mem.memory_id}, relevance: ${mem.similarity.toFixed(4)}, confidence ${mem.metadata.confidence}, last_updated: ${mem.metadata.updated_at}]: ${mem.content}`;
      })
      .join('\n\n');
    const formattedSemanticMemories = s_memories
      .map((mem) => {
        return `Semantic Memory [id: ${mem.memory_id}, relevance: ${mem.similarity.toFixed(4)}, category: ${mem.metadata.category}, confidence ${mem.metadata.confidence}, last_updated: ${mem.metadata.updated_at}]: ${mem.content}`;
      })
      .join('\n\n');

    return formattedEpisodicMemories.concat(formattedSemanticMemories);
  }
}
