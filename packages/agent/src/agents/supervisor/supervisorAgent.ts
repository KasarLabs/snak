// agents/supervisor/supervisorAgent.ts
import {
  BaseAgent,
  AgentType,
  AgentMessage,
  IAgent,
} from '../core/baseAgent.js';
import { ModelSelectionAgent } from '../operators/modelSelectionAgent.js';
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
import { AgentSelectionAgent } from '../operators/agentSelectionAgent.js';
import { OperatorRegistry } from '../operators/operatorRegistry.js';

/**
 * Configuration for the SupervisorAgent.
 */
export interface SupervisorAgentConfig {
  modelsConfig: ModelsConfig;
  starknetConfig: SnakAgentConfig;
  debug?: boolean;
}

/**
 * SupervisorAgent manages the orchestration of all system agents.
 * It acts as a central coordinator, initializing and managing the lifecycle
 * of various operator agents like ModelSelectionAgent, SnakAgent,
 * ToolsOrchestrator, and MemoryAgent. It also handles the execution flow
 * through a WorkflowController.
 */
export class SupervisorAgent extends BaseAgent {
  private modelSelectionAgent: ModelSelectionAgent | null = null;
  private snakAgent: SnakAgent | null = null;
  private toolsOrchestrator: ToolsOrchestrator | null = null;
  private memoryAgent: MemoryAgent | null = null;
  private workflowController: WorkflowController | null = null;
  private config: SupervisorAgentConfig;
  private operators: Map<string, IAgent> = new Map();
  private debug: boolean = false;
  private executionDepth: number = 0;
  private checkpointEnabled: boolean = false; // TODO: This seems unused, consider removing or implementing its functionality.
  private agentSelectionAgent: AgentSelectionAgent | null = null;
  private snakAgents: Record<string, SnakAgent> = {};

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
      modelsConfig: configObject.modelsConfig || '',
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
        modelsConfig: this.config.modelsConfig,
      });
      await this.modelSelectionAgent.init();
      this.operators.set(this.modelSelectionAgent.id, this.modelSelectionAgent);
      logger.debug('SupervisorAgent: ModelSelectionAgent initialized');

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

      logger.debug('SupervisorAgent: Initializing ToolsOrchestrator...');
      this.toolsOrchestrator = new ToolsOrchestrator({
        // Passer null en tant que snakAgent - ToolsOrchestrator doit gérer ce cas
        snakAgent: null,
        agentConfig: agentConfig,
        modelSelectionAgent: this.modelSelectionAgent,
      });
      await this.toolsOrchestrator.init();
      this.operators.set(this.toolsOrchestrator.id, this.toolsOrchestrator);
      logger.debug('SupervisorAgent: ToolsOrchestrator initialized');

      logger.debug('SupervisorAgent: Initializing AgentSelectionAgent...');
      this.agentSelectionAgent = new AgentSelectionAgent({
        availableAgents: {}, // Sera mis à jour après l'initialisation de tous les agents
        modelSelector: this.modelSelectionAgent,
        debug: this.debug,
      });
      await this.agentSelectionAgent.init();
      this.operators.set(this.agentSelectionAgent.id, this.agentSelectionAgent);
      logger.debug('SupervisorAgent: AgentSelectionAgent initialized');

      // Mettre à jour les agents disponibles pour l'agent de sélection
      this.updateAgentSelectionAgentRegistry();

      logger.debug('SupervisorAgent: Initializing WorkflowController...');
      // Initialiser le workflow controller même sans agents Starknet, ils seront ajoutés plus tard
      await this.initializeWorkflowController(true);
      logger.debug('SupervisorAgent: WorkflowController initialized');

      // Initialiser les métriques uniquement si nécessaire
      if (Object.keys(this.snakAgents).length > 0) {
        this.initializeMetrics(agentConfig);
      } else {
        logger.debug(
          'SupervisorAgent: Metrics initialization skipped (no agents registered)'
        );
      }

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
   * @param allowNoSnakAgents Si true, permet l'initialisation même s'il n'y a pas d'agent Starknet
   * @throws Will throw an error if essential agents like the Starknet agent are missing.
   */
  private async initializeWorkflowController(
    allowNoSnakAgents: boolean = false
  ): Promise<void> {
    logger.debug('SupervisorAgent: Initializing WorkflowController components');
    try {
      const allAgents: Record<string, IAgent> = {
        supervisor: this,
      };

      // Ajouter tous les agents Snak disponibles
      Object.entries(this.snakAgents).forEach(([id, agent]) => {
        allAgents[id] = agent;
      });

      // Si snakAgent existe et n'est pas déjà dans snakAgents, l'ajouter avec un ID spécifique
      if (
        this.snakAgent &&
        !Object.values(this.snakAgents).includes(this.snakAgent)
      ) {
        allAgents['snak-main'] = this.snakAgent;
        logger.debug(
          'SupervisorAgent: Added main snakAgent to workflow as "snak-main"'
        );
      }

      // Ajouter tous les agents opérateurs enregistrés
      const registry = OperatorRegistry.getInstance();
      const operatorAgents = registry.getAllAgents();
      Object.entries(operatorAgents).forEach(([id, agent]) => {
        allAgents[id] = agent;
      });

      // Vérifier si au moins un agent d'exécution est disponible
      const snakAgentsCount = Object.keys(allAgents).filter(
        (id) =>
          id.startsWith('snak-') ||
          (allAgents[id] && allAgents[id].type === AgentType.SNAK)
      ).length;

      if (snakAgentsCount === 0 && !allowNoSnakAgents) {
        throw new Error(
          'WorkflowController requires at least one Starknet execution agent.'
        );
      } else if (snakAgentsCount === 0) {
        logger.warn(
          'WorkflowController: No Starknet agents available yet, but proceeding with initialization anyway'
        );
      } else {
        logger.info(
          `WorkflowController: Found ${snakAgentsCount} Starknet execution agents available`
        );
      }

      const maxIterations = 15;
      const workflowTimeout = 60000; // 60 seconds

      // Utiliser agent-selector comme point d'entrée s'il est disponible
      const entryPoint = allAgents['agent-selector']
        ? 'agent-selector'
        : 'supervisor';

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

      // Mettre à jour l'agent de sélection avec la liste complète des agents
      if (this.agentSelectionAgent) {
        this.agentSelectionAgent.setAvailableAgents(allAgents);
      }

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
   * Executes a task based on the provided input.
   * This method manages the execution flow, including depth checking to prevent
   * infinite loops, input processing, memory context enrichment, and invoking
   * the WorkflowController or returning a directive if called as a workflow node.
   * @param input The user input, which can be a string, AgentMessage, or BaseMessage or array of BaseMessages.
   * @param config Optional execution configuration, may include `isWorkflowNodeCall: true` if called by WorkflowController.
   * @returns The final agent response or a directive message for the workflow.
   * @throws Will throw an error if the WorkflowController is not initialized when needed.
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

    // Safeguard against extreme recursion within the supervisor itself, though primary loop control is via call paths.
    if (this.executionDepth > 5) {
      logger.warn(
        `${depthIndent}SupervisorAgent: Critical execution depth (${this.executionDepth}) reached. Attempting fallback.`
      );

      try {
        // Try to execute with a fallback agent if available
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

        // If no fallback agent is available, return error message
        this.executionDepth--;
        return new AIMessage({
          content:
            'Error: Supervisor critical depth reached. StarknetAgent not available for direct execution. Please try a simpler query.',
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

    let currentMessage: BaseMessage;
    const originalUserQueryFromConfig = config?.originalUserQuery as
      | string
      | undefined;

    // Determine the primary message to process for the current step
    if (originalUserQueryFromConfig && isNodeCall) {
      // Prioritize original query if supervisor is re-evaluating as a node
      currentMessage = new HumanMessage(originalUserQueryFromConfig);
      logger.debug(
        `${depthIndent}SupervisorAgent: Using originalUserQuery from config for ${callPath} processing: \"${originalUserQueryFromConfig}\"`
      );
    } else if (Array.isArray(input) && input.length > 0) {
      // Typically from state.messages
      const lastMsg = input[input.length - 1];
      if (lastMsg instanceof BaseMessage) {
        currentMessage = lastMsg;
      } else if (lastMsg && typeof (lastMsg as any).content === 'string') {
        currentMessage = new HumanMessage((lastMsg as any).content);
      } else if (lastMsg) {
        currentMessage = new HumanMessage(JSON.stringify(lastMsg));
      } else {
        currentMessage = new HumanMessage(
          'Empty or invalid last message in array'
        );
      }
      logger.debug(
        `${depthIndent}SupervisorAgent: Processing last message from array for ${callPath}. Content (truncated): \"${String(currentMessage.content).substring(0, 100)}...\"`
      );
    } else if (typeof input === 'string') {
      currentMessage = new HumanMessage(input);
    } else if (input instanceof BaseMessage) {
      currentMessage = input;
    } else if (
      typeof input === 'object' &&
      input !== null &&
      'content' in input
    ) {
      // AgentMessage like
      currentMessage = new HumanMessage(
        typeof input.content === 'string'
          ? input.content
          : JSON.stringify(input.content)
      );
    } else {
      logger.warn(
        `${depthIndent}SupervisorAgent: Unrecognized input type for ${callPath}: ${typeof input}. Wrapping as HumanMessage 'Unrecognized input format'.`
      );
      currentMessage = new HumanMessage('Unrecognized input format');
    }

    // Enrich with memory context if enabled
    if (
      this.config.starknetConfig.agentConfig?.memory?.enabled !== false &&
      this.memoryAgent
    ) {
      logger.debug(
        `${depthIndent}SupervisorAgent: Enriching message with memory context for ${callPath}.`
      );
      currentMessage = await this.enrichWithMemoryContext(currentMessage);
    }

    // ***** CORE LOGIC SPLIT BASED ON CALL PATH *****
    if (isNodeCall) {
      // ----------- NODE CALL PATH -----------
      // Supervisor is acting as a node within the workflow.
      // It should decide the next step and return a directive AIMessage.
      logger.debug(
        `${depthIndent}SupervisorAgent (${callPath}): Determining next action based on query: \"${String(currentMessage.content).substring(0, 150)}...\"`
      );

      let responseContent = '';
      let nextAgent: string | undefined = undefined;
      let isFinal = false;
      let toolCallsFromSelection: any[] | undefined = undefined;
      let needsClarification = false;

      // Check if there's a pre-selected agent (bypass agent selector entirely)
      const preSelectedAgent = config?.selectedSnakAgent;
      if (preSelectedAgent && this.snakAgents[preSelectedAgent]) {
        logger.debug(
          `${depthIndent}SupervisorAgent (${callPath}): Pre-selected agent "${preSelectedAgent}" found, bypassing AgentSelectionAgent entirely.`
        );
        responseContent = `Supervisor: Routing directly to pre-selected agent "${preSelectedAgent}".`;
        nextAgent = preSelectedAgent;

        this.executionDepth--;
        const directiveMessage = new AIMessage({
          content: responseContent,
          additional_kwargs: {
            from: 'supervisor',
            next_agent: nextAgent,
          },
        });
        logger.debug(
          `${depthIndent}SupervisorAgent (${callPath}): Returning direct routing directive: ${JSON.stringify(directiveMessage.toJSON())}`
        );
        return directiveMessage;
      }

      // Use original query if available and appropriate for agent selection, otherwise current message content.
      const queryForSelection = (originalUserQueryFromConfig ||
        (typeof currentMessage.content === 'string'
          ? currentMessage.content
          : JSON.stringify(currentMessage.content))) as string;

      if (this.agentSelectionAgent) {
        logger.debug(
          `${depthIndent}SupervisorAgent (${callPath}): Invoking AgentSelectionAgent.`
        );
        try {
          const selectionOutcome = await this.agentSelectionAgent.execute(
            new HumanMessage(queryForSelection), // Provide a clean query to ASA
            {
              ...(config || {}),
              originalUserQuery: queryForSelection,
              isWorkflowNodeCall: true,
            } // Pass relevant config
          );

          responseContent = String(selectionOutcome.content || '');

          // Check if the agent selection agent needs clarification
          if (selectionOutcome.additional_kwargs?.needsClarification === true) {
            needsClarification = true;
            isFinal = true; // Mark as final when clarification is needed
            logger.debug(
              `${depthIndent}SupervisorAgent (${callPath}): AgentSelectionAgent needs clarification from user. Ending workflow.`
            );
          } else if (selectionOutcome.additional_kwargs?.next_agent) {
            nextAgent = selectionOutcome.additional_kwargs.next_agent as string;
          }

          if (
            selectionOutcome.additional_kwargs?.final !== undefined &&
            !needsClarification
          ) {
            isFinal = selectionOutcome.additional_kwargs.final as boolean;
          }
          // Check for tool calls on AIMessage
          if (
            selectionOutcome instanceof AIMessage &&
            selectionOutcome.tool_calls &&
            selectionOutcome.tool_calls.length > 0
          ) {
            toolCallsFromSelection = selectionOutcome.tool_calls;
            if (!nextAgent && this.toolsOrchestrator) nextAgent = 'tools'; // Route to tools if orchestrator exists
          } else if (
            selectionOutcome.additional_kwargs?.tool_calls &&
            selectionOutcome.additional_kwargs?.tool_calls.length > 0
          ) {
            // Check additional_kwargs as a fallback, though AIMessage.tool_calls is standard
            toolCallsFromSelection =
              selectionOutcome.additional_kwargs.tool_calls;
            if (!nextAgent && this.toolsOrchestrator) nextAgent = 'tools'; // Route to tools if orchestrator exists
          }

          logger.debug(
            `${depthIndent}SupervisorAgent (${callPath}): AgentSelectionAgent outcome - Next: ${nextAgent}, Final: ${isFinal}, Clarification: ${needsClarification}, Tools: ${toolCallsFromSelection?.length || 0}`
          );
        } catch (e: any) {
          logger.error(
            `${depthIndent}SupervisorAgent (${callPath}): Error calling AgentSelectionAgent: ${e.message}`
          );
          responseContent = 'Error during agent selection by Supervisor.';
          isFinal = true; // End flow on selection error
        }
      } else {
        logger.warn(
          `${depthIndent}SupervisorAgent (${callPath}): AgentSelectionAgent not available. Defaulting to 'snak' or ending.`
        );
        if (this.snakAgent && queryForSelection) {
          responseContent = `Supervisor: No AgentSelector. Routing to default Snak agent for query: \"${queryForSelection.substring(0, 100)}...\"`;
          nextAgent = 'snak';
        } else {
          responseContent =
            'Supervisor: AgentSelectionAgent not found, and no default action. Ending task.';
          isFinal = true;
        }
      }

      this.executionDepth--;
      const directiveMessage = new AIMessage({
        content: responseContent,
        additional_kwargs: {
          from: 'supervisor', // Critical for router logic
          ...(nextAgent && { next_agent: nextAgent }),
          ...(isFinal && !nextAgent && { final: true }),
          ...(needsClarification && { needsClarification: true }),
        },
      });
      // Attach tool calls directly to the message if they exist
      if (toolCallsFromSelection && toolCallsFromSelection.length > 0) {
        directiveMessage.tool_calls = toolCallsFromSelection;
        directiveMessage.additional_kwargs.tool_calls = toolCallsFromSelection; // Also ensure in additional_kwargs for some router patterns
      }

      logger.debug(
        `${depthIndent}SupervisorAgent (${callPath}): Returning directive: ${JSON.stringify(directiveMessage.toJSON())}`
      );
      return directiveMessage;
    } else {
      // ----------- EXTERNAL CALL PATH (this.executionDepth is 1) -----------
      // This is the initial call to start the workflow.
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

      const workflowConfig: Record<string, any> = { ...(config || {}) };
      if (
        !workflowConfig.originalUserQuery &&
        typeof currentMessage.content === 'string'
      ) {
        workflowConfig.originalUserQuery = currentMessage.content;
      }

      // Handle agentId from the initial external call config to set a specific startNode
      let targetAgentFromExternalCall = config?.agentId || null;
      if (targetAgentFromExternalCall) {
        const isValidAgent =
          targetAgentFromExternalCall in this.snakAgents ||
          targetAgentFromExternalCall === 'snak' ||
          targetAgentFromExternalCall === 'supervisor' ||
          this.operators.has(targetAgentFromExternalCall) ||
          targetAgentFromExternalCall === this.agentSelectionAgent?.id ||
          targetAgentFromExternalCall === this.memoryAgent?.id;
        if (!isValidAgent) {
          logger.warn(
            `${depthIndent}SupervisorAgent (${callPath}): Specified agentId \"${targetAgentFromExternalCall}\" in config is not a recognized agent. Workflow will use default entry point.`
          );
          targetAgentFromExternalCall = null; // Fallback to workflow's default entryPoint
        } else {
          logger.debug(
            `${depthIndent}SupervisorAgent (${callPath}): External config requests startNode: \"${targetAgentFromExternalCall}\"`
          );
          workflowConfig.startNode = targetAgentFromExternalCall;
        }
      }

      // Si un agent Snak est ciblé et que la mémoire est activée, router via l'agent mémoire d'abord
      const finalTargetNodeForSnak = workflowConfig.startNode;
      const isSnakAgent =
        finalTargetNodeForSnak &&
        (this.snakAgents[finalTargetNodeForSnak] ||
          finalTargetNodeForSnak.startsWith('snak-'));

      if (
        this.memoryAgent &&
        finalTargetNodeForSnak &&
        isSnakAgent &&
        workflowConfig.startNode !== this.memoryAgent.id // Éviter de rediriger si la mémoire est déjà le startNode
      ) {
        logger.debug(
          `${depthIndent}SupervisorAgent (${callPath}): Snak agent \"${finalTargetNodeForSnak}\" targeted. Routing via MemoryAgent (${this.memoryAgent.id}) first.`
        );
        workflowConfig.selectedSnakAgent = finalTargetNodeForSnak;
        workflowConfig.startNode = this.memoryAgent.id;
      } else if (finalTargetNodeForSnak && isSnakAgent) {
        // Si un agent Snak spécifique est ciblé mais qu'on ne passe pas par la mémoire,
        // définir selectedSnakAgent pour que le router puisse bypasser l'agent selector
        logger.debug(
          `${depthIndent}SupervisorAgent (${callPath}): Snak agent \"${finalTargetNodeForSnak}\" targeted. Setting selectedSnakAgent to bypass agent selector.`
        );
        workflowConfig.selectedSnakAgent = finalTargetNodeForSnak;
      }

      try {
        // Ensure originalUserQuery is in the metadata for the very first message passed to workflow
        const initialMessagesForWorkflow = [currentMessage];
        if (
          workflowConfig.originalUserQuery &&
          (!currentMessage.additional_kwargs ||
            !currentMessage.additional_kwargs.originalUserQuery)
        ) {
          if (!initialMessagesForWorkflow[0].additional_kwargs)
            initialMessagesForWorkflow[0].additional_kwargs = {};
          initialMessagesForWorkflow[0].additional_kwargs.originalUserQuery =
            workflowConfig.originalUserQuery;
        }

        const result = await this.workflowController.execute(
          initialMessagesForWorkflow[0],
          workflowConfig
        );

        // Check if the workflow encountered a need for clarification from agent-selector
        if (
          result &&
          result.metadata &&
          result.metadata.requiresClarification === true
        ) {
          if (result.metadata.clarificationMessage) {
            logger.debug(
              `${depthIndent}SupervisorAgent (${callPath}): Agent requires clarification. Ending workflow and returning clarification message directly.`
            );
            this.executionDepth--;
            // Return the agent's clarification message content directly
            return result.metadata.clarificationMessage.content;
          }
        }

        // Additional check for clarification messages in the final message
        if (result && result.messages && result.messages.length > 0) {
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

        let finalUserResponse: string = 'Workflow completed.'; // Default response
        // Extract final response from workflow result (which is typically the full state)
        if (
          result &&
          result.messages &&
          Array.isArray(result.messages) &&
          result.messages.length > 0
        ) {
          const lastWorkflowMessage =
            result.messages[result.messages.length - 1];
          if (lastWorkflowMessage) {
            if (
              typeof lastWorkflowMessage.content === 'string' &&
              lastWorkflowMessage.content.trim() !== ''
            ) {
              finalUserResponse = lastWorkflowMessage.content;
            } else if (
              lastWorkflowMessage.additional_kwargs?.final_answer &&
              typeof lastWorkflowMessage.additional_kwargs.final_answer ===
                'string'
            ) {
              finalUserResponse =
                lastWorkflowMessage.additional_kwargs.final_answer;
            } else if (typeof lastWorkflowMessage.content !== 'string') {
              finalUserResponse = JSON.stringify(lastWorkflowMessage.content);
            }
            // If content is empty, but it's a final AI message, keep default or use "Task completed"
            else if (
              lastWorkflowMessage instanceof AIMessage &&
              lastWorkflowMessage.content.trim() === '' &&
              lastWorkflowMessage.additional_kwargs?.final
            ) {
              finalUserResponse = 'Task completed.';
            }
          }
        } else if (typeof result === 'string') {
          // Should not happen if workflow returns full state
          finalUserResponse = result;
        } else if (
          result &&
          result.content &&
          typeof result.content === 'string'
        ) {
          // If result is a single BaseMessage
          finalUserResponse = result.content;
        } else if (result) {
          // Fallback for other unexpected result structures
          finalUserResponse = this.formatResponse(result);
        }

        logger.debug(
          `${depthIndent}SupervisorAgent (${callPath}): Workflow finished. Final response (truncated): \"${finalUserResponse.substring(0, 200)}...\"`
        );
        this.executionDepth--;
        return finalUserResponse;
      } catch (error: any) {
        logger.error(
          `${depthIndent}SupervisorAgent (${callPath}): Error during WorkflowController execution: ${error.message || error}`
        );
        this.executionDepth--;
        // Return a user-friendly error message
        return `An error occurred while processing your request: ${error.message || String(error)}. Please try again.`;
      }
    }
  }

  /**
   * Formats a response, primarily for logging and ensuring string output.
   * If the response is an object with a string `content` property, that content is formatted.
   * Otherwise, strings are returned as is, and other types are stringified.
   * @param response The response to format.
   * @returns The formatted response.
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
   * Executes a task in autonomous mode using the SnakAgent.
   * @returns The result of the autonomous execution.
   * @throws Will throw an error if the SnakAgent is not available.
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
   * Gets an operator agent by its ID.
   * @param id The ID of the operator agent.
   * @returns The agent if found, otherwise undefined.
   */
  public getOperator(id: string): IAgent | undefined {
    return this.operators.get(id);
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
    logger.debug('SupervisorAgent: Disposing agents...');

    // Dispose SnakAgent if it exists
    if (this.snakAgent) {
      await this.snakAgent.dispose();
      logger.debug('SupervisorAgent: SnakAgent disposed');
    }

    // Dispose individual agents
    if (this.modelSelectionAgent && this.modelSelectionAgent.dispose) {
      await this.modelSelectionAgent.dispose();
    }
    if (this.memoryAgent && this.memoryAgent.dispose) {
      await this.memoryAgent.dispose();
    }
    if (this.toolsOrchestrator && this.toolsOrchestrator.dispose) {
      await this.toolsOrchestrator.dispose();
    }
    if (this.workflowController && this.workflowController.dispose) {
      await this.workflowController.dispose();
    }

    this.modelSelectionAgent = null;
    this.snakAgent = null;
    this.toolsOrchestrator = null;
    this.memoryAgent = null;
    this.agentSelectionAgent = null;
    this.workflowController = null;
    this.operators.clear();
    this.snakAgents = {};

    SupervisorAgent.instance = null; // Clear the singleton instance

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
      // TODO: Remove chatId from agent_config and move it to request body to support multiple conversations per agent
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
      return message; // Return original message on error
    }
  }

  /**
   * Starts a hybrid execution flow with an initial input.
   * This delegates to the SnakAgent's hybrid execution capabilities.
   * @param initialInput The initial input string to start the hybrid process.
   * @returns An object containing the initial state and the thread ID for the execution.
   * @throws Will throw an error if the SnakAgent is not available or if the execution fails to start.
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
      state: resultObj.state || resultObj, // Use the whole result as state if 'state' property is missing
      threadId,
    };
  }

  /**
   * Provides subsequent input to a paused hybrid execution.
   * This delegates to the SnakAgent to resume the hybrid flow.
   * @param input The human input string to provide to the paused execution.
   * @param threadId The thread ID of the paused hybrid execution.
   * @returns The updated state after processing the input.
   * @throws Will throw an error if the SnakAgent is not available.
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

  /**
   * Enregistre un nouvel agent Snak dans le système
   */
  public registerSnakAgent(id: string, agent: SnakAgent, metadata?: any): void {
    // S'assurer que l'ID est valide et pas vide
    if (!id || id.trim() === '') {
      logger.warn(
        'SupervisorAgent: Invalid empty agent ID, using "snak-custom" instead'
      );
      id = 'snak-custom';
    }

    // S'assurer que les métadonnées existent
    if (!metadata) {
      metadata = {};
    }

    // Attacher les métadonnées à l'agent
    (agent as any).metadata = {
      name: metadata.name || id,
      description: metadata.description || 'A Starknet interaction agent',
      group: metadata.group || 'starknet',
    };

    // Enregistrer l'agent avec son ID spécifique
    this.snakAgents[id] = agent;
    logger.debug(
      `SupervisorAgent: Registered Snak agent "${id}" with metadata: ${JSON.stringify((agent as any).metadata)}`
    );

    // Mettre à jour l'agent de sélection
    this.updateAgentSelectionAgentRegistry();
  }

  /**
   * Met à jour le registre pour l'agent de sélection
   */
  public updateAgentSelectionAgentRegistry(): void {
    if (!this.agentSelectionAgent) return;

    const registry = OperatorRegistry.getInstance();
    const availableAgents: Record<string, IAgent> = {
      supervisor: this,
      ...registry.getAllAgents(),
    };

    // Ajouter tous les agents Snak avec leur ID spécifique
    Object.entries(this.snakAgents).forEach(([id, agent]) => {
      availableAgents[id] = agent;
    });

    // Si snakAgent existe mais n'est pas dans snakAgents, l'ajouter également
    if (
      this.snakAgent &&
      !Object.values(this.snakAgents).includes(this.snakAgent)
    ) {
      // Utiliser un ID distinctif pour éviter les conflits
      const mainAgentId = 'snak-main';
      availableAgents[mainAgentId] = this.snakAgent;
      logger.debug(
        `SupervisorAgent: Added main snakAgent with ID "${mainAgentId}"`
      );
    }

    // Mettre à jour l'agent de sélection
    this.agentSelectionAgent.setAvailableAgents(availableAgents);

    // Produire un log détaillé des agents disponibles
    logger.debug(
      `SupervisorAgent: Updated AgentSelectionAgent registry with ${Object.keys(availableAgents).length} agents:`
    );
    Object.entries(availableAgents).forEach(([id, agent]) => {
      const metadata = (agent as any).metadata;
      const type = agent.type;

      if (metadata) {
        logger.debug(
          `  - Agent: ${id}, Type: ${type}, Metadata: {"name":"${metadata.name || 'unnamed'}","group":"${metadata.group || 'unknown'}"}`
        );
      } else {
        logger.debug(`  - Agent: ${id}, Type: ${type}, Metadata: no metadata`);
      }
    });
  }

  /**
   * Désinscrire un agent Snak du système
   */
  public unregisterSnakAgent(id: string): void {
    if (this.snakAgents[id]) {
      // Dispose de l'agent si possible
      const agent = this.snakAgents[id];
      if (agent && typeof (agent as any).dispose === 'function') {
        try {
          (agent as any).dispose();
        } catch (error) {
          logger.error(`Error disposing agent ${id}:`, error);
        }
      }

      // Supprimer du registre
      delete this.snakAgents[id];
      logger.debug(`SupervisorAgent: Unregistered Snak agent "${id}"`);

      // Mettre à jour l'agent de sélection
      this.updateAgentSelectionAgentRegistry();
    } else {
      logger.warn(
        `SupervisorAgent: Attempted to unregister non-existent agent "${id}"`
      );
    }
  }

  /**
   * Obtenir la liste des agents Snak enregistrés
   */
  public getRegisteredSnakAgents(): Record<string, SnakAgent> {
    return { ...this.snakAgents };
  }

  /**
   * Obtenir le nombre d'agents Snak enregistrés
   */
  public getRegisteredSnakAgentsCount(): number {
    return Object.keys(this.snakAgents).length;
  }

  /**
   * Vérifier si un agent Snak est enregistré
   */
  public isSnakAgentRegistered(id: string): boolean {
    return id in this.snakAgents;
  }

  /**
   * Récupère un agent Snak par son ID
   */
  public getSnakAgent(id?: string): SnakAgent | null {
    // Si un ID est fourni, on retourne l'agent correspondant
    if (id && this.snakAgents[id]) {
      return this.snakAgents[id];
    }

    // Si aucun ID n'est fourni mais que nous avons un snakAgent principal, on le retourne
    if (!id && this.snakAgent) {
      return this.snakAgent;
    }

    // Sinon, on retourne null (pas de fallback par défaut)
    return null;
  }

  /**
   * Récupère l'agent de sélection
   */
  public getAgentSelectionAgent(): AgentSelectionAgent | null {
    return this.agentSelectionAgent;
  }

  /**
   * Met à jour le WorkflowController avec les agents actuellement disponibles.
   * Cette méthode est utile après l'enregistrement de nouveaux agents.
   */
  public async refreshWorkflowController(): Promise<void> {
    if (!this.workflowController) {
      logger.warn(
        'SupervisorAgent: Cannot refresh WorkflowController as it is not initialized yet'
      );
      return;
    }

    logger.info(
      'SupervisorAgent: Refreshing WorkflowController with newly registered agents'
    );
    try {
      // Réinitialiser d'abord
      await this.workflowController.reset();

      // Puis réinitialiser avec les agents actuels (strictement cette fois)
      await this.initializeWorkflowController(false);

      logger.info('SupervisorAgent: WorkflowController successfully refreshed');
    } catch (error) {
      logger.error(
        `SupervisorAgent: Failed to refresh WorkflowController: ${error}`
      );
      throw new Error(`Failed to refresh WorkflowController: ${error}`);
    }
  }
}
