// agents/supervisor/workflowController.ts
import { MemorySaver, StateGraph, END, START } from '@langchain/langgraph';
import {
  BaseMessage,
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { logger } from '@snakagent/core';
import { IAgent } from '../core/baseAgent.js';
import { RunnableConfig } from '@langchain/core/runnables';
import crypto from 'crypto';

/**
 * Represents the state of the multi-agent workflow
 */
interface WorkflowState {
  messages: BaseMessage[];
  currentAgent: string;
  metadata: Record<string, any>;
  toolCalls: any[];
  error?: string;
  iterationCount: number; // Counter to avoid infinite loops
  modelType?: string; // Add this to track the selected model type
}

/**
 * Configuration for the workflow controller
 */
export interface WorkflowControllerConfig {
  agents: Record<string, IAgent>;
  entryPoint: string;
  useConditionalEntryPoint?: boolean;
  checkpointEnabled?: boolean;
  debug?: boolean;
  maxIterations?: number; // Maximum iterations before forcing end
  workflowTimeout?: number; // Timeout in milliseconds
}

/**
 * Controller that manages workflow between different agents
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
  private entryPointSelector: ((state: WorkflowState) => string) | null = null;
  private useConditionalEntryPoint: boolean;
  private iterationCount: number = 0;
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(config: WorkflowControllerConfig) {
    this.agents = config.agents;
    this.entryPoint = config.entryPoint;
    this.checkpointer = new MemorySaver();
    this.debug = config.debug || false;
    this.maxIterations = config.maxIterations || 10; // Default 10 iterations
    this.workflowTimeout = config.workflowTimeout || 60000; // Default 60 seconds
    this.checkpointEnabled = config.checkpointEnabled ?? false;
    this.useConditionalEntryPoint = config.useConditionalEntryPoint ?? false;

    // Validate required agents exist
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
   * Validates that necessary agents exist
   */
  private validateAgents(): void {
    if (!this.agents[this.entryPoint]) {
      throw new Error(`Entry point agent "${this.entryPoint}" does not exist`);
    }

    if (this.debug) {
      logger.debug(
        `WorkflowController: Initialized with agents: ${Object.keys(this.agents).join(', ')}`
      );
      logger.debug(`WorkflowController: Entry point is "${this.entryPoint}"`);
    }
  }

  /**
   * Initializes the workflow
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
            value: (x, _) => (x || 0) + 1, // Increment each pass
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
                `WorkflowController[Exec:${execId}]: Node[${agentId}] - START (Iteration: ${state.iterationCount})`
              );
              logger.debug(`  - Last agents: ${lastAgents || 'none'}`);
              logger.debug(`  - Messages: ${state.messages.length}`);
              logger.debug(
                `  - Current agent state value: ${state.currentAgent}`
              );

              if (state.messages.length > 0) {
                const lastMsg = state.messages[state.messages.length - 1];
                logger.debug(`  - Last message type: ${lastMsg?._getType()}`);
                logger.debug(
                  `  - Last message from agent: ${lastMsg?.additional_kwargs?.from || 'unknown'}`
                );
                logger.debug(
                  `  - Last message is final: ${lastMsg?.additional_kwargs?.final ? 'yes' : 'no'}`
                );
                logger.debug(
                  `  - Last message content snippet: "${String(lastMsg?.content).substring(0, 100)}..."`
                );
              }
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
              // force end to avoid loops
              if (agentId === 'supervisor' && !nextAgent && !isFinal) {
                // Check if this is the second consecutive time
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
                  `WorkflowController[Exec:${execId}]: Node[${agentId}] - END`
                );
                logger.debug(
                  `  - Returning next agent: ${outputState.currentAgent || 'router_decision'}`
                );
                logger.debug(`  - Is final: ${isFinal ? 'yes' : 'no'}`);
                logger.debug(
                  `  - New messages: ${outputState.messages?.length || 0}`
                );
                if (outputState.messages && outputState.messages.length > 0) {
                  const newLastMsg =
                    outputState.messages[outputState.messages.length - 1];
                  logger.debug(
                    `  - Last new message type: ${newLastMsg._getType()}, from: ${newLastMsg.additional_kwargs?.from || agentId}, final: ${newLastMsg.additional_kwargs?.final ? 'yes' : 'no'}`
                  );
                }
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

        // Add conditional transitions
        logger.debug(
          `WorkflowController: Adding conditional edges from "${agentId}" with router function`
        );
        workflow.addConditionalEdges(
          agentId, // Source node is current agent
          (state: WorkflowState) => this.router(state), // Decision function
          routingMap // Mapping of decisions to target nodes
        );
      }

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
   * Routes to next agent or terminates workflow
   */
  private router(state: WorkflowState): string | typeof END {
    const execId = this.executionId || 'unknown';
    logger.debug(`WorkflowController[Exec:${execId}]: Router - START`);
    logger.debug(`  - Current state agent: ${state.currentAgent}`);
    logger.debug(`  - Iteration count: ${state.iterationCount}`);

    // Preserve model type if available in metadata
    if (state.metadata.modelType) {
      logger.debug(
        `WorkflowController[Exec:${execId}]: Router - Preserved model type: "${state.metadata.modelType}"`
      );
    }

    // Maintain agent history
    if (!state.metadata.agentHistory) {
      state.metadata.agentHistory = [];
    }

    // Add current agent to history if not already at END
    if (state.currentAgent && state.currentAgent !== END) {
      state.metadata.agentHistory.push(state.currentAgent);
      logger.debug(
        `  - Updated agent history: ${(state.metadata.agentHistory || []).join(' → ')}`
      );
    }

    // Check max iterations
    if (state.iterationCount >= this.maxIterations) {
      logger.warn(
        `WorkflowController[Exec:${execId}]: Router - Max iterations (${this.maxIterations}) reached, forcing END`
      );
      return END;
    }

    // Ensure we have messages
    if (!state.messages || state.messages.length === 0) {
      logger.warn(
        `WorkflowController[Exec:${execId}]: Router - No messages in state, forcing END`
      );
      return END;
    }

    const lastMessage = state.messages[state.messages.length - 1];
    const history = state.metadata.agentHistory || [];

    // Check if last message contains final response
    if (lastMessage instanceof AIMessage) {
      // Case 1: Explicit final response via metadata
      if (lastMessage.additional_kwargs?.final === true) {
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - Message marked as final, ending workflow`
        );
        return END;
      }

      // Case 2: Response from starknet - always assume it's final to avoid loops
      if (lastMessage.additional_kwargs?.from === 'starknet') {
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - Response from starknet, treating as final and ending workflow`
        );
        return END;
      }

      // Case 3: Empty content or other signs conversation should end
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
    }

    // Check for cycles involving supervisor
    if (state.currentAgent === 'supervisor') {
      const supervisorCount = history.filter(
        (agent: string) => agent === 'supervisor'
      ).length;
      if (supervisorCount > 1) {
        logger.warn(
          `WorkflowController[Exec:${execId}]: Router - Supervisor called multiple times, routing directly to starknet`
        );
        if ('starknet' in this.agents) return 'starknet';
        logger.warn(
          `WorkflowController[Exec:${execId}]: Router - Starknet agent not found after supervisor loop detection, ending.`
        );
        return END;
      }
    }

    // Direct routing from model-selector to starknet
    if (lastMessage.additional_kwargs?.from === 'model-selector') {
      logger.debug(
        `WorkflowController[Exec:${execId}]: Router - Message from model-selector, routing directly to starknet`
      );

      // Preserve the original user query in the state
      if (lastMessage.additional_kwargs?.originalUserQuery) {
        state.metadata.originalUserQuery =
          lastMessage.additional_kwargs.originalUserQuery;
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - Preserved original user query: "${state.metadata.originalUserQuery}"`
        );
      }

      // Add this to preserve model type selection
      if (lastMessage.additional_kwargs?.modelType) {
        state.metadata.modelType = lastMessage.additional_kwargs
          .modelType as string;
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - Preserved model type: "${state.metadata.modelType}"`
        );
      }

      if ('starknet' in this.agents) {
        return 'starknet';
      }
      logger.warn(
        `WorkflowController[Exec:${execId}]: Router - Starknet agent not found after model-selector, ending.`
      );
      return END;
    }

    // Handle tool calls
    if (
      lastMessage instanceof AIMessage &&
      lastMessage.tool_calls &&
      lastMessage.tool_calls.length > 0
    ) {
      if ('tools' in this.agents) {
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - Routing to tools agent.`
        );
        return 'tools';
      }
    }

    // For simple human messages, go directly to starknet
    if (lastMessage instanceof HumanMessage) {
      const content =
        typeof lastMessage.content === 'string' ? lastMessage.content : '';
      if (
        content.trim().length < 30 ||
        content.startsWith('/') ||
        content.startsWith('!') ||
        content.endsWith('?')
      ) {
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - Direct routing to starknet for simple query`
        );
        if ('starknet' in this.agents) return 'starknet';
        logger.warn(
          `WorkflowController[Exec:${execId}]: Router - Starknet agent not found for simple query, ending.`
        );
        return END;
      }
    }

    // If already at starknet, end workflow
    if (state.currentAgent === 'starknet') {
      logger.debug(
        `WorkflowController[Exec:${execId}]: Router - Current agent is starknet, ending workflow.`
      );
      return END;
    }

    // Only route to supervisor for complex coordination needs
    if (state.currentAgent !== 'supervisor' && 'supervisor' in this.agents) {
      logger.debug(
        `WorkflowController[Exec:${execId}]: Router - Routing to supervisor for coordination.`
      );
      return 'supervisor';
    }

    // If can't determine next agent, end workflow
    logger.warn(
      `WorkflowController[Exec:${execId}]: Router - Could not determine next agent, forcing END.`
    );
    return END;
  }

  /**
   * Executes the workflow with the given input
   */
  public async execute(
    input: string | BaseMessage,
    config?: Record<string, any>
  ): Promise<any> {
    this.executionId = crypto.randomUUID().substring(0, 8);
    logger.debug(
      `WorkflowController[Exec:${this.executionId}]: Starting execution`
    );

    // If a previous timeout is still active, clear it
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

      // Convert input to BaseMessage if string
      const message =
        typeof input === 'string' ? new HumanMessage(input) : input;
      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Input message type: ${message._getType()}`
      );

      // Configure thread ID if available
      const threadId = config?.threadId || this.executionId;
      const runConfig: RunnableConfig = {
        configurable: {
          thread_id: threadId,
        },
        recursionLimit: this.maxIterations * 2, // More generous recursion limit
        ...(config || {}), // Merge with provided configuration
      };
      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Using thread ID: ${threadId}`
      );

      // Determine initial agent
      const initialAgent =
        this.useConditionalEntryPoint && this.entryPointSelector
          ? this.entryPointSelector({
              messages: [message],
              currentAgent: '',
              metadata: { threadId },
              toolCalls: [],
              error: undefined,
              iterationCount: 0,
            })
          : this.entryPoint;
      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Determined initial agent: ${initialAgent}`
      );

      // Add improved timeout with proper cleanup
      const timeoutPromise = new Promise((_, reject) => {
        this.timeoutId = setTimeout(() => {
          logger.warn(
            `WorkflowController[Exec:${this.executionId}]: Workflow execution TIMED OUT after ${this.workflowTimeout}ms`
          );
          this.timeoutId = null; // Clear timeout ID *before* rejecting
          reject(
            new Error(
              `Workflow execution timed out after ${this.workflowTimeout}ms`
            )
          );
        }, this.workflowTimeout);
      });

      // Execute workflow with timeout
      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Invoking workflow with initial state`
      );
      const workflowPromise = this.workflow.invoke(
        {
          messages: [message],
          currentAgent: initialAgent,
          metadata: { threadId }, // Include threadId in initial metadata
          toolCalls: [],
          error: undefined,
          iterationCount: 0,
        },
        runConfig
      );

      // Wait for result or timeout
      const result = await Promise.race([workflowPromise, timeoutPromise]);

      // Clean up timeout if workflow finishes before
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

      // Extract final messages
      const finalMessages = result?.messages || [];
      const lastMessage =
        finalMessages.length > 0
          ? finalMessages[finalMessages.length - 1]
          : null;

      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Final message type: ${lastMessage?._getType()}, From: ${lastMessage?.additional_kwargs?.from}, Final: ${lastMessage?.additional_kwargs?.final}`
      );

      // If last message is a system error message, throw it
      if (
        lastMessage instanceof AIMessage &&
        lastMessage.additional_kwargs?.error
      ) {
        logger.error(
          `WorkflowController[Exec:${this.executionId}]: Workflow finished with error state: ${lastMessage.additional_kwargs.error}`
        );
        // Try to return more useful message than just the error
        if (
          lastMessage.content &&
          typeof lastMessage.content === 'string' &&
          lastMessage.content.includes('Maximum workflow iterations')
        ) {
          return lastMessage; // Return specific error message
        }
        throw new Error(
          `Workflow error: ${lastMessage.additional_kwargs.error} - ${lastMessage.content}`
        );
      }

      // Return last message if available, otherwise raw result
      return lastMessage || result;
    } catch (error: any) {
      logger.error(
        `WorkflowController[Exec:${this.executionId}]: Execution failed: ${error.message || error}`
      );
      if (error.stack) {
        logger.error(`Stack trace: ${error.stack}`);
      }
      // Ensure timeout is cleaned up even in case of error
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
        logger.debug(
          `WorkflowController[Exec:${this.executionId}]: Cleared timeout due to error.`
        );
      }
      throw error; // Propagate error
    } finally {
      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Execution finished`
      );
      this.executionId = null; // Clear execution ID
    }
  }

  /**
   * Resets the workflow
   */
  public async reset(): Promise<void> {
    logger.debug('WorkflowController: Starting reset');
    try {
      if (this.checkpointer) {
        // Reset checkpointer
        logger.debug(
          'WorkflowController: Resetting in-memory checkpointer by creating a new instance.'
        );
        this.checkpointer = new MemorySaver(); // Re-instantiate instead of clear
      }

      logger.debug('WorkflowController: Reset finished');
    } catch (error) {
      logger.error(`WorkflowController: Error resetting workflow: ${error}`);
      throw error;
    }
  }

  /**
   * Checks if workflow is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Gets current workflow state
   */
  public async getState(): Promise<any> {
    logger.debug('WorkflowController: Getting state');
    if (!this.checkpointer) {
      logger.debug('WorkflowController: No checkpointer, returning null state');
      return null;
    }

    try {
      // Retrieve state from checkpointer
      logger.debug('WorkflowController: Retrieving state from checkpointer');
      const state = await this.checkpointer.get({
        configurable: { thread_id: 'dummy_thread_for_get_state' },
      });
      logger.debug('WorkflowController: State retrieved successfully');
      return state;
    } catch (error) {
      logger.error(
        `WorkflowController: Error getting workflow state: ${error}`
      );
      return null;
    }
  }

  /**
   * Sets maximum iterations
   */
  public setMaxIterations(maxIterations: number): void {
    logger.debug(
      `WorkflowController: Setting maxIterations to ${maxIterations}`
    );
    if (maxIterations < 1) {
      logger.warn(
        `Invalid maxIterations value: ${maxIterations}. Must be at least 1.`
      );
      return;
    }
    this.maxIterations = maxIterations;
  }

  /**
   * Sets a conditional entry point for the workflow
   */
  public setConditionalEntryPoint(
    entryPointSelector: (state: WorkflowState) => string
  ): void {
    logger.debug('WorkflowController: Setting up conditional entry point');
    this.entryPointSelector = entryPointSelector;
  }

  /**
   * Extracts original user query from workflow state or messages
   */
  private extractOriginalUserQuery(state: WorkflowState): string | null {
    // First try to extract from metadata
    if (state.metadata && state.metadata.originalUserQuery) {
      return state.metadata.originalUserQuery;
    }

    // Otherwise, look in messages
    if (state.messages && state.messages.length > 0) {
      // First look in message metadata
      for (const msg of state.messages) {
        if (msg.additional_kwargs?.originalUserQuery) {
          return msg.additional_kwargs.originalUserQuery;
        }
      }

      // If not found, look for a user message (HumanMessage)
      for (const msg of state.messages) {
        if (msg instanceof HumanMessage && typeof msg.content === 'string') {
          return msg.content;
        }
      }
    }

    return null;
  }
}
