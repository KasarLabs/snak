import { DynamicStructuredTool, tool } from '@langchain/core/tools';
import { BaseToolRegistry } from './base-tool-registry.js';
import { AnyZodObject } from 'zod';
import {
  retrieveMemoryFromContentSchema,
  retrieveMemoryFromContentType,
  retrieveMemoryFromStepId,
  retrieveMemoryFromStepIdType,
  retrieveMemoryFromTaskId,
  retrieveMemoryFromTaskIdType,
} from '@stypes/memory.types.js';
import { AgentConfig, logger } from '@snakagent/core';
import { memory } from '@snakagent/database/queries';
import { embeddingModel } from '../manager/memory/memory-db-manager.js';
export class MemoryToolRegistry {
  private agentConfig: AgentConfig.Runtime;
  private tools: DynamicStructuredTool<AnyZodObject>[];
  constructor(agentConfig: AgentConfig.Runtime) {
    this.agentConfig = agentConfig;
    this.tools = this.registerTools();
  }

  private initRetrieveMemoryFromContentTool(): DynamicStructuredTool<AnyZodObject> {
    const retrieveMemoryFromContentTool = tool(
      this.retrieveMemoryFromContextTool.bind(this),
      {
        name: 'retrieve_memory_from_content',
        description: `[SNAK Tool] Search and retrieve relevant memories based on semantic similarity to provided content. 
        This tool uses embeddings to find memories that are contextually similar to the input text. 
        Use this when you need to find memories related to a specific topic, concept, or context 
        without knowing the exact step or task ID.`,
        schema: retrieveMemoryFromContentSchema,
      }
    );

    return retrieveMemoryFromContentTool;
  }

  // Initialize the retrieve memory from step ID tool
  private initRetrieveMemoryFromStepIdTool(): DynamicStructuredTool<AnyZodObject> {
    const retrieveMemoryFromStepIdTool = tool(
      this.retrieveMemoriesFromStepId.bind(this),
      {
        name: 'retrieve_memory_from_step_id',
        description: `[SNAK Tool] Retrieve all memories associated with a specific step in the workflow or process. 
        This tool fetches memories that were created or linked to a particular step ID. 
        Use this when you need to access historical data, decisions, or context from a 
        specific step in the execution flow.`,
        schema: retrieveMemoryFromStepId,
      }
    );
    return retrieveMemoryFromStepIdTool;
  }

  // Initialize the retrieve memory from task ID tool
  private initRetrieveMemoryFromTaskIdTool(): DynamicStructuredTool<AnyZodObject> {
    const retrieveMemoryFromTaskIdTool = tool(
      this.retrieveMemoriesFromTaskId.bind(this),
      {
        name: 'retrieve_memory_from_task_id',
        description: `[SNAK Tool] Retrieve all memories associated with a specific task in the system. 
        This tool fetches memories that were created or linked to a particular task ID. 
        Use this when you need to access all information, context, and historical data 
        related to a specific task, including its subtasks and related operations.`,
        schema: retrieveMemoryFromTaskId,
      }
    );

    return retrieveMemoryFromTaskIdTool;
  }

  // Updated registerTools method
  protected registerTools(): DynamicStructuredTool<AnyZodObject>[] {
    const tools: DynamicStructuredTool<AnyZodObject>[] = [];

    // Initialize and register all memory retrieval tools
    tools.push(this.initRetrieveMemoryFromContentTool());
    tools.push(this.initRetrieveMemoryFromStepIdTool());
    tools.push(this.initRetrieveMemoryFromTaskIdTool());

    // Add any other tools here as needed

    logger.debug(`[MemoryAgent] Registered ${tools.length} tools`);
    return tools;
  }

  private async retrieveMemoriesFromStepId(
    request: retrieveMemoryFromStepIdType
  ): Promise<memory.MemoryRetrieval[]> {
    try {
      if (request.step_id.length === 0) {
        throw new Error(
          'Step ID is empty make sure to pass non empty step ID.'
        );
      }
      logger.debug(
        `[MemoryAgent] Retrieving memory for step ID: ${request.step_id}`
      );
      const userId = this.agentConfig.user_id; // Replace with actual user ID retrieval logic
      const result = await memory.get_memories_by_step_id(
        userId,
        request.step_id,
        request.limit ?? null
      );
      return result;
    } catch (error) {
      logger.error(
        `[MemoryAgent] Error in retrieveMemoriesFromStepId: ${error}`
      );
      throw error;
    }
  }

  private async retrieveMemoriesFromTaskId(
    request: retrieveMemoryFromTaskIdType
  ): Promise<memory.MemoryRetrieval[]> {
    try {
      if (request.task_id.length === 0) {
        throw new Error(
          'Task ID is empty make sure to pass non empty task ID.'
        );
      }
      logger.debug(
        `[MemoryAgent] Retrieving memory for task ID: ${request.task_id}`
      );
      const userId = this.agentConfig.user_id; // Replace with actual user ID retrieval logic
      const result = await memory.get_memories_by_task_id(
        userId,
        request.task_id,
        request.limit ?? null
      );
      return result;
    } catch (error) {
      logger.error(
        `[MemoryAgent] Error in retrieveMemoriesFromTaskId: ${error}`
      );
      throw error;
    }
  }
  private async retrieveMemoryFromContextTool(
    request: retrieveMemoryFromContentType
  ): Promise<string | memory.Similarity[]> {
    try {
      if (request.content.length === 0) {
        throw new Error(
          'Content is empty make sure to pass non empty content.'
        );
      }
      logger.debug(
        `[MemoryAgent] Retrieving memory for content with length ${request.content.length}`
      );
      const userId = this.agentConfig.user_id; // Replace with actual user ID retrieval logic
      const embedding = await embeddingModel.embedQuery(request.content);
      const result = await memory.retrieve_memory(
        this.agentConfig.memory.strategy,
        userId,
        embedding,
        request.topK,
        request.threshold
      );
      return result;
    } catch (error) {
      logger.error(
        `[MemoryAgent] Error in retrieveMemoryFromContent: ${error}`
      );
      throw error;
    }
  }
}
