import { BaseAgent, AgentType } from '../core/baseAgent.js';
import { logger } from '@snakagent/core';
import { SnakAgentInterface } from '../../tools/tools.js';
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
import { ModelSelector } from './modelSelector.js';

/**
 * Configuration for the tools orchestrator
 */
export interface ToolsOrchestratorConfig {
  snakAgent: SnakAgentInterface | null;
  agentConfig: any;
  modelSelector: ModelSelector | null;
}

/**
 * Operator agent that manages tools orchestration and execution
 */
export class ToolsOrchestrator extends BaseAgent {
  private snakAgent: SnakAgentInterface | null;
  private agentConfig: any;
  private tools: (Tool | StructuredTool | DynamicStructuredTool<any>)[] = [];
  private toolNode: ToolNode | null = null;
  private modelSelector: ModelSelector | null = null;

  constructor(config: ToolsOrchestratorConfig) {
    super('tools-orchestrator', AgentType.OPERATOR);
    this.snakAgent = config.snakAgent;
    this.agentConfig = config.agentConfig;
    this.modelSelector = config.modelSelector;
  }

  /**
   * Initialize the tools orchestrator with available tools and MCP connections
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
   * Initialize available tools including signature tools, allowed tools, and MCP tools
   */
  private async initializeTools(): Promise<void> {
    try {
      if (!this.snakAgent) {
        logger.info(
          'ToolsOrchestrator: No SnakAgent provided, initializing with limited tools set'
        );
        this.tools = [];
      } else {
        const isSignature =
          this.snakAgent.getSignature().signature === 'wallet';

        if (isSignature) {
          this.tools = await createSignatureTools(this.agentConfig.plugins);
          logger.debug(
            `ToolsOrchestrator: Initialized signature tools (${this.tools.length})`
          );
        } else {
          const allowedTools = await createAllowedTools(
            this.snakAgent,
            this.agentConfig.plugins
          );
          this.tools = [...allowedTools];
          logger.debug(
            `ToolsOrchestrator: Initialized allowed tools (${this.tools.length})`
          );
        }
      }

      if (
        this.agentConfig.mcpServers &&
        Object.keys(this.agentConfig.mcpServers).length > 0
      ) {
        try {
          const mcp = MCP_CONTROLLER.fromAgentConfig(this.agentConfig);
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
   * Execute a tool call with the provided input and configuration
   * @param input - Tool call input (string, BaseMessage, or tool call object)
   * @param config - Optional execution configuration
   * @returns Result of the tool execution
   */
  public async execute(
    input: string | BaseMessage | any,
    config?: Record<string, any>
  ): Promise<any> {
    if (!this.toolNode) {
      throw new Error('ToolsOrchestrator: ToolNode is not initialized');
    }

    const { toolName, toolArgs, toolCall } = this.parseToolInput(input);

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

    const execToolNode = await this.getExecutionToolNode(config);
    const result = await this.executeToolCall(
      execToolNode,
      toolCall,
      toolName,
      config
    );

    return result;
  }

  /**
   * Parse tool input from various formats
   * @param input - Input to parse
   * @returns Parsed tool information
   */
  private parseToolInput(input: string | BaseMessage | any): {
    toolName: string;
    toolArgs: any;
    toolCall: any;
  } {
    let toolCall;
    let toolName: string;
    let toolArgs: any;

    if (typeof input === 'string') {
      try {
        toolCall = JSON.parse(input);
        toolName = toolCall.name;
        toolArgs = toolCall.args;
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
    } else {
      toolCall = input;
      toolName = toolCall.name;
      toolArgs = toolCall.args;
    }

    if (!toolName || toolArgs === undefined) {
      throw new Error('ToolsOrchestrator: Invalid tool call format');
    }

    return { toolName, toolArgs, toolCall };
  }

  /**
   * Get the appropriate tool node for execution
   * @param config - Execution configuration
   * @returns Tool node for execution
   */
  private async getExecutionToolNode(
    config?: Record<string, any>
  ): Promise<ToolNode> {
    if (!this.modelSelector) {
      return this.toolNode!;
    }

    const modelType = config?.modelType || 'fast';
    const modelForToolExecution =
      await this.modelSelector.getModels()[modelType];

    if (
      modelForToolExecution &&
      typeof modelForToolExecution.bindTools === 'function'
    ) {
      const boundTools = modelForToolExecution.bindTools(this.tools);
      return new ToolNode(boundTools as any);
    }

    return this.toolNode!;
  }

  /**
   * Execute the tool call and return the result
   * @param execToolNode - Tool node to use for execution
   * @param toolCall - Tool call to execute
   * @param toolName - Name of the tool being executed
   * @param config - Execution configuration
   * @returns Execution result
   */
  private async executeToolCall(
    execToolNode: ToolNode,
    toolCall: any,
    toolName: string,
    config?: Record<string, any>
  ): Promise<any> {
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

    if (result?.messages?.length > 0) {
      return result.messages[result.messages.length - 1].content;
    }

    return 'Tool execution completed without result';
  }

  /**
   * Get the list of available tools
   * @returns Array of available tools
   */
  public getTools(): (Tool | StructuredTool | DynamicStructuredTool<any>)[] {
    return [...this.tools];
  }

  /**
   * Get a tool by its name
   * @param name - Name of the tool to find
   * @returns The tool if found, undefined otherwise
   */
  public getToolByName(
    name: string
  ): Tool | StructuredTool | DynamicStructuredTool<any> | undefined {
    return this.tools.find((tool) => tool.name === name);
  }
}
