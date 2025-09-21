import { DynamicStructuredTool } from '@langchain/core/tools';
import { GraphConfigurableAnnotation, GraphState } from '../graph.js';
import { AnyZodObject } from 'zod';

export abstract class GraphToolRegistry {
  protected tools: any[] = [];
  protected readonly config: typeof GraphConfigurableAnnotation.State;

  constructor(config: typeof GraphConfigurableAnnotation.State) {
    this.config = config;
  }
  protected abstract registerTools(): DynamicStructuredTool<AnyZodObject>[];
  /**
   * Clear all registered tools
   */
  public clearTools(): void {
    this.tools = [];
  }
}