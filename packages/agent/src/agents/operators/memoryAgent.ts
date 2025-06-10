import { BaseAgent, AgentType } from '../core/baseAgent.js';
import { logger } from '@snakagent/core';
import { BaseMessage } from '@langchain/core/messages';
import { CustomHuggingFaceEmbeddings } from '../../memory/customEmbedding.js';
import { memory } from '@snakagent/database/queries';
import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { ChatPromptTemplate } from '@langchain/core/prompts';

// TODO: env -> config/agents
const SIMILARITY_THRESHOLD = parseFloat(
  process.env.MEMORY_SIMILARITY_THRESHOLD || '0.75'
);
/**
 * Memory configuration for the agent
 */
export interface MemoryConfig {
  enabled?: boolean;
  shortTermMemorySize?: number;
  maxIterations?: number;
  embeddingModel?: string;
}

/**
 * Operator agent that manages memory and knowledge
 */
export class MemoryAgent extends BaseAgent {
  private config: MemoryConfig;
  private embeddings: CustomHuggingFaceEmbeddings;
  private memoryTools: any[] = [];
  private initialized: boolean = false;

  constructor(config: MemoryConfig) {
    super('memory-agent', AgentType.OPERATOR);
    this.config = {
      shortTermMemorySize: config.shortTermMemorySize || 15,
      maxIterations: config.maxIterations,
      embeddingModel: config.embeddingModel || 'Xenova/all-MiniLM-L6-v2',
    };

    this.embeddings = new CustomHuggingFaceEmbeddings({
      model: this.config.embeddingModel,
      dtype: 'fp32',
    });
  }

  /**
   * Initialize the memory agent
   */
  public async init(): Promise<void> {
    try {
      logger.debug('MemoryAgent: Starting initialization');
      await this.initializeMemoryDB();
      this.createMemoryTools();
      this.initialized = true;
      logger.debug('MemoryAgent: Initialized successfully');
    } catch (error) {
      logger.error(`MemoryAgent: Initialization failed: ${error}`);
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
   * Create memory tools
   */
  private createMemoryTools(): void {
    // Tool for creating or updating a memory
    const upsertMemoryTool = tool(
      async ({
        content,
        memoryId,
        userId = 'default_user',
      }): Promise<string> => {
        try {
          const embedding = await this.embeddings.embedQuery(content);
          const metadata = { timestamp: new Date().toISOString() };
          content = content.replace(/'/g, "''"); // Escape apostrophes for SQL

          logger.debug(`MemoryAgent: Upserting memory for user ${userId}`);

          if (memoryId) {
            logger.debug(`MemoryAgent: Updating memory ID ${memoryId}`);
            await memory.update_memory(memoryId, content, embedding);
            return `Memory ${memoryId} updated successfully.`;
          }

          await memory.insert_memory({
            user_id: userId,
            content,
            embedding,
            metadata,
            history: [],
          });

          return `Memory stored successfully.`;
        } catch (error) {
          logger.error(`MemoryAgent: Error storing memory: ${error}`);
          return `Failed to store memory: ${error}`;
        }
      },
      {
        name: 'upsert_memory',
        schema: z.object({
          content: z.string().describe('The content of the memory to store.'),
          memoryId: z
            .number()
            .optional()
            .nullable()
            .describe('Memory ID when wanting to update an existing memory.'),
          userId: z
            .string()
            .optional()
            .describe('The user ID to associate with this memory.'),
        }),
        description: `
        CREATE, UPDATE or DELETE persistent MEMORIES to persist across conversations.
        Include the MEMORY ID when updating or deleting a MEMORY. Omit when creating a new MEMORY.
        Proactively call this tool when you:
        1. Identify a new user preference.
        2. Receive an explicit user request to remember something.
        3. Are working and want to record important context.
        4. Identify that an existing MEMORY is incorrect or outdated.
        `,
      }
    );

    // Tool for retrieving similar memories
    const retrieveMemoriesTool = tool(
      async ({ query, userId = 'default_user' }): Promise<string> => {
        try {
          const embedding = await this.embeddings.embedQuery(query);
          const similar = await memory.similar_memory(userId, embedding);
          const filtered = similar.filter(
            (s) => s.similarity >= SIMILARITY_THRESHOLD
          );

          if (filtered.length === 0) {
            return 'No relevant memories found.';
          }

          const memories = filtered
            .map((similarity) => {
              return `Memory [id: ${similarity.id}, similarity: ${similarity.similarity.toFixed(4)}]: ${similarity.content}`;
            })
            .join('\n\n');

          return `Retrieved ${filtered.length} memories:\n\n${memories}`;
        } catch (error) {
          logger.error(`MemoryAgent: Error retrieving memories: ${error}`);
          return `Failed to retrieve memories: ${error}`;
        }
      },
      {
        name: 'retrieve_memories',
        schema: z.object({
          query: z.string().describe('The query to find similar memories for.'),
          userId: z
            .string()
            .optional()
            .describe('The user ID to retrieve memories for.'),
          limit: z
            .number()
            .optional()
            .describe('Maximum number of memories to retrieve.'),
        }),
        description: `
        Retrieve memories that are semantically similar to a query.
        Use this tool to recall information about user preferences, past interactions, or stored knowledge.
        `,
      }
    );

    this.memoryTools = [upsertMemoryTool, retrieveMemoriesTool];
    logger.debug(
      `MemoryAgent: Created ${this.memoryTools.length} memory tools`
    );
  }

  /**
   * Prepare memory tools for the interactive agent
   */
  public prepareMemoryTools(): any[] {
    if (!this.initialized) {
      logger.warn(
        'MemoryAgent: Trying to get memory tools before initialization'
      );
      this.createMemoryTools();
    }

    // Create the upsert memory tool for the interactive agent
    const upsertMemoryToolDB = tool(
      async (
        { content, memoryId },
        config: LangGraphRunnableConfig
      ): Promise<string> => {
        try {
          const userId = config.configurable?.userId || 'default_user';
          const embedding = await this.embeddings.embedQuery(content);
          const metadata = { timestamp: new Date().toISOString() };
          content = content.replace(/'/g, "''");

          if (memoryId) {
            logger.debug('memoryId detected : ' + memoryId);
            await memory.update_memory(memoryId, content, embedding);
          }

          memory.insert_memory({
            user_id: userId,
            content,
            embedding,
            metadata,
            history: [],
          });

          return 'Memory stored successfully.';
        } catch (error) {
          logger.error('Error storing memory:', error);
          return 'Failed to store memory.';
        }
      },
      {
        name: 'upsert_memory',
        schema: z.object({
          content: z.string().describe('The content of the memory to store.'),
          memoryId: z
            .number()
            .optional()
            .nullable()
            .describe('Memory ID when wanting to update an existing memory.'),
        }),
        description: `
        CREATE, UPDATE or DELETE persistent MEMORIES to persist across conversations.
        In your system prompt, you have access to the MEMORIES relevant to the user's
        query, each having their own MEMORY ID. Include the MEMORY ID when updating
        or deleting a MEMORY. Omit when creating a new MEMORY - it will be created for
        you. Proactively call this tool when you:
        1. Identify a new USER preference.
        2. Receive an explicit USER request to remember something or otherwise alter your behavior.
        3. Are working and want to record important context.
        4. Identify that an existing MEMORY is incorrect or outdated.
        `,
      }
    );

    return [upsertMemoryToolDB];
  }

  /**
   * Create a memory node for the graph
   */
  public createMemoryNode(): any {
    return async (state: any, config: LangGraphRunnableConfig) => {
      try {
        const userId = config.configurable?.userId || 'default_user';
        const lastMessage = state.messages[state.messages.length - 1]
          .content as string;
        const embedding = await this.embeddings.embedQuery(lastMessage);
        const similar = await memory.similar_memory(userId, embedding);
        const filtered = similar.filter(
          (s) => s.similarity >= SIMILARITY_THRESHOLD
        );
        const memoryContext = this.formatMemoriesForContext(filtered);

        return { memories: memoryContext };
      } catch (error) {
        logger.error('Error retrieving memories:', error);
        return { memories: '' };
      }
    };
  }

  /**
   * Retrieve relevant memories for a message
   * @param message The message to retrieve memories for
   * @param userId The user ID
   * @param limit Maximum number of memories to retrieve
   */
  public async retrieveRelevantMemories(
    message: string | BaseMessage,
    userId: string = 'default_user'
  ): Promise<any[]> {
    try {
      if (!this.initialized) {
        throw new Error('MemoryAgent: Not initialized');
      }

      const query =
        typeof message === 'string' ? message : message.content.toString();

      const embedding = await this.embeddings.embedQuery(query);
      const memories = await memory.similar_memory(userId, embedding);

      return memories.filter((m) => m.similarity >= SIMILARITY_THRESHOLD);
    } catch (error) {
      logger.error(`MemoryAgent: Error retrieving relevant memories: ${error}`);
      return [];
    }
  }

  /**
   * Format memories for inclusion in a context
   * @param memories The memories to format
   */
  public formatMemoriesForContext(memories: any[]): string {
    if (memories.length === 0) {
      return '';
    }

    const formattedMemories = memories
      .map((mem) => {
        const lastHist = Array.isArray(mem.history) && mem.history.length > 0
          ? mem.history[mem.history.length - 1]
          : null;
        const ts = lastHist?.timestamp || 'unknown';
        return `Memory [id: ${mem.id}, relevance: ${mem.similarity.toFixed(4)}, last_updated: ${ts}]: ${mem.content}`;
      })
      .join('\n\n');

    return (
      '### User Memory Context (reference only - always verify dynamic info using tools) ###\n' +
      formattedMemories +
      '\n\n'
    );
  }

  /**
   * Enrich a prompt with memory context
   */
  public async enrichPromptWithMemories(
    prompt: ChatPromptTemplate,
    message: string | BaseMessage,
    userId: string = 'default_user'
  ): Promise<ChatPromptTemplate> {
    try {
      if (!this.initialized) {
        logger.warn('MemoryAgent: Not initialized for memory enrichment');
        return prompt;
      }

      const memories = await this.retrieveRelevantMemories(message, userId);
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
  public async execute(input: any, config?: Record<string, any>): Promise<any> {
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
        return this.storeMemory(content, config?.userId || 'default_user');
      } else if (
        content.includes('retrieve') ||
        content.includes('recall') ||
        content.includes('get')
      ) {
        return this.retrieveMemoriesForContent(
          content,
          config?.userId || 'default_user'
        );
      }

      // Default to retrieving relevant memories
      return this.retrieveMemoriesForContent(
        content,
        config?.userId || 'default_user'
      );
    } catch (error) {
      logger.error(`MemoryAgent: Execution error: ${error}`);
      throw error;
    }
  }

  /**
   * Store a memory
   */
  private async storeMemory(content: string, userId: string): Promise<string> {
    try {
      const embedding = await this.embeddings.embedQuery(content);
      const metadata = { timestamp: new Date().toISOString() };
      content = content.replace(/'/g, "''");

      await memory.insert_memory({
        user_id: userId,
        content,
        embedding,
        metadata,
        history: [],
      });

      return `Memory stored successfully.`;
    } catch (error) {
      logger.error(`MemoryAgent: Error storing memory: ${error}`);
      return `Failed to store memory: ${error}`;
    }
  }

  /**
   * Retrieve memories for a content
   */
  private async retrieveMemoriesForContent(
    content: string,
    userId: string
  ): Promise<string> {
    try {
      const embedding = await this.embeddings.embedQuery(content);
      const memories = await memory.similar_memory(userId, embedding);
      const filtered = memories.filter(
        (m) => m.similarity >= SIMILARITY_THRESHOLD
      );
      if (filtered.length === 0) {
        return 'No relevant memories found.';
      }

      return this.formatMemoriesForContext(filtered);
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
