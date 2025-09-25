import { DynamicStructuredTool, tool } from '@langchain/core/tools';
import { AnyZodObject } from 'zod';
import { AgentConfig } from '@snakagent/core';
import { BaseToolRegistry } from './base-tool-registry.js';
import { ThoughtsSchema } from '@schemas/graph.schemas.js';
import { z } from 'zod';

const endTask = (): string => {
  return 'Task ended successfully';
};

export class CoreToolRegistry extends BaseToolRegistry {
  constructor() {
    super();
    this.tools = this.registerTools();
  }

  protected registerTools(): DynamicStructuredTool<AnyZodObject>[] {
    const tools: DynamicStructuredTool<AnyZodObject>[] = [];

    // End task tool
    tools.push(
      tool(endTask, {
        name: 'end_task',
        description:
          '[SNAK Tool] Use this tool to end the task execution when the task is completed or cannot be completed. Provide a clear and concise summary in the "speak" field of the response.',
        schema: ThoughtsSchema,
      })
    );

    // Blocked task tool
    tools.push(
      tool(() => {}, {
        name: 'block_task',
        description:
          '[SNAK Tool] Use when the task cannot be completed due to unresolvable obstacles. Provide details in the response.',
        schema: ThoughtsSchema,
      })
    );

    // HITL tool
    tools.push(
      tool(() => {}, {
        name: 'ask_human',
        description: `[SNAK Tool] Use this tool to ask the user for input when necessary don't violate your system constraint. Provide a clear and concise question in the "speak" field of the response.`,
        schema: ThoughtsSchema,
      })
    );
    return tools;
  }
}

export const CoreToolRegistryInstance = new CoreToolRegistry();
