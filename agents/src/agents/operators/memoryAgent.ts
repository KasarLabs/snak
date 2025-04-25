// agents/operators/memoryAgent.ts
import { BaseAgent, AgentType } from '../core/baseAgent.js';
import { logger } from '@snakagent/core';
import { BaseMessage, HumanMessage } from '@langchain/core/messages';
import { CustomHuggingFaceEmbeddings } from '../../memory/customEmbedding.js';
import { memory, Postgres } from '@snakagent/database/queries';
import { z } from 'zod';
import { tool } from '@langchain/core/tools';

/**
 * Configuration pour l'agent de mémoire
 */
export interface MemoryAgentConfig {
  shortTermMemorySize?: number;
  recursionLimit?: number;
  embeddingModel?: string;
}

/**
 * Agent opérateur qui gère la mémoire et les connaissances
 */
export class MemoryAgent extends BaseAgent {
  private config: MemoryAgentConfig;
  private embeddings: CustomHuggingFaceEmbeddings;
  private memoryTools: any[] = [];
  private initialized: boolean = false;

  constructor(config: MemoryAgentConfig) {
    super('memory-agent', AgentType.OPERATOR);
    this.config = {
      shortTermMemorySize: config.shortTermMemorySize || 15,
      recursionLimit: config.recursionLimit,
      embeddingModel: config.embeddingModel || 'Xenova/all-MiniLM-L6-v2',
    };

    // Initialiser les embeddings
    this.embeddings = new CustomHuggingFaceEmbeddings({
      model: this.config.embeddingModel,
      dtype: 'fp32',
    });
  }

  /**
   * Initialise l'agent de mémoire
   */
  public async init(): Promise<void> {
    try {
      logger.debug('MemoryAgent: Starting initialization');

      // Initialiser la base de données de mémoire
      await this.initializeMemoryDB();

      // Créer les outils de mémoire
      this.createMemoryTools();

      this.initialized = true;
      logger.debug('MemoryAgent: Initialized successfully');
    } catch (error) {
      logger.error(`MemoryAgent: Initialization failed: ${error}`);
      throw new Error(`MemoryAgent initialization failed: ${error}`);
    }
  }

  /**
   * Initialise la base de données de mémoire
   */
  private async initializeMemoryDB(): Promise<void> {
    try {
      await memory.init();
      logger.debug('MemoryAgent: Memory database initialized');
    } catch (error) {
      logger.error(
        `MemoryAgent: Failed to initialize memory database: ${error}`
      );
      throw error;
    }
  }

  /**
   * Crée les outils de mémoire
   */
  private createMemoryTools(): void {
    // Outil pour créer ou mettre à jour une mémoire
    const upsertMemoryTool = tool(
      async ({
        content,
        memoryId,
        userId = 'default_user',
      }): Promise<string> => {
        try {
          const embedding = await this.embeddings.embedQuery(content);
          const metadata = { timestamp: new Date().toISOString() };
          content = content.replace(/'/g, "''"); // Échapper les apostrophes pour SQL

          logger.debug(`MemoryAgent: Upserting memory for user ${userId}`);

          if (memoryId) {
            logger.debug(`MemoryAgent: Updating memory ID ${memoryId}`);
            await memory.update_memory(memoryId, content, embedding);
            return `Memory ${memoryId} updated successfully.`;
          }

          // insert_memory returns void, so we can't get the ID directly here.
          await memory.insert_memory({
            user_id: userId,
            content,
            embedding,
            metadata,
            history: [],
          });

          // Returning a generic message as the ID is not available from insert_memory
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

    // Outil pour récupérer des souvenirs similaires
    const retrieveMemoriesTool = tool(
      async ({
        query,
        userId = 'default_user',
        limit = 5,
      }): Promise<string> => {
        try {
          const embedding = await this.embeddings.embedQuery(query);
          // Corrected: similar_memory only takes userId and embedding
          const similar = await memory.similar_memory(userId, embedding);
          // Note: The 'limit' parameter is not used in the DB function call directly.
          // If limiting is needed, it might be handled inside the SQL function or requires filtering results here.

          if (similar.length === 0) {
            return 'No relevant memories found.';
          }

          const memories = similar
            .map((similarity) => {
              return `Memory [id: ${similarity.id}, similarity: ${similarity.similarity.toFixed(4)}]: ${similarity.content}`;
            })
            .join('\n\n');

          return `Retrieved ${similar.length} memories:\n\n${memories}`;
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

    // Outil pour supprimer une mémoire - Commented out as delete_memory function doesn't exist in queries
    /*
    const deleteMemoryTool = tool(
      async ({ memoryId, userId = 'default_user' }): Promise<string> => {
        try {
          if (!memoryId) {
            return 'Memory ID is required for deletion.';
          }

          // FIXME: memory.delete_memory function does not exist in the provided database queries.
          // await memory.delete_memory(memoryId, userId); 
          // return `Memory ${memoryId} deleted successfully.`;
          return `Deletion functionality is currently disabled.`; 
        } catch (error) {
          logger.error(`MemoryAgent: Error deleting memory: ${error}`);
          return `Failed to delete memory: ${error}`;
        }
      },
      {
        name: 'delete_memory',
        schema: z.object({
          memoryId: z.number().describe('The ID of the memory to delete.'),
          userId: z
            .string()
            .optional()
            .describe('The user ID associated with the memory.'),
        }),
        description: `
        Delete a specific memory by its ID.
        Use this tool when information is outdated or no longer relevant.
        `,
      }
    );
    */

    // Adjusted tool list - removed deleteMemoryTool
    this.memoryTools = [
      upsertMemoryTool,
      retrieveMemoriesTool /*, deleteMemoryTool */,
    ];
    logger.debug(
      `MemoryAgent: Created ${this.memoryTools.length} memory tools`
    );
  }

  /**
   * Récupère les mémoires pertinentes pour un message
   * @param message Le message pour lequel récupérer des mémoires
   * @param userId L'ID de l'utilisateur
   * @param limit Le nombre maximum de mémoires à récupérer
   */
  public async retrieveRelevantMemories(
    message: string | BaseMessage,
    userId: string = 'default_user',
    limit: number = 5
  ): Promise<any[]> {
    try {
      if (!this.initialized) {
        throw new Error('MemoryAgent: Not initialized');
      }

      const query =
        typeof message === 'string' ? message : message.content.toString();

      const embedding = await this.embeddings.embedQuery(query);
      const memories = await memory.similar_memory(userId, embedding);

      return memories;
    } catch (error) {
      logger.error(`MemoryAgent: Error retrieving relevant memories: ${error}`);
      return [];
    }
  }

  /**
   * Formate les mémoires pour l'inclusion dans un contexte
   * @param memories Les mémoires à formater
   */
  public formatMemoriesForContext(memories: any[]): string {
    if (memories.length === 0) {
      return '';
    }

    const formattedMemories = memories
      .map((mem) => {
        return `Memory [id: ${mem.id}, relevance: ${mem.similarity.toFixed(4)}]: ${mem.content}`;
      })
      .join('\n\n');

    return `### User Memory Context ###\n${formattedMemories}\n\n`;
  }

  /**
   * Exécute une action avec l'agent de mémoire
   * @param input L'entrée à traiter
   * @param config Configuration optionnelle
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

      // Déterminer le type d'opération de mémoire à effectuer
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
      /* // Commented out delete logic
      else if (content.includes('delete') || content.includes('forget') || content.includes('remove')) {
        // Extraction simplifiée d'ID de mémoire pour la suppression
        const idMatch = content.match(/\bID\s*[:=]?\s*(\d+)/i) || content.match(/\bmemory\s*(\d+)/i);
        if (idMatch && idMatch[1]) {
          // return this.deleteMemory(parseInt(idMatch[1]), config?.userId || 'default_user');
           return Promise.resolve("Deletion functionality is currently disabled.");
        }
      }
      */

      // Par défaut, nous récupérons simplement les mémoires pertinentes
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
   * Stocke une mémoire
   */
  private async storeMemory(content: string, userId: string): Promise<string> {
    try {
      const embedding = await this.embeddings.embedQuery(content);
      const metadata = { timestamp: new Date().toISOString() };
      content = content.replace(/'/g, "''");

      // insert_memory returns void
      await memory.insert_memory({
        user_id: userId,
        content,
        embedding,
        metadata,
        history: [],
      });

      // Returning generic message as ID is not available
      return `Memory stored successfully.`;
    } catch (error) {
      logger.error(`MemoryAgent: Error storing memory: ${error}`);
      return `Failed to store memory: ${error}`;
    }
  }

  /**
   * Récupère les mémoires pour un contenu
   */
  private async retrieveMemoriesForContent(
    content: string,
    userId: string
  ): Promise<string> {
    try {
      const embedding = await this.embeddings.embedQuery(content);
      // Corrected: similar_memory only takes userId and embedding
      const memories = await memory.similar_memory(userId, embedding);
      // Note: Limit (e.g., 5) is not passed here. Assumed handled by DB or needs slicing.

      if (memories.length === 0) {
        return 'No relevant memories found.';
      }

      return this.formatMemoriesForContext(memories);
    } catch (error) {
      logger.error(`MemoryAgent: Error retrieving memories: ${error}`);
      return `Failed to retrieve memories: ${error}`;
    }
  }

  /**
   * Supprime une mémoire - Commented out
   */
  /*
  private async deleteMemory(memoryId: number, userId: string): Promise<string> {
    try {
      // FIXME: memory.delete_memory function does not exist.
      // await memory.delete_memory(memoryId, userId);
      // return `Memory ${memoryId} deleted successfully.`;
       return `Deletion functionality is currently disabled.`;
    } catch (error) {
      logger.error(`MemoryAgent: Error deleting memory: ${error}`);
      return `Failed to delete memory: ${error}`;
    }
  }
  */

  /**
   * Obtient les outils de mémoire
   */
  public getMemoryTools(): any[] {
    return [...this.memoryTools];
  }
}
