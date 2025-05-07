// agents/supervisor/supervisorAgent.ts
import {
  BaseAgent,
  AgentType,
  AgentMessage,
  IAgent,
} from '../core/baseAgent.js';
import { ModelSelectionAgent } from '../operators/modelSelectionAgent.js';
import { StarknetAgent, StarknetAgentConfig } from '../core/starknetAgent.js';
import { ToolsOrchestrator } from '../operators/toolOrchestratorAgent.js';
import { MemoryAgent } from '../operators/memoryAgent.js';
import { WorkflowController } from './worflowController.js';
import { DatabaseCredentials, logger, metrics } from '@snakagent/core';
import { HumanMessage, BaseMessage } from '@langchain/core/messages';
import { Tool } from '@langchain/core/tools';
import {
  AgentConfig,
  AgentMode,
  AGENT_MODES,
} from '../../config/jsonConfig.js';
import { RpcProvider } from 'starknet';

/**
 * Configuration for the SupervisorAgent.
 */
export interface SupervisorAgentConfig {
  modelsConfigPath: string;
  starknetConfig: StarknetAgentConfig;
  debug?: boolean;
}

/**
 * SupervisorAgent manages the orchestration of all system agents.
 * It acts as a central coordinator, initializing and managing the lifecycle
 * of various operator agents like ModelSelectionAgent, StarknetAgent,
 * ToolsOrchestrator, and MemoryAgent. It also handles the execution flow
 * through a WorkflowController.
 */
export class SupervisorAgent extends BaseAgent {
  private modelSelectionAgent: ModelSelectionAgent | null = null;
  private starknetAgent: StarknetAgent | null = null;
  private toolsOrchestrator: ToolsOrchestrator | null = null;
  private memoryAgent: MemoryAgent | null = null;
  private workflowController: WorkflowController | null = null;
  private config: SupervisorAgentConfig;
  private operators: Map<string, IAgent> = new Map();
  private debug: boolean = false;
  private executionDepth: number = 0;
  private checkpointEnabled: boolean = false; // TODO: This seems unused, consider removing or implementing its functionality.

  private static instance: SupervisorAgent | null = null;

  /**
   * Gets the singleton instance of SupervisorAgent.
   * @returns The SupervisorAgent instance, or null if not initialized.
   */
  public static getInstance(): SupervisorAgent | null {
    return SupervisorAgent.instance;
  }

  /**
   * Constructs a new SupervisorAgent.
   * @param configObject The configuration for the supervisor agent.
   */
  constructor(configObject: SupervisorAgentConfig) {
    super('supervisor', AgentType.SUPERVISOR);
    SupervisorAgent.instance = this;

    this.config = {
      modelsConfigPath: configObject.modelsConfigPath || '',
      starknetConfig: configObject.starknetConfig || {
        provider: {} as RpcProvider, // Default empty provider
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
   * Initializes the supervisor and all agents under its control.
   * This method sets up the model selection agent, memory agent (if enabled),
   * the main Starknet agent, the tools orchestrator, and the workflow controller.
   * It also initializes metrics.
   * @throws Will throw an error if initialization of any critical component fails.
   */
  public async init(): Promise<void> {
    const agentConfig = this.config.starknetConfig.agentConfig;
    logger.info('SupervisorAgent: Starting initialization');

    try {
      logger.debug('SupervisorAgent: Initializing ModelSelectionAgent...');
      this.modelSelectionAgent = new ModelSelectionAgent({
        debugMode: this.debug,
        useModelSelector: true,
        modelsConfigPath: this.config.modelsConfigPath,
      });
      await this.modelSelectionAgent.init();
      this.operators.set(this.modelSelectionAgent.id, this.modelSelectionAgent);
      logger.debug('SupervisorAgent: ModelSelectionAgent initialized');

      if (agentConfig?.memory?.enabled !== false) {
        logger.debug('SupervisorAgent: Initializing MemoryAgent...');
        this.memoryAgent = new MemoryAgent({
          shortTermMemorySize: agentConfig?.memory?.shortTermMemorySize || 15,
          maxIteration: agentConfig?.memory?.maxIteration,
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

      logger.debug('SupervisorAgent: Initializing StarknetAgent...');
      this.starknetAgent = new StarknetAgent({
        provider: this.config.starknetConfig.provider,
        accountPublicKey: this.config.starknetConfig.accountPublicKey,
        accountPrivateKey: this.config.starknetConfig.accountPrivateKey,
        signature: this.config.starknetConfig.signature,
        modelSelector: this.modelSelectionAgent,
        memory: this.config.starknetConfig.agentConfig?.memory,
        agentConfig: this.config.starknetConfig.agentConfig,
        db_credentials: this.config.starknetConfig.db_credentials,
      });
      await this.starknetAgent.init();
      logger.debug('SupervisorAgent: StarknetAgent initialized');

      logger.debug('SupervisorAgent: Initializing ToolsOrchestrator...');
      this.toolsOrchestrator = new ToolsOrchestrator({
        starknetAgent: this.starknetAgent,
        agentConfig: agentConfig,
        modelSelectionAgent: this.modelSelectionAgent,
      });
      await this.toolsOrchestrator.init();
      this.operators.set(this.toolsOrchestrator.id, this.toolsOrchestrator);
      logger.debug('SupervisorAgent: ToolsOrchestrator initialized');

      logger.debug('SupervisorAgent: Initializing WorkflowController...');
      await this.initializeWorkflowController();
      logger.debug('SupervisorAgent: WorkflowController initialized');

      this.initializeMetrics(agentConfig);

      logger.info('SupervisorAgent: All agents initialized successfully');
    } catch (error) {
      logger.error(`SupervisorAgent: Initialization failed: ${error}`);
      throw new Error(`SupervisorAgent initialization failed: ${error}`);
    }
  }

  /**
   * Initializes the WorkflowController with all available agents.
   * It gathers all initialized operator agents and the supervisor itself
   * to be managed by the workflow controller.
   * @throws Will throw an error if essential agents like the Starknet agent are missing.
   */
  private async initializeWorkflowController(): Promise<void> {
    logger.debug('SupervisorAgent: Initializing WorkflowController components');
    try {
      const allAgents: Record<string, IAgent> = {
        supervisor: this,
      };

      if (this.starknetAgent) {
        allAgents['snak'] = this.starknetAgent;
      } else {
        logger.warn(
          'SupervisorAgent: StarknetAgent is not initialized and will not be available to the WorkflowController.'
        );
      }

      if (this.modelSelectionAgent) {
        allAgents['model-selector'] = this.modelSelectionAgent;
      } else {
        logger.warn(
          'SupervisorAgent: ModelSelectionAgent is not initialized and will not be available to the WorkflowController.'
        );
      }

      if (this.memoryAgent) {
        allAgents['memory'] = this.memoryAgent;
      }

      if (this.toolsOrchestrator) {
        allAgents['tools'] = this.toolsOrchestrator;
      }

      if (!allAgents['snak']) {
        throw new Error(
          'WorkflowController requires at least the Starknet execution agent (snak).'
        );
      }

      const maxIterations = 15;
      const workflowTimeout = 60000; // 60 seconds
      const entryPoint = 'snak'; // Default entry point

      logger.debug(
        `SupervisorAgent: WorkflowController configured with maxIterations=${maxIterations}, timeout=${workflowTimeout}ms, entryPoint='${entryPoint}'`
      );

      this.workflowController = new WorkflowController({
        agents: allAgents,
        entryPoint,
        checkpointEnabled: this.checkpointEnabled,
        debug: this.debug,
        maxIterations,
        workflowTimeout,
      });

      await this.workflowController.init();
      logger.debug(
        'WorkflowController initialized with agents: ' +
          Object.keys(allAgents).join(', ')
      );
    } catch (error: any) {
      logger.error(
        `Failed to initialize workflow controller: ${error.message || error}`
      );
      throw error;
    }
  }

  /**
   * Initializes metrics collection for the agent.
   * @param agentConfig The configuration of the agent, used to determine agent name and mode for metrics.
   */
  private initializeMetrics(agentConfig: AgentConfig | null | undefined): void {
    if (!this.starknetAgent) {
      logger.warn(
        'SupervisorAgent: StarknetAgent not available, skipping metrics initialization.'
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
   * Executes a task based on the provided input.
   * This method manages the execution flow, including depth checking to prevent
   * infinite loops, input processing, memory context enrichment, and invoking
   * the WorkflowController. If execution depth is exceeded, it attempts a direct
   * execution via StarknetAgent.
   * @param input The user input, which can be a string, AgentMessage, or BaseMessage.
   * @param config Optional execution configuration.
   * @returns The final agent response.
   * @throws Will throw an error if the WorkflowController is not initialized.
   */
  public async execute(
    input: string | AgentMessage | BaseMessage,
    config?: Record<string, any>
  ): Promise<any> {
    this.executionDepth++;
    const depthIndent = '  '.repeat(this.executionDepth);
    logger.debug(
      `${depthIndent}SupervisorAgent[Depth:${this.executionDepth}]: Executing task`
    );

    if (this.executionDepth > 3) {
      logger.warn(
        `${depthIndent}SupervisorAgent: Maximum execution depth (${this.executionDepth}) reached. Attempting direct execution via StarknetAgent.`
      );
      try {
        if (this.starknetAgent) {
          const result = await this.starknetAgent.execute(
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
        return 'Maximum recursion depth reached. StarknetAgent not available for direct execution. Please try a simpler query.';
      } catch (error) {
        logger.error(
          `${depthIndent}SupervisorAgent: Error in direct execution attempt: ${error}`
        );
        this.executionDepth--;
        return `Error during forced direct execution: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    let message: BaseMessage;
    if (typeof input === 'string') {
      message = new HumanMessage(input);
    } else if (input instanceof BaseMessage) {
      message = input;
    } else if (
      typeof input === 'object' &&
      input !== null &&
      'content' in input // AgentMessage like
    ) {
      if (typeof input.content === 'string') {
        message = new HumanMessage(input.content);
      } else {
        try {
          message = new HumanMessage(JSON.stringify(input.content));
        } catch (e) {
          message = new HumanMessage('Unparseable structured content');
          logger.warn(
            `${depthIndent}SupervisorAgent: Error parsing AgentMessage content: ${e}`
          );
        }
      }
    } else {
      logger.warn(
        `${depthIndent}SupervisorAgent: Unrecognized input type: ${typeof input}. Wrapping as HumanMessage.`
      );
      message = new HumanMessage('Unrecognized input format');
    }

    if (config?.modelType) {
      logger.debug(
        `SupervisorAgent: Using provided model type: ${config.modelType}`
      );
    }

    if (
      this.config.starknetConfig.agentConfig?.memory?.enabled !== false &&
      this.memoryAgent
    ) {
      logger.debug(
        `${depthIndent}SupervisorAgent: Enriching message with memory context.`
      );
      message = await this.enrichWithMemoryContext(message);
    }

    if (!this.workflowController) {
      logger.error(
        `${depthIndent}SupervisorAgent: WorkflowController not initialized.`
      );
      this.executionDepth--;
      throw new Error('WorkflowController not initialized for execution.');
    }

    logger.debug(`${depthIndent}SupervisorAgent: Invoking WorkflowController.`);
    try {
      const result = await this.workflowController.execute(message, config);
      logger.debug(
        `${depthIndent}SupervisorAgent: WorkflowController execution finished.`
      );

      let formattedResponse =
        result instanceof BaseMessage
          ? result.content
          : this.formatResponse(result);

      logger.debug(
        `${depthIndent}SupervisorAgent: Execution complete. Returning formatted response.`
      );
      this.executionDepth--;
      return formattedResponse;
    } catch (error) {
      logger.error(
        `${depthIndent}SupervisorAgent: Error during WorkflowController execution: ${error}`
      );
      this.executionDepth--;
      return `An error occurred during processing: ${error instanceof Error ? error.message : String(error)}. Please try again.`;
    }
  }

  /**
   * Formats a response, primarily for logging and ensuring string output.
   * If the response is an object with a string `content` property, that content is formatted.
   * Otherwise, strings are returned as is, and other types are stringified.
   * @param response The response to format.
   * @returns The formatted response.
   */
  private formatResponse(response: any): string {
    if (typeof response === 'string') {
      return response
        .split('\n')
        .map((line: string) => (line.includes('•') ? `  ${line.trim()}` : line))
        .join('\n');
    }

    if (response && typeof response === 'object') {
      if (response.content && typeof response.content === 'string') {
        // Format content if it's a string
        response.content = response.content
          .split('\n')
          .map((line: string) =>
            line.includes('•') ? `  ${line.trim()}` : line
          )
          .join('\n');
        return response.content; // Return the formatted content string
      }
      // For other objects, or if content is not a string, stringify the whole object
      try {
        return JSON.stringify(response);
      } catch (e) {
        logger.warn(`Error stringifying response object: ${e}`);
        return 'Unparseable object response';
      }
    }
    // Fallback for other types (null, undefined, number, boolean)
    return String(response);
  }

  /**
   * Executes a task in autonomous mode using the StarknetAgent.
   * @returns The result of the autonomous execution.
   * @throws Will throw an error if the StarknetAgent is not available.
   */
  public async executeAutonomous(): Promise<any> {
    logger.debug('SupervisorAgent: Entering autonomous execution mode.');
    if (!this.starknetAgent) {
      logger.error(
        'SupervisorAgent: StarknetAgent is not available for autonomous execution.'
      );
      throw new Error(
        'StarknetAgent is not available for autonomous execution.'
      );
    }
    const result = await this.starknetAgent.execute_autonomous();
    logger.debug('SupervisorAgent: Autonomous execution finished.');
    return result;
  }

  /**
   * Gets an operator agent by its ID.
   * @param id The ID of the operator agent.
   * @returns The agent if found, otherwise undefined.
   */
  public getOperator(id: string): IAgent | undefined {
    return this.operators.get(id);
  }

  /**
   * Gets the StarknetAgent instance.
   * @returns The StarknetAgent instance, or null if not initialized.
   */
  public getStarknetAgent(): StarknetAgent | null {
    return this.starknetAgent;
  }

  /**
   * Gets the ToolsOrchestrator instance.
   * @returns The ToolsOrchestrator instance, or null if not initialized.
   */
  public getToolsOrchestrator(): ToolsOrchestrator | null {
    return this.toolsOrchestrator;
  }

  /**
   * Gets the MemoryAgent instance.
   * @returns The MemoryAgent instance, or null if not initialized.
   */
  public getMemoryAgent(): MemoryAgent | null {
    return this.memoryAgent;
  }

  /**
   * Gets the ModelSelectionAgent instance.
   * @returns The ModelSelectionAgent instance, or null if not initialized.
   */
  public getModelSelectionAgent(): ModelSelectionAgent | null {
    return this.modelSelectionAgent;
  }

  /**
   * Gets all available tools from the ToolsOrchestrator and MemoryAgent.
   * @returns An array of Tool instances.
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
   * Resets the SupervisorAgent and its components.
   * This includes resetting the WorkflowController and the execution depth counter.
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
   * Updates the operational mode of the SupervisorAgent.
   * This involves updating the agent's configuration and re-initializing
   * the WorkflowController to reflect the mode change.
   * @param mode The new AgentMode to set.
   */
  public async updateMode(mode: AgentMode): Promise<void> {
    logger.debug(`SupervisorAgent: Updating mode to: ${AGENT_MODES[mode]}`);

    const agentConfig = this.config.starknetConfig.agentConfig;
    if (agentConfig) {
      agentConfig.mode = mode;
    } else {
      logger.warn(
        `SupervisorAgent: Unable to update mode - agentConfig not found in starknetConfig.`
      );
      // Potentially initialize agentConfig here if it's a valid scenario
      // this.config.starknetConfig.agentConfig = { mode: mode, name: 'default', ... };
    }

    if (this.workflowController) {
      logger.debug(
        'SupervisorAgent: Re-initializing WorkflowController due to mode change.'
      );
      // It's important that initializeWorkflowController correctly uses the updated mode.
      // If WorkflowController's behavior depends on agentConfig.mode, this should be sufficient.
      // Consider if WorkflowController itself needs an updateMode method or if re-initialization is the correct approach.
      await this.workflowController.reset(); // Reset existing state
      await this.initializeWorkflowController(); // Re-initialize with new mode context
      logger.debug('SupervisorAgent: WorkflowController re-initialized.');
    } else {
      // If there's no workflowController, the mode change might be less impactful
      // or it might indicate an incomplete setup.
      logger.warn(
        'SupervisorAgent: Mode updated, but no WorkflowController was present to reconfigure.'
      );
    }
    logger.debug(
      `SupervisorAgent: Mode update to ${AGENT_MODES[mode]} complete.`
    );
  }

  /**
   * Releases resources held by the SupervisorAgent and its components.
   * This involves resetting the WorkflowController and nullifying references
   * to all operator agents.
   */
  public async dispose(): Promise<void> {
    logger.debug('SupervisorAgent: Disposing...');
    if (this.workflowController) {
      await this.workflowController.reset(); // Ensure graceful shutdown of workflow
      logger.debug('SupervisorAgent: WorkflowController reset during dispose.');
    }

    this.modelSelectionAgent = null;
    this.starknetAgent = null;
    this.toolsOrchestrator = null;
    this.memoryAgent = null;
    this.workflowController = null;
    this.operators.clear();
    logger.debug(
      'SupervisorAgent: Cleared agent references and operator map. Dispose complete.'
    );
  }

  /**
   * Enriches a message with relevant memory context if the MemoryAgent is enabled.
   * It retrieves memories relevant to the message and appends them to the message's
   * `additional_kwargs.memory_context`.
   * @param message The BaseMessage to enrich.
   * @returns The enriched message, or the original message if MemoryAgent is unavailable or no memories are found.
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
        this.config.starknetConfig.agentConfig?.chat_id || 'default_chat'
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
      return message; // Return original message on error
    }
  }

  /**
   * Starts a hybrid execution flow with an initial input.
   * This delegates to the StarknetAgent's hybrid execution capabilities.
   * @param initialInput The initial input string to start the hybrid process.
   * @returns An object containing the initial state and the thread ID for the execution.
   * @throws Will throw an error if the StarknetAgent is not available or if the execution fails to start.
   */
  public async startHybridExecution(
    initialInput: string
  ): Promise<{ state: any; threadId: string }> {
    logger.debug('SupervisorAgent: Starting hybrid execution.');
    if (!this.starknetAgent) {
      logger.error(
        'SupervisorAgent: StarknetAgent is not available for hybrid execution.'
      );
      throw new Error('StarknetAgent is not available for hybrid execution.');
    }

    const result = await this.starknetAgent.execute_hybrid(initialInput);

    if (!result || typeof result !== 'object') {
      logger.error(
        'SupervisorAgent: Failed to start hybrid execution - invalid result from StarknetAgent.'
      );
      throw new Error(
        'Failed to start hybrid execution: received invalid result from StarknetAgent.'
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
      state: resultObj.state || resultObj, // Use the whole result as state if 'state' property is missing
      threadId,
    };
  }

  /**
   * Provides subsequent input to a paused hybrid execution.
   * This delegates to the StarknetAgent to resume the hybrid flow.
   * @param input The human input string to provide to the paused execution.
   * @param threadId The thread ID of the paused hybrid execution.
   * @returns The updated state after processing the input.
   * @throws Will throw an error if the StarknetAgent is not available.
   */
  public async provideHybridInput(
    input: string,
    threadId: string
  ): Promise<any> {
    logger.debug(
      `SupervisorAgent: Providing input to hybrid execution (thread: ${threadId})`
    );
    if (!this.starknetAgent) {
      logger.error(
        'SupervisorAgent: StarknetAgent is not available to provide hybrid input.'
      );
      throw new Error(
        'StarknetAgent is not available to provide hybrid input.'
      );
    }
    return this.starknetAgent.resume_hybrid(input, threadId);
  }

  /**
   * Checks if the current state of a hybrid execution is waiting for human input.
   * It examines the state object, specifically looking for flags or markers in messages
   * that indicate a waiting state.
   * @param state The current execution state object.
   * @returns True if the execution is waiting for input, false otherwise.
   */
  public isWaitingForInput(state: any): boolean {
    if (
      !state ||
      !Array.isArray(state.messages) ||
      state.messages.length === 0
    ) {
      return false;
    }

    // Direct flag check
    if (state.waiting_for_input === true) {
      return true;
    }

    const lastMessage = state.messages[state.messages.length - 1];
    if (!lastMessage) return false;

    // Check message content for specific markers
    if (
      lastMessage.content &&
      typeof lastMessage.content === 'string' &&
      lastMessage.content.includes('WAITING_FOR_HUMAN_INPUT:')
    ) {
      return true;
    }

    // Check additional_kwargs for a waiting flag
    if (
      lastMessage.additional_kwargs &&
      lastMessage.additional_kwargs.wait_for_input === true
    ) {
      return true;
    }

    return false;
  }

  /**
   * Checks if the current state of a hybrid execution indicates completion.
   * It examines the state object, looking for markers in messages that signify
   * the end of the execution.
   * @param state The current execution state object.
   * @returns True if the execution is complete, false otherwise.
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

    // Check message content for final answer marker
    if (
      lastMessage.content &&
      typeof lastMessage.content === 'string' &&
      lastMessage.content.includes('FINAL ANSWER:')
    ) {
      return true;
    }

    // Check additional_kwargs for a final flag
    if (
      lastMessage.additional_kwargs &&
      lastMessage.additional_kwargs.final === true
    ) {
      return true;
    }

    return false;
  }
}
