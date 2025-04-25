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
 * Configuration pour l'orchestrateur d'outils
 */
export interface ToolsOrchestratorConfig {
  starknetAgent: StarknetAgentInterface;
  agentConfig: any;
}

/**
 * Agent opérateur qui gère l'orchestration des outils
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
   * Initialise l'orchestrateur d'outils
   */
  public async init(): Promise<void> {
    try {
      logger.debug('ToolsOrchestrator: Starting initialization');

      // Initialiser les outils
      await this.initializeTools();

      // Créer le nœud d'outil
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
   * Initialise les outils disponibles
   */
  private async initializeTools(): Promise<void> {
    try {
      const isSignature =
        this.starknetAgent.getSignature().signature === 'wallet';

      if (isSignature) {
        // Initialiser les outils de signature
        this.tools = await createSignatureTools(this.agentConfig.plugins);
        logger.debug(
          `ToolsOrchestrator: Initialized signature tools (${this.tools.length})`
        );
      } else {
        // Initialiser les outils standard
        const allowedTools = await createAllowedTools(
          this.starknetAgent,
          this.agentConfig.plugins
        );
        this.tools = [...allowedTools];
        logger.debug(
          `ToolsOrchestrator: Initialized allowed tools (${this.tools.length})`
        );
      }

      // Initialiser les outils MCP si configurés
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
   * Exécute un appel d'outil
   * @param input Le contenu à traiter
   * @param config Configuration optionnelle
   * @returns Le résultat de l'exécution de l'outil
   */
  public async execute(
    input: string | BaseMessage | any,
    config?: Record<string, any>
  ): Promise<any> {
    try {
      if (!this.toolNode) {
        throw new Error('ToolsOrchestrator: ToolNode is not initialized');
      }

      // Préparer l'entrée pour l'exécution de l'outil
      let toolCall;

      if (typeof input === 'string') {
        // Essayer de parser l'entrée comme un appel d'outil JSON
        try {
          toolCall = JSON.parse(input);
        } catch (e) {
          throw new Error(
            `ToolsOrchestrator: Input could not be parsed as a tool call: ${e}`
          );
        }
      } else if (input instanceof BaseMessage) {
        // Extraire un appel d'outil du message
        if (!input.tool_calls || input.tool_calls.length === 0) {
          throw new Error('ToolsOrchestrator: No tool calls found in message');
        }
        toolCall = input.tool_calls[0];
      } else {
        // Supposer que l'entrée est déjà un objet d'appel d'outil
        toolCall = input;
      }

      // Valider l'appel d'outil
      if (!toolCall.name || toolCall.args === undefined) {
        throw new Error('ToolsOrchestrator: Invalid tool call format');
      }

      // Trouver l'outil correspondant
      const tool = this.tools.find((t) => t.name === toolCall.name);
      if (!tool) {
        throw new Error(`ToolsOrchestrator: Tool "${toolCall.name}" not found`);
      }

      // Exécuter l'outil
      logger.debug(`ToolsOrchestrator: Executing tool "${toolCall.name}"`);

      // Préparer l'état pour ToolNode
      const state = {
        messages: [
          new HumanMessage({
            content: 'Execute tool',
            tool_calls: [toolCall],
          }),
        ],
      };

      // Exécuter avec ToolNode pour un comportement cohérent
      const result = await this.toolNode.invoke(state, config);

      // Extraire et retourner le résultat
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
   * Obtient la liste des outils disponibles
   */
  public getTools(): (Tool | StructuredTool | DynamicStructuredTool<any>)[] {
    return [...this.tools];
  }

  /**
   * Obtient un outil par son nom
   */
  public getToolByName(
    name: string
  ): Tool | StructuredTool | DynamicStructuredTool<any> | undefined {
    return this.tools.find((tool) => tool.name === name);
  }
}
