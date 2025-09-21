import { BaseAgent } from '../core/baseAgent.js';
import { logger, MemoryConfig } from '@snakagent/core';
import { BaseMessage } from '@langchain/core/messages';
import { CustomHuggingFaceEmbeddings } from '@snakagent/core';
import { memory, iterations } from '@snakagent/database/queries';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import {
  Runnable,
  RunnableConfig,
  RunnableSequence,
} from '@langchain/core/runnables';
import { GraphConfigurableAnnotation, GraphState } from '../graphs/graph.js';
import {
  EpisodicMemoryContext,
  Memories,
  retrieveMemoryFromContentType,
  SemanticMemoryContext,
} from '../../shared/types/index.js';
import { MemoryDBManager } from '../graphs/manager/memory/memory-db-manager.js';
import { embeddingModel } from '@agents/graphs/chain/memory/memory-chain.js';
export interface MemoryChainResult {
  memories: string;
}
/**
 * Operator agent that manages memory and knowledge
 */
export class MemoryAgent {
  private embeddings: CustomHuggingFaceEmbeddings;
  private memoryTools: any[] = [];
  private initialized: boolean = false;
  private dbManager: MemoryDBManager | null = null;

  constructor() {
    this.embeddings = embeddingModel;
  }

  /**
   * Initialize the memory agent
   */
  public async init(): Promise<void> {
    try {
      logger.debug('[MemoryAgent] Starting initialization');
      await this.initializeMemoryDB();

      // Initialize database manager with improved error handling
      this.dbManager = new MemoryDBManager(this.embeddings);

      // this.createMemoryTools();
      this.initialized = true;
      logger.debug('[MemoryAgent] Initialized successfully');
    } catch (error) {
      logger.error(`[MemoryAgent] Initialization failed: ${error}`);
      throw new Error(`MemoryAgent initialization failed: ${error}`);
    }
  }

  /**
   * Initialize the memory database with retry logic
   */
  private async initializeMemoryDB(): Promise<void> {
    const maxRetries = 3;
    let attempt = 1;

    while (attempt <= maxRetries) {
      try {
        logger.debug(
          `MemoryAgent: Memory database initialization attempt ${attempt}/${maxRetries}`
        );
        await memory.init();
        logger.debug('MemoryAgent: Memory database initialized');
        return;
      } catch (error) {
        logger.error(
          `MemoryAgent: Failed to initialize memory database (attempt ${attempt}/${maxRetries}): ${error}`
        );

        if (attempt === maxRetries) {
          throw error;
        }

        // Wait before retrying (exponential backoff)
        const waitTime = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        logger.debug(`MemoryAgent: Waiting ${waitTime}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        attempt++;
      }
    }
  }

  /**
   * Get memory tools
   */
  public getMemoryTools(): any[] {
    return [...this.memoryTools];
  }

  /**
   * Gets the embeddings instance
   */
  public getEmbeddings(): CustomHuggingFaceEmbeddings {
    return this.embeddings;
  }
}