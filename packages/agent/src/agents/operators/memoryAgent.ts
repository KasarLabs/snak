import { BaseAgent, AgentType } from '../core/baseAgent.js';
import { BaseMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { CustomHuggingFaceEmbeddings } from '@snakagent/core';
import { Tool } from '@langchain/core/tools';
import { Runnable } from '@langchain/core/runnables';
import {
  MemoryAgentService,
  MemoryNodeState,
  ExecutionConfig,
} from './services/memoryAgentService.js';
import { memory } from '@snakagent/database/queries';

export interface MemoryConfig {
  enabled?: boolean;
  shortTermMemorySize?: number;
  memorySize?: number;
  maxIterations?: number;
  embeddingModel?: string;
}

export class MemoryAgent extends BaseAgent {
  private service: MemoryAgentService;

  constructor(config: MemoryConfig) {
    super('memory-agent', AgentType.OPERATOR);
    this.service = new MemoryAgentService(config);
  }

  public async init(): Promise<void> {
    await this.service.init();
  }

  public prepareMemoryTools(): Tool[] {
    return this.service.prepareMemoryTools();
  }

  public createMemoryNode(): Runnable<MemoryNodeState, { memories: string }> {
    return this.service.createMemoryNode();
  }

  public createMemoryChain(
    limit = 4
  ): Runnable<MemoryNodeState, { memories: string }> {
    return this.service.createMemoryChain(limit);
  }

  public async retrieveRelevantMemories(
    message: string | BaseMessage,
    userId: string = 'default_user',
    agentId?: string,
    limit = 4
  ): Promise<memory.Similarity[]> {
    return this.service.retrieveRelevantMemories(message, userId, agentId, limit);
  }

  public formatMemoriesForContext(memories: memory.Similarity[]): string {
    return this.service.formatMemoriesForContext(memories);
  }

  public async enrichPromptWithMemories(
    prompt: ChatPromptTemplate,
    message: string | BaseMessage,
    userId: string = 'default_user',
    agentId?: string
  ): Promise<ChatPromptTemplate> {
    return this.service.enrichPromptWithMemories(prompt, message, userId, agentId);
  }

  public async execute(
    input: unknown,
    isInterrupted?: boolean,
    config?: ExecutionConfig
  ): Promise<string> {
    return this.service.execute(input, isInterrupted, config);
  }

  public getMemoryTools(): Tool[] {
    return this.service.getMemoryTools();
  }

  public getEmbeddings(): CustomHuggingFaceEmbeddings {
    return this.service.getEmbeddings();
  }
}