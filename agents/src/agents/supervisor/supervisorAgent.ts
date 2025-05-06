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
import { JsonConfig } from '../../config/jsonConfig.js';
import { RpcProvider } from 'starknet';

/**
 * Configuration for the supervisor agent
 */
export interface SupervisorAgentConfig {
  modelsConfigPath: string;
  starknetConfig: StarknetAgentConfig;
  debug?: boolean;
}

/**
 * Supervisor agent that manages orchestration of all system agents
 */
export class SupervisorAgent extends BaseAgent {
  private modelSelectionAgent: ModelSelectionAgent | null = null;
  private starknetAgent: StarknetAgent | null = null;
  private toolsOrchestrator: ToolsOrchestrator | null = null;
  private memoryAgent: MemoryAgent | null = null;
  private workflowController: WorkflowController | null = null;
  private config: SupervisorAgentConfig = {
    modelsConfigPath: '',
    starknetConfig: {
      provider: {} as RpcProvider,
      accountPublicKey: '',
      accountPrivateKey: '',
      signature: '',
      db_credentials: {} as DatabaseCredentials,
    },
  };
  private operators: Map<string, IAgent> = new Map();
  private debug: boolean = false;
  private executionDepth: number = 0; // Track execution depth
  private checkpointEnabled: boolean = false;
  // Store the original config as a static property
  // Static instance for singleton pattern
  private static instance: SupervisorAgent | null = null;

  /**
   * Get the singleton instance of SupervisorAgent
   * @returns The SupervisorAgent instance or null if not initialized
   */
  public static getInstance(): SupervisorAgent | null {
    return SupervisorAgent.instance;
  }

  constructor(configObject: SupervisorAgentConfig) {
    super('supervisor', AgentType.SUPERVISOR);

    // Store instance for singleton pattern
    SupervisorAgent.instance = this;

    // Directly assign the provided config object
    this.config = {
      modelsConfigPath: configObject.modelsConfigPath || '',
      starknetConfig: configObject.starknetConfig || {},
      debug: !!configObject.debug,
    };

    // Set debug flag
    this.debug = !!this.config.debug;
    logger.debug('SupervisorAgent: Initializing');
  }

  /**
   * Initializes the supervisor and all agents under its control
   */
  public async init(): Promise<void> {
    const agentConfig = this.config.starknetConfig.agentConfig;
    logger.debug('SupervisorAgent: Starting initialization');

    try {
      // 1. Initialize model selection agent
      logger.debug('SupervisorAgent: Initializing ModelSelectionAgent...');
      this.modelSelectionAgent = new ModelSelectionAgent({
        debugMode: this.debug,
        useMetaSelection: true,
        modelsConfigPath: this.config.modelsConfigPath,
      });
      await this.modelSelectionAgent.init();
      this.operators.set(this.modelSelectionAgent.id, this.modelSelectionAgent);
      logger.debug('SupervisorAgent: ModelSelectionAgent initialized');

      // 2. Initialize memory agent if needed
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
        logger.debug(
          'SupervisorAgent: MemoryAgent initialization skipped (disabled in config)'
        );
      }

      // 3. Initialize main agent (Starknet)
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

      // 4. Initialize tools orchestrator
      logger.debug('SupervisorAgent: Initializing ToolsOrchestrator...');
      this.toolsOrchestrator = new ToolsOrchestrator({
        starknetAgent: this.starknetAgent,
        agentConfig: agentConfig,
        modelSelectionAgent: this.modelSelectionAgent,
      });
      await this.toolsOrchestrator.init();
      this.operators.set(this.toolsOrchestrator.id, this.toolsOrchestrator);
      logger.debug('SupervisorAgent: ToolsOrchestrator initialized');

      // 5. Initialize workflow controller
      logger.debug('SupervisorAgent: Initializing WorkflowController...');
      await this.initializeWorkflowController();
      logger.debug('SupervisorAgent: WorkflowController initialized');

      // 6. Enable metrics
      this.initializeMetrics(agentConfig);

      logger.info('SupervisorAgent: All agents initialized successfully');
    } catch (error) {
      logger.error(`SupervisorAgent: Initialization failed: ${error}`);
      throw new Error(`SupervisorAgent initialization failed: ${error}`);
    }
  }

  /**
   * Initializes the workflow controller
   */
  private async initializeWorkflowController(): Promise<void> {
    logger.debug('SupervisorAgent: Entering initializeWorkflowController');
    try {
      // Gather all available agents
      const allAgents: Record<string, IAgent> = {
        supervisor: this,
      };

      // Add all agents with verification
      if (this.starknetAgent) {
        allAgents['snak'] = this.starknetAgent;
        logger.debug(
          `SupervisorAgent: Added starknet agent: ${!!this.starknetAgent}`
        );
      } else {
        logger.warn('SupervisorAgent: starknetAgent is not initialized');
      }

      if (this.modelSelectionAgent) {
        allAgents['model-selector'] = this.modelSelectionAgent;
        logger.debug(
          `SupervisorAgent: Added model-selector agent: ${!!this.modelSelectionAgent}`
        );
      } else {
        logger.warn('SupervisorAgent: modelSelectionAgent is not initialized');
      }

      if (this.memoryAgent) {
        allAgents['memory'] = this.memoryAgent;
        logger.debug('SupervisorAgent: Added memory agent');
      }

      if (this.toolsOrchestrator) {
        allAgents['tools'] = this.toolsOrchestrator;
        logger.debug('SupervisorAgent: Added tools orchestrator');
      }

      // Check that we have at least the required agents
      if (Object.keys(allAgents).length < 2 || !allAgents['snak']) {
        throw new Error(
          'Workflow requires at least supervisor and starknet execution agent'
        );
      }

      // Improved configuration
      const maxIterations = 15; // Use default directly
      const workflowTimeout = 60000; // Use default directly

      logger.debug(
        `SupervisorAgent: WorkflowController will be configured with maxIterations=${maxIterations}, timeout=${workflowTimeout}ms`
      );

      // Determine ideal entry point based on configuration
      const entryPoint = 'snak';
      logger.debug(`SupervisorAgent: Using '${entryPoint}' as entry point`);

      // Create and initialize controller
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
   * Initializes metrics
   */
  private initializeMetrics(agentConfig: JsonConfig | null | undefined): void {
    logger.debug('SupervisorAgent: Initializing metrics');
    if (!this.starknetAgent) return;

    const agentName = agentConfig?.name || 'agent';
    metrics.metricsAgentConnect(
      agentName,
      this.config.starknetConfig.agentConfig?.mode?.autonomous
        ? 'autonomous'
        : 'interactive'
    );
  }

  /**
   * Executes the task requested by the user
   * @param input User input
   * @param config Execution configuration
   * @returns Final agent response
   */
  public async execute(
    input: string | AgentMessage | BaseMessage,
    config?: Record<string, any>
  ): Promise<any> {
    this.executionDepth++;
    const depthIndent = '  '.repeat(this.executionDepth);
    logger.debug(
      `${depthIndent}SupervisorAgent[Depth:${this.executionDepth}]: Entering execute`
    );

    // Limit execution depth to prevent infinite loops
    if (this.executionDepth > 3) {
      logger.warn(
        `${depthIndent}SupervisorAgent: Maximum execution depth (${this.executionDepth}) reached, forcing direct execution`
      );

      try {
        // Force direct execution with starknet, bypassing workflow
        if (this.starknetAgent) {
          logger.debug(
            `${depthIndent}SupervisorAgent: Forcing direct execution with StarknetAgent`
          );
          const result = await this.starknetAgent.execute(
            typeof input === 'string'
              ? input
              : input instanceof BaseMessage
                ? input
                : (input as AgentMessage).content,
            config
          );

          // Wrap result and mark as final
          const finalResult =
            result instanceof BaseMessage
              ? result.content
              : typeof result === 'string'
                ? result
                : JSON.stringify(result);

          logger.debug(
            `${depthIndent}SupervisorAgent: Leaving execute with direct execution result`
          );
          this.executionDepth--;
          return finalResult;
        }

        // If no starknetAgent, return error message
        this.executionDepth--;
        return 'Maximum recursion depth reached. Please try again with a simpler query.';
      } catch (error) {
        logger.error(
          `${depthIndent}SupervisorAgent: Error in direct execution: ${error}`
        );
        this.executionDepth--;
        return `Error occurred during forced direct execution: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    logger.debug(`${depthIndent}SupervisorAgent: Processing input...`);
    let message: string | HumanMessage;

    if (typeof input === 'string') {
      logger.debug(`${depthIndent}SupervisorAgent: Input is a string`);
      message = new HumanMessage(input);
    } else if (input instanceof BaseMessage) {
      logger.debug(
        `${depthIndent}SupervisorAgent: Input is a BaseMessage: ${input.constructor.name}`
      );
      message = input;
    } else if (
      typeof input === 'object' &&
      input !== null &&
      'content' in input
    ) {
      logger.debug(`${depthIndent}SupervisorAgent: Input is an AgentMessage`);
      if (typeof input.content === 'string') {
        message = new HumanMessage(input.content);
      } else {
        try {
          const contentStr = JSON.stringify(input.content);
          message = new HumanMessage(contentStr);
        } catch (e) {
          message = new HumanMessage('Unparseable content');
          logger.warn(`Error parsing agent message content: ${e}`);
        }
      }
    } else {
      logger.warn(
        `${depthIndent}SupervisorAgent: Unrecognized input type: ${typeof input}`
      );
      message = new HumanMessage('Unrecognized input format');
    }

    if (config?.modelType) {
      logger.debug(
        `SupervisorAgent: Using provided model type: ${config.modelType}`
      );
    }

    // Enrich with memory context if enabled
    if (
      this.config.starknetConfig.agentConfig?.memory?.enabled !== false &&
      this.memoryAgent
    ) {
      logger.debug(
        `${depthIndent}SupervisorAgent: Enriching message with memory context`
      );
      message = await this.enrichWithMemoryContext(message);
    } else {
      logger.debug(
        `${depthIndent}SupervisorAgent: Memory enrichment skipped (disabled or agent unavailable)`
      );
    }

    // Check if workflowController is initialized
    if (!this.workflowController) {
      logger.error(
        `${depthIndent}SupervisorAgent: Workflow controller not initialized`
      );
      this.executionDepth--;
      throw new Error('WorkflowController not initialized');
    }

    // Execute workflow
    logger.debug(
      `${depthIndent}SupervisorAgent: Invoking workflow controller...`
    );
    try {
      const result = await this.workflowController.execute(message, config);
      logger.debug(
        `${depthIndent}SupervisorAgent: Workflow controller execution finished`
      );

      // Extract message content or format response
      let formattedResponse;
      if (result instanceof BaseMessage) {
        // Directly extract message content
        formattedResponse = result.content;
      } else {
        // For other response types, try to format if possible
        try {
          formattedResponse = this.formatResponse(result);
        } catch (formatError) {
          logger.warn(
            `Error formatting response: ${formatError}. Returning raw response.`
          );
          formattedResponse =
            typeof result === 'string' ? result : JSON.stringify(result);
        }
      }

      logger.debug(
        `${depthIndent}SupervisorAgent: Formatted response ready to return`
      );

      // Return formatted response
      logger.debug(`${depthIndent}SupervisorAgent: Leaving execute normally`);
      this.executionDepth--;
      return formattedResponse;
    } catch (error) {
      logger.error(
        `${depthIndent}SupervisorAgent: Error during workflow execution: ${error}`
      );
      this.executionDepth--;

      // Return simple error message instead of AIMessage object
      return `An error occurred during processing: ${error instanceof Error ? error.message : String(error)}. Please try again.`;
    }
  }

  /**
   * Formats a response for logging
   */
  private formatResponse(response: any): any {
    // Check if response is a string
    if (typeof response === 'string') {
      return response
        .split('\n')
        .map((line: string) => (line.includes('•') ? `  ${line.trim()}` : line))
        .join('\n');
    }

    // If it's an AIMessage or other object, return as is
    if (response && typeof response === 'object') {
      // If object has a content property that's a string, format that content
      if (response.content && typeof response.content === 'string') {
        response.content = response.content
          .split('\n')
          .map((line: string) =>
            line.includes('•') ? `  ${line.trim()}` : line
          )
          .join('\n');
      }
      return response;
    }

    // Fallback for any other type
    return response;
  }

  /**
   * Executes a request in autonomous mode
   */
  public async executeAutonomous(): Promise<any> {
    logger.debug('SupervisorAgent: Entering executeAutonomous');
    if (!this.starknetAgent) {
      logger.error(
        'SupervisorAgent: Starknet agent is not available for autonomous execution.'
      );
      throw new Error('Starknet agent is not available');
    }
    logger.debug('SupervisorAgent: Calling starknetAgent.execute_autonomous()');
    const result = await this.starknetAgent.execute_autonomous();
    logger.debug('SupervisorAgent: Leaving executeAutonomous');
    return result;
  }

  /**
   * Gets an operator by ID
   */
  public getOperator(id: string): IAgent | undefined {
    return this.operators.get(id);
  }

  /**
   * Gets the Starknet agent
   */
  public getStarknetAgent(): StarknetAgent | null {
    return this.starknetAgent;
  }

  /**
   * Gets the tools orchestrator
   */
  public getToolsOrchestrator(): ToolsOrchestrator | null {
    return this.toolsOrchestrator;
  }

  /**
   * Gets the memory agent
   */
  public getMemoryAgent(): MemoryAgent | null {
    return this.memoryAgent;
  }

  /**
   * Gets the model selection agent
   */
  public getModelSelectionAgent(): ModelSelectionAgent | null {
    return this.modelSelectionAgent;
  }

  /**
   * Gets all available tools
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
   * Resets the supervisor and its agents
   */
  public async reset(): Promise<void> {
    logger.debug('SupervisorAgent: Entering reset');
    if (this.workflowController) {
      logger.debug('SupervisorAgent: Resetting workflow controller...');
      await this.workflowController.reset();
      logger.debug('SupervisorAgent: Workflow controller reset complete.');
    } else {
      logger.debug('SupervisorAgent: No workflow controller to reset.');
    }
    this.executionDepth = 0; // Reset execution depth
    logger.debug('SupervisorAgent: Leaving reset');
  }

  /**
   * Updates supervisor operation mode
   */
  public async updateMode(mode: 'interactive' | 'autonomous'): Promise<void> {
    logger.debug(`SupervisorAgent: Entering updateMode with mode: ${mode}`);

    // Get the current config
    const agentConfig = this.config.starknetConfig.agentConfig;

    // Safely update the mode if agentConfig exists
    if (agentConfig && agentConfig.mode) {
      agentConfig.mode.interactive = mode === 'interactive';
      agentConfig.mode.autonomous = mode === 'autonomous';
    } else {
      logger.warn(
        `SupervisorAgent: Unable to update mode - agentConfig or mode not initialized`
      );
    }

    logger.debug(`SupervisorAgent: Set agentMode to ${mode}`);

    // Reconfigure workflow
    if (this.workflowController) {
      logger.debug(
        'SupervisorAgent: Resetting and re-initializing workflow controller due to mode change...'
      );
      await this.workflowController.reset();
      await this.initializeWorkflowController();
      logger.debug('SupervisorAgent: Workflow controller re-initialized.');
    } else {
      logger.debug('SupervisorAgent: No workflow controller to reconfigure.');
    }
    logger.debug('SupervisorAgent: Leaving updateMode');
  }

  /**
   * Releases resources
   */
  public async dispose(): Promise<void> {
    logger.debug('SupervisorAgent: Entering dispose');

    // Reset workflow
    if (this.workflowController) {
      logger.debug(
        'SupervisorAgent: Resetting workflow controller during dispose...'
      );
      await this.workflowController.reset();
      logger.debug('SupervisorAgent: Workflow controller reset complete.');
    }

    // Other cleanup operations if needed
    this.modelSelectionAgent = null;
    this.starknetAgent = null;
    this.toolsOrchestrator = null;
    this.memoryAgent = null;
    this.workflowController = null;
    this.operators.clear();
    logger.debug(
      'SupervisorAgent: Cleared agent references and operators map.'
    );

    logger.debug('SupervisorAgent: Leaving dispose');
  }

  /**
   * Retrieves and enriches memory context
   */
  private async enrichWithMemoryContext(
    message: BaseMessage
  ): Promise<BaseMessage> {
    logger.debug('SupervisorAgent: Entering enrichWithMemoryContext');
    if (!this.memoryAgent) {
      logger.debug(
        'SupervisorAgent: Memory agent not available, skipping enrichment.'
      );
      return message;
    }

    try {
      // Retrieve relevant memories
      logger.debug('SupervisorAgent: Retrieving relevant memories...');
      const memories = await this.memoryAgent.retrieveRelevantMemories(
        message,
        this.config.starknetConfig.agentConfig?.chat_id || 'default_user'
      );
      logger.debug(`SupervisorAgent: Retrieved ${memories.length} memories.`);

      if (memories.length === 0) {
        logger.debug('SupervisorAgent: No relevant memories found.');
        return message; // No relevant memories
      }

      // Format memories for context
      const memoryContext = this.memoryAgent.formatMemoriesForContext(memories);
      logger.debug(
        `SupervisorAgent: Formatted memory context: "${memoryContext.substring(0, 100)}..."`
      );

      // Create new message with memory context
      const originalContent =
        typeof message.content === 'string'
          ? message.content
          : JSON.stringify(message.content);

      const newMessage = new HumanMessage({
        content: originalContent,
        additional_kwargs: {
          ...message.additional_kwargs,
          memory_context: memoryContext,
        },
      });
      logger.debug('SupervisorAgent: Created new message with memory context.');
      return newMessage;
    } catch (error) {
      logger.error(`Error enriching with memory context: ${error}`);
      return message; // In case of error, return original message
    }
  }
}
