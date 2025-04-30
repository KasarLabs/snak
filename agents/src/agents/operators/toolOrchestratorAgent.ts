// agents/operators/toolsOrchestrator.ts
console.log('📣 ToolsOrchestrator MODULE LOADED');
import { BaseAgent, AgentType, IAgent } from '../core/baseAgent.js';
import { logger } from '@snakagent/core';
import { StarknetAgentInterface } from '../../tools/tools.js';
import { createAllowedTools } from '../../tools/tools.js';
import { createSignatureTools } from '../../tools/signatureTools.js';
import { MCP_CONTROLLER } from '../../services/mcp/src/mcp.js';
import {
  Tool,
  StructuredTool,
  DynamicStructuredTool,
} from '@langchain/core/tools';
import { BaseMessage, HumanMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ModelSelectionAgent } from './modelSelectionAgent.js';

/**
 * Configuration for the tools orchestrator
 */
export interface ToolsOrchestratorConfig {
  starknetAgent: StarknetAgentInterface;
  agentConfig: any;
  modelSelectionAgent: ModelSelectionAgent | null;
}

/**
 * Operator agent that manages tools orchestration
 */
export class ToolsOrchestrator extends BaseAgent {
  private starknetAgent: StarknetAgentInterface;
  private agentConfig: any;
  private tools: (Tool | StructuredTool | DynamicStructuredTool<any>)[] = [];
  private toolNode: ToolNode | null = null;
  private modelSelectionAgent: ModelSelectionAgent | null = null;

  constructor(config: ToolsOrchestratorConfig) {
    super('tools-orchestrator', AgentType.OPERATOR);
    this.starknetAgent = config.starknetAgent;
    this.agentConfig = config.agentConfig;
    this.modelSelectionAgent = config.modelSelectionAgent;
  }

  /**
   * Initialize the tools orchestrator
   */
  public async init(): Promise<void> {
    try {
      logger.debug('ToolsOrchestrator: Starting initialization');
      await this.initializeTools();
      this.toolNode = new ToolNode(this.tools);
      logger.debug(
        `ToolsOrchestrator: Initialized with ${this.tools.length} tools`
      );
    } catch (error) {
      logger.error(`ToolsOrchestrator: Initialization failed: ${error}`);
      throw new Error(`ToolsOrchestrator initialization failed: ${error}`);
    }
  }

  /**
   * Initialize available tools
   */
  private async initializeTools(): Promise<void> {
    try {
      const isSignature =
        this.starknetAgent.getSignature().signature === 'wallet';

      if (isSignature) {
        this.tools = await createSignatureTools(this.agentConfig.plugins);
        logger.debug(
          `ToolsOrchestrator: Initialized signature tools (${this.tools.length})`
        );
      } else {
        const allowedTools = await createAllowedTools(
          this.starknetAgent,
          this.agentConfig.plugins
        );
        this.tools = [...allowedTools];
        logger.debug(
          `ToolsOrchestrator: Initialized allowed tools (${this.tools.length})`
        );
      }

      if (
        this.agentConfig.mcpServers &&
        Object.keys(this.agentConfig.mcpServers).length > 0
      ) {
        try {
          const mcp = MCP_CONTROLLER.fromJsonConfig(this.agentConfig);
          await mcp.initializeConnections();

          const mcpTools = mcp.getTools();
          logger.info(`ToolsOrchestrator: Added ${mcpTools.length} MCP tools`);
          this.tools = [...this.tools, ...mcpTools];
        } catch (error) {
          logger.error(
            `ToolsOrchestrator: Failed to initialize MCP tools: ${error}`
          );
        }
      }
    } catch (error) {
      logger.error(`ToolsOrchestrator: Failed to initialize tools: ${error}`);
      throw error;
    }
  }

  /**
   * Execute a tool call
   * @param input Content to process
   * @param config Optional configuration
   * @returns Result of the tool execution
   */
  public async execute(
    input: string | BaseMessage | any,
    config?: Record<string, any>
  ): Promise<any> {
    try {
      if (!this.toolNode) {
        throw new Error('ToolsOrchestrator: ToolNode is not initialized');
      }

      let toolCall;
      let toolName: string;
      let toolArgs: any;

      // Extract tool information from input
      if (typeof input === 'string') {
        try {
          toolCall = JSON.parse(input);
          toolName = toolCall.name;
          toolArgs = toolCall.args;
          logger.debug(
            `ToolsOrchestrator: Processing tool call for "${toolName}"`
          );
        } catch (e) {
          throw new Error(
            `ToolsOrchestrator: Input could not be parsed as a tool call: ${e}`
          );
        }
      } else if (input instanceof BaseMessage) {
        if (
          !(input as any).tool_calls ||
          (input as any).tool_calls.length === 0
        ) {
          throw new Error('ToolsOrchestrator: No tool calls found in message');
        }
        toolCall = (input as any).tool_calls[0];
        toolName = toolCall.name;
        toolArgs = toolCall.args;
        logger.debug(
          `ToolsOrchestrator: Processing BaseMessage tool call for "${toolName}"`
        );
      } else {
        toolCall = input;
        toolName = toolCall.name;
        toolArgs = toolCall.args;
        logger.debug(
          `ToolsOrchestrator: Processing generic object tool call for "${toolName}"`
        );
      }

      if (!toolName || toolArgs === undefined) {
        throw new Error('ToolsOrchestrator: Invalid tool call format');
      }

      const tool = this.tools.find((t) => t.name === toolName);
      if (!tool) {
        logger.warn(
          `ToolsOrchestrator: Tool "${toolName}" was requested but not found in available tools`
        );
        throw new Error(`ToolsOrchestrator: Tool "${toolName}" not found`);
      }

      logger.debug(
        `ToolsOrchestrator: Executing tool "${toolName}" with args: ${JSON.stringify(toolArgs).substring(0, 100)}...`
      );

      // Get the appropriate model if needed
      let modelForToolExecution = null;
      if (this.modelSelectionAgent) {
        const modelType = config?.modelType || 'fast'; // Default to fast for tools
        modelForToolExecution = await this.modelSelectionAgent.getModelForTask(
          [],
          modelType
        );
      }

      // Create a tool node with the appropriate model if available
      let execToolNode = this.toolNode;
      if (
        modelForToolExecution &&
        typeof modelForToolExecution.bindTools === 'function'
      ) {
        logger.debug(
          `ToolsOrchestrator: Creating new ToolNode with selected model`
        );
        const boundTools = modelForToolExecution.bindTools(this.tools);
        execToolNode = new ToolNode(boundTools as any);
      }

      const state = {
        messages: [
          new HumanMessage({
            content: 'Execute tool',
            tool_calls: [toolCall],
          } as any),
        ],
      };

      const startTime = Date.now();
      const result = await execToolNode.invoke(state, config);
      const executionTime = Date.now() - startTime;
      logger.debug(
        `ToolsOrchestrator: Tool "${toolName}" execution completed in ${executionTime}ms`
      );

      if (result && result.messages && result.messages.length > 0) {
        const resultContent =
          result.messages[result.messages.length - 1].content;
        return resultContent;
      }

      return 'Tool execution completed without result';
    } catch (error) {
      logger.error(
        `ToolsOrchestrator: Execution error for tool call: ${error}`
      );
      throw error;
    }
  }

  /**
   * Get the list of available tools
   */
  public getTools(): (Tool | StructuredTool | DynamicStructuredTool<any>)[] {
    return [...this.tools];
  }

  /**
   * Get a tool by its name
   */
  public getToolByName(
    name: string
  ): Tool | StructuredTool | DynamicStructuredTool<any> | undefined {
    return this.tools.find((tool) => tool.name === name);
  }
}
