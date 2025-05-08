// agents/supervisor/workflowController.ts
import { MemorySaver, StateGraph, END, START } from '@langchain/langgraph';
import { BaseMessage, AIMessage, HumanMessage } from '@langchain/core/messages';
import { logger } from '@snakagent/core';
import { IAgent } from '../core/baseAgent.js';
import { RunnableConfig } from '@langchain/core/runnables';
import crypto from 'crypto';
import { AgentMode, AGENT_MODES } from '../../config/agentConfig.js';

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
      // Create state graph
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

      // Add nodes for each agent
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
              // Check if max iterations is reached
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

              // Track agent executions to detect loops
              const agentExecutionCount =
                state.metadata.agentExecutionCount || {};
              const currentCount = agentExecutionCount[agentId] || 0;
              const newCount = currentCount + 1;

              // Update metadata
              const updatedMetadata: Record<string, any> = {
                ...state.metadata,
                agentExecutionCount: {
                  ...agentExecutionCount,
                  [agentId]: newCount,
                },
              };

              // If non-tool agent is called too many times, force termination
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

              // Get last message or use empty message if none exists
              const lastMessage =
                state.messages.length > 0
                  ? state.messages[state.messages.length - 1]
                  : new HumanMessage('Initializing workflow');

              logger.debug(
                `WorkflowController[Exec:${execId}]: Node[${agentId}] - Last message to process: Type=${lastMessage._getType()}, From=${lastMessage.additional_kwargs?.from || 'initial'}`
              );

              // Extract original user query and add to configuration
              const originalUserQuery = this.extractOriginalUserQuery(state);
              if (originalUserQuery) {
                updatedMetadata.originalUserQuery = originalUserQuery;
                logger.debug(
                  `WorkflowController[Exec:${execId}]: Node[${agentId}] - Using original user query: "${originalUserQuery}"`
                );
              }

              // Prepare configuration with metadata
              const config = {
                ...(runnable_config || {}),
                ...updatedMetadata,
                toolCalls: state.toolCalls,
              };

              // Execute agent
              logger.debug(
                `WorkflowController[Exec:${execId}]: Node[${agentId}] - Calling agent.execute()...`
              );
              const result = await agent.execute(lastMessage, config);

              logger.debug(
                `WorkflowController[Exec:${execId}]: Node[${agentId}] - Agent execution finished. Processing result...`
              );

              // Handle different result formats
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
                // Case where result contains messages
                response = Array.isArray(result.messages)
                  ? result.messages.map((msg: any) => {
                      if (msg instanceof BaseMessage) {
                        // Add source agent info if it doesn't exist
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
                // Ensure message contains source agent info
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
                // Fallback for other result types
                response = [
                  new AIMessage({
                    content: String(result),
                    additional_kwargs: { from: agentId },
                  }),
                ];
              }

              // Determine next agent based on result
              let nextAgent: string | undefined = undefined;
              let isFinal: boolean = false;

              // Check if specific agent is requested in result
              if (result && typeof result === 'object') {
                if ('nextAgent' in result) {
                  nextAgent = result.nextAgent as string;

                  // Check that we don't send to current agent (except for tools)
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

              // Check messages if a message is marked as final
              const lastResponseMessage = response[response.length - 1];
              if (
                lastResponseMessage &&
                lastResponseMessage.additional_kwargs &&
                lastResponseMessage.additional_kwargs.final === true
              ) {
                isFinal = true;
              }

              // If current agent is supervisor and no next agent specified,
              // and it's the second consecutive supervisor call, force end.
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

              // Check tool calls
              let toolCalls: any[] = [];
              if (
                lastResponseMessage instanceof AIMessage &&
                'tool_calls' in lastResponseMessage &&
                Array.isArray(lastResponseMessage.tool_calls) &&
                lastResponseMessage.tool_calls.length > 0
              ) {
                toolCalls = lastResponseMessage.tool_calls;

                // Automatically direct to tools orchestrator if tool calls detected
                if (!nextAgent && 'tools' in this.agents) {
                  nextAgent = 'tools';
                }
              }

              // Build output state
              const outputState: Partial<WorkflowState> = {
                messages: response,
                metadata: updatedMetadata, // Ensure metadata is included
              };

              // If this is final response, force workflow end
              if (isFinal) {
                if (this.debug) {
                  logger.debug(
                    `WorkflowController[Exec:${execId}]: Node[${agentId}] - Final response detected from "${agentId}", ending workflow`
                  );
                }
                outputState.currentAgent = END;
              }
              // Otherwise, add next agent if specified
              else if (nextAgent) {
                logger.debug(
                  `WorkflowController[Exec:${execId}]: Node[${agentId}] - Setting next agent to "${nextAgent}" based on result.`
                );
                outputState.currentAgent = nextAgent;
              }

              // Add tool calls if present
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

              // Create error message
              const errorMessage = new AIMessage({
                content: `Error executing agent "${agentId}": ${error instanceof Error ? error.message : String(error)}`,
                additional_kwargs: {
                  from: agentId,
                  error: true,
                },
              });

              // If supervisor generates an error, avoid loop
              // by terminating workflow
              if (agentId === 'supervisor') {
                logger.debug(
                  `WorkflowController[Exec:${execId}]: Node[${agentId}] - Error in supervisor, forcing END.`
                );
                return {
                  messages: [errorMessage],
                  error: String(error),
                  currentAgent: END, // Force end to avoid a loop
                };
              }

              // For other agents, return to supervisor
              logger.debug(
                `WorkflowController[Exec:${execId}]: Node[${agentId}] - Error in agent, returning to supervisor.`
              );
              return {
                messages: [errorMessage],
                currentAgent: 'supervisor', // Return to supervisor in case of error
                error: String(error),
              };
            }
          }
        );
      }

      // Set the entry point
      logger.debug(
        `WorkflowController: Setting entry point to ${this.entryPoint}`
      );
      workflow.addEdge(START as any, this.entryPoint as any);

      // Route transitions based on current agent
      for (const agentId of Object.keys(this.agents)) {
        // Create routing map for this agent
        const routingMap: Record<string, string | typeof END> = {};

        // Add each agent as a possible destination
        for (const targetId of Object.keys(this.agents)) {
          routingMap[targetId] = targetId;
        }

        // Add END as a possible destination
        routingMap[END] = END;

        // Add hybrid_pause as a possible destination
        routingMap['hybrid_pause'] = 'hybrid_pause';

        // Add conditional transitions
        logger.debug(
          `WorkflowController: Adding conditional edges from "${agentId}" with router function`
        );
        workflow.addConditionalEdges(
          // @ts-expect-error - The type definition expects "__start__" but routing from agentId is intended here
          agentId, // Source node is current agent
          (state: WorkflowState) => this.router(state), // Decision function
          routingMap as Record<string, string | typeof END> // Explicit cast added
        );
      }

      // Add a special node for hybrid mode pauses
      workflow.addNode('hybrid_pause', async () => {
        // This node just returns the current state
        // The actual pause happens at the higher level when hybrid_pause is returned
        return {};
      });

      // Compile workflow
      logger.debug('WorkflowController: Compiling workflow');
      this.workflow = workflow.compile({
        checkpointer: this.checkpointEnabled ? this.checkpointer : undefined,
      });
      logger.debug('WorkflowController: Workflow compiled successfully');

      this.initialized = true;
      logger.debug('WorkflowController: Initialization complete');
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
      `WorkflowController[Exec:${execId}]: Router - Iteration: ${state.iterationCount}, Current Agent: ${state.currentAgent}`
    );

    if (state.metadata.modelType) {
      logger.debug(
        `WorkflowController[Exec:${execId}]: Router - Preserved model type: "${state.metadata.modelType}"`
      );
    }

    if (!state.metadata.agentHistory) {
      state.metadata.agentHistory = [];
    }

    if (state.currentAgent && state.currentAgent !== END) {
      state.metadata.agentHistory.push(state.currentAgent);
      logger.debug(
        `  - Agent history: ${(state.metadata.agentHistory || []).join(' → ')}`
      );
    }

    if (
      state.metadata.mode === AGENT_MODES[AgentMode.HYBRID] &&
      state.metadata.waiting_for_input === true
    ) {
      logger.debug(
        `WorkflowController[Exec:${execId}]: Router - Hybrid mode waiting for input, pausing workflow`
      );
      return 'hybrid_pause';
    }

    if (state.iterationCount >= this.maxIterations) {
      logger.warn(
        `WorkflowController[Exec:${execId}]: Router - Max iterations (${this.maxIterations}) reached, forcing END`
      );
      return END;
    }

    if (!state.messages || state.messages.length === 0) {
      logger.warn(
        `WorkflowController[Exec:${execId}]: Router - No messages in state, forcing END`
      );
      return END;
    }

    const lastMessage = state.messages[state.messages.length - 1];
    const history = state.metadata.agentHistory || [];

    if (lastMessage instanceof AIMessage) {
      if (lastMessage.additional_kwargs?.final === true) {
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - Message marked as final, ending workflow`
        );
        return END;
      }

      // Responses from 'snak' agent are treated as final to prevent loops.
      if (lastMessage.additional_kwargs?.from === 'snak') {
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - Response from 'snak' agent, treating as final and ending workflow`
        );
        return END;
      }

      if (
        !lastMessage.content ||
        (Array.isArray(lastMessage.content) &&
          lastMessage.content.length === 0) ||
        (typeof lastMessage.content === 'string' &&
          lastMessage.content.trim() === '')
      ) {
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - Empty response detected, ending workflow`
        );
        return END;
      }

      // Check for hybrid mode input request
      if (
        lastMessage.additional_kwargs?.wait_for_input === true ||
        (typeof lastMessage.content === 'string' &&
          lastMessage.content.includes('WAITING_FOR_HUMAN_INPUT:'))
      ) {
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - Detected request for human input in hybrid mode`
        );
        state.metadata.waiting_for_input = true;
        state.metadata.mode = AGENT_MODES[AgentMode.HYBRID];
        return 'hybrid_pause';
      }
    }

    if (state.currentAgent === 'supervisor') {
      const supervisorCount = history.filter(
        (agent: string) => agent === 'supervisor'
      ).length;
      if (supervisorCount > 1) {
        logger.warn(
          `WorkflowController[Exec:${execId}]: Router - Supervisor called multiple times (${supervisorCount}), routing directly to 'snak' to prevent loop.`
        );
        if ('snak' in this.agents) return 'snak';
        logger.warn(
          `WorkflowController[Exec:${execId}]: Router - 'snak' agent not found after supervisor loop detection, ending.`
        );
        return END;
      }
    }

    if (lastMessage.additional_kwargs?.from === 'model-selector') {
      logger.debug(
        `WorkflowController[Exec:${execId}]: Router - Message from model-selector, routing directly to 'snak'`
      );

      if (lastMessage.additional_kwargs?.originalUserQuery) {
        state.metadata.originalUserQuery =
          lastMessage.additional_kwargs.originalUserQuery;
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - Preserved original user query: "${state.metadata.originalUserQuery}"`
        );
      }

      if (lastMessage.additional_kwargs?.modelType) {
        state.metadata.modelType = lastMessage.additional_kwargs
          .modelType as string;
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - Preserved model type: "${state.metadata.modelType}"`
        );
      }

      if ('snak' in this.agents) {
        return 'snak';
      }
      logger.warn(
        `WorkflowController[Exec:${execId}]: Router - 'snak' agent not found after model-selector, ending.`
      );
      return END;
    }

    if (
      lastMessage instanceof AIMessage &&
      lastMessage.tool_calls &&
      lastMessage.tool_calls.length > 0
    ) {
      if ('tools' in this.agents) {
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - Routing to 'tools' agent due to tool calls.`
        );
        return 'tools';
      }
    }

    if (lastMessage instanceof HumanMessage) {
      logger.debug(
        `WorkflowController[Exec:${execId}]: Router - Direct routing to 'snak' for human message`
      );
      if ('snak' in this.agents) return 'snak';
      logger.warn(
        `WorkflowController[Exec:${execId}]: Router - 'snak' agent not found for human message, ending.`
      );
      return END;
    }

    if (state.currentAgent === 'snak') {
      logger.debug(
        `WorkflowController[Exec:${execId}]: Router - Current agent is 'snak', ending workflow.`
      );
      return END;
    }

    if (state.currentAgent !== 'supervisor' && 'supervisor' in this.agents) {
      logger.debug(
        `WorkflowController[Exec:${execId}]: Router - Routing to 'supervisor' for coordination.`
      );
      return 'supervisor';
    }

    logger.warn(
      `WorkflowController[Exec:${execId}]: Router - Could not determine next agent, forcing END. Last message from: ${lastMessage?.additional_kwargs?.from}, Current Agent: ${state.currentAgent}`
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
  public async execute(
    input: string | BaseMessage,
    config?: Record<string, any>
  ): Promise<any> {
    this.executionId = crypto.randomUUID().substring(0, 8);
    logger.debug(
      `WorkflowController[Exec:${this.executionId}]: Starting execution`
    );

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Cleared previous timeout`
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
      const runConfig: RunnableConfig = {
        configurable: {
          thread_id: threadId,
        },
        recursionLimit: this.maxIterations * 2,
        ...(config || {}),
      };
      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Using thread ID: ${threadId}`
      );

      const initialAgent = 'snak'; // All executions now start directly with the 'snak' agent.
      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Determined initial agent: ${initialAgent}`
      );

      const timeoutPromise = new Promise((_, reject) => {
        this.timeoutId = setTimeout(() => {
          logger.warn(
            `WorkflowController[Exec:${this.executionId}]: Workflow execution TIMED OUT after ${this.workflowTimeout}ms`
          );
          this.timeoutId = null; // Important: Clear timeoutId before rejecting
          reject(
            new Error(
              `Workflow execution timed out after ${this.workflowTimeout}ms`
            )
          );
        }, this.workflowTimeout);
      });

      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Invoking workflow with initial state`
      );
      const workflowPromise = this.workflow.invoke(
        {
          messages: [message],
          currentAgent: initialAgent,
          metadata: { threadId },
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
        logger.debug(
          `WorkflowController[Exec:${this.executionId}]: Workflow finished before timeout, cleared timeout.`
        );
      }

      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Workflow invocation completed. Result keys: ${Object.keys(result || {}).join(', ')}`
      );

      const finalMessages = result?.messages || [];
      const lastMessage =
        finalMessages.length > 0
          ? finalMessages[finalMessages.length - 1]
          : null;

      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Final message type: ${lastMessage?._getType()}, From: ${lastMessage?.additional_kwargs?.from}, Final: ${lastMessage?.additional_kwargs?.final}`
      );

      if (
        lastMessage instanceof AIMessage &&
        lastMessage.additional_kwargs?.error
      ) {
        logger.error(
          `WorkflowController[Exec:${this.executionId}]: Workflow finished with error state: ${lastMessage.additional_kwargs.error}`
        );
        // Provide a more specific message if it's a max iteration error.
        if (
          lastMessage.content &&
          typeof lastMessage.content === 'string' &&
          lastMessage.content.includes('Maximum workflow iterations')
        ) {
          return lastMessage;
        }
        throw new Error(
          `Workflow error: ${lastMessage.additional_kwargs.error} - ${lastMessage.content}`
        );
      }

      return lastMessage || result;
    } catch (error: any) {
      logger.error(
        `WorkflowController[Exec:${this.executionId}]: Execution failed: ${error.message || error}`
      );
      if (error.stack) {
        logger.error(`Stack trace: ${error.stack}`);
      }
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
        logger.debug(
          `WorkflowController[Exec:${this.executionId}]: Cleared timeout due to error.`
        );
      }
      throw error;
    } finally {
      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Execution finished`
      );
      this.executionId = null;
    }
  }

  /**
   * Resets the workflow's state, primarily by clearing any persisted checkpoint data.
   * This allows for a fresh execution of the workflow.
   * @throws Error if resetting fails.
   */
  public async reset(): Promise<void> {
    logger.debug('WorkflowController: Starting reset');
    try {
      if (this.checkpointer) {
        logger.debug(
          'WorkflowController: Resetting in-memory checkpointer by creating a new instance.'
        );
        // Re-instantiating MemorySaver effectively clears its state.
        this.checkpointer = new MemorySaver();
      }

      logger.debug('WorkflowController: Reset finished');
    } catch (error) {
      logger.error(`WorkflowController: Error resetting workflow: ${error}`);
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
}
