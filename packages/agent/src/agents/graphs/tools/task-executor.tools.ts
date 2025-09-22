import { DynamicStructuredTool, tool } from '@langchain/core/tools';
import { BaseToolRegistry } from './base-tool-registry.js';
import { AnyZodObject } from 'zod';
import { AgentConfig } from '@snakagent/core';
import { ThoughtsSchema, ThoughtsSchemaType } from '@schemas/graph.schemas.js';

const responseTask = (thoughts: ThoughtsSchemaType): ThoughtsSchemaType => {
  return thoughts;
};

export class TaskExecutorToolRegistry extends BaseToolRegistry {
  constructor(agentConfig: AgentConfig.Runtime) {
    super(agentConfig);
    this.tools = this.registerTools();
  }

  protected registerTools(): DynamicStructuredTool<AnyZodObject>[] {
    const tools: DynamicStructuredTool<AnyZodObject>[] = [];

    // Response tool
    tools.push(
      tool(responseTask, {
        name: 'response_task',
        description:
          '[SNAK Tool] Provide a structured response with thoughts, reasoning, criticism, and speak fields',
        schema: ThoughtsSchema,
      })
    );

    return tools;
  }

}