import { DynamicStructuredTool, tool } from '@langchain/core/tools';
import { BaseToolRegistry } from './base-tool-registry.js';
import { AnyZodObject } from 'zod';
import { TaskSchema } from '@schemas/graph.schemas.js';

export class TaskManagerToolRegistry extends BaseToolRegistry {
  constructor() {
    super();
    this.tools = this.registerTools();
  }

  protected registerTools(): DynamicStructuredTool<AnyZodObject>[] {
    const tools: DynamicStructuredTool<AnyZodObject>[] = [];

    // Create task tool
    tools.push(
      tool(() => {}, {
        name: 'create_task',
        description:
          '[SNAK Tool] Create a structured task with thoughts, reasoning, criticism, and speak fields',
        schema: TaskSchema,
      })
    );

    return tools;
  }
}

export const TaskManagerToolRegistryInstance = new TaskManagerToolRegistry();
