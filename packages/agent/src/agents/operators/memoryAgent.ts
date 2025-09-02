import { BaseAgent, AgentType } from '../core/baseAgent.js';
import { AgentConfig, logger } from '@snakagent/core';
import { BaseMessage, HumanMessage } from '@langchain/core/messages';
import { CustomHuggingFaceEmbeddings } from '@snakagent/core';
import { memory, iterations } from '@snakagent/database/queries';
import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import {
  Runnable,
  RunnableConfig,
  RunnableSequence,
} from '@langchain/core/runnables';
import {
  GraphConfigurableAnnotation,
  GraphState,
  ExecutionMode,
} from '../../agents/modes/graph.js';
import { MemoryGraph } from '../../agents/modes/sub-graph/memory.js';
import {
  Agent,
  EpisodicMemoryContext,
  Memories,
  MemoryOperationResult,
  SemanticMemoryContext,
  StepToolsInfo,
} from '../../agents/modes/types/index.js';
import { MemoryDBManager } from '../modes/utils/memory-db-manager.js';
import { MemoryStateManager, LTMManager } from '../modes/utils/memory-utils.js';
import { DEFAULT_GRAPH_CONFIG } from '../modes/config/default-config.js';
import { checkAndReturnObjectFromPlansOrHistories } from '../../agents/modes/utils.js';
export interface MemoryChainResult {
  memories: string;
}

// TODO: env -> config/agents
const SIMILARITY_THRESHOLD = (() => {
  const value = parseFloat(process.env.MEMORY_SIMILARITY_THRESHOLD || '0');
  if (isNaN(value) || value < 0 || value > 1) {
    logger.warn(
      `Invalid MEMORY_SIMILARITY_THRESHOLD: ${process.env.MEMORY_SIMILARITY_THRESHOLD}, using default 0`
    );
    return 0;
  }
  return value;
})();
/**
 * Memory configuration for the agent
 */
export interface MemoryConfig {
  enabled?: boolean;
  shortTermMemorySize?: number;
  memorySize?: number;
  maxIterations?: number;
  embeddingModel?: string;
  isAutonomous?: boolean;
  maxRetries?: number;
  operationTimeoutMs?: number;
}

/**
 * Operator agent that manages memory and knowledge
 */
export class MemoryAgent extends BaseAgent {
  private config: MemoryConfig;
  private embeddings: CustomHuggingFaceEmbeddings;
  private memoryTools: any[] = [];
  private initialized: boolean = false;
  private isAutonomous: boolean;
  private agentConfig: AgentConfig;
  private dbManager: MemoryDBManager | null = null;

  constructor(config: MemoryConfig, agentConfig?: AgentConfig) {
    super('memory-agent', AgentType.OPERATOR);
    this.config = {
      shortTermMemorySize: config.shortTermMemorySize || 15,
      memorySize: config.memorySize || 20,
      maxIterations: config.maxIterations,
      embeddingModel: 'Xenova/all-MiniLM-L6-v2',
    };
    if (agentConfig) {
      this.agentConfig = agentConfig;
    }
    if (!config.isAutonomous) {
      this.isAutonomous = false;
    } else {
      this.isAutonomous = true;
    }

    this.embeddings = new CustomHuggingFaceEmbeddings({
      model: 'Xenova/all-MiniLM-L6-v2',
      dtype: 'fp32',
    });
  }

  /**
   * Initialize the memory agent
   */
  public async init(): Promise<void> {
    try {
      logger.debug('[MemoryAgent] Starting initialization');
      await this.initializeMemoryDB();

      // Initialize database manager with improved error handling
      this.dbManager = new MemoryDBManager(
        this.embeddings,
        this.config.maxRetries || 3,
        this.config.operationTimeoutMs || 5000
      );

      // this.createMemoryTools();
      this.initialized = true;
      logger.debug('[MemoryAgent] ✅ Initialized successfully');
    } catch (error) {
      logger.error(`[MemoryAgent] ❌ Initialization failed: ${error}`);
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

  public async upsertMemory(
    semantic_memories: SemanticMemoryContext[],
    episodic_memories: EpisodicMemoryContext[]
  ): Promise<string> {
    try {
      if (!this.dbManager) {
        throw new Error('[Memory Agent] dbManager is null.');
      }

      const result = await this.dbManager.upsertMemory(
        semantic_memories,
        episodic_memories
      );

      if (result.success) {
        return result.data || `Memory updated successfully`;
      } else {
        throw new Error(result.error || 'Unknown error during memory upsert');
      }
    } catch (error) {
      logger.error(`[MemoryAgent] ❌ Memory upsert failed: ${error}`);
      throw error;
    }
  }

  /**
   * Create a memory node for the graph
   */
  public createMemoryNode(): any {
    const chain = this.createMemoryChain(20);
    return async (
      state: typeof GraphState.State,
      config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
    ): Promise<{ memories: Memories; last_agent: Agent }> => {
      try {
        logger.debug('[MemoryNode] Starting memory context retrieval');
        const plan_or_history = checkAndReturnObjectFromPlansOrHistories(
          state.plans_or_histories
        );
        if (
          plan_or_history.type === 'plan' &&
          state.currentStepIndex >= plan_or_history.steps.length
        ) {
          logger.info(`[MemoryNode] Final step reach no retrieval data.`);
        } // TODO add history case
        if (!MemoryStateManager.validate(state.memories)) {
          logger.error(
            '[MemoryNode] Invalid memory state detected created initial memory-manager state'
          );
          return {
            memories: MemoryStateManager.createInitialState(
              config.configurable?.memory_size ||
                DEFAULT_GRAPH_CONFIG.memorySize
            ),
            last_agent: Agent.MEMORY_MANAGER,
          };
        }
        const result = await chain.invoke(state, config);
        logger.debug(`[MemoryNode] Retrieved  ${result.length} memory context`);

        // Update LTM context safely
        const updatedMemories = MemoryStateManager.updateLTM(
          state.memories,
          result
        );

        return {
          memories: updatedMemories,
          last_agent: Agent.MEMORY_MANAGER,
        };
      } catch (error) {
        logger.error(`[MemoryNode] ❌ Error retrieving memories: ${error}`);

        // Return safe fallback with error information
        const fallbackMemories: Memories = {
          ...state.memories,
          lastError: {
            type: 'MEMORY_RETRIEVAL_ERROR',
            message: error.message,
            timestamp: Date.now(),
          },
        };

        return {
          memories: fallbackMemories,
          last_agent: Agent.MEMORY_MANAGER,
        };
      }
    };
  }

  /**
   * Creates a LangGraph chain to fetch relevant memories using the last
   * user message. This mirrors the chain used for documents so LangSmith
   * can trace memory retrieval.
   */
  public createMemoryChain(
    limit: number
  ): Runnable<typeof GraphState.State, memory.Similarity[]> {
    const buildQuery = (
      state: typeof GraphState.State,
      config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
    ): string => {
      const agentConfig =
        config.configurable?.agent_config ?? DEFAULT_GRAPH_CONFIG.agent_config;
      if (!agentConfig) {
        throw new Error(`[MemoryAgent] AgentConfig is undefined.`);
      }
      const executionMode = config.configurable?.executionMode;
      if (executionMode === ExecutionMode.PLANNING) {
        const plan = checkAndReturnObjectFromPlansOrHistories(
          state.plans_or_histories
        );
        if (!plan || plan.type !== 'plan') {
          throw new Error(`[MemoryAgent] Plan is undefined or type history.`);
        }
        const currentStep = plan.steps[state.currentStepIndex];
        if (!currentStep) {
          return 'No current step available';
        }

        // Build a comprehensive query using all available StepInfo fields
        const queryParts: string[] = [];

        queryParts.push(`${currentStep.stepNumber}: ${currentStep.stepName}`);
        queryParts.push(`Description: ${currentStep.description}`);
        if (currentStep.tools && currentStep.tools.length > 0) {
          const toolsInfo = currentStep.tools
            .map(
              (tool: StepToolsInfo) =>
                `Tool: ${tool.description} | Required: ${tool.required} | Expected: ${tool.expected_result}`
            )
            .join(' | ');
          queryParts.push(`Tools: ${toolsInfo}`);
        }
        return queryParts.join(' | ');
      } else {
        const user_r = config.configurable?.user_request;
        if (!user_r) {
          throw new Error(`[MemoryAgent] UserQuery is undefined.`);
        }
        return user_r; //TODO improve query from history
      }
    };

    const fetchMemories = async (
      query: string,
      config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
    ): Promise<memory.Similarity[]> => {
      const runId = config?.configurable?.thread_id as string;
      const userId = 'default_user';
      const embedding = await this.embeddings.embedQuery(query);
      const memResults = await memory.similar_memory(
        userId,
        runId,
        embedding,
        limit
      );
      return memResults;
    };

    return RunnableSequence.from<typeof GraphState.State, memory.Similarity[]>([
      buildQuery,
      fetchMemories,
    ]).withConfig({
      runName: 'MemoryContextChain',
    });
  }

  /**
   * Retrieve relevant memories for a message
   * @param message The message to retrieve memories for
   * @param userId The user ID
   * @param limit Maximum number of memories to retrieve
   */
  public async retrieveRelevantMemories(
    message: string | BaseMessage,
    userId: string = 'default_user',
    runId: string,
    agentId?: string,
    limit = 4
  ): Promise<memory.Similarity[]> {
    try {
      if (!this.initialized) {
        throw new Error('MemoryAgent: Not initialized');
      }

      const query =
        typeof message === 'string' ? message : message.content.toString();

      const embedding = await this.embeddings.embedQuery(query);
      const memResults = await memory.similar_memory(
        userId,
        runId,
        embedding,
        limit
      );
      let iterResults: iterations.IterationSimilarity[] = [];
      if (agentId) {
        iterResults = await iterations.similar_iterations(
          agentId,
          embedding,
          limit
        );
      }

      return memResults;
    } catch (error) {
      logger.error(`MemoryAgent: Error retrieving relevant memories: ${error}`);
      return [];
    }
  }

  /**
   * Format memories for inclusion in a context
   * @param memories The memories to format
   */
  public formatMemoriesForContext(memories: memory.Similarity[]): string {
    if (memories.length === 0) {
      return '';
    }

    const s_memories: memory.Similarity[] = [];
    const e_memories: memory.Similarity[] = [];
    for (const memory of memories) {
      console.log(memory.memory_type);
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

  /**
   * Enrich a prompt with memory context
   */
  public async enrichPromptWithMemories(
    prompt: ChatPromptTemplate,
    message: string | BaseMessage,
    userId: string = 'default_user',
    runId: string,
    agentId?: string
  ): Promise<ChatPromptTemplate> {
    try {
      if (!this.initialized) {
        logger.warn('MemoryAgent: Not initialized for memory enrichment');
        return prompt;
      }

      const memories = await this.retrieveRelevantMemories(
        message,
        userId,
        runId
      );
      if (!memories || memories.length === 0) {
        logger.debug('MemoryAgent: No relevant memories found for enrichment');
        return prompt;
      }

      const memoryContext = this.formatMemoriesForContext(memories);
      logger.debug(
        `MemoryAgent: Found ${memories.length} relevant memories for context enrichment`
      );

      // We don't modify the original prompt, we return a new prompt with memories partial applied
      return prompt.partial({
        memories: memoryContext,
      });
    } catch (error) {
      logger.error(
        `MemoryAgent: Error enriching prompt with memories: ${error}`
      );
      return prompt;
    }
  }

  /**
   * Execute an action with the memory agent
   * @param input The input to process
   * @param config Optional configuration
   */
  public async execute(
    input: any,
    isInterrupted?: boolean,
    config?: Record<string, any>
  ): Promise<any> {
    try {
      if (!this.initialized) {
        throw new Error('MemoryAgent: Not initialized');
      }

      const content =
        typeof input === 'string'
          ? input
          : input instanceof BaseMessage
            ? input.content.toString()
            : JSON.stringify(input);

      // Determine the type of memory operation to perform
      if (
        content.includes('store') ||
        content.includes('remember') ||
        content.includes('save')
      ) {
        // return this.upsertMemory(content, config?.userId || 'default_user');
      } else if (
        content.includes('retrieve') ||
        content.includes('recall') ||
        content.includes('get')
      ) {
        return this.retrieveMemoriesForContent(
          content,
          config?.userId || 'default_user',
          config?.agentId
        );
      }

      // Default to retrieving relevant memories
      return this.retrieveMemoriesForContent(
        content,
        config?.userId || 'default_user',
        config?.agentId
      );
    } catch (error) {
      logger.error(`MemoryAgent: Execution error: ${error}`);
      throw error;
    }
  }

  // /**
  //  * Store a memory
  //  */
  // private async storeMemory(
  //   content: string,
  //   userId: string,
  //   memorySize?: number
  // ): Promise<string> {
  //   try {
  //     const embedding = await this.embeddings.embedQuery(content);
  //     const metadata = { timestamp: new Date().toISOString() };
  //     const limit = memorySize ?? this.config.memorySize;

  //     await memory.insert_memory({
  //       user_id: userId,
  //       memories_id: memories_id,
  //       query: query,
  //       content: content,
  //       embedding: embedding,
  //       metadata: metadata,
  //       history: [],
  //     });

  //     if (limit) {
  //       await memory.enforce_memory_limit(userId, limit);
  //     }
  //     return `Memory stored successfully.`;
  //   } catch (error) {
  //     logger.error(`MemoryAgent: Error storing memory: ${error}`);
  //     return `Failed to store memory: ${error}`;
  //   }
  // }

  /**
   * Retrieve memories for a content
   */
  private async retrieveMemoriesForContent(
    content: string,
    userId: string,
    runId: string,
    agentId?: string,
    limit = 4
  ): Promise<string> {
    try {
      const embedding = await this.embeddings.embedQuery(content);
      const memResults = await memory.similar_memory(
        userId,
        runId,
        embedding,
        limit
      );
      let iterResults: iterations.IterationSimilarity[] = [];
      if (agentId) {
        iterResults = await iterations.similar_iterations(
          agentId,
          embedding,
          limit
        );
      }
      return this.formatMemoriesForContext(memResults);
    } catch (error) {
      logger.error(`MemoryAgent: Error retrieving memories: ${error}`);
      return `Failed to retrieve memories: ${error}`;
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
