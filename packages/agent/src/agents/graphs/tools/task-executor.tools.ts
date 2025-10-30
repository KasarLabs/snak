import { DynamicStructuredTool, tool } from '@langchain/core/tools';
import { BaseToolRegistry } from './base-tool-registry.js';
import { AnyZodObject } from 'zod';
import { AgentConfig } from '@snakagent/core';
import { ThoughtsSchema } from '@schemas/graph.schema.js';

export class TaskExecutorToolRegistry extends BaseToolRegistry {
  constructor() {
    super();
    this.tools = this.registerTools();
  }

  protected registerTools(): DynamicStructuredTool<AnyZodObject>[] {
    const tools: DynamicStructuredTool<AnyZodObject>[] = [];

    // Response tool
    tools.push(
      tool(() => {}, {
        name: 'response_task',
        description:
          '[SNAK Tool] Provide a structured response with thoughts, reasoning, criticism, and speak fields',
        schema: ThoughtsSchema,
      })
    );

    return tools;
  }
}

export const TaskExecutorToolRegistryInstance = new TaskExecutorToolRegistry();
