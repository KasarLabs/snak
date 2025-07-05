import { MemorySaver, StateGraph, END, START } from '@langchain/langgraph';
import { BaseMessage, AIMessage, HumanMessage } from '@langchain/core/messages';
import { logger } from '@snakagent/core';
import { IAgent } from '../core/baseAgent.types.js';
import { RunnableConfig } from '@langchain/core/runnables';
import crypto from 'crypto';
import { AgentType } from '../core/baseAgent.js';
import { FormatChunkIteration } from '../../agents/core/utils.js';
import {
  AgentIterationEvent,
  IterationResponse,
} from '../../agents/core/snakAgent.js';

export interface LangChainResponse {
  supervisor: {
    messages: BaseMessage[];
    metadata: Record<string, any>;
    currentAgent: string;
  };
}
/**
 * Represents the state of the multi-agent workflow.
 */
interface WorkflowState {
  /** The sequence of messages in the workflow. */
  messages: BaseMessage[];
  /** The identifier of the current agent to execute. */
  currentAgent: string;
  /** Arbitrary metadata associated with the workflow state. */
  metadata: Record<string, any>;
  /** Tool calls to be executed. */
  toolCalls: any[];
  /** Optional error message if an error occurred. */
  error?: string;
  /** Counter to track the number of iterations to prevent infinite loops. */
  iterationCount: number;
  /** Optional field to track the selected model type. */
  modelType?: string;
  /** The current operational mode of the agent (e.g., autonomous, hybrid). */
  mode?: string;
  /** Flag indicating if the workflow is paused, waiting for user input in hybrid mode. */
  waiting_for_input?: boolean;
}

/**
 * Configuration for the WorkflowController.
 */
export interface WorkflowControllerConfig {
  /** A record of agent instances, keyed by their unique identifiers. */
  agents: Record<string, IAgent>;
  /** The identifier of the agent that serves as the entry point for the workflow. */
  entryPoint: string;
  /** Optional. Enables checkpointing of the workflow state if true. Defaults to false. */
  checkpointEnabled?: boolean;
  /** Optional. Enables detailed debug logging if true. Defaults to false. */
  debug?: boolean;
  /** Optional. The maximum number of iterations the workflow can run before being forced to end. Defaults to 10. */
  maxIterations?: number;
  /** Optional. The timeout in milliseconds for workflow execution. Defaults to 60000 (60 seconds). */
  workflowTimeout?: number;
}

/**
 * Controller that manages the workflow execution and transitions between different agents.
 * It uses a state graph to define and run the sequence of operations.
 */
export class WorkflowController {
  private agents: Record<string, IAgent>;
  private workflow: any;
  private checkpointer: MemorySaver;
  private entryPoint: string;
  private debug: boolean;
  private maxIterations: number;
  private initialized: boolean = false;
  private workflowTimeout: number;
  private executionId: string | null = null;
  private checkpointEnabled: boolean;
  private timeoutId: NodeJS.Timeout | null = null;

  /**
   * Constructs a new WorkflowController.
   * @param config The configuration object for the workflow controller.
   */
  constructor(config: WorkflowControllerConfig) {
    this.agents = config.agents;
    this.entryPoint = config.entryPoint;
    this.checkpointer = new MemorySaver();
    this.debug = config.debug || false;
    this.maxIterations = config.maxIterations || 10;
    this.workflowTimeout = config.workflowTimeout || 60000;
    this.checkpointEnabled = config.checkpointEnabled ?? false;

    this.validateAgents();

    if (this.debug) {
      logger.debug(
        `WorkflowController: Initialized with agents: ${Object.keys(this.agents).join(', ')}`
      );
      logger.debug(`WorkflowController: Entry point is "${this.entryPoint}"`);
      logger.debug(`WorkflowController: Max iterations: ${this.maxIterations}`);
      logger.debug(
        `WorkflowController: Workflow timeout: ${this.workflowTimeout}ms`
      );
    }
  }

  /**
   * Validates that necessary agents, like the entry point, exist.
   * @throws Error if the entry point agent is not found.
   */
  private validateAgents(): void {
    if (!this.agents[this.entryPoint]) {
      throw new Error(`Entry point agent "${this.entryPoint}" does not exist`);
    }
  }

  /**
   * Initializes the workflow graph, defining nodes for each agent and the transitions between them.
   * This method must be called before executing the workflow.
   * @throws Error if initialization fails.
   */
  public async init(): Promise<void> {
    logger.debug('WorkflowController: Starting initialization');
    try {
      logger.debug(
        `WorkflowController: Available agents: ${Object.keys(this.agents).join(', ')}`
      );

      const workflow = new StateGraph<WorkflowState>({
        channels: {
          messages: {
            value: (x, y) =>
              Array.isArray(y)
                ? [...(x || []), ...y]
                : [...(x || []), ...(y ? [y] : [])],
            default: () => [],
          },
          currentAgent: {
            value: (_, y) => y,
            default: () => this.entryPoint,
          },
          metadata: {
            value: (x, y) => ({ ...(x || {}), ...(y || {}) }),
            default: () => ({}),
          },
          toolCalls: {
            value: (x, y) =>
              Array.isArray(y)
                ? [...(x || []), ...y]
                : [...(x || []), ...(y ? [y] : [])],
            default: () => [],
          },
          error: {
            value: (_, y) => y,
            default: () => undefined,
          },
          iterationCount: {
            value: (x, _) => (x || 0) + 1,
            default: () => 0,
          },
        },
      });

      for (const [agentId, agent] of Object.entries(this.agents)) {
        const execId = this.executionId || 'unknown';
        workflow.addNode(
          agentId,
          async (state: WorkflowState, runnable_config?: RunnableConfig) => {
            if (this.debug) {
              const lastAgents = (state.metadata.agentHistory || [])
                .slice(-3)
                .join(' → ');
              logger.debug(
                `WorkflowController[Exec:${execId}]: Node[${agentId}] - START (Iteration: ${state.iterationCount}, Prev: ${lastAgents || 'none'}, Msgs: ${state.messages.length})`
              );
            }

            try {
              if (state.iterationCount >= this.maxIterations) {
                logger.warn(
                  `WorkflowController[Exec:${execId}]: Node[${agentId}] - Maximum iterations (${this.maxIterations}) reached.`
                );
                return {
                  messages: [
                    new AIMessage({
                      content: `Maximum workflow iterations (${this.maxIterations}) reached. Execution stopped to prevent infinite loop.`,
                      additional_kwargs: {
                        from: agentId,
                        final: true,
                        error: 'max_iterations_reached',
                      },
                    }),
                  ],
                  error: 'max_iterations_reached',
                  currentAgent: END,
                };
              }

              const agentExecutionCount =
                state.metadata.agentExecutionCount || {};
              const currentCount = agentExecutionCount[agentId] || 0;
              const newCount = currentCount + 1;

              const updatedMetadata: Record<string, any> = {
                ...state.metadata,
                agentExecutionCount: {
                  ...agentExecutionCount,
                  [agentId]: newCount,
                },
              };

              if (newCount > 3 && agentId !== 'tools') {
                logger.warn(
                  `WorkflowController[Exec:${execId}]: Node[${agentId}] - Agent called ${newCount} times, forcing END.`
                );

                return {
                  messages: [
                    new AIMessage({
                      content: `Workflow terminated to prevent infinite loop: agent "${agentId}" called too many times.`,
                      additional_kwargs: {
                        from: agentId,
                        final: true,
                      },
                    }),
                  ],
                  currentAgent: END,
                  metadata: updatedMetadata,
                };
              }

              const lastMessage =
                state.messages.length > 0
                  ? state.messages[state.messages.length - 1]
                  : new HumanMessage('Initializing workflow');

              logger.debug(
                `WorkflowController[Exec:${execId}]: Node[${agentId}] - Last message to process: Type=${lastMessage._getType()}, From=${lastMessage.additional_kwargs?.from || 'initial'}`
              );

              const originalUserQuery = this.extractOriginalUserQuery(state);
              if (originalUserQuery) {
                updatedMetadata.originalUserQuery = originalUserQuery;
                logger.debug(
                  `WorkflowController[Exec:${execId}]: Node[${agentId}] - Using original user query: "${originalUserQuery}"`
                );
              }

              if (
                agentId === 'supervisor' &&
                state.metadata?.selectedSnakAgent
              ) {
                updatedMetadata.selectedSnakAgent =
                  state.metadata.selectedSnakAgent;
                logger.debug(
                  `WorkflowController[Exec:${execId}]: Node[${agentId}] - Passing selectedSnakAgent to supervisor: "${state.metadata.selectedSnakAgent}"`
                );
              }

              const config = {
                ...(runnable_config || {}),
                ...updatedMetadata,
                toolCalls: state.toolCalls,
              };

              logger.debug(
                `WorkflowController[Exec:${execId}]: Node[${agentId}] - Calling agent.execute()...`
              );
              const result = await agent.execute(state.messages, false, {
                ...config,
                isWorkflowNodeCall: true,
              });
              logger.debug(
                `WorkflowController[Exec:${execId}]: Node[${agentId}] - Agent execution finished. Processing result...`
              );

              let response: BaseMessage[];

              if (Array.isArray(result)) {
                response = result.map((item: any) =>
                  item instanceof BaseMessage
                    ? item
                    : new AIMessage({
                        content: String(item),
                        additional_kwargs: { from: agentId },
                      })
                );
              } else if (
                result &&
                typeof result === 'object' &&
                'messages' in result
              ) {
                response = Array.isArray(result.messages)
                  ? result.messages.map((msg: any) => {
                      if (msg instanceof BaseMessage) {
                        if (
                          !msg.additional_kwargs ||
                          !msg.additional_kwargs.from
                        ) {
                          return new AIMessage({
                            content: msg.content,
                            additional_kwargs: {
                              ...(msg.additional_kwargs || {}),
                              from: agentId,
                            },
                          });
                        }
                        return msg;
                      }
                      return new AIMessage({
                        content: String(msg),
                        additional_kwargs: { from: agentId },
                      });
                    })
                  : [
                      new AIMessage({
                        content: String(result),
                        additional_kwargs: { from: agentId },
                      }),
                    ];
              } else if (result instanceof BaseMessage) {
                if (
                  !result.additional_kwargs ||
                  !result.additional_kwargs.from
                ) {
                  response = [
                    new AIMessage({
                      content: result.content,
                      additional_kwargs: {
                        ...(result.additional_kwargs || {}),
                        from: agentId,
                      },
                    }),
                  ];
                } else {
                  response = [result];
                }
              } else {
                response = [
                  new AIMessage({
                    content: String(result),
                    additional_kwargs: { from: agentId },
                  }),
                ];
              }

              let nextAgent: string | undefined = undefined;
              let isFinal: boolean = false;

              if (result && typeof result === 'object') {
                if ('nextAgent' in result) {
                  nextAgent = result.nextAgent as string;

                  if (nextAgent === agentId && agentId !== 'tools') {
                    logger.warn(
                      `WorkflowController[Exec:${execId}]: Node[${agentId}] - Agent "${agentId}" trying to route to itself, redirecting to supervisor instead`
                    );
                    nextAgent = 'supervisor';
                  }
                }

                if ('final' in result && result.final === true) {
                  isFinal = true;
                }
              }

              const lastResponseMessage = response[response.length - 1];
              if (
                lastResponseMessage &&
                lastResponseMessage.additional_kwargs &&
                lastResponseMessage.additional_kwargs.final === true
              ) {
                isFinal = true;
              }

              if (agentId === 'supervisor' && !nextAgent && !isFinal) {
                const history = state.metadata.agentHistory || [];
                if (
                  history.length >= 2 &&
                  history.slice(-2).every((a: string) => a === 'supervisor')
                ) {
                  isFinal = true;
                  logger.warn(
                    'Supervisor called twice with no clear next agent, marking as final'
                  );
                }
              }

              let toolCalls: any[] = [];
              if (
                lastResponseMessage instanceof AIMessage &&
                'tool_calls' in lastResponseMessage &&
                Array.isArray(lastResponseMessage.tool_calls) &&
                lastResponseMessage.tool_calls.length > 0
              ) {
                toolCalls = lastResponseMessage.tool_calls;

                if (!nextAgent && 'tools' in this.agents) {
                  nextAgent = 'tools';
                }
              }

              const outputState: Partial<WorkflowState> = {
                messages: response,
                metadata: updatedMetadata,
              };

              if (isFinal) {
                if (this.debug) {
                  logger.debug(
                    `WorkflowController[Exec:${execId}]: Node[${agentId}] - Final response detected from "${agentId}", ending workflow`
                  );
                }
                outputState.currentAgent = END;
              } else if (nextAgent) {
                logger.debug(
                  `WorkflowController[Exec:${execId}]: Node[${agentId}] - Setting next agent to "${nextAgent}" based on result.`
                );
                outputState.currentAgent = nextAgent;
              }

              if (toolCalls.length > 0) {
                logger.debug(
                  `WorkflowController[Exec:${execId}]: Node[${agentId}] - Adding ${toolCalls.length} tool calls to state.`
                );
                outputState.toolCalls = toolCalls;
              }

              if (this.debug) {
                logger.debug(
                  `WorkflowController[Exec:${execId}]: Node[${agentId}] - END. Next: ${outputState.currentAgent || 'router_decision'}, Final: ${isFinal}, New Msgs: ${outputState.messages?.length || 0}`
                );
              }

              return outputState;
            } catch (error) {
              logger.error(
                `WorkflowController[Exec:${execId}]: Node[${agentId}] - ERROR executing agent: ${error}`
              );

              const errorMessage = new AIMessage({
                content: `Error executing agent "${agentId}": ${error instanceof Error ? error.message : String(error)}`,
                additional_kwargs: {
                  from: agentId,
                  error: true,
                },
              });

              if (agentId === 'supervisor') {
                logger.debug(
                  `WorkflowController[Exec:${execId}]: Node[${agentId}] - Error in supervisor, forcing END.`
                );
                return {
                  messages: [errorMessage],
                  error: String(error),
                  currentAgent: END,
                };
              }

              logger.debug(
                `WorkflowController[Exec:${execId}]: Node[${agentId}] - Error in agent, returning to supervisor.`
              );
              return {
                messages: [errorMessage],
                currentAgent: 'supervisor',
                error: String(error),
              };
            }
          }
        );
      }

      logger.debug(
        `WorkflowController: Setting entry point to ${this.entryPoint}`
      );
      workflow.addEdge(START as any, this.entryPoint as any);

      for (const agentId of Object.keys(this.agents)) {
        const routingMap: Record<string, string | typeof END> = {};

        for (const targetId of Object.keys(this.agents)) {
          routingMap[targetId] = targetId;
        }

        routingMap[END] = END;

        logger.debug(
          `WorkflowController: Adding conditional edges from "${agentId}" with router function`
        );

        for (const routingId of Object.keys(routingMap)) {
          logger.info(routingId);
        }
        workflow.addConditionalEdges(
          // @ts-expect-error - The type definition expects "__start__" but routing from agentId is intended here
          agentId,
          (state: WorkflowState) => this.router(state),
          routingMap as Record<string, string | typeof END>
        );
      }

      logger.debug('WorkflowController: Compiling workflow');
      this.workflow = workflow.compile({
        checkpointer: this.checkpointEnabled ? this.checkpointer : undefined,
      });
      logger.debug('WorkflowController: Workflow compiled successfully');

      this.initialized = true;
      logger.debug(
        `WorkflowController: Initialization complete with ${Object.keys(this.agents).length} agents`
      );
    } catch (error) {
      logger.error(
        `WorkflowController: Failed to initialize workflow: ${error}`
      );
      throw error;
    }
  }

  /**
   * Determines the next agent to execute or ends the workflow based on the current state.
   * This function is used as the decision logic for conditional edges in the workflow graph.
   * @param state The current workflow state.
   * @returns The identifier of the next agent, 'hybrid_pause', or END.
   */
  private router(state: WorkflowState): string | typeof END {
    const execId = this.executionId || 'unknown';
    logger.debug(
      `WorkflowController[Exec:${execId}]: Router - Evaluating state (Iteration: ${state.iterationCount}, Msgs: ${state.messages.length})`
    );

    if (state.error) {
      logger.error(
        `WorkflowController[Exec:${execId}]: Router - Error in state: ${state.error}, ending workflow.`
      );
      return END;
    }

    if (state.iterationCount >= this.maxIterations) {
      logger.warn(
        `WorkflowController[Exec:${execId}]: Router - Max iterations reached, ending workflow.`
      );
      return END;
    }

    if (!state.messages || state.messages.length === 0) {
      logger.warn(
        `WorkflowController[Exec:${execId}]: Router - No messages in state, ending workflow.`
      );
      return END;
    }

    const lastMessage = state.messages[state.messages.length - 1];

    // Handle selection agent messages requesting clarification
    if (
      lastMessage instanceof AIMessage &&
      lastMessage.additional_kwargs?.needsClarification === true
    ) {
      logger.debug(
        `WorkflowController[Exec:${execId}]: Router - Agent ${lastMessage.additional_kwargs?.from || state.currentAgent} requesting clarification from user, ending workflow to get user input`
      );

      state.metadata.requiresClarification = true;
      state.metadata.clarificationMessage = lastMessage;

      return END;
    }

    if (
      lastMessage.additional_kwargs?.tool_calls &&
      lastMessage.additional_kwargs.tool_calls.length > 0
    ) {
      if (this.agents['tools']) {
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - Tool calls detected, routing to "tools"`
        );
        return 'tools';
      } else {
        logger.warn(
          `WorkflowController[Exec:${execId}]: Router - Tool calls detected, but no "tools" agent (ToolsOrchestrator) available. Ending workflow.`
        );
        return END;
      }
    }

    if (lastMessage.additional_kwargs?.next_agent) {
      const nextAgent = lastMessage.additional_kwargs.next_agent as string;
      if (this.agents[nextAgent]) {
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - Explicit next agent "${nextAgent}" requested, routing there.`
        );
        return nextAgent;
      } else {
        logger.warn(
          `WorkflowController[Exec:${execId}]: Router - Requested next agent "${nextAgent}" does not exist. Available agents: ${Object.keys(this.agents).join(', ')}. Ending workflow.`
        );
        return END;
      }
    }

    if (lastMessage.additional_kwargs?.nextAgent) {
      const nextAgent = lastMessage.additional_kwargs.nextAgent as string;
      if (this.agents[nextAgent]) {
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - Next agent "${nextAgent}" specified in additional_kwargs.nextAgent, routing there.`
        );
        return nextAgent;
      } else {
        logger.warn(
          `WorkflowController[Exec:${execId}]: Router - Requested nextAgent "${nextAgent}" from additional_kwargs does not exist. Available agents: ${Object.keys(this.agents).join(', ')}. Ending workflow.`
        );
        return END;
      }
    }

    const currentAgentId = state.currentAgent;
    const messageSource = lastMessage.additional_kwargs?.from || currentAgentId;

    if (this.debug) {
      logger.debug(
        `WorkflowController[Exec:${execId}]: Router - Current agent: "${currentAgentId}", Message source: "${messageSource}"`
      );
    }

    if (messageSource === 'supervisor') {
      if (
        state.metadata?.selectedSnakAgent &&
        this.agents[state.metadata.selectedSnakAgent]
      ) {
        const selectedAgent = state.metadata.selectedSnakAgent;
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - From supervisor, specific agent "${selectedAgent}" pre-selected, routing there directly (bypassing agent selector)`
        );
        delete state.metadata.selectedSnakAgent;
        return selectedAgent;
      }

      const snakAgents = Object.keys(this.agents).filter(
        (id) => this.agents[id].type === AgentType.SNAK
      );

      if (snakAgents.length > 0) {
        if (snakAgents.length > 1 && this.agents['agent-selector']) {
          logger.debug(
            `WorkflowController[Exec:${execId}]: Router - From supervisor, multiple Snak agents available, routing to "agent-selector"`
          );
          return 'agent-selector';
        }

        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - From supervisor, routing to Snak agent "${snakAgents[0]}"`
        );
        return snakAgents[0];
      }

      if (this.agents['agent-selector']) {
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - From supervisor, no Snak agent, routing to "agent-selector"`
        );
        return 'agent-selector';
      }

      logger.warn(
        `WorkflowController[Exec:${execId}]: Router - From supervisor, no suitable next agent found. Ending workflow.`
      );
      return END;
    } else if (messageSource === 'agent-selector') {
      const snakAgents = Object.keys(this.agents).filter(
        (id) => this.agents[id].type === AgentType.SNAK
      );

      if (snakAgents.length > 0) {
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - From agent-selector with no nextAgent, using first available Snak agent "${snakAgents[0]}"`
        );
        return snakAgents[0];
      }

      logger.warn(
        `WorkflowController[Exec:${execId}]: Router - From agent-selector with no nextAgent, no suitable Snak agent found. Ending workflow.`
      );
      return END;
    } else if (messageSource === 'tools') {
      const previousAgent = state.metadata?.lastActiveAgent || 'snak-main';

      if (this.agents[previousAgent]) {
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - From tools, routing to previous agent "${previousAgent}"`
        );
        return previousAgent;
      }

      const snakAgents = Object.keys(this.agents).filter(
        (id) => this.agents[id].type === AgentType.SNAK
      );

      if (snakAgents.length > 0) {
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - From tools, previous agent not found, routing to available Snak agent "${snakAgents[0]}"`
        );
        return snakAgents[0];
      }

      logger.warn(
        `WorkflowController[Exec:${execId}]: Router - From tools, no suitable agent found. Ending workflow.`
      );
      return END;
    } else if (
      typeof messageSource === 'string' &&
      messageSource in this.agents
    ) {
      const agentFromSource =
        this.agents[messageSource as keyof typeof this.agents];
      if (
        agentFromSource &&
        (messageSource === 'snak' ||
          agentFromSource.type === AgentType.SNAK ||
          agentFromSource.type === AgentType.OPERATOR)
      ) {
        if (lastMessage.additional_kwargs?.final === true) {
          logger.debug(
            `WorkflowController[Exec:${execId}]: Router - From "${messageSource}", message is final. Ending workflow.`
          );
          return END;
        }
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - From "${messageSource}" (Snak/Operator), no explicit next_agent or tool_calls, and not marked final. Ending workflow.`
        );
        return END;
      }
    }

    logger.warn(
      `WorkflowController[Exec:${execId}]: Router - No specific routing rule matched for message from "${messageSource}". Ending workflow.`
    );
    return END;
  }

  /**
   * Executes the workflow with the given input.
   * @param input The initial input for the workflow, can be a string or a BaseMessage.
   * @param config Optional configuration for the run, including `threadId`.
   * @returns The final message or result from the workflow execution.
   * @throws Error if the workflow is not initialized, times out, or encounters an unhandled error.
   */
  public async *execute(
    input: string | BaseMessage,
    config?: Record<string, any>
  ): AsyncGenerator<any> {
    this.executionId = crypto.randomUUID().substring(0, 8);
    logger.debug(
      `WorkflowController[Exec:${this.executionId}]: Starting execution`
    );

    let originalUserQuery: string | null = null;
    if (config?.originalUserQuery) {
      originalUserQuery = config.originalUserQuery;
      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Preserving original user query from config: "${originalUserQuery}"`
      );
    }

    try {
      if (!this.initialized) {
        logger.warn(
          'WorkflowController: Workflow not initialized. Call init() first.'
        );
        throw new Error('WorkflowController is not initialized');
      }
      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Workflow initialized, proceeding...`
      );

      const message =
        typeof input === 'string' ? new HumanMessage(input) : input;
      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Input message type: ${message._getType()}`
      );

      const threadId = config?.threadId || this.executionId;
      const runConfig: any = {
        configurable: {
          thread_id: threadId,
        },
        version: 'v2' as const,
      };
      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Using thread ID: ${threadId}`
      );

      // Allow specifying a start node
      let initialAgent = config?.startNode || this.entryPoint;

      const shouldBypassSupervisor =
        config?.startNode && config.startNode !== this.entryPoint;

      if (!this.agents[initialAgent]) {
        logger.warn(
          `WorkflowController[Exec:${this.executionId}]: Specified start node "${initialAgent}" not found, using default entry point "${this.entryPoint}"`
        );
        if (shouldBypassSupervisor) {
          logger.warn(
            `WorkflowController[Exec:${this.executionId}]: Cannot bypass to non-existent agent "${initialAgent}", falling back to normal workflow`
          );
        }
        initialAgent = this.entryPoint;
      }

      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Determined initial agent: ${initialAgent}`
      );

      // Initialize additional config metadata
      const initialMetadata: Record<string, any> = {
        threadId,
        ...config,
      };
      // Don't include startNode in metadata to avoid confusion
      if (initialMetadata.startNode) {
        delete initialMetadata.startNode;
      }

      // Set selected Snak agent if specified
      if (config?.selectedSnakAgent) {
        initialMetadata.selectedSnakAgent = config.selectedSnakAgent;
      }

      const canBypass =
        shouldBypassSupervisor &&
        this.agents[config?.startNode || ''] &&
        initialAgent !== this.entryPoint;

      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Bypass check - startNode: "${config?.startNode}", entryPoint: "${this.entryPoint}", canBypass: ${canBypass}`
      );

      if (canBypass) {
        logger.debug(
          `WorkflowController[Exec:${this.executionId}]: Bypassing supervisor, starting directly with agent: ${initialAgent}`
        );

        const targetAgent = this.agents[initialAgent];
        if (!targetAgent) {
          throw new Error(`Target agent "${initialAgent}" not found`);
        }

        const agentConfig = {
          ...initialMetadata,
          originalUserQuery:
            originalUserQuery ||
            (typeof message.content === 'string'
              ? message.content
              : JSON.stringify(message.content)),
          isWorkflowNodeCall: true,
        };

        try {
          const result = await targetAgent.execute(
            [message],
            false,
            agentConfig
          );

          let finalResult;
          if (result && typeof result === 'object' && 'messages' in result) {
            finalResult = result;
          } else if (result instanceof BaseMessage) {
            finalResult = {
              messages: [result],
              metadata: initialMetadata,
            };
          } else {
            finalResult = {
              messages: [
                new AIMessage({
                  content:
                    typeof result === 'string'
                      ? result
                      : JSON.stringify(result),
                  additional_kwargs: { from: initialAgent, final: true },
                }),
              ],
              metadata: initialMetadata,
            };
          }

          logger.debug(
            `WorkflowController[Exec:${this.executionId}]: Direct agent execution completed`
          );
          return finalResult;
        } catch (error) {
          logger.error(
            `WorkflowController[Exec:${this.executionId}]: Direct agent execution failed: ${error}`
          );
          throw error;
        }
      }

      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Invoking workflow with initial state`
      );

      const timeoutPromise = new Promise((_, reject) => {
        this.timeoutId = setTimeout(() => {
          logger.error(
            `WorkflowController[Exec:${this.executionId}]: Workflow execution timed out after ${this.workflowTimeout}ms`
          );
          reject(
            new Error(
              `Workflow execution timed out after ${this.workflowTimeout}ms`
            )
          );
        }, this.workflowTimeout);
      });
      const workflowPromise = this.workflow.invoke(
        {
          messages: [message],
          currentAgent: initialAgent,
          metadata: initialMetadata,
          toolCalls: [],
          error: undefined,
          iterationCount: 0,
        },
        runConfig
      );

      const result = await Promise.race([workflowPromise, timeoutPromise]);

      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Workflow execution completed`
      );
      return result;
    } catch (error) {
      logger.error(
        `WorkflowController[Exec:${this.executionId}]: Workflow execution failed: ${error}`
      );
      throw error;
    }
  }

  /**
   * Extracts the original user query from the workflow state.
   * It first checks the metadata, then iterates through messages for
   * `originalUserQuery` in `additional_kwargs`, and finally falls back
   * to the content of the first HumanMessage.
   * @param state The current workflow state.
   * @returns The original user query as a string, or null if not found.
   */
  private extractOriginalUserQuery(state: WorkflowState): string | null {
    if (
      state.metadata &&
      typeof state.metadata.originalUserQuery === 'string'
    ) {
      return state.metadata.originalUserQuery;
    }

    if (state.messages && state.messages.length > 0) {
      for (const msg of state.messages) {
        if (
          msg.additional_kwargs &&
          typeof msg.additional_kwargs.originalUserQuery === 'string'
        ) {
          return msg.additional_kwargs.originalUserQuery;
        }
      }

      for (const msg of state.messages) {
        if (msg instanceof HumanMessage && typeof msg.content === 'string') {
          return msg.content;
        }
      }
    }

    return null;
  }

  /**
   * Resets the workflow's state, primarily by clearing any persisted checkpoint data.
   * This allows for a fresh execution of the workflow.
   * @throws Error if resetting fails.
   */
  public async reset(): Promise<void> {
    logger.debug(
      `WorkflowController[Exec:${this.executionId || 'unknown'}]: Starting reset`
    );
    try {
      if (this.checkpointer && this.checkpointEnabled) {
        this.checkpointer = new MemorySaver();
        logger.debug(
          `WorkflowController[Exec:${this.executionId || 'unknown'}]: Checkpointer reset.`
        );
      }
      this.executionId = null;
      logger.debug(
        `WorkflowController[Exec:${this.executionId || 'unknown'}]: Reset finished`
      );
    } catch (error) {
      logger.error(
        `WorkflowController[Exec:${this.executionId || 'unknown'}]: Error resetting workflow: ${error}`
      );
      throw error;
    }
  }

  /**
   * Disposes of resources used by the WorkflowController.
   * Clears any active timeouts and resets the initialized flag.
   * @returns Promise that resolves when disposal is complete.
   */
  public async dispose(): Promise<void> {
    logger.debug(
      `WorkflowController[Exec:${this.executionId || 'unknown'}]: Disposing...`
    );
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.initialized = false;
    logger.debug(
      `WorkflowController[Exec:${this.executionId || 'unknown'}]: Dispose complete.`
    );
    return Promise.resolve();
  }
}
