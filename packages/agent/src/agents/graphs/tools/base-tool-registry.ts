import { DynamicStructuredTool } from '@langchain/core/tools';
import { AnyZodObject } from 'zod';
import { AgentConfig } from '@snakagent/core';

export abstract class BaseToolRegistry {
  protected tools: DynamicStructuredTool<AnyZodObject>[] = [];
  protected readonly agentConfig: AgentConfig.Runtime;

  constructor(agentConfig: AgentConfig.Runtime) {
    this.agentConfig = agentConfig;
  }

  protected abstract registerTools(): DynamicStructuredTool<AnyZodObject>[];

  public getTools(): DynamicStructuredTool<AnyZodObject>[] {
    return this.tools;
  }

  public clearTools(): void {
    this.tools = [];
  }
}
