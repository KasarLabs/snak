import {
  BaseAgent,
  AgentType,
  AgentMessage,
  IAgent,
} from '../core/baseAgent.js';
import { ModelSelector } from '../operators/modelSelector.js';
import { SnakAgent, SnakAgentConfig } from '../core/snakAgent.js';
import { ToolsOrchestrator } from '../operators/toolOrchestratorAgent.js';
import { MemoryAgent } from '../operators/memoryAgent.js';
import { WorkflowController } from './workflowController.js';
import {
  DatabaseCredentials,
  logger,
  metrics,
  AgentConfig,
  ModelsConfig,
} from '@snakagent/core';
import { HumanMessage, BaseMessage, AIMessage } from '@langchain/core/messages';
import { Tool } from '@langchain/core/tools';
import { AgentMode, AGENT_MODES } from '../../config/agentConfig.js';
import { RpcProvider } from 'starknet';
import { AgentSelector } from '../operators/agentSelector.js';
import { OperatorRegistry } from '../operators/operatorRegistry.js';
import { ConfigurationAgent } from '../operators/config-agent/configAgent.js';
import { MCPAgent } from '../operators/mcp-agent/mcpAgent.js';

/**
 * Represents an agent to be registered
 */
interface AgentRegistration {
  agent: SnakAgent;
  metadata?: any;
}

/**
 * Configuration interface for the SupervisorAgent
 * @interface SupervisorAgentConfig
 */
export interface SupervisorAgentConfig {
  modelsConfig: ModelsConfig;
  starknetConfig: SnakAgentConfig;
  debug?: boolean;
}

/**
 * SupervisorAgent manages the orchestration of all system agents.
 * Acts as a central coordinator, initializing and managing the lifecycle
 * of various operator agents and handling execution flow through WorkflowController.
 */
export class SupervisorAgent extends BaseAgent {
  private modelSelector: ModelSelector | null = null;
  private snakAgent: SnakAgent | null = null;
  private toolsOrchestrator: ToolsOrchestrator | null = null;
  private memoryAgent: MemoryAgent | null = null;
  private workflowController: WorkflowController | null = null;
  private configAgent: ConfigurationAgent | null = null;
  private mcpAgent: MCPAgent | null = null;
  private config: SupervisorAgentConfig;
  private operators: Map<string, IAgent> = new Map();
  private debug: boolean = false;
  private executionDepth: number = 0;
  private checkpointEnabled: boolean = false;
  private agentSelector: AgentSelector | null = null;
  private snakAgents: Record<string, SnakAgent> = {};
  private nodeNameToAgentId: Map<string, string> = new Map();
  private agentIdToNodeName: Map<string, string> = new Map();
  private workflowInitialized: boolean = false;
  private isInitializing: boolean = false;

  private static instance: SupervisorAgent | null = null;

  /**
   * Gets the singleton instance of SupervisorAgent
   * @returns The SupervisorAgent instance, or null if not initialized
   */
  public static getInstance(): SupervisorAgent | null {
    return SupervisorAgent.instance;
  }

  /**
   * Constructs a new SupervisorAgent
   * @param configObject - The configuration for the supervisor agent
   */
  constructor(configObject: SupervisorAgentConfig) {
    super('supervisor', AgentType.SUPERVISOR);
    SupervisorAgent.instance = this;

    this.config = {
      modelsConfig: configObject.modelsConfig || '',
      starknetConfig: configObject.starknetConfig || {
        provider: {} as RpcProvider,
        accountPublicKey: '',
        accountPrivateKey: '',
        signature: '',
        db_credentials: {} as DatabaseCredentials,
      },
      debug: !!configObject.debug,
    };

    this.debug = !!this.config.debug;
    logger.debug('SupervisorAgent: Initializing');
  }

  /**
   * Initializes the supervisor and all agents under its control
   * Sets up model selection agent, memory agent, main Snak agent, tools orchestrator, and workflow controller
   * @throws {Error} Will throw an error if initialization of any critical component fails
   */
  public async init(): Promise<void> {
    const agentConfig = this.config.starknetConfig.agentConfig;
    logger.info('SupervisorAgent: Starting initialization');

    try {
      await this.initializeModelSelector();
      await this.initializeMemoryAgent(agentConfig);
      await this.initializeToolsOrchestrator(agentConfig);
      await this.initializeAgentSelector();

      this.updateAgentSelectorRegistry();
      await this.initializeConfigAgent();
      await this.initializeMCPAgent();

      await this.initializeWorkflowController(true);

      if (Object.keys(this.snakAgents).length > 0) {
        this.initializeMetrics(agentConfig);
      }

      logger.info('SupervisorAgent: All agents initialized successfully');
    } catch (error) {
      logger.error(`SupervisorAgent: Initialization failed: ${error}`);
      throw new Error(`SupervisorAgent initialization failed: ${error}`);
    }
  }

  private async initializeConfigAgent(): Promise<void> {
    logger.debug('SupervisorAgent: Initializing ConfigAgent...');
    this.configAgent = new ConfigurationAgent({ debug: this.debug });
    await this.configAgent.init();
    this.operators.set(this.configAgent.id, this.configAgent);
  }

  private async initializeMCPAgent(): Promise<void> {
    logger.debug('SupervisorAgent: Initializing MCPAgent...');
    this.mcpAgent = new MCPAgent({ debug: this.debug });
    await this.mcpAgent.init();
    this.operators.set(this.mcpAgent.id, this.mcpAgent);
  }

  /**
   * Initializes the ModelSelector component
   * @private
   */
  private async initializeModelSelector(): Promise<void> {
    logger.debug('SupervisorAgent: Initializing ModelSelector...');
    this.modelSelector = new ModelSelector({
      debugMode: this.debug,
      useModelSelector: true,
      modelsConfig: this.config.modelsConfig,
    });
    await this.modelSelector.init();
    this.operators.set(this.modelSelector.id, this.modelSelector);
    logger.debug('SupervisorAgent: ModelSelector initialized');
  }

  /**
   * Initializes the MemoryAgent component if enabled
   * @param agentConfig - Agent configuration
   * @private
   */
  private async initializeMemoryAgent(
    agentConfig: AgentConfig | undefined
  ): Promise<void> {
    if (agentConfig?.memory?.enabled !== false) {
      logger.debug('SupervisorAgent: Initializing MemoryAgent...');
      this.memoryAgent = new MemoryAgent({
        shortTermMemorySize: agentConfig?.memory?.shortTermMemorySize || 15,
        maxIterations: agentConfig?.memory?.maxIterations,
        embeddingModel: agentConfig?.memory?.embeddingModel,
      });
      await this.memoryAgent.init();
      this.operators.set(this.memoryAgent.id, this.memoryAgent);
      logger.debug('SupervisorAgent: MemoryAgent initialized');
    } else {
      logger.info(
        'SupervisorAgent: MemoryAgent initialization skipped (disabled in config)'
      );
    }
  }

  /**
   * Initializes the ToolsOrchestrator component
   * @param agentConfig - Agent configuration
   * @private
   */
  private async initializeToolsOrchestrator(
    agentConfig: AgentConfig | undefined
  ): Promise<void> {
    logger.debug('SupervisorAgent: Initializing ToolsOrchestrator...');
    this.toolsOrchestrator = new ToolsOrchestrator({
      snakAgent: null,
      agentConfig: agentConfig,
      modelSelector: this.modelSelector,
    });
    await this.toolsOrchestrator.init();
    this.operators.set(this.toolsOrchestrator.id, this.toolsOrchestrator);
    logger.debug('SupervisorAgent: ToolsOrchestrator initialized');
  }

  /**
   * Initializes the AgentSelector component
   * @private
   */
  private async initializeAgentSelector(): Promise<void> {
    logger.debug('SupervisorAgent: Initializing AgentSelector...');
    this.agentSelector = new AgentSelector({
      availableAgents: {},
      modelSelector: this.modelSelector,
      debug: this.debug,
    });
    await this.agentSelector.init();
    this.operators.set(this.agentSelector.id, this.agentSelector);
    logger.debug('SupervisorAgent: AgentSelector initialized');
  }

  /**
   * Initializes the WorkflowController with all available agents
   * @param allowNoSnakAgents - If true, allows initialization even if there are no Snak execution agents
   * @param forceReinitialize - If true, forces complete reinitialization even if already initialized
   * @throws {Error} Will throw an error if essential agents are missing
   * @private
   */
  private async initializeWorkflowController(
    allowNoSnakAgents: boolean = false,
    forceReinitialize: boolean = false
  ): Promise<void> {
    if (this.isInitializing && !forceReinitialize) {
      logger.debug(
        'SupervisorAgent: WorkflowController initialization already in progress, skipping'
      );
      return;
    }

    if (
      this.workflowInitialized &&
      !forceReinitialize &&
      Object.keys(this.snakAgents).length > 0
    ) {
      logger.debug(
        'SupervisorAgent: WorkflowController already initialized, performing lightweight refresh'
      );
      await this.refreshWorkflowOnly();
      return;
    }

    this.isInitializing = true;

    try {
      logger.debug(
        'SupervisorAgent: Initializing WorkflowController components'
      );

      const allAgents: Record<string, IAgent> = { supervisor: this };

      const snakAgentCount = Object.keys(this.snakAgents).length;
      logger.debug(
        `SupervisorAgent: Found ${snakAgentCount} registered SnakAgents`
      );

      Object.entries(this.snakAgents).forEach(([id, agent]) => {
        const nodeName = this.agentIdToNodeName.get(id);
        if (nodeName) {
          allAgents[nodeName] = agent;
          logger.debug(
            `SupervisorAgent: Added SnakAgent "${id}" with node name "${nodeName}"`
          );
        } else {
          allAgents[id] = agent;
          logger.warn(
            `SupervisorAgent: No node name mapping for agent "${id}", using original ID`
          );
        }
      });

      if (
        this.snakAgent &&
        !Object.values(this.snakAgents).includes(this.snakAgent)
      ) {
        allAgents['snak-main'] = this.snakAgent;
        logger.debug(
          'SupervisorAgent: Added main snakAgent to workflow as "snak-main"'
        );
      }

      const registry = OperatorRegistry.getInstance();
      const operatorAgents = registry.getAllAgents();
      Object.entries(operatorAgents).forEach(([id, agent]) => {
        allAgents[id] = agent;
        logger.debug(`SupervisorAgent: Added operator agent "${id}"`);
      });

      logger.debug(
        `SupervisorAgent: Total agents for WorkflowController: ${Object.keys(allAgents).join(', ')}`
      );

      const snakAgentsCount = Object.keys(allAgents).filter(
        (id) => allAgents[id] && allAgents[id].type === AgentType.SNAK
      ).length;

      if (snakAgentsCount === 0 && !allowNoSnakAgents) {
        throw new Error(
          'WorkflowController requires at least one Snak execution agent.'
        );
      } else if (snakAgentsCount === 0) {
        logger.warn(
          'WorkflowController: No Snak agents available yet, but proceeding with initialization anyway'
        );
      } else {
        logger.info(
          `WorkflowController: Found ${snakAgentsCount} Snak execution agents available`
        );
      }

      const maxIterations = 15;
      const workflowTimeout = 60000;
      const entryPoint = allAgents['agent-selector']
        ? 'agent-selector'
        : 'supervisor';

      logger.debug(
        `SupervisorAgent: WorkflowController configured with maxIterations=${maxIterations}, timeout=${workflowTimeout}ms, entryPoint='${entryPoint}'`
      );

      if (
        this.workflowController &&
        (forceReinitialize || !this.workflowInitialized)
      ) {
        logger.debug(
          'SupervisorAgent: Resetting existing WorkflowController before reinitialization'
        );
        await this.workflowController.reset();
      }

      this.workflowController = new WorkflowController({
        agents: allAgents,
        entryPoint,
        checkpointEnabled: this.checkpointEnabled,
        debug: this.debug,
        maxIterations,
        workflowTimeout,
      });

      if (this.agentSelector) {
        this.agentSelector.setAvailableAgents(allAgents);
      }

      await this.workflowController.init();

      this.workflowInitialized = true;
      logger.debug(
        'WorkflowController initialized with agents: ' +
          Object.keys(allAgents).join(', ')
      );
    } catch (error: any) {
      this.workflowInitialized = false;
      logger.error(
        `Failed to initialize workflow controller: ${error.message || error}`
      );
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Performs a lightweight refresh of the WorkflowController without full reinitialization
   * @private
   */
  private async refreshWorkflowOnly(): Promise<void> {
    if (!this.workflowController || !this.workflowInitialized) {
      logger.debug(
        'SupervisorAgent: WorkflowController not initialized, performing full initialization'
      );
      const allowNoSnakAgents = Object.keys(this.snakAgents).length === 0;
      await this.initializeWorkflowController(allowNoSnakAgents);
      return;
    }

    try {
      logger.debug(
        'SupervisorAgent: Performing lightweight WorkflowController refresh'
      );

      // Reset workflow controller
      await this.workflowController.reset();

      // Update agent selector with current agents
      if (this.agentSelector) {
        const allAgents: Record<string, IAgent> = { supervisor: this };

        // Add all registered SnakAgents with their node names
        Object.entries(this.snakAgents).forEach(([id, agent]) => {
          const nodeName = this.agentIdToNodeName.get(id);
          if (nodeName) {
            allAgents[nodeName] = agent;
            logger.debug(
              `SupervisorAgent: Added agent "${id}" with node name "${nodeName}"`
            );
          } else {
            allAgents[id] = agent;
            logger.warn(
              `SupervisorAgent: No node name found for agent "${id}"`
            );
          }
        });

        // Add operator agents
        const registry = OperatorRegistry.getInstance();
        const operatorAgents = registry.getAllAgents();
        Object.entries(operatorAgents).forEach(([id, agent]) => {
          allAgents[id] = agent;
        });

        this.agentSelector.setAvailableAgents(allAgents);
        logger.debug(
          `SupervisorAgent: Updated AgentSelector with ${Object.keys(allAgents).length} agents`
        );
      }

      logger.debug(
        'SupervisorAgent: Lightweight WorkflowController refresh completed'
      );
    } catch (error) {
      logger.error(
        `SupervisorAgent: Error during lightweight refresh: ${error}`
      );
      logger.debug('SupervisorAgent: Falling back to full reinitialization');
      this.workflowInitialized = false;
      await this.initializeWorkflowController(true, true);
    }
  }

  /**
   * Initializes metrics collection for the agent
   * @param agentConfig - The agent configuration used to determine agent name and mode for metrics
   * @private
   */
  private initializeMetrics(agentConfig: AgentConfig): void {
    if (!this.snakAgent) {
      logger.warn(
        'SupervisorAgent: SnakAgent not available, skipping metrics initialization.'
      );
      return;
    }

    const agentName = agentConfig?.name || 'agent';
    const agentMode =
      agentConfig?.mode === AgentMode.AUTONOMOUS
        ? AGENT_MODES[AgentMode.AUTONOMOUS]
        : agentConfig?.mode === AgentMode.HYBRID
          ? AGENT_MODES[AgentMode.HYBRID]
          : AGENT_MODES[AgentMode.INTERACTIVE];

    metrics.metricsAgentConnect(agentName, agentMode);
    logger.debug(
      `SupervisorAgent: Metrics initialized for agent '${agentName}' in mode '${agentMode}'`
    );
  }

  /**
   * Executes a task based on the provided input
   * Manages execution flow including depth checking, input processing, memory context enrichment,
   * and invoking WorkflowController or returning directive if called as workflow node
   * @param input - The user input (string, AgentMessage, BaseMessage, or array of BaseMessages)
   * @param config - Optional execution configuration
   * @returns The final agent response or directive message for the workflow
   * @throws {Error} Will throw an error if WorkflowController is not initialized when needed
   */
  public async execute(
    input: string | AgentMessage | BaseMessage | BaseMessage[],
    config?: Record<string, any>
  ): Promise<any> {
    this.executionDepth++;
    const depthIndent = '  '.repeat(this.executionDepth);
    const isNodeCall = !!config?.isWorkflowNodeCall || this.executionDepth > 1;
    const callPath = isNodeCall ? 'Node Call Path' : 'External Call Path';

    logger.debug(
      `${depthIndent}SupervisorAgent[Depth:${this.executionDepth}, Path:${callPath}]: Executing task`
    );

    if (this.executionDepth > 5) {
      return await this.handleCriticalDepth(depthIndent, input, config);
    }

    const currentMessage = await this.processInput(
      input,
      config,
      isNodeCall,
      callPath,
      depthIndent
    );

    if (
      this.config.starknetConfig.agentConfig?.memory?.enabled !== false &&
      this.memoryAgent
    ) {
      logger.debug(
        `${depthIndent}SupervisorAgent: Enriching message with memory context for ${callPath}.`
      );
      const enrichedMessage =
        await this.enrichWithMemoryContext(currentMessage);
      return await this.executeWithMessage(
        enrichedMessage,
        config,
        isNodeCall,
        callPath,
        depthIndent
      );
    }

    return await this.executeWithMessage(
      currentMessage,
      config,
      isNodeCall,
      callPath,
      depthIndent
    );
  }

  /**
   * Handles critical execution depth scenarios
   * @param depthIndent - Indentation string for logging
   * @param input - Original input
   * @param config - Execution configuration
   * @returns Execution result or error message
   * @private
   */
  private async handleCriticalDepth(
    depthIndent: string,
    input: string | AgentMessage | BaseMessage | BaseMessage[],
    config?: Record<string, any>
  ): Promise<any> {
    logger.warn(
      `${depthIndent}SupervisorAgent: Critical execution depth (${this.executionDepth}) reached. Attempting fallback.`
    );

    try {
      if (this.snakAgent) {
        const result = await this.snakAgent.execute(
          typeof input === 'string'
            ? input
            : input instanceof BaseMessage
              ? input
              : (input as AgentMessage).content,
          config
        );

        const finalResult =
          result instanceof BaseMessage
            ? result.content
            : typeof result === 'string'
              ? result
              : JSON.stringify(result);
        this.executionDepth--;
        return finalResult;
      }

      this.executionDepth--;
      return new AIMessage({
        content:
          'Error: Supervisor critical depth reached. SnakAgent not available for direct execution. Please try a simpler query.',
        additional_kwargs: { from: 'supervisor', final: true },
      });
    } catch (error) {
      logger.error(
        `${depthIndent}SupervisorAgent: Error in direct execution attempt: ${error}`
      );
      this.executionDepth--;
      return new AIMessage({
        content: `Error during forced direct execution: ${error instanceof Error ? error.message : String(error)}`,
        additional_kwargs: { from: 'supervisor', final: true },
      });
    }
  }

  /**
   * Processes input into a BaseMessage format
   * @param input - Raw input in various formats
   * @param config - Execution configuration
   * @param isNodeCall - Whether this is a node call
   * @param callPath - Call path for logging
   * @param depthIndent - Indentation for logging
   * @returns Processed BaseMessage
   * @private
   */
  private async processInput(
    input: string | AgentMessage | BaseMessage | BaseMessage[],
    config: Record<string, any> | undefined,
    isNodeCall: boolean,
    callPath: string,
    depthIndent: string
  ): Promise<BaseMessage> {
    const originalUserQueryFromConfig = config?.originalUserQuery as
      | string
      | undefined;

    if (originalUserQueryFromConfig && isNodeCall) {
      logger.debug(
        `${depthIndent}SupervisorAgent: Using originalUserQuery from config for ${callPath} processing: "${originalUserQueryFromConfig}"`
      );
      return new HumanMessage(originalUserQueryFromConfig);
    }

    if (Array.isArray(input) && input.length > 0) {
      const lastMsg = input[input.length - 1];
      const content =
        lastMsg instanceof BaseMessage
          ? lastMsg
          : lastMsg && typeof (lastMsg as any).content === 'string'
            ? new HumanMessage((lastMsg as any).content)
            : lastMsg
              ? new HumanMessage(JSON.stringify(lastMsg))
              : new HumanMessage('Empty or invalid last message in array');

      logger.debug(
        `${depthIndent}SupervisorAgent: Processing last message from array for ${callPath}. Content (truncated): "${String(content.content).substring(0, 100)}..."`
      );
      return content;
    }

    if (typeof input === 'string') {
      return new HumanMessage(input);
    }

    if (input instanceof BaseMessage) {
      return input;
    }

    if (typeof input === 'object' && input !== null && 'content' in input) {
      return new HumanMessage(
        typeof input.content === 'string'
          ? input.content
          : JSON.stringify(input.content)
      );
    }

    logger.warn(
      `${depthIndent}SupervisorAgent: Unrecognized input type for ${callPath}: ${typeof input}. Wrapping as HumanMessage 'Unrecognized input format'.`
    );
    return new HumanMessage('Unrecognized input format');
  }

  /**
   * Executes with processed message
   * @param currentMessage - Processed message
   * @param config - Execution configuration
   * @param isNodeCall - Whether this is a node call
   * @param callPath - Call path for logging
   * @param depthIndent - Indentation for logging
   * @returns Execution result
   * @private
   */
  private async executeWithMessage(
    currentMessage: BaseMessage,
    config: Record<string, any> | undefined,
    isNodeCall: boolean,
    callPath: string,
    depthIndent: string
  ): Promise<any> {
    if (isNodeCall) {
      return await this.handleNodeCall(
        currentMessage,
        config,
        callPath,
        depthIndent
      );
    } else {
      return await this.handleExternalCall(
        currentMessage,
        config,
        callPath,
        depthIndent
      );
    }
  }

  /**
   * Handles node call execution path
   * @param currentMessage - Current message to process
   * @param config - Execution configuration
   * @param callPath - Call path for logging
   * @param depthIndent - Indentation for logging
   * @returns Directive message for workflow
   * @private
   */
  private async handleNodeCall(
    currentMessage: BaseMessage,
    config: Record<string, any> | undefined,
    callPath: string,
    depthIndent: string
  ): Promise<AIMessage> {
    logger.debug(
      `${depthIndent}SupervisorAgent (${callPath}): Determining next action based on query: "${String(currentMessage.content).substring(0, 150)}..."`
    );

    let responseContent = '';
    let nextAgent: string | undefined = undefined;
    let isFinal = false;
    let toolCallsFromSelection: any[] | undefined = undefined;
    let needsClarification = false;

    // Extract and preserve the original user query
    const originalUserQuery =
      config?.originalUserQuery ||
      (typeof currentMessage.content === 'string'
        ? currentMessage.content
        : JSON.stringify(currentMessage.content));

    const preSelectedAgent = config?.selectedSnakAgent;
    if (preSelectedAgent && this.snakAgents[preSelectedAgent]) {
      logger.debug(
        `${depthIndent}SupervisorAgent (${callPath}): Pre-selected agent "${preSelectedAgent}" found, bypassing AgentSelector entirely.`
      );

      const nodeName = this.agentIdToNodeName.get(preSelectedAgent);
      const routingTarget = nodeName || preSelectedAgent;

      responseContent = `Supervisor: Routing directly to pre-selected agent "${preSelectedAgent}" (node: ${routingTarget}).`;
      nextAgent = routingTarget;

      this.executionDepth--;
      return new AIMessage({
        content: responseContent,
        additional_kwargs: {
          from: 'supervisor',
          next_agent: nextAgent,
          originalUserQuery: originalUserQuery, // Preserve original query
        },
      });
    }

    const queryForSelection = originalUserQuery;

    if (this.agentSelector) {
      try {
        const selectionOutcome = await this.agentSelector.execute(
          new HumanMessage(queryForSelection),
          {
            ...(config || {}),
            originalUserQuery: queryForSelection,
            isWorkflowNodeCall: true,
          }
        );

        responseContent = String(selectionOutcome.content || '');

        if (selectionOutcome.additional_kwargs?.needsClarification === true) {
          needsClarification = true;
          isFinal = true;
          logger.debug(
            `${depthIndent}SupervisorAgent (${callPath}): AgentSelector needs clarification from user. Ending workflow.`
          );
        } else if (selectionOutcome.additional_kwargs?.nextAgent) {
          nextAgent = selectionOutcome.additional_kwargs.nextAgent as string;
        }

        if (
          selectionOutcome.additional_kwargs?.final !== undefined &&
          !needsClarification
        ) {
          isFinal = selectionOutcome.additional_kwargs.final as boolean;
        }

        if (
          selectionOutcome instanceof AIMessage &&
          selectionOutcome.tool_calls &&
          selectionOutcome.tool_calls.length > 0
        ) {
          toolCallsFromSelection = selectionOutcome.tool_calls;
          if (!nextAgent && this.toolsOrchestrator) nextAgent = 'tools';
        } else if (
          selectionOutcome.additional_kwargs?.tool_calls &&
          selectionOutcome.additional_kwargs.tool_calls.length > 0
        ) {
          toolCallsFromSelection =
            selectionOutcome.additional_kwargs.tool_calls;
          if (!nextAgent && this.toolsOrchestrator) nextAgent = 'tools';
        }

        logger.debug(
          `${depthIndent}SupervisorAgent (${callPath}): AgentSelector outcome - Next: ${nextAgent}, Final: ${isFinal}, Clarification: ${needsClarification}, Tools: ${toolCallsFromSelection?.length || 0}`
        );
      } catch (e: any) {
        logger.error(
          `${depthIndent}SupervisorAgent (${callPath}): Error calling AgentSelector: ${e.message}`
        );
        responseContent = 'Error during agent selection by Supervisor.';
        isFinal = true;
      }
    } else {
      logger.warn(
        `${depthIndent}SupervisorAgent (${callPath}): AgentSelector not available. Defaulting to 'snak' or ending.`
      );
      if (this.snakAgent && queryForSelection) {
        responseContent = `Supervisor: No AgentSelector. Routing to default Snak agent for query: "${queryForSelection.substring(0, 100)}..."`;
        nextAgent = 'snak';
      } else {
        responseContent =
          'Supervisor: AgentSelector not found, and no default action. Ending task.';
        isFinal = true;
      }
    }

    this.executionDepth--;
    const directiveMessage = new AIMessage({
      content: responseContent,
      additional_kwargs: {
        from: 'supervisor',
        originalUserQuery: originalUserQuery, // Always preserve original user query
        ...(nextAgent && { next_agent: nextAgent }),
        ...(isFinal && !nextAgent && { final: true }),
        ...(needsClarification && { needsClarification: true }),
      },
    });

    if (toolCallsFromSelection && toolCallsFromSelection.length > 0) {
      directiveMessage.tool_calls = toolCallsFromSelection;
      directiveMessage.additional_kwargs.tool_calls = toolCallsFromSelection;
    }

    logger.debug(
      `${depthIndent}SupervisorAgent (${callPath}): Returning directive with preserved originalUserQuery: ${JSON.stringify(directiveMessage.toJSON())}`
    );
    return directiveMessage;
  }

  /**
   * Handles external call execution path
   * @param currentMessage - Current message to process
   * @param config - Execution configuration
   * @param callPath - Call path for logging
   * @param depthIndent - Indentation for logging
   * @returns Final execution result
   * @private
   */
  private async handleExternalCall(
    currentMessage: BaseMessage,
    config: Record<string, any> | undefined,
    callPath: string,
    depthIndent: string
  ): Promise<any> {
    logger.debug(
      `${depthIndent}SupervisorAgent (${callPath}): Initiating workflow with WorkflowController.`
    );

    if (!this.workflowController) {
      logger.error(
        `${depthIndent}SupervisorAgent (${callPath}): WorkflowController not initialized.`
      );
      this.executionDepth--;
      throw new Error('WorkflowController not initialized for execution.');
    }

    const workflowConfig = this.prepareWorkflowConfig(
      currentMessage,
      config,
      callPath,
      depthIndent
    );

    try {
      const initialMessagesForWorkflow = [currentMessage];
      if (
        workflowConfig.originalUserQuery &&
        !currentMessage.additional_kwargs?.originalUserQuery
      ) {
        if (!initialMessagesForWorkflow[0].additional_kwargs) {
          initialMessagesForWorkflow[0].additional_kwargs = {};
        }
        initialMessagesForWorkflow[0].additional_kwargs.originalUserQuery =
          workflowConfig.originalUserQuery;
      }

      const result = await this.workflowController.execute(
        initialMessagesForWorkflow[0],
        workflowConfig
      );

      if (
        result?.metadata?.requiresClarification === true &&
        result.metadata.clarificationMessage
      ) {
        logger.debug(
          `${depthIndent}SupervisorAgent (${callPath}): Agent requires clarification. Ending workflow and returning clarification message directly.`
        );
        this.executionDepth--;
        return result.metadata.clarificationMessage.content;
      }

      if (result?.messages?.length > 0) {
        const lastMessage = result.messages[result.messages.length - 1];
        if (
          lastMessage instanceof AIMessage &&
          lastMessage.additional_kwargs?.needsClarification === true
        ) {
          logger.debug(
            `${depthIndent}SupervisorAgent (${callPath}): Found clarification request in final message from ${lastMessage.additional_kwargs?.from || 'unknown agent'}.`
          );
          this.executionDepth--;
          return lastMessage.content;
        }
      }

      const finalUserResponse = this.extractFinalResponse(result);
      logger.debug(
        `${depthIndent}SupervisorAgent (${callPath}): Workflow finished. Final response (truncated): "${finalUserResponse.substring(0, 200)}..."`
      );
      this.executionDepth--;
      return finalUserResponse;
    } catch (error: any) {
      logger.error(
        `${depthIndent}SupervisorAgent (${callPath}): Error during WorkflowController execution: ${error.message || error}`
      );
      this.executionDepth--;
      return `An error occurred while processing your request: ${error.message || String(error)}. Please try again.`;
    }
  }

  /**
   * Prepares workflow configuration for execution
   * @param currentMessage - Current message
   * @param config - Original configuration
   * @param callPath - Call path for logging
   * @param depthIndent - Indentation for logging
   * @returns Prepared workflow configuration
   * @private
   */
  private prepareWorkflowConfig(
    currentMessage: BaseMessage,
    config: Record<string, any> | undefined,
    callPath: string,
    depthIndent: string
  ): Record<string, any> {
    const workflowConfig: Record<string, any> = { ...(config || {}) };

    if (
      !workflowConfig.originalUserQuery &&
      typeof currentMessage.content === 'string'
    ) {
      workflowConfig.originalUserQuery = currentMessage.content;
    }

    let targetAgentFromExternalCall = config?.agentId || null;
    if (targetAgentFromExternalCall) {
      logger.debug(
        `${depthIndent}SupervisorAgent (${callPath}): Received agentId in config: "${targetAgentFromExternalCall}"`
      );

      const isValidAgent = this.isValidAgent(targetAgentFromExternalCall);
      if (!isValidAgent) {
        logger.warn(
          `${depthIndent}SupervisorAgent (${callPath}): Specified agentId "${targetAgentFromExternalCall}" in config is not a recognized agent. Workflow will use default entry point.`
        );
        targetAgentFromExternalCall = null;
      } else {
        let targetNodeName = targetAgentFromExternalCall;
        if (targetAgentFromExternalCall in this.snakAgents) {
          const nodeName = this.agentIdToNodeName.get(
            targetAgentFromExternalCall
          );
          if (nodeName) {
            targetNodeName = nodeName;
            logger.debug(
              `${depthIndent}SupervisorAgent (${callPath}): Converting agent ID "${targetAgentFromExternalCall}" to node name "${targetNodeName}"`
            );
          }
        }

        logger.debug(
          `${depthIndent}SupervisorAgent (${callPath}): External config requests startNode: "${targetNodeName}"`
        );
        workflowConfig.startNode = targetNodeName;

        if (targetAgentFromExternalCall in this.snakAgents) {
          workflowConfig.selectedSnakAgent = targetAgentFromExternalCall;
          logger.debug(
            `${depthIndent}SupervisorAgent (${callPath}): Setting selectedSnakAgent to bypass agent selector: "${targetAgentFromExternalCall}"`
          );
        }
      }
    } else {
      logger.debug(
        `${depthIndent}SupervisorAgent (${callPath}): No agentId provided in config, using default workflow`
      );
    }

    this.configureMemoryRouting(workflowConfig, config, callPath, depthIndent);
    return workflowConfig;
  }

  /**
   * Configures memory routing for workflow
   * @param workflowConfig - Workflow configuration to modify
   * @param config - Original configuration
   * @param callPath - Call path for logging
   * @param depthIndent - Indentation for logging
   * @private
   */
  private configureMemoryRouting(
    workflowConfig: Record<string, any>,
    config: Record<string, any> | undefined,
    callPath: string,
    depthIndent: string
  ): void {
    const finalTargetNodeForSnak = workflowConfig.startNode;
    const isSnakAgent =
      finalTargetNodeForSnak && this.isSnakAgentNode(finalTargetNodeForSnak);
    const isSpecificAgentRequested =
      config?.agentId && workflowConfig.startNode;

    if (
      this.memoryAgent &&
      finalTargetNodeForSnak &&
      isSnakAgent &&
      workflowConfig.startNode !== this.memoryAgent.id &&
      !isSpecificAgentRequested
    ) {
      const originalAgentId =
        this.nodeNameToAgentId.get(finalTargetNodeForSnak) ||
        finalTargetNodeForSnak;
      logger.debug(
        `${depthIndent}SupervisorAgent (${callPath}): Snak agent "${finalTargetNodeForSnak}" targeted. Routing via MemoryAgent (${this.memoryAgent.id}) first.`
      );
      workflowConfig.selectedSnakAgent = originalAgentId;
      workflowConfig.startNode = this.memoryAgent.id;
    } else if (
      finalTargetNodeForSnak &&
      isSnakAgent &&
      !workflowConfig.selectedSnakAgent
    ) {
      const originalAgentId =
        this.nodeNameToAgentId.get(finalTargetNodeForSnak) ||
        finalTargetNodeForSnak;
      logger.debug(
        `${depthIndent}SupervisorAgent (${callPath}): Snak agent "${finalTargetNodeForSnak}" targeted. Setting selectedSnakAgent to bypass agent selector.`
      );
      workflowConfig.selectedSnakAgent = originalAgentId;
    }

    if (isSpecificAgentRequested && finalTargetNodeForSnak && isSnakAgent) {
      logger.debug(
        `${depthIndent}SupervisorAgent (${callPath}): Specific agent requested via agentId. Bypassing MemoryAgent and routing directly to "${finalTargetNodeForSnak}".`
      );
      workflowConfig.startNode = finalTargetNodeForSnak;
    }
  }

  /**
   * Checks if an agent ID is valid
   * @param agentId - Agent ID to validate
   * @returns True if valid, false otherwise
   * @private
   */
  private isValidAgent(agentId: string): boolean {
    return (
      agentId in this.snakAgents ||
      agentId === 'snak' ||
      agentId === 'supervisor' ||
      this.operators.has(agentId) ||
      agentId === this.agentSelector?.id ||
      agentId === this.memoryAgent?.id
    );
  }

  /**
   * Checks if a node name corresponds to a Snak agent
   * @param nodeName - Node name to check
   * @returns True if it's a Snak agent node, false otherwise
   * @private
   */
  private isSnakAgentNode(nodeName: string): boolean {
    return (
      this.nodeNameToAgentId.has(nodeName) ||
      !!this.snakAgents[nodeName] ||
      (this.workflowController &&
        this.workflowController['agents'] &&
        this.workflowController['agents'][nodeName] &&
        this.workflowController['agents'][nodeName].type === AgentType.SNAK)
    );
  }

  /**
   * Extracts final response from workflow result
   * @param result - Workflow execution result
   * @returns Formatted final response string
   * @private
   */
  private extractFinalResponse(result: any): string {
    let finalUserResponse = 'Workflow completed.';

    if (
      result?.messages &&
      Array.isArray(result.messages) &&
      result.messages.length > 0
    ) {
      const lastWorkflowMessage = result.messages[result.messages.length - 1];
      if (lastWorkflowMessage) {
        if (
          typeof lastWorkflowMessage.content === 'string' &&
          lastWorkflowMessage.content.trim() !== ''
        ) {
          finalUserResponse = lastWorkflowMessage.content;
        } else if (
          lastWorkflowMessage.additional_kwargs?.final_answer &&
          typeof lastWorkflowMessage.additional_kwargs.final_answer === 'string'
        ) {
          finalUserResponse =
            lastWorkflowMessage.additional_kwargs.final_answer;
        } else if (typeof lastWorkflowMessage.content !== 'string') {
          finalUserResponse = JSON.stringify(lastWorkflowMessage.content);
        } else if (
          lastWorkflowMessage instanceof AIMessage &&
          lastWorkflowMessage.content.trim() === '' &&
          lastWorkflowMessage.additional_kwargs?.final
        ) {
          finalUserResponse = 'Task completed.';
        }
      }
    } else if (typeof result === 'string') {
      finalUserResponse = result;
    } else if (result?.content && typeof result.content === 'string') {
      finalUserResponse = result.content;
    } else if (result) {
      finalUserResponse = this.formatResponse(result);
    }

    return finalUserResponse;
  }

  /**
   * Formats a response for output
   * @param response - The response to format
   * @returns The formatted response string
   */
  public formatResponse(response: any): string {
    if (typeof response === 'string') {
      return response
        .split('\n')
        .map((line: string) => (line.includes('•') ? `  ${line.trim()}` : line))
        .join('\n');
    }

    if (response && typeof response === 'object') {
      if (response.content && typeof response.content === 'string') {
        response.content = response.content
          .split('\n')
          .map((line: string) =>
            line.includes('•') ? `  ${line.trim()}` : line
          )
          .join('\n');
        return response.content;
      }
      try {
        return JSON.stringify(response);
      } catch (e) {
        logger.warn(`Error stringifying response object: ${e}`);
        return 'Unparseable object response';
      }
    }
    return String(response);
  }

  /**
   * Executes a task in autonomous mode using the SnakAgent
   * @returns The result of the autonomous execution
   * @throws {Error} Will throw an error if the SnakAgent is not available
   */
  public async executeAutonomous(): Promise<any> {
    logger.debug('SupervisorAgent: Entering autonomous execution mode.');
    if (!this.snakAgent) {
      logger.error(
        'SupervisorAgent: SnakAgent is not available for autonomous execution.'
      );
      throw new Error('SnakAgent is not available for autonomous execution.');
    }
    const result = await this.snakAgent.execute_autonomous();
    logger.debug('SupervisorAgent: Autonomous execution finished.');
    return result;
  }

  /**
   * Gets an operator agent by its ID
   * @param id - The ID of the operator agent
   * @returns The agent if found, otherwise undefined
   */
  public getOperator(id: string): IAgent | undefined {
    return this.operators.get(id);
  }

  /**
   * Gets the ToolsOrchestrator instance
   * @returns The ToolsOrchestrator instance, or null if not initialized
   */
  public getToolsOrchestrator(): ToolsOrchestrator | null {
    return this.toolsOrchestrator;
  }

  /**
   * Gets the MemoryAgent instance
   * @returns The MemoryAgent instance, or null if not initialized
   */
  public getMemoryAgent(): MemoryAgent | null {
    return this.memoryAgent;
  }

  /**
   * Gets all available tools from the ToolsOrchestrator and MemoryAgent
   * @returns An array of Tool instances
   */
  public getAllTools(): Tool[] {
    const tools: Tool[] = [];
    if (this.toolsOrchestrator) {
      tools.push(...(this.toolsOrchestrator.getTools() as Tool[]));
    }
    if (this.memoryAgent) {
      tools.push(...(this.memoryAgent.getMemoryTools() as Tool[]));
    }
    return tools;
  }

  /**
   * Resets the SupervisorAgent and its components
   * Includes resetting the WorkflowController and execution depth counter
   */
  public async reset(): Promise<void> {
    logger.debug('SupervisorAgent: Resetting...');
    if (this.workflowController) {
      await this.workflowController.reset();
      logger.debug('SupervisorAgent: WorkflowController reset.');
    }
    this.executionDepth = 0;
    logger.debug('SupervisorAgent: Reset complete.');
  }

  /**
   * Updates the operational mode of the SupervisorAgent
   * Updates agent configuration and re-initializes WorkflowController to reflect mode change
   * @param mode - The new AgentMode to set
   */
  public async updateMode(mode: AgentMode): Promise<void> {
    logger.debug(`SupervisorAgent: Updating mode to: ${AGENT_MODES[mode]}`);

    const agentConfig = this.config.starknetConfig.agentConfig;
    if (agentConfig) {
      agentConfig.mode = mode;
    } else {
      logger.warn(
        'SupervisorAgent: Unable to update mode - agentConfig not found in starknetConfig.'
      );
    }

    if (this.workflowController) {
      logger.debug(
        'SupervisorAgent: Re-initializing WorkflowController due to mode change.'
      );
      await this.workflowController.reset();
      await this.initializeWorkflowController();
      logger.debug('SupervisorAgent: WorkflowController re-initialized.');
    } else {
      logger.warn(
        'SupervisorAgent: Mode updated, but no WorkflowController was present to reconfigure.'
      );
    }
    logger.debug(
      `SupervisorAgent: Mode update to ${AGENT_MODES[mode]} complete.`
    );
  }

  /**
   * Releases resources held by the SupervisorAgent and its components
   * Resets WorkflowController and nullifies references to all operator agents
   */
  public async dispose(): Promise<void> {
    logger.debug('SupervisorAgent: Disposing agents...');

    if (this.snakAgent) {
      await this.snakAgent.dispose();
      logger.debug('SupervisorAgent: SnakAgent disposed');
    }

    const agentsToDispose = [
      this.modelSelector,
      this.memoryAgent,
      this.toolsOrchestrator,
      this.workflowController,
    ];

    for (const agent of agentsToDispose) {
      if (agent && 'dispose' in agent && typeof agent.dispose === 'function') {
        await agent.dispose();
      }
    }

    this.modelSelector = null;
    this.snakAgent = null;
    this.toolsOrchestrator = null;
    this.memoryAgent = null;
    this.agentSelector = null;
    this.workflowController = null;
    this.operators.clear();
    this.snakAgents = {};
    this.nodeNameToAgentId.clear();
    this.agentIdToNodeName.clear();

    SupervisorAgent.instance = null;

    logger.debug(
      'SupervisorAgent: Cleared agent references, operator map, and node name mappings. Dispose complete.'
    );
  }

  /**
   * Enriches a message with relevant memory context if MemoryAgent is enabled
   * Retrieves memories relevant to the message and appends them to additional_kwargs.memory_context
   * @param message - The BaseMessage to enrich
   * @returns The enriched message, or original message if MemoryAgent unavailable or no memories found
   * @private
   */
  private async enrichWithMemoryContext(
    message: BaseMessage
  ): Promise<BaseMessage> {
    if (!this.memoryAgent) {
      logger.debug(
        'SupervisorAgent: MemoryAgent not available, skipping context enrichment.'
      );
      return message;
    }

    try {
      const memories = await this.memoryAgent.retrieveRelevantMemories(
        message,
        this.config.starknetConfig.agentConfig?.chatId || 'default_chat'
      );

      if (memories.length === 0) {
        logger.debug(
          'SupervisorAgent: No relevant memories found for context.'
        );
        return message;
      }

      const memoryContext = this.memoryAgent.formatMemoriesForContext(memories);
      logger.debug(
        `SupervisorAgent: Formatted memory context (first 100 chars): "${memoryContext.substring(0, 100)}..."`
      );

      const originalContent =
        typeof message.content === 'string'
          ? message.content
          : JSON.stringify(message.content);

      return new HumanMessage({
        content: originalContent,
        additional_kwargs: {
          ...message.additional_kwargs,
          memory_context: memoryContext,
        },
      });
    } catch (error) {
      logger.error(
        `SupervisorAgent: Error enriching message with memory context: ${error}`
      );
      return message;
    }
  }

  /**
   * Starts a hybrid execution flow with an initial input
   * Delegates to the SnakAgent's hybrid execution capabilities
   * @param initialInput - The initial input string to start the hybrid process
   * @returns An object containing the initial state and the thread ID for the execution
   * @throws {Error} Will throw an error if the SnakAgent is not available or if execution fails to start
   */
  public async startHybridExecution(
    initialInput: string
  ): Promise<{ state: any; threadId: string }> {
    logger.debug('SupervisorAgent: Starting hybrid execution.');
    if (!this.snakAgent) {
      logger.error(
        'SupervisorAgent: SnakAgent is not available for hybrid execution.'
      );
      throw new Error('SnakAgent is not available for hybrid execution.');
    }

    const result = await this.snakAgent.execute_hybrid(initialInput);

    if (!result || typeof result !== 'object') {
      logger.error(
        'SupervisorAgent: Failed to start hybrid execution - invalid result from SnakAgent.'
      );
      throw new Error(
        'Failed to start hybrid execution: received invalid result from SnakAgent.'
      );
    }

    const resultObj = result as any;
    const threadId = resultObj.threadId || `hybrid_fallback_${Date.now()}`;
    if (!resultObj.threadId) {
      logger.warn(
        `SupervisorAgent: ThreadId missing in hybrid execution result, generated fallback: ${threadId}`
      );
    }

    return {
      state: resultObj.state || resultObj,
      threadId,
    };
  }

  /**
   * Provides subsequent input to a paused hybrid execution
   * Delegates to the SnakAgent to resume the hybrid flow
   * @param input - The human input string to provide to the paused execution
   * @param threadId - The thread ID of the paused hybrid execution
   * @returns The updated state after processing the input
   * @throws {Error} Will throw an error if the SnakAgent is not available
   */
  public async provideHybridInput(
    input: string,
    threadId: string
  ): Promise<any> {
    logger.debug(
      `SupervisorAgent: Providing input to hybrid execution (thread: ${threadId})`
    );
    if (!this.snakAgent) {
      logger.error(
        'SupervisorAgent: SnakAgent is not available to provide hybrid input.'
      );
      throw new Error('SnakAgent is not available to provide hybrid input.');
    }
    return this.snakAgent.resume_hybrid(input, threadId);
  }

  /**
   * Checks if the current state of a hybrid execution is waiting for human input
   * Examines the state object for flags or markers in messages indicating waiting state
   * @param state - The current execution state object
   * @returns True if the execution is waiting for input, false otherwise
   */
  public isWaitingForInput(state: any): boolean {
    if (
      !state ||
      !Array.isArray(state.messages) ||
      state.messages.length === 0
    ) {
      return false;
    }

    if (state.waiting_for_input === true) {
      return true;
    }

    const lastMessage = state.messages[state.messages.length - 1];
    if (!lastMessage) return false;

    if (
      lastMessage.content &&
      typeof lastMessage.content === 'string' &&
      lastMessage.content.includes('WAITING_FOR_HUMAN_INPUT:')
    ) {
      return true;
    }

    return lastMessage.additional_kwargs?.wait_for_input === true;
  }

  /**
   * Checks if the current state of a hybrid execution indicates completion
   * Examines the state object for markers in messages signifying end of execution
   * @param state - The current execution state object
   * @returns True if the execution is complete, false otherwise
   */
  public isExecutionComplete(state: any): boolean {
    if (
      !state ||
      !Array.isArray(state.messages) ||
      state.messages.length === 0
    ) {
      return false;
    }

    const lastMessage = state.messages[state.messages.length - 1];
    if (!lastMessage) return false;

    if (
      lastMessage.content &&
      typeof lastMessage.content === 'string' &&
      lastMessage.content.includes('FINAL ANSWER:')
    ) {
      return true;
    }

    return lastMessage.additional_kwargs?.final === true;
  }

  /**
   * Registers a new SnakAgent in the system
   * @param agent - The SnakAgent instance to register
   * @param metadata - Optional metadata for the agent (if not provided, uses agent config)
   */
  public registerSnakAgent(agent: SnakAgent, metadata?: any): void {
    const agentConfig = agent.getAgentConfig();
    const id = agentConfig.id;

    if (!id || id.trim() === '') {
      logger.warn(
        'SupervisorAgent: Invalid empty agent ID from config, using "snak-custom" instead'
      );
      const fallbackId = 'snak-custom';
      // Update the agent config with the fallback ID
      agentConfig.id = fallbackId;
    }

    const agentMetadata = {
      name: metadata?.name || agentConfig.name || id,
      description:
        metadata?.description ||
        agentConfig.description ||
        'A Snak interaction agent',
      group: metadata?.group || agentConfig.group || 'snak',
    };

    (agent as any).metadata = agentMetadata;
    const nodeName = this.generateNodeName(
      agentMetadata.name,
      agentMetadata.group
    );

    // Internal registration
    this.snakAgents[id] = agent;
    this.nodeNameToAgentId.set(nodeName, id);
    this.agentIdToNodeName.set(id, nodeName);

    logger.debug(
      `SupervisorAgent: Registered Snak agent "${id}" with node name "${nodeName}" and metadata: ${JSON.stringify(agentMetadata)}`
    );

    // Always update registry after registration
    this.updateAgentSelectorRegistry();

    logger.debug(
      `SupervisorAgent: Agent ${id} registered, WorkflowController refresh should be handled externally`
    );
  }

  /**
   * Registers multiple SnakAgents efficiently in batch mode
   * @param agents - Array of agents to register
   * @param refreshWorkflowAfter - Whether to refresh workflow after batch registration
   */
  public registerMultipleSnakAgents(
    agents: AgentRegistration[],
    refreshWorkflowAfter: boolean = true
  ): void {
    if (!agents || agents.length === 0) {
      logger.debug('SupervisorAgent: No agents to register in batch');
      return;
    }

    logger.debug(
      `SupervisorAgent: Starting batch registration of ${agents.length} agents`
    );

    const successfulRegistrations: string[] = [];
    const failedRegistrations: Array<{ id: string; error: string }> = [];

    // Register all agents without updating registry each time
    agents.forEach(({ agent, metadata }) => {
      try {
        const agentConfig = agent.getAgentConfig();
        const id = agentConfig.id;

        if (!id || id.trim() === '') {
          logger.warn(
            'SupervisorAgent: Invalid empty agent ID from config, using "snak-custom" instead'
          );
          const fallbackId = 'snak-custom';
          agentConfig.id = fallbackId;
        }

        const agentMetadata = {
          name: metadata?.name || agentConfig.name || id,
          description:
            metadata?.description ||
            agentConfig.description ||
            'A Snak interaction agent',
          group: metadata?.group || agentConfig.group || 'snak',
        };

        (agent as any).metadata = agentMetadata;
        const nodeName = this.generateNodeName(
          agentMetadata.name,
          agentMetadata.group
        );

        // Internal registration without registry update
        this.snakAgents[id] = agent;
        this.nodeNameToAgentId.set(nodeName, id);
        this.agentIdToNodeName.set(id, nodeName);

        successfulRegistrations.push(id);
        logger.debug(
          `SupervisorAgent: Registered Snak agent "${id}" with node name "${nodeName}" in batch`
        );
      } catch (error) {
        const agentConfig = agent.getAgentConfig();
        const id = agentConfig.id || 'unknown';
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        failedRegistrations.push({ id, error: errorMessage });
        logger.error(
          `SupervisorAgent: Failed to register agent ${id} in batch:`,
          error
        );
      }
    });

    // Update registry once after all registrations
    if (successfulRegistrations.length > 0) {
      logger.debug(
        `SupervisorAgent: Updating agent selector registry after batch registration`
      );
      this.updateAgentSelectorRegistry();
    }

    // Refresh WorkflowController if requested
    if (refreshWorkflowAfter && successfulRegistrations.length > 0) {
      logger.debug(
        `SupervisorAgent: Refreshing WorkflowController after batch registration`
      );
      // Use setTimeout to avoid synchronization issues
      setTimeout(async () => {
        try {
          await this.refreshWorkflowController(true); // Force full refresh
          logger.info(
            `SupervisorAgent: WorkflowController refresh completed after batch registration`
          );
        } catch (error) {
          logger.error(
            `SupervisorAgent: Error refreshing WorkflowController after batch registration:`,
            error
          );
        }
      }, 100).unref();
    }

    logger.info(
      `SupervisorAgent: Batch registration completed - ${successfulRegistrations.length} successful, ${failedRegistrations.length} failed`
    );

    if (failedRegistrations.length > 0) {
      logger.warn(
        `SupervisorAgent: Failed registrations:`,
        failedRegistrations
      );
    }
  }

  /**
   * Generates a node name in "name-group" format, ensuring uniqueness
   * @param name - The agent name
   * @param group - The agent group
   * @returns A unique node name in "name-group" format
   * @private
   */
  private generateNodeName(name: string, group: string): string {
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const sanitizedGroup = group.toLowerCase().replace(/[^a-z0-9]/g, '-');

    let baseName = `${sanitizedName}-${sanitizedGroup}`;
    let nodeName = baseName;
    let counter = 1;

    while (this.nodeNameToAgentId.has(nodeName)) {
      nodeName = `${baseName}-${counter}`;
      counter++;
    }

    return nodeName;
  }

  /**
   * Updates the registry for the agent selector with all available agents
   * @param options - Update options
   */
  public updateAgentSelectorRegistry(): void {
    if (!this.agentSelector) {
      logger.debug(
        'SupervisorAgent: AgentSelector not available, skipping registry update'
      );
      return;
    }

    const agentCount = Object.keys(this.snakAgents).length;
    const registry = OperatorRegistry.getInstance();
    const operatorAgents = registry.getAllAgents();
    const operatorAgentCount = Object.keys(operatorAgents).length;
    const totalAgentCount = agentCount + operatorAgentCount;

    if (totalAgentCount === 0) {
      logger.debug(
        'SupervisorAgent: No SnakAgents or operator agents registered, skipping registry update'
      );
      return;
    }

    const availableAgents: Record<string, IAgent> = {
      supervisor: this,
      ...operatorAgents,
    };

    Object.entries(this.snakAgents).forEach(([id, agent]) => {
      const nodeName = this.agentIdToNodeName.get(id);
      if (nodeName) {
        availableAgents[nodeName] = agent;
      } else {
        availableAgents[id] = agent;
      }
    });

    if (
      this.snakAgent &&
      !Object.values(this.snakAgents).includes(this.snakAgent)
    ) {
      const mainAgentId = 'snak-main';
      availableAgents[mainAgentId] = this.snakAgent;
    }

    this.agentSelector.setAvailableAgents(availableAgents);

    const finalAgentCount = Object.keys(availableAgents).length;
    logger.debug(
      `SupervisorAgent: Updated AgentSelector registry with ${finalAgentCount} agents (${agentCount} SnakAgents)`
    );
  }

  /**
   * Unregisters a SnakAgent from the system
   * @param id - The unique identifier of the agent to unregister
   */
  public unregisterSnakAgent(id: string): void {
    if (!this.snakAgents[id]) {
      logger.warn(
        `SupervisorAgent: Attempted to unregister non-existent agent "${id}"`
      );
      return;
    }

    const agent = this.snakAgents[id];

    if (agent && 'dispose' in agent && typeof agent.dispose === 'function') {
      try {
        agent.dispose();
      } catch (error) {
        logger.error(`Error disposing agent ${id}:`, error);
      }
    }

    const nodeName = this.agentIdToNodeName.get(id);
    if (nodeName) {
      this.nodeNameToAgentId.delete(nodeName);
      this.agentIdToNodeName.delete(id);
      logger.debug(
        `SupervisorAgent: Cleaned up node name mapping for "${id}" -> "${nodeName}"`
      );
    }

    delete this.snakAgents[id];
    logger.debug(`SupervisorAgent: Unregistered Snak agent "${id}"`);

    // Always update registry after unregistration
    this.updateAgentSelectorRegistry();

    logger.debug(
      `SupervisorAgent: Agent ${id} unregistered, WorkflowController refresh should be handled externally`
    );
  }

  /**
   * Gets the list of registered SnakAgents
   * @returns A copy of the registered SnakAgents record
   */
  public getRegisteredSnakAgents(): Record<string, SnakAgent> {
    return { ...this.snakAgents };
  }

  /**
   * Gets the number of registered SnakAgents
   * @returns The count of registered agents
   */
  public getRegisteredSnakAgentsCount(): number {
    return Object.keys(this.snakAgents).length;
  }

  /**
   * Checks if a SnakAgent is registered
   * @param id - The agent ID to check
   * @returns True if the agent is registered, false otherwise
   */
  public isSnakAgentRegistered(id: string): boolean {
    return id in this.snakAgents;
  }

  /**
   * Retrieves a SnakAgent by its ID
   * @param id - Optional agent ID. If not provided, returns the main SnakAgent
   * @returns The requested SnakAgent or null if not found
   */
  public getSnakAgent(id?: string): SnakAgent | null {
    if (id && this.snakAgents[id]) {
      return this.snakAgents[id];
    }

    if (!id && this.snakAgent) {
      return this.snakAgent;
    }

    return null;
  }

  /**
   * Gets the agent selector instance
   * @returns The AgentSelector instance or null if not initialized
   */
  public getAgentSelector(): AgentSelector | null {
    return this.agentSelector;
  }

  /**
   * Updates the WorkflowController with currently available agents
   * Uses intelligent refresh strategy based on current state
   * @param forceFullRefresh - If true, forces complete reinitialization
   * @throws {Error} Will throw an error if the refresh fails
   */
  public async refreshWorkflowController(
    forceFullRefresh: boolean = false
  ): Promise<void> {
    logger.debug(
      `SupervisorAgent: refreshWorkflowController called with forceFullRefresh=${forceFullRefresh}`
    );

    if (!this.workflowController && !this.workflowInitialized) {
      logger.debug(
        'SupervisorAgent: WorkflowController not initialized, performing initial setup'
      );
      const allowNoSnakAgents = Object.keys(this.snakAgents).length === 0;
      await this.initializeWorkflowController(allowNoSnakAgents);
      return;
    }

    try {
      const agentCount = Object.keys(this.snakAgents).length;
      logger.debug(
        `SupervisorAgent: Refreshing WorkflowController. Current agent count: ${agentCount}`
      );

      if (forceFullRefresh || agentCount > 0) {
        logger.info(
          `SupervisorAgent: Performing ${forceFullRefresh ? 'forced full' : 'standard'} WorkflowController refresh`
        );

        if (this.workflowController) {
          await this.workflowController.reset();
        }

        this.workflowInitialized = false;
        this.workflowController = null;

        const allowNoSnakAgents = agentCount === 0;
        await this.initializeWorkflowController(allowNoSnakAgents, true);

        const finalAgentCount = Object.keys(this.snakAgents).length;
        const nodeNames = Array.from(this.nodeNameToAgentId.keys());
        logger.info(
          `SupervisorAgent: WorkflowController refresh completed. Agents: ${finalAgentCount}, Node names: [${nodeNames.join(', ')}]`
        );
      } else {
        logger.info(
          'SupervisorAgent: Performing optimized WorkflowController refresh'
        );
        await this.refreshWorkflowOnly();
      }

      logger.info('SupervisorAgent: WorkflowController successfully refreshed');
    } catch (error) {
      logger.error(
        `SupervisorAgent: Failed to refresh WorkflowController: ${error}`
      );
      throw new Error(`Failed to refresh WorkflowController: ${error}`);
    }
  }

  /**
   * Gets the node name for a given agent ID
   * @param agentId - The agent ID
   * @returns The node name or null if not found
   */
  public getNodeNameForAgent(agentId: string): string | null {
    return this.agentIdToNodeName.get(agentId) || null;
  }

  /**
   * Gets the agent ID for a given node name
   * @param nodeName - The node name
   * @returns The agent ID or null if not found
   */
  public getAgentIdForNodeName(nodeName: string): string | null {
    return this.nodeNameToAgentId.get(nodeName) || null;
  }

  /**
   * Gets a SnakAgent by its node name
   * @param nodeName - The node name
   * @returns The SnakAgent or null if not found
   */
  public getSnakAgentByNodeName(nodeName: string): SnakAgent | null {
    const agentId = this.nodeNameToAgentId.get(nodeName);
    if (agentId && this.snakAgents[agentId]) {
      return this.snakAgents[agentId];
    }
    return null;
  }

  /**
   * Gets all node names for registered SnakAgents
   * @returns An array of node names
   */
  public getRegisteredNodeNames(): string[] {
    return Array.from(this.nodeNameToAgentId.keys());
  }

  /**
   * Gets the initialization status of the WorkflowController
   * @returns Object containing initialization status information
   */
  public getWorkflowStatus(): {
    initialized: boolean;
    isInitializing: boolean;
    agentCount: number;
    nodeNames: string[];
  } {
    return {
      initialized: this.workflowInitialized,
      isInitializing: this.isInitializing,
      agentCount: Object.keys(this.snakAgents).length,
      nodeNames: Array.from(this.nodeNameToAgentId.keys()),
    };
  }
}
