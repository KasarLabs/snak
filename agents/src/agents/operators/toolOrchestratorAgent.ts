// agents/operators/toolsOrchestrator.ts
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

/**
 * Configuration for the tools orchestrator
 */
export interface ToolsOrchestratorConfig {
  starknetAgent: StarknetAgentInterface;
  agentConfig: any;
}

/**
 * Operator agent that manages tools orchestration
 */
export class ToolsOrchestrator extends BaseAgent {
  private starknetAgent: StarknetAgentInterface;
  private agentConfig: any;
  private tools: (Tool | StructuredTool | DynamicStructuredTool<any>)[] = [];
  private toolNode: ToolNode | null = null;

  constructor(config: ToolsOrchestratorConfig) {
    super('tools-orchestrator', AgentType.OPERATOR);
    this.starknetAgent = config.starknetAgent;
    this.agentConfig = config.agentConfig;
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

      if (typeof input === 'string') {
        try {
          toolCall = JSON.parse(input);
        } catch (e) {
          throw new Error(
            `ToolsOrchestrator: Input could not be parsed as a tool call: ${e}`
          );
        }
      } else if (input instanceof BaseMessage) {
        if (!input.tool_calls || input.tool_calls.length === 0) {
          throw new Error('ToolsOrchestrator: No tool calls found in message');
        }
        toolCall = input.tool_calls[0];
      } else {
        toolCall = input;
      }

      if (!toolCall.name || toolCall.args === undefined) {
        throw new Error('ToolsOrchestrator: Invalid tool call format');
      }

      const tool = this.tools.find((t) => t.name === toolCall.name);
      if (!tool) {
        throw new Error(`ToolsOrchestrator: Tool "${toolCall.name}" not found`);
      }

      logger.debug(`ToolsOrchestrator: Executing tool "${toolCall.name}"`);

      const state = {
        messages: [
          new HumanMessage({
            content: 'Execute tool',
            tool_calls: [toolCall],
          }),
        ],
      };

      const result = await this.toolNode.invoke(state, config);

      if (result && result.messages && result.messages.length > 0) {
        return result.messages[result.messages.length - 1].content;
      }

      return 'Tool execution completed without result';
    } catch (error) {
      logger.error(`ToolsOrchestrator: Execution error: ${error}`);
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
