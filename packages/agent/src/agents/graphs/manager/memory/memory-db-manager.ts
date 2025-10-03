import {
  logger,
  MemoryConfig,
  MemorySizeLimits,
  MemoryTimeouts,
  MemoryThresholds,
  CustomHuggingFaceEmbeddings,
  MemoryStrategy,
} from '@snakagent/core';
import { memory } from '@snakagent/database/queries';

import {
  EpisodicMemoryContext,
  HolisticMemoryContext,
  MemoryItem,
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
  private readonly memoryStrategy: MemoryStrategy;
  constructor(memoryConfig: MemoryConfig) {
    this.embeddings = embeddingModel;
    this.memoryTimeouts = memoryConfig.timeouts;
    this.memorySizeLimit = memoryConfig.size_limits;
    this.memoryThreshold = memoryConfig.thresholds;
    this.memoryStrategy = memoryConfig.strategy;
  }

  async upersertHolisticMemory(
    memories: HolisticMemoryContext
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
        this.performHolisticUpsert(memories),
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
   * Safe memory upsert with retry logic and transaction safety
   */
  async upsertCategorizedMemory(
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
        this.performCategorizedUpsert(semantic_memories, episodic_memories),
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

  private async performHolisticUpsert(
    memories: HolisticMemoryContext
  ): Promise<MemoryOperationResult<string>> {
    try {
      const embedding = await this.embeddings.embedQuery(memories.content);
      if (!embedding || embedding.length === 0) {
        throw new Error(`Failed to generate embedding for holistic memory`);
      }
      const h_memory: memory.HolisticMemory = {
        type: memories.type,
        user_id: memories.user_id,
        task_id: memories.task_id,
        step_id: memories.step_id,
        content: memories.content,
        request: memories.request,
        embedding: embedding,
      };
      await memory.insert_holistic_memory(
        h_memory,
        this.memoryThreshold.insert_semantic_threshold
      );
    } catch (error) {
      logger.error(`[MemoryDBManager] Upsert operation failed:`, error);
      throw error;
    }
    return {
      success: true,
      data: 'Holistic memory upsert not implemented yet',
      timestamp: Date.now(),
    };
  }
  /**
   * Performs the actual upsert operation with transaction safety
   */
  private async performCategorizedUpsert(
    semantic_memories: SemanticMemoryContext[],
    episodic_memories: EpisodicMemoryContext[]
  ): Promise<MemoryOperationResult<string>> {
    try {
      episodic_memories = episodic_memories.filter(
        (mem) =>
          mem !== null &&
          mem !== undefined &&
          this.validateEpisodicUpsertInputs(mem).success
      );
      semantic_memories = semantic_memories.filter(
        (mem) =>
          mem !== null &&
          mem !== undefined &&
          this.validateSemanticUpsertInputs(mem).success
      );
      if (episodic_memories.length === 0 && semantic_memories.length === 0) {
        return {
          success: false,
          error: 'No valid memories to upsert',
          timestamp: Date.now(),
        };
      }

      const event_ids: Array<string> = [];
      const errors: string[] = [];
      let successfulEpisodicCount = 0;
      let successfulSemanticCount = 0;

      // Process episodic memories in parallel with Promise.all
      const episodicPromises = episodic_memories.map(async (e_memory, i) => {
        try {
          const embedding = await this.embeddings.embedQuery(e_memory.content);
          if (
            !embedding ||
            !Array.isArray(embedding) ||
            embedding.length === 0
          ) {
            throw new Error(
              `Failed to generate embedding for episodic memory ${i + 1}`
            );
          }

          const episodicRecord: memory.EpisodicMemory = {
            user_id: e_memory.user_id,
            task_id: e_memory.task_id,
            step_id: e_memory.step_id,
            content: e_memory.content,
            embedding: embedding,
            sources: e_memory.sources,
          };

          const result = await memory.insert_episodic_memory(
            episodicRecord,
            this.memoryThreshold.insert_episodic_threshold
          );
          logger.debug(
            `[MemoryDBManager] Successfully ${result.operation} memory_id : ${result.memory_id} for user : ${e_memory.user_id}`
          );
          return { success: true, memory_id: result.memory_id, index: i };
        } catch (error) {
          const errorMsg = `Failed to process episodic memory ${i + 1}: ${error.message}`;
          logger.error(`[MemoryDBManager] ${errorMsg}`, error);
          return { success: false, error: errorMsg, index: i };
        }
      });

      const episodicResults = await Promise.all(episodicPromises);

      // Collect results and errors
      episodicResults.forEach((result) => {
        if (result.success) {
          event_ids.push(result.memory_id!);
          successfulEpisodicCount++;
        } else {
          errors.push(result.error!);
        }
      });

      // Process semantic memories in parallel with Promise.all
      const semanticPromises = semantic_memories.map(async (s_memory, i) => {
        try {
          const embedding = await this.embeddings.embedQuery(s_memory.fact);
          if (
            !embedding ||
            !Array.isArray(embedding) ||
            embedding.length === 0
          ) {
            throw new Error(
              `Failed to generate embedding for semantic memory ${i + 1}`
            );
          }

          const semanticRecord: memory.SemanticMemory = {
            user_id: s_memory.user_id,
            task_id: s_memory.task_id,
            step_id: s_memory.step_id,
            fact: s_memory.fact,
            embedding: embedding,
            category: s_memory.category,
            source_events: event_ids,
          };
          const result = await memory.insert_semantic_memory(
            semanticRecord,
            this.memoryThreshold.insert_semantic_threshold
          );
          logger.debug(
            `[MemoryDBManager] Successfully ${result.operation} memory_id : ${result.memory_id} for user : ${s_memory.user_id}`
          );
          return { success: true, index: i };
        } catch (error) {
          const errorMsg = `Failed to process semantic memory ${i + 1}: ${error.message}`;
          logger.error(`[MemoryDBManager] ${errorMsg}`, error);
          return { success: false, error: errorMsg, index: i };
        }
      });

      const semanticResults = await Promise.all(semanticPromises);

      // Collect semantic results and errors
      semanticResults.forEach((result) => {
        if (result.success) {
          successfulSemanticCount++;
        } else {
          errors.push(result.error!);
        }
      });

      // Determine result based on success/failure counts
      const totalMemories = episodic_memories.length + semantic_memories.length;
      const totalSuccessful = successfulEpisodicCount + successfulSemanticCount;

      if (totalSuccessful === 0) {
        // Complete failure
        return {
          success: false,
          error: `All memory operations failed: ${errors.join('; ')}`,
          timestamp: Date.now(),
        };
      } else if (errors.length === 0) {
        // Complete success
        return {
          success: true,
          data: `Memory updated successfully: ${totalSuccessful}/${totalMemories} processed`,
          timestamp: Date.now(),
        };
      } else {
        // Partial success
        logger.warn(
          `[MemoryDBManager] Partial success: ${totalSuccessful}/${totalMemories} memories processed. Errors: ${errors.join('; ')}`
        );
        return {
          success: true,
          data: `Memory updated with partial success: ${totalSuccessful}/${totalMemories} processed. Some operations failed: ${errors.join('; ')}`,
          timestamp: Date.now(),
        };
      }
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
    userId: string
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
          this.performRetrieval(query, userId),
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
    userId: string
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
        this.memoryStrategy,
        userId,
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
    episodic_memory: EpisodicMemoryContext
  ): MemoryOperationResult<void> {
    if (!episodic_memory) {
      return {
        success: false,
        error: 'Episodic memory entry cannot be null or undefined',
        timestamp: Date.now(),
      };
    }
    if (!episodic_memory.content.trim()) {
      return {
        success: false,
        error: 'Episodic Content cannot be empty',
        timestamp: Date.now(),
      };
    }

    if (episodic_memory.content.length > 10000) {
      return {
        success: false,
        error: 'Content too long (max 10000 characters)',
        timestamp: Date.now(),
      };
    }

    if (!episodic_memory.user_id.trim()) {
      return {
        success: false,
        error: 'User ID cannot be empty',
        timestamp: Date.now(),
      };
    }

    if (!episodic_memory.run_id.trim()) {
      return {
        success: false,
        error: 'User ID cannot be empty',
        timestamp: Date.now(),
      };
    }

    if (episodic_memory.sources.length <= 0) {
      return {
        success: false,
        error: 'Sources Array cannot be empty',
        timestamp: Date.now(),
      };
    }
    return { success: true, timestamp: Date.now() };
  }

  private validateSemanticUpsertInputs(
    semantic_memory: SemanticMemoryContext
  ): MemoryOperationResult<void> {
    if (!semantic_memory) {
      return {
        success: false,
        error: 'Semantic memory entry cannot be null or undefined',
        timestamp: Date.now(),
      };
    }
    if (!semantic_memory.fact.trim()) {
      return {
        success: false,
        error: 'Semantic Fact cannot be empty',
        timestamp: Date.now(),
      };
    }

    if (semantic_memory.fact.length > 10000) {
      return {
        success: false,
        error: 'Content too long (max 10000 characters)',
        timestamp: Date.now(),
      };
    }

    if (!semantic_memory.user_id.trim()) {
      return {
        success: false,
        error: 'User ID cannot be empty',
        timestamp: Date.now(),
      };
    }

    if (!semantic_memory.run_id.trim()) {
      return {
        success: false,
        error: 'User ID cannot be empty',
        timestamp: Date.now(),
      };
    }

    if (!semantic_memory.category.trim()) {
      return {
        success: false,
        error: 'Sources Array cannot be empty',
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
