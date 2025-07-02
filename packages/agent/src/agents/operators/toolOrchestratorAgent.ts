import { BaseAgent, AgentType } from '../core/baseAgent.js';
import { Tool, StructuredTool, DynamicStructuredTool } from '@langchain/core/tools';
import { BaseMessage } from '@langchain/core/messages';
import { OperatorRegistry } from './operatorRegistry.js';
import {
  ToolsOrchestratorService,
  ToolsOrchestratorServiceConfig,
} from './services/toolOrchestratorService.js';

/**
 * Configuration for the tools orchestrator
 */
export interface ToolsOrchestratorConfig extends ToolsOrchestratorServiceConfig {}

interface ExecuteConfig {
  originalUserQuery: string;
  [key: string]: unknown;
}

/**
 * Operator agent that manages tools orchestration and execution
 */
export class ToolsOrchestrator extends BaseAgent {
  private service: ToolsOrchestratorService;

  constructor(config: ToolsOrchestratorConfig) {
    super('tools-orchestrator', AgentType.OPERATOR);
    this.service = new ToolsOrchestratorService(config);
  }

  /**
   * Initialize the tools orchestrator with available tools and MCP connections
   */
  public async init(): Promise<void> {
    await this.service.init();
    OperatorRegistry.getInstance().register(this.id, this);
  }

  /**
   * Execute a tool call with the provided input and configuration
   * @param {string | BaseMessage | BaseMessage[]} input - Tool call input (string, BaseMessage, or tool call object)
   * @param {ExecuteConfig} [config] - Optional execution configuration
   * @returns {Promise<any>} Result of the tool execution
   */
  public async execute(
    input: string | BaseMessage | any,
    isInterrupted?: boolean,
    config?: ExecuteConfig
  ): Promise<any> {
    return this.service.execute(input, isInterrupted, config);
  }


  /**
   * Get the list of available tools
   * @returns Array of available tools
   */
  public getTools(): (Tool | StructuredTool | DynamicStructuredTool<any>)[] {
    return this.service.getTools();
  }

  /**
   * Get a tool by its name
   * @param name - Name of the tool to find
   * @returns The tool if found, undefined otherwise
   */
  public getToolByName(
    name: string
  ): Tool | StructuredTool | DynamicStructuredTool<any> | undefined {
    return this.service.getToolByName(name);
  }

  /**
   * Dispose the orchestrator and unregister from the registry
   */
  public async dispose(): Promise<void> {
    await this.service.dispose();
    OperatorRegistry.getInstance().unregister(this.id);
  }
}