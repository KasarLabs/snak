import { logger, CustomHuggingFaceEmbeddings } from '@snakagent/core';
import { BaseMessage, HumanMessage } from '@langchain/core/messages';
import { memory, iterations } from '@snakagent/database/queries';
import { z } from 'zod';
import { tool, Tool } from '@langchain/core/tools';
import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import {
  RunnableSequence,
  Runnable,
  RunnableLambda,
} from '@langchain/core/runnables';
import { MemoryConfig } from '../memoryAgent.js';

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

export interface MemoryNodeState {
  messages: BaseMessage[];
}

export interface UpsertMemoryInput {
  content: string;
  memoryId?: number | null;
  userId?: string;
}

export interface RetrieveMemoriesInput {
  query: string;
  userId?: string;
  limit?: number;
}

export interface ExecutionConfig {
  userId?: string;
  agentId?: string;
}

export class MemoryAgentService {
  private config: MemoryConfig;
  private embeddings: CustomHuggingFaceEmbeddings;
  private memoryTools: Tool[] = [];
  private initialized = false;

  constructor(config: MemoryConfig) {
    this.config = {
      shortTermMemorySize: config.shortTermMemorySize || 15,
      memorySize: config.memorySize || 20,
      maxIterations: config.maxIterations,
      embeddingModel: config.embeddingModel || 'Xenova/all-MiniLM-L6-v2',
    };

    this.embeddings = new CustomHuggingFaceEmbeddings({
      model: this.config.embeddingModel,
      dtype: 'fp32',
    });
  }

  public async init(): Promise<void> {
    try {
      logger.debug('MemoryAgentService: Starting initialization');
      await this.initializeMemoryDB();
      this.createMemoryTools();
      this.initialized = true;
      logger.debug('MemoryAgentService: Initialized successfully');
    } catch (error) {
      logger.error(`MemoryAgentService: Initialization failed: ${error}`);
      throw new Error(`MemoryAgentService initialization failed: ${error}`);
    }
  }

  private async initializeMemoryDB(): Promise<void> {
    const maxRetries = 3;
    let attempt = 1;

    while (attempt <= maxRetries) {
      try {
        logger.debug(
          `MemoryAgentService: Memory database initialization attempt ${attempt}/${maxRetries}`
        );
        await memory.init();
        logger.debug('MemoryAgentService: Memory database initialized');
        return;
      } catch (error) {
        logger.error(
          `MemoryAgentService: Failed to initialize memory database (attempt ${attempt}/${maxRetries}): ${error}`
        );

        if (attempt === maxRetries) {
          throw error;
        }

        const waitTime = Math.pow(2, attempt - 1) * 1000;
        logger.debug(
          `MemoryAgentService: Waiting ${waitTime}ms before retry...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        attempt++;
      }
    }
  }

  private async upsertMemory(
    content: string,
    memoryId: number | null | undefined,
    userId: string
  ): Promise<string> {
    logger.debug(`MemoryAgentService: Upserting memory for user ${userId}`);
    const embedding = await this.embeddings.embedQuery(content);
    const metadata = { timestamp: new Date().toISOString() };

    if (memoryId) {
      logger.debug(`MemoryAgentService: Updating memory ID ${memoryId}`);
      await memory.update_memory(memoryId, content, embedding);
      return `Memory ${memoryId} updated successfully.`;
    } else {
      await memory.insert_memory({
        user_id: userId,
        content,
        embedding,
        metadata,
        history: [],
      });
    }

    if (this.config.memorySize) {
      await memory.enforce_memory_limit(userId, this.config.memorySize);
    }

    return memoryId
      ? `Memory ${memoryId} updated successfully.`
      : `Memory stored successfully.`;
  }

  private createMemoryTools(): void {
    const upsertMemoryTool = tool(
      async ({
        content,
        memoryId,
        userId = 'default_user',
      }): Promise<string> => {
        try {
          return await this.upsertMemory(content, memoryId, userId);
        } catch (error) {
          logger.error(`MemoryAgentService: Error storing memory: ${error}`);
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

    const retrieveMemoriesTool = tool(
      async ({
        query,
        userId = 'default_user',
        limit = 4,
      }): Promise<string> => {
        try {
          const embedding = await this.embeddings.embedQuery(query);
          const similar = await memory.similar_memory(userId, embedding, limit);
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
          logger.error(
            `MemoryAgentService: Error retrieving memories: ${error}`
          );
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
            .default(4)
            .describe('Maximum number of memories to retrieve.'),
        }),
        description: `
        Retrieve memories that are semantically similar to a query.
        Use this tool to recall information about user preferences, past interactions, or stored knowledge.
        `,
      }
    );

    this.memoryTools = [upsertMemoryTool as any, retrieveMemoriesTool as any];
    logger.debug(
      `MemoryAgentService: Created ${this.memoryTools.length} memory tools`
    );
  }

  public prepareMemoryTools(): Tool[] {
    if (!this.initialized) {
      logger.warn(
        'MemoryAgentService: Trying to get memory tools before initialization'
      );
      this.createMemoryTools();
    }

    const upsertMemoryToolDB = tool(
      async (
        { content, memoryId },
        config: LangGraphRunnableConfig
      ): Promise<string> => {
        try {
          const { userId = 'default_user' } = (config.configurable ??
            {}) as ExecutionConfig;
          return await this.upsertMemory(content, memoryId, userId);
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

    return [upsertMemoryToolDB as any];
  }

  public createMemoryNode(): Runnable<MemoryNodeState, { memories: string }> {
    const chain = this.createMemoryChain();
    return new RunnableLambda({
      func: async (state: MemoryNodeState, config: LangGraphRunnableConfig) => {
        try {
          return await chain.invoke(state, config);
        } catch (error) {
          logger.error('Error retrieving memories:', error);
          return { memories: '' };
        }
      },
    });
  }

  public createMemoryChain(
    limit = 4
  ): Runnable<MemoryNodeState, { memories: string }> {
    const buildQuery = (state: MemoryNodeState) => {
      const lastUser = [...state.messages]
        .reverse()
        .find((msg: BaseMessage) => msg instanceof HumanMessage);
      return lastUser
        ? typeof lastUser.content === 'string'
          ? lastUser.content
          : JSON.stringify(lastUser.content)
        : (state.messages[0]?.content as string);
    };

    const fetchMemories = async (
      query: string,
      config: LangGraphRunnableConfig
    ) => {
      const { userId = 'default_user', agentId } = (config.configurable ??
        {}) as ExecutionConfig;
      const embedding = await this.embeddings.embedQuery(query);
      const memResults = await memory.similar_memory(userId, embedding, limit);
      let iterResults: iterations.IterationSimilarity[] = [];
      if (agentId) {
        iterResults = await iterations.similar_iterations(
          agentId,
          embedding,
          limit
        );
      }

      const formattedIter = iterResults.map((it) => ({
        id: it.id,
        content: `Question: ${it.question}\nAnswer: ${it.answer}`,
        history: [],
        similarity: it.similarity,
      }));

      const filtered = [...memResults, ...formattedIter].filter(
        (s) => s.similarity >= SIMILARITY_THRESHOLD
      );
      const combined = filtered
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      return this.formatMemoriesForContext(combined);
    };

    return RunnableSequence.from([
      buildQuery,
      fetchMemories,
      (context: string) => ({ memories: context }),
    ]).withConfig({ runName: 'MemoryContextChain' });
  }

  public async retrieveRelevantMemories(
    message: string | BaseMessage,
    userId: string = 'default_user',
    agentId?: string,
    limit = 4
  ): Promise<memory.Similarity[]> {
    try {
      if (!this.initialized) {
        throw new Error('MemoryAgentService: Not initialized');
      }

      const query =
        typeof message === 'string' ? message : message.content.toString();

      const embedding = await this.embeddings.embedQuery(query);
      const memResults = await memory.similar_memory(userId, embedding, limit);
      let iterResults: iterations.IterationSimilarity[] = [];
      if (agentId) {
        iterResults = await iterations.similar_iterations(
          agentId,
          embedding,
          limit
        );
      }

      const formattedIter = iterResults.map((it) => ({
        id: it.id,
        content: `Question: ${it.question}\nAnswer: ${it.answer}`,
        history: [],
        similarity: it.similarity,
      }));

      const combined = [...memResults, ...formattedIter].filter(
        (m) => m.similarity >= SIMILARITY_THRESHOLD
      );
      return combined
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      logger.error(
        `MemoryAgentService: Error retrieving relevant memories: ${error}`
      );
      return [];
    }
  }

  public formatMemoriesForContext(memories: memory.Similarity[]): string {
    if (memories.length === 0) {
      return '';
    }

    const formattedMemories = memories
      .map((mem) => {
        const lastHist =
          Array.isArray(mem.history) && mem.history.length > 0
            ? mem.history[mem.history.length - 1]
            : null;
        const ts = lastHist?.timestamp || 'unknown';
        return `Memory [id: ${mem.id}, relevance: ${mem.similarity.toFixed(4)}, last_updated: ${ts}]: ${mem.content}`;
      })
      .join('\n\n');

    return (
      '### User Memory Context (reference only - always verify dynamic info using tools)\n\
  Format:\n    Memory [id: <number>, relevance: <score>, last_updated: <date or “unknown”>]: <description>\n    - Iteration memories may provide a "Question:" followed by its "Answer:".\n  Instruction: 1.Always read every entry in the Memory Context before composing your answer.\n    2. When description adds useful information quote or integrate it.\n    3. Carefully analyze provided question/answer pairs before responding.\n###\n' +
      formattedMemories +
      '\n\n'
    );
  }

  public async enrichPromptWithMemories(
    prompt: ChatPromptTemplate,
    message: string | BaseMessage,
    userId: string = 'default_user',
    agentId?: string
  ): Promise<ChatPromptTemplate> {
    try {
      if (!this.initialized) {
        logger.warn(
          'MemoryAgentService: Not initialized for memory enrichment'
        );
        return prompt;
      }

      const memories = await this.retrieveRelevantMemories(
        message,
        userId,
        agentId
      );
      if (!memories || memories.length === 0) {
        logger.debug(
          'MemoryAgentService: No relevant memories found for enrichment'
        );
        return prompt;
      }

      const memoryContext = this.formatMemoriesForContext(memories);
      logger.debug(
        `MemoryAgentService: Found ${memories.length} relevant memories for context enrichment`
      );

      return prompt.partial({
        memories: memoryContext,
      });
    } catch (error) {
      logger.error(
        `MemoryAgentService: Error enriching prompt with memories: ${error}`
      );
      return prompt;
    }
  }

  public async execute(
    input: unknown,
    isInterrupted?: boolean,
    config: ExecutionConfig = {}
  ): Promise<string> {
    try {
      if (!this.initialized) {
        throw new Error('MemoryAgentService: Not initialized');
      }

      const content =
        typeof input === 'string'
          ? input
          : input instanceof BaseMessage
            ? input.content.toString()
            : JSON.stringify(input);

      if (
        content.includes('store') ||
        content.includes('remember') ||
        content.includes('save')
      ) {
        return this.storeMemory(content, config.userId ?? 'default_user');
      } else if (
        content.includes('retrieve') ||
        content.includes('recall') ||
        content.includes('get')
      ) {
        return this.retrieveMemoriesForContent(
          content,
          config.userId ?? 'default_user',
          config.agentId
        );
      }

      return this.retrieveMemoriesForContent(
        content,
        config.userId ?? 'default_user',
        config.agentId
      );
    } catch (error) {
      logger.error(`MemoryAgentService: Execution error: ${error}`);
      throw error;
    }
  }

  private async storeMemory(content: string, userId: string): Promise<string> {
    try {
      const embedding = await this.embeddings.embedQuery(content);
      const metadata = { timestamp: new Date().toISOString() };

      await memory.insert_memory({
        user_id: userId,
        content,
        embedding,
        metadata,
        history: [],
      });

      if (this.config.memorySize) {
        await memory.enforce_memory_limit(userId, this.config.memorySize);
      }

      return `Memory stored successfully.`;
    } catch (error) {
      logger.error(`MemoryAgentService: Error storing memory: ${error}`);
      return `Failed to store memory: ${error}`;
    }
  }

  private async retrieveMemoriesForContent(
    content: string,
    userId: string,
    agentId?: string,
    limit = 4
  ): Promise<string> {
    try {
      const embedding = await this.embeddings.embedQuery(content);
      const memResults = await memory.similar_memory(userId, embedding, limit);
      let iterResults: iterations.IterationSimilarity[] = [];
      if (agentId) {
        iterResults = await iterations.similar_iterations(
          agentId,
          embedding,
          limit
        );
      }

      const formattedIter = iterResults.map((it) => ({
        id: it.id,
        content: `Question: ${it.question}\nAnswer: ${it.answer}`,
        history: [],
        similarity: it.similarity,
      }));

      const filtered = [...memResults, ...formattedIter].filter(
        (m) => m.similarity >= SIMILARITY_THRESHOLD
      );

      if (filtered.length === 0) {
        return 'No relevant memories found.';
      }

      return this.formatMemoriesForContext(
        filtered.sort((a, b) => b.similarity - a.similarity).slice(0, limit)
      );
    } catch (error) {
      logger.error(`MemoryAgentService: Error retrieving memories: ${error}`);
      return `Failed to retrieve memories: ${error}`;
    }
  }

  public getMemoryTools(): Tool[] {
    return [...this.memoryTools];
  }

  public getEmbeddings(): CustomHuggingFaceEmbeddings {
    return this.embeddings;
  }
}
