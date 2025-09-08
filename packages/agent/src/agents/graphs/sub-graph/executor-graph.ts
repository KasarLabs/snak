import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { START, StateGraph, Command, interrupt } from '@langchain/langgraph';
import {
  checkAndReturnLastItemFromPlansOrHistories,
  checkAndReturnObjectFromPlansOrHistories,
  getCurrentPlanStep,
  getCurrentPlan,
  getCurrentHistory,
  createMaxIterationsResponse,
  estimateTokens,
  getLatestMessageForMessage,
  handleNodeError,
} from '../utils/graph-utils.js';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AnyZodObject } from 'zod';
import { AgentConfig, AgentMode, logger } from '@snakagent/core';
import { ModelSelector } from '../../operators/modelSelector.js';
import { GraphConfigurableAnnotation, GraphState } from '../graph.js';
import { RunnableConfig } from '@langchain/core/runnables';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { DEFAULT_GRAPH_CONFIG } from '../config/default-config.js';
import {
  ExecutionMode,
  ExecutorNode,
} from '../../../shared/enums/agent-modes.enum.js';
import {
  TOOLS_STEP_VALIDATOR_SYSTEM_PROMPT,
  VALIDATOR_EXECUTOR_CONTEXT,
} from '../../../shared/prompts/graph/executor/validator_prompt.js';
import { TokenTracker } from '../../../shared/lib/token/token-tracking.js';
import {
  parseReActResponse,
  createReActObservation,
  parseActionsToToolCallsReact,
} from '../utils/react-utils.js';
import { PromptManagerFactory } from '../manager/prompts/executor-prompt-manager.js';
import {
  MODEL_TIMEOUTS,
  DEFAULT_MODELS,
  STRING_LIMITS,
} from '../constants/execution-constants.js';
import { v4 as uuidv4 } from 'uuid';
import { ChatOpenAI } from '@langchain/openai';
import { truncateToolResults } from '@agents/utils/tools.utils.js';
import { ValidatorResponseSchema } from '@schemas/graph.schemas.js';
import {
  HistoryItem,
  ParsedPlan,
  History,
  ReturnTypeCheckPlanorHistory,
  ToolCallWithId,
} from '../../../shared/types/index.js';
import { formatLTMForContext } from '../parser/memory/ltm-parser.js';
import {
  formatExecutionMessage,
  formatStepsForContext,
  formatToolResponse,
  formatToolsForHistory,
  formatToolsForPlan,
  formatValidatorToolsExecutor,
} from '../parser/plan-or-histories/plan-or-histoires.parser.js';
import { PromptGenerator } from '../manager/prompts/prompt-manager.js';
import { headerPromptStandard } from '@prompts/agents/header.prompt.js';
import { parseToolsToJson } from './planner-graph.js';
import {
  EXECUTOR_TASK_GENERATION_INSTRUCTION,
  INSTRUCTION_TASK_INITALIZER,
} from '@prompts/agents/instruction.prompts.js';
import { PERFORMANCE_EVALUATION_PROMPT } from '@prompts/agents/performance-evaluation.prompt.js';
import { CORE_AGENT_PROMPT } from '@prompts/agents/core.prompts.js';

export class AgentExecutorGraph {
  private agentConfig: AgentConfig;
  private modelSelector: ModelSelector | null;
  private toolsList: (
    | StructuredTool
    | Tool
    | DynamicStructuredTool<AnyZodObject>
  )[] = [];
  private graph: any;
  constructor(
    agentConfig: AgentConfig,
    modelSelector: ModelSelector,
    toolList: (StructuredTool | Tool | DynamicStructuredTool<AnyZodObject>)[]
  ) {
    this.modelSelector = modelSelector;
    this.agentConfig = agentConfig;
    this.toolsList = toolList;
  }

  // --- Prompt Building ---
  /**
   * Builds system prompt using strategy pattern for clean separation of concerns
   * Delegates prompt selection to appropriate strategy based on execution mode
   * @param state - Current graph execution state
   * @param config - Configuration including execution mode and agent settings
   * @returns ChatPromptTemplate configured for the current execution context
   */
  private buildSystemPrompt(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): ChatPromptTemplate {
    return PromptManagerFactory.buildSystemPrompt(state, config);
  }

  private async invokeModelWithMessages(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<AIMessageChunk> {
    const model = this.modelSelector?.getModels()['fast'];
    if (!model) {
      throw new Error('Model not found in ModelSelector');
    }
    if (model === undefined) {
      throw new Error('Failed to bind tools to model');
    }
    const prompts = this.build_prompt_generator(
      config.configurable!.agent_config!.mode,
      ExecutorNode.REASONING_EXECUTOR
    );
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', CORE_AGENT_PROMPT],
    ]);

    const formattedResponseFormat = JSON.stringify(
      prompts.getResponseFormat(),
      null,
      4
    );
    logger.debug(`[Executor] Invoking model () with execution`);
    const result = await model.invoke(
      await prompt.formatMessages({
        header: prompts.generateNumberedList(prompts.getHeader()),
        goal: state.tasks[0].text,
        constraints: prompts.generateNumberedList(
          prompts.getConstraints(),
          'constraint'
        ),
        goals: prompts.generateNumberedList(prompts.getGoals(), 'goal'),
        instructions: prompts.generateNumberedList(
          prompts.getInstructions(),
          'instruction'
        ),
        tools: prompts.generateNumberedList(prompts.getTools(), 'tool'),
        performance_evaluation: prompts.generateNumberedList(
          prompts.getPerformanceEvaluation(),
          'performance evaluation'
        ),
        output_format: formattedResponseFormat,
      })
    );
    if (!result) {
      throw new Error(
        'Model invocation returned no result. Please check the model configuration.'
      );
    }

    TokenTracker.trackCall(result, 'selectedModelType.model_name');

    // Add metadata to result
    result.additional_kwargs = {
      ...result.additional_kwargs,
      from: ExecutorNode.REASONING_EXECUTOR,
      final: false,
    };
    return result;
  }

  // --- Model Execution Helpers ---

  /**
   * Executes model inference with timeout protection
   * Handles model selection and invocation with proper error handling
   * @param state - Current graph execution state
   * @param config - Configuration for the execution
   * @param currentItem - Current plan step or history item being processed
   * @param prompt - Prepared prompt template for the model
   * @returns Model response as AIMessageChunk
   */
  private async executeModelWithTimeout(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<AIMessageChunk> {
    const modelPromise = this.invokeModelWithMessages(state, config);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Model invocation timeout')),
        MODEL_TIMEOUTS.DEFAULT_MODEL_TIMEOUT
      );
    });

    return (await Promise.race([
      modelPromise,
      timeoutPromise,
    ])) as AIMessageChunk;
  }

  /**
   * Processes ReAct responses for interactive reactive mode
   * Handles tool call extraction and response formatting
   * @param result - Model response to process
   * @param content - String content from the model
   * @param tokens - Estimated token count
   * @param state - Current graph execution state
   * @returns Processing result with updated state or null if no processing needed
   */
  private async processReActResponse(
    result: AIMessageChunk,
    content: string,
    tokens: number,
    state: typeof GraphState.State
  ): Promise<{
    messages: BaseMessage[];
    last_node: ExecutorNode;
    plans_or_histories?: ParsedPlan | History;
    currentGraphStep?: number;
  } | null> {
    const reactParsed = parseReActResponse(content);

    // Check for existing tool calls first
    let toolCallsToUse = result.tool_calls || [];

    // If no tool calls but ReAct parsed indicates there should be some, parse them from actions
    if (!toolCallsToUse?.length && !reactParsed.isFinalAnswer) {
      const parsedToolCalls = parseActionsToToolCallsReact(content);
      if (parsedToolCalls.length > 0) {
        // Convert our ToolCall interface to the expected format and add to result
        toolCallsToUse = parsedToolCalls.map((tc: ToolCallWithId) => ({
          name: tc.name,
          args: tc.args,
          id: tc.id,
          type: tc.type,
        }));
        // Update the result message with the parsed tool calls
        result.tool_calls = toolCallsToUse;
      }
    }

    // Handle tool calls
    if (
      toolCallsToUse?.length ||
      (reactParsed.hasToolCall && !reactParsed.isFinalAnswer)
    ) {
      const currentHistory = getCurrentHistory(state.plans_or_histories);
      if (currentHistory) {
        // Add or update tools entry in history
        if (currentHistory.items.length === 0) {
          currentHistory.items.push({
            type: 'tools',
            message: {
              content: content,
              tokens: tokens,
            },
            timestamp: Date.now(),
          });
        }
        return {
          messages: [result],
          last_node: ExecutorNode.REASONING_EXECUTOR,
          plans_or_histories: currentHistory,
          currentGraphStep: state.currentGraphStep + 1,
        };
      }
    }

    // Handle final answer or reasoning without tool calls
    if (reactParsed.isFinalAnswer || !reactParsed.hasToolCall) {
      const currentHistory = getCurrentHistory(state.plans_or_histories);
      if (currentHistory) {
        const historyItem: HistoryItem = {
          type: 'message',
          message: {
            content: content,
            tokens: estimateTokens(content),
          },
          timestamp: Date.now(),
        };
        currentHistory.items.push(historyItem);

        // Mark as final if it's explicitly a final answer
        result.additional_kwargs = {
          ...result.additional_kwargs,
          final: reactParsed.isFinalAnswer,
        };

        return {
          messages: [result],
          last_node: ExecutorNode.REASONING_EXECUTOR,
          plans_or_histories: currentHistory,
          currentGraphStep: state.currentGraphStep + 1,
        };
      }
    }

    return null;
  }

  /**
   * Updates plan or history based on execution mode
   * Handles message storage in the appropriate data structure
   * @param executionMode - Current execution mode
   * @param state - Current graph execution state
   * @param content - Message content to store
   * @param tokens - Token count for the content
   * @returns Updated plan or history object
   */
  private updatePlanOrHistoryWithMessage(
    executionMode: ExecutionMode,
    state: typeof GraphState.State,
    content: string,
    tokens: number
  ): ParsedPlan | History {
    if (executionMode === ExecutionMode.REACTIVE) {
      const currentHistory = getCurrentHistory(state.plans_or_histories);
      if (!currentHistory) {
        throw new Error('No history available for message update');
      }

      const historyItem: HistoryItem = {
        type: 'message',
        message: {
          content: content,
          tokens: tokens,
        },
        timestamp: Date.now(),
      };
      currentHistory.items.push(historyItem);
      return currentHistory;
    } else if (executionMode === ExecutionMode.PLANNING) {
      const currentPlan = getCurrentPlan(state.plans_or_histories);
      const currentStep = getCurrentPlanStep(
        state.plans_or_histories,
        state.currentStepIndex
      );
      if (!currentPlan || !currentStep || currentStep.type !== 'message') {
        throw new Error('No plan step available for message update');
      }

      currentPlan.steps[state.currentStepIndex].message = {
        content: content,
        tokens: tokens,
      };
      return currentPlan;
    } else {
      throw new Error(`Unknown execution mode: ${executionMode}`);
    }
  }

  private build_prompt_generator(
    mode: AgentMode,
    context: ExecutorNode
  ): PromptGenerator {
    try {
      let prompt: PromptGenerator;
      if (mode != AgentMode.AUTONOMOUS) {
        throw new Error(`[PlannerGraph] Unsupported agent mode: ${mode}`);
      }
      if (context === ExecutorNode.REASONING_EXECUTOR) {
        prompt = new PromptGenerator();
        prompt.addHeader(headerPromptStandard);
        // Add constraints based on agent mode
        prompt.addConstraint('INDEPENDENT_DECISION_MAKING');
        prompt.addConstraint('DECISION_BASED_ON_DATA_TOOLS');
        prompt.addConstraint('DECISITION_SAFEST_POSSIBLE');
        prompt.addConstraint('NEVER_WAIT_HUMAN');
        prompt.addConstraint('SUBSEQUENT_TASKS');
        prompt.addConstraint(`JSON_RESPONSE_MANDATORY`);

        // add goals
        prompt.addInstruction(EXECUTOR_TASK_GENERATION_INSTRUCTION);
        prompt.addTools(parseToolsToJson(this.toolsList));
        prompt.addPerformanceEvaluation(PERFORMANCE_EVALUATION_PROMPT);
        prompt.setActiveResponseFormat('executor');
        return prompt;
      }
      throw new Error(`[PlannerGraph] No prompt found for context: ${context}`);
    } catch (error) {
      throw error;
    }
  }

  // --- EXECUTOR NODE ---
  private async reasoning_executor(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<
    | {
        messages: BaseMessage[];
        last_node: ExecutorNode;
        plans_or_histories?: ParsedPlan | History;
        currentGraphStep?: number;
      }
    | Command
  > {
    if (!this.agentConfig || !this.modelSelector) {
      throw new Error('Agent configuration and ModelSelector are required.');
    }
    // Validate current execution context
    logger.debug(`[Executor] Current graph step: ${state.currentGraphStep}`);

    const systemPrompt = this.build_prompt_generator(
      config.configurable!.agent_config!.mode,
      ExecutorNode.REASONING_EXECUTOR
    );

    try {
      // Execute model with timeout protection
      const result = await this.executeModelWithTimeout(state, config);
      const content = result.content.toLocaleString();
      const tokens = estimateTokens(content);
      const agentMode = config.configurable?.agent_config?.mode;
      const executionMode = config.configurable?.executionMode;
      // Handle ReAct responses for INTERACTIVE+REACTIVE mode
      if (
        executionMode === ExecutionMode.REACTIVE &&
        agentMode === AgentMode.INTERACTIVE
      ) {
        const reactResult = await this.processReActResponse(
          result,
          content,
          tokens,
          state
        );
        if (reactResult) {
          return reactResult;
        }
      } else {
        // Handle non-ReAct modes with tool calls
        if (result.tool_calls?.length) {
          if (executionMode === ExecutionMode.REACTIVE) {
            const currentHistory = getCurrentHistory(state.plans_or_histories);
            if (currentHistory && currentHistory.items.length === 0) {
              currentHistory.items.push({
                type: 'tools',
                timestamp: Date.now(),
              });
              return {
                messages: [result],
                last_node: ExecutorNode.REASONING_EXECUTOR,
                plans_or_histories: currentHistory,
                currentGraphStep: state.currentGraphStep + 1,
              };
            }
          } else {
            // In planning mode, the tool node will handle updating the plan with tool calls
            return {
              messages: [result],
              last_node: ExecutorNode.REASONING_EXECUTOR,
              plans_or_histories: state.plans_or_histories[0],
              currentGraphStep: state.currentGraphStep + 1,
            };
          }
        }
      }

      // Handle message updates using helper method
      if (!executionMode) {
        throw new Error('Execution mode is required for message updates');
      }

      const updatedPlanOrHistory = this.updatePlanOrHistoryWithMessage(
        executionMode,
        state,
        content,
        tokens
      );

      logger.debug(
        `[Executor] Token tracking: ${tokens} tokens for step ${state.currentStepIndex + 1}`
      );

      return {
        messages: [result],
        last_node: ExecutorNode.REASONING_EXECUTOR,
        plans_or_histories: updatedPlanOrHistory,
        currentGraphStep: state.currentGraphStep + 1,
      };
    } catch (error: any) {
      logger.error(`[Executor] Model invocation failed: ${error.message}`);
      return handleNodeError(
        error,
        'EXECUTOR',
        state,
        'Model invocation failed during execution'
      );
    }
  }

  private async validatorExecutor(
    state: typeof GraphState.State,
    config?: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<
    | {
        messages: BaseMessage[];
        currentStepIndex?: number; // Optional when we are in history mode
        plans_or_histories?: ParsedPlan | History;
        last_node: ExecutorNode;
        retry: number;
        currentGraphStep: number;
      }
    | Command
  > {
    try {
      const retry: number = state.retry;
      const plan_or_history = checkAndReturnObjectFromPlansOrHistories(
        state.plans_or_histories
      );
      const currentItem = checkAndReturnLastItemFromPlansOrHistories(
        state.plans_or_histories,
        state.currentStepIndex
      );
      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('Model not found in ModelSelector');
      }

      const structuredModel = model.withStructuredOutput(
        ValidatorResponseSchema
      );

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', TOOLS_STEP_VALIDATOR_SYSTEM_PROMPT],
        ['ai', VALIDATOR_EXECUTOR_CONTEXT],
      ]);

      const structuredResult = await structuredModel.invoke(
        await prompt.formatMessages({
          formatValidatorInput: formatValidatorToolsExecutor(currentItem),
        })
      );
      if (structuredResult.success === true) {
        if (plan_or_history.type === 'history') {
          const successMessage = new AIMessageChunk({
            content: `Executor Validation successfully - History mode`,
            additional_kwargs: {
              error: false,
              final: true,
              from: ExecutorNode.EXECUTOR_VALIDATOR,
            },
          });
          return {
            messages: [successMessage],
            last_node: ExecutorNode.EXECUTOR_VALIDATOR,
            retry: retry,
            currentGraphStep: state.currentGraphStep + 1,
          };
        }
        const updatedPlan = plan_or_history;
        updatedPlan.steps[state.currentStepIndex].status = 'completed';

        if (state.currentStepIndex === plan_or_history.steps.length - 1) {
          logger.info(
            '[ExecutorValidator] Final step reached - Plan completed'
          );
          const successMessage = new AIMessageChunk({
            content: `Last Step ${state.currentStepIndex + 1} has been success`,
            additional_kwargs: {
              error: false,
              final: true,
              from: ExecutorNode.EXECUTOR_VALIDATOR,
            },
          });
          return {
            messages: [successMessage],
            currentStepIndex: state.currentStepIndex + 1,
            last_node: ExecutorNode.EXECUTOR_VALIDATOR,
            retry: retry,
            plans_or_histories: updatedPlan,
            currentGraphStep: state.currentGraphStep + 1,
          };
        } else {
          logger.info(
            `[ExecutorValidator] Step ${state.currentStepIndex + 1} success successfully`
          );
          const message = new AIMessageChunk({
            content: `Step ${state.currentStepIndex + 1} has been success`,
            additional_kwargs: {
              error: false,
              final: false,
              from: ExecutorNode.EXECUTOR_VALIDATOR,
            },
          });
          return {
            messages: [message],
            currentStepIndex: state.currentStepIndex + 1,
            last_node: ExecutorNode.EXECUTOR_VALIDATOR,
            retry: 0,
            plans_or_histories: updatedPlan,
            currentGraphStep: state.currentGraphStep + 1,
          };
        }
      }

      logger.warn(
        `[ExecutorValidator] Step ${state.currentStepIndex + 1} validation failed - Reason: ${structuredResult.results.join('Reason :')}`
      );
      const notValidateMessage = new AIMessageChunk({
        content: `Step ${state.currentStepIndex + 1} not success - Reason: ${structuredResult.results.join('Reason :')}`,
        additional_kwargs: {
          error: false,
          final: false,
          from: ExecutorNode.EXECUTOR_VALIDATOR,
        },
      });
      return {
        messages: [notValidateMessage],
        currentStepIndex: state.currentStepIndex,
        last_node: ExecutorNode.EXECUTOR_VALIDATOR,
        retry: retry + 1,
        currentGraphStep: state.currentGraphStep + 1,
      };
    } catch (error: any) {
      logger.error(
        `[ExecutorValidator] Failed to validate step: ${error.message}`
      );
      return handleNodeError(
        error,
        ExecutorNode.EXECUTOR_VALIDATOR,
        state,
        'Step validation failed'
      );
    }
  }

  private async toolNodeInvoke(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>,
    originalInvoke: Function
  ): Promise<
    | {
        messages: BaseMessage[];
        last_node: ExecutorNode;
        plans_or_histories: ParsedPlan | History;
      }
    | Command
    | null
  > {
    const lastMessage = state.messages[state.messages.length - 1];
    const toolTimeout = DEFAULT_GRAPH_CONFIG.toolTimeout; // TODO add the field in the agent_configuration;

    const toolCalls =
      lastMessage instanceof AIMessageChunk && lastMessage.tool_calls
        ? lastMessage.tool_calls
        : [];

    if (toolCalls.length > 0) {
      toolCalls.forEach((call) => {
        const argsPreview = JSON.stringify(call.args).substring(
          0,
          STRING_LIMITS.CONTENT_PREVIEW_LENGTH
        );
        const hasMore =
          JSON.stringify(call.args).length >
          STRING_LIMITS.CONTENT_PREVIEW_LENGTH;
        logger.info(
          `[Tools] Executing tool: ${call.name} with args: ${argsPreview}${hasMore ? '...' : ''}`
        );
      });
    }
    const currentItem = checkAndReturnLastItemFromPlansOrHistories(
      state.plans_or_histories,
      state.currentStepIndex
    );
    if (!currentItem || currentItem.item === null) {
      throw new Error(`CurrentItem or Item is undefined.`);
    }
    const startTime = Date.now();

    try {
      // Add timeout wrapper for tool execution
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Tool execution timed out after ${toolTimeout}ms`));
        }, toolTimeout);
      });

      const executionPromise = originalInvoke(state, config);
      const result = await Promise.race([executionPromise, timeoutPromise]);

      const executionTime = Date.now() - startTime;

      let truncatedResult: { messages: ToolMessage[] };
      try {
        truncatedResult = truncateToolResults(result, 100000);
      } catch (error) {
        logger.error(
          `[Tools] Failed to truncate tool results: ${error.message}`
        );
        // Create a fallback result to prevent complete failure
        truncatedResult = {
          messages: [
            new ToolMessage({
              content: `Tool execution completed but result processing failed: ${error.message}`,
              tool_call_id: result.messages?.[0]?.tool_call_id || 'unknown',
              name: result.messages?.[0]?.name || 'unknown_tool',
              additional_kwargs: { from: 'tools', final: false },
            }),
          ],
        };
      }

      logger.debug(`[Tools] Tool execution completed in ${executionTime}ms`);

      truncatedResult.messages.forEach((res) => {
        res.additional_kwargs = {
          from: 'tools',
          final: false,
        };
      });

      // Handle ReAct observation for INTERACTIVE+REACTIVE mode
      const toolExecutionMode = config.configurable?.executionMode;
      const toolAgentMode = config.configurable?.agent_config?.mode;

      if (
        toolExecutionMode === ExecutionMode.REACTIVE &&
        toolAgentMode === AgentMode.INTERACTIVE
      ) {
        // Create ReAct observation from tool results
        const observation = createReActObservation(truncatedResult.messages);

        // Add the observation to the last message's content for ReAct pattern
        if (
          truncatedResult.messages.length > 0 &&
          currentItem.type === 'history' &&
          currentItem.item.message
        ) {
          currentItem.item.message.content =
            currentItem.item.message?.content +
            `**Observation**: ${observation}`;
        }
      }
      // Improved token tracking for tool results with safe content extraction
      let toolResultContent = '';
      try {
        const firstMessage = truncatedResult.messages[0];
        if (firstMessage && firstMessage.content) {
          if (typeof firstMessage.content === 'string') {
            toolResultContent = firstMessage.content;
          } else if (typeof firstMessage.content.toString === 'function') {
            toolResultContent = firstMessage.content.toString();
          } else {
            toolResultContent = String(firstMessage.content);
          }
        }
      } catch (error) {
        logger.warn(
          `[Tools] Failed to extract tool result content: ${error.message}`
        );
        toolResultContent = '[Content extraction failed]';
      }
      const estimatedTokens = estimateTokens(toolResultContent);

      const toolHistoryExecutionMode = config.configurable?.executionMode;
      let updatedPlanOrHistory: ParsedPlan | History;

      if (toolHistoryExecutionMode === ExecutionMode.REACTIVE) {
        const currentHistory = getCurrentHistory(state.plans_or_histories);
        if (currentHistory && currentHistory.items.length > 0) {
          const tools = formatToolsForHistory(truncatedResult.messages);
          currentHistory.items[currentHistory.items.length - 1].tools = tools;
          updatedPlanOrHistory = currentHistory;
        } else {
          throw new Error('No history available for tool results');
        }
      } else if (toolHistoryExecutionMode === ExecutionMode.PLANNING) {
        const currentPlan = getCurrentPlan(state.plans_or_histories);
        const currentStep = getCurrentPlanStep(
          state.plans_or_histories,
          state.currentStepIndex
        );
        if (currentPlan && currentStep) {
          const tools = formatToolsForPlan(
            truncatedResult.messages,
            currentStep
          );
          currentPlan.steps[state.currentStepIndex].tools = tools;
          updatedPlanOrHistory = currentPlan;
        } else {
          throw new Error('No plan step available for tool results');
        }
      } else {
        throw new Error(`Unknown execution mode: ${toolHistoryExecutionMode}`);
      }
      logger.debug(
        `[Tools] Token tracking: ${estimatedTokens} tokens for tool result`
      );

      return {
        ...truncatedResult,
        last_node: ExecutorNode.TOOL_EXECUTOR,
        plans_or_histories: updatedPlanOrHistory,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      if (error.message.includes('timed out')) {
        logger.error(
          `[Tools] ⏱️ Tool execution timed out after ${toolTimeout}ms`
        );
      } else {
        logger.error(
          `[Tools] Tool execution failed after ${executionTime}ms: ${error}`
        );
      }

      return handleNodeError(error, 'TOOLS', state, 'Tool execution failed');
    }
  }

  private createToolNode(): ToolNode {
    const toolNode = new ToolNode(this.toolsList);
    const originalInvoke = toolNode.invoke.bind(toolNode);
    // Override invoke method
    toolNode.invoke = async (
      state: typeof GraphState.State,
      config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
    ): Promise<
      | {
          messages: BaseMessage[];
          last_node: ExecutorNode;
          plans_or_histories: ParsedPlan | History;
        }
      | Command
      | null
    > => {
      return this.toolNodeInvoke(state, config, originalInvoke);
    };

    return toolNode;
  }

  public async humanNode(state: typeof GraphState.State): Promise<{
    messages: BaseMessage[];
    last_node: ExecutorNode;
    currentGraphStep?: number;
  }> {
    const currentItem = checkAndReturnLastItemFromPlansOrHistories(
      state.plans_or_histories,
      state.currentStepIndex
    );
    if (!currentItem || currentItem.item === null) {
      throw new Error(`CurrentItem or item are undefined or null`);
    }
    const input_content: string =
      currentItem.type === 'step'
        ? currentItem.item.description
        : (currentItem.item.message?.content ?? ''); // TODO update this
    logger.info(`[Human] Awaiting human input for: ${input_content}`);
    const input = interrupt(input_content);
    const message = new AIMessageChunk({
      content: input,
      additional_kwargs: {
        from: ExecutorNode.HUMAN,
        final: false,
      },
    });

    return {
      messages: [message],
      last_node: ExecutorNode.HUMAN,
      currentGraphStep: state.currentGraphStep + 1,
    };
  }

  private shouldContinue(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): ExecutorNode {
    if (state.last_node === ExecutorNode.REASONING_EXECUTOR) {
      const lastAiMessage = state.messages[state.messages.length - 1];
      if (
        (lastAiMessage instanceof AIMessageChunk ||
          lastAiMessage instanceof AIMessage) &&
        lastAiMessage.tool_calls?.length
      ) {
        logger.debug(
          `[Router] Detected ${lastAiMessage.tool_calls.length} tool calls, routing to tools node`
        );
        return ExecutorNode.TOOL_EXECUTOR;
      }
    } else if (state.last_node === ExecutorNode.TOOL_EXECUTOR) {
      const maxSteps =
        config.configurable?.max_graph_steps ??
        DEFAULT_GRAPH_CONFIG.maxGraphSteps;
      if (maxSteps <= state.currentGraphStep) {
        logger.warn('[Router] Max graph steps reached, routing to END node');
        return ExecutorNode.END_EXECUTOR_GRAPH;
      } else {
        // For other modes, use validator
        return ExecutorNode.EXECUTOR_VALIDATOR;
      }
    }
    if (state.last_node === ExecutorNode.EXECUTOR_VALIDATOR) {
      if (state.retry != 0 && state.retry < 3) {
        logger.debug(
          '[Router] Execution not validated routing to agent_executor'
        );
        return ExecutorNode.REASONING_EXECUTOR;
      } else if (state.retry >= 3) {
        logger.debug(
          '[Router] Execution not validated and max retry reach routing to end'
        );
        return ExecutorNode.END_EXECUTOR_GRAPH;
      }
      return ExecutorNode.END;
    }
    logger.debug('[Router] Routing to validator');
    return ExecutorNode.EXECUTOR_VALIDATOR;
  }

  private shouldContinueReactive(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): ExecutorNode {
    const executionMode = config.configurable?.executionMode;
    const agentMode = config.configurable?.agent_config?.mode;
    const lastAiMessage = state.messages[state.messages.length - 1];

    if (
      executionMode === ExecutionMode.REACTIVE &&
      agentMode === AgentMode.INTERACTIVE
    ) {
      if (state.last_node === ExecutorNode.REASONING_EXECUTOR) {
        // Handle ReAct responses for INTERACTIVE+REACTIVE mode
        const content = lastAiMessage.content.toString();
        const reactParsed = parseReActResponse(content);

        // Check for final answer in ReAct format
        if (
          reactParsed.isFinalAnswer ||
          lastAiMessage.additional_kwargs?.final === true
        ) {
          logger.info(
            `[Router] ReAct final answer detected, routing to end node`
          );
          return ExecutorNode.END;
        }

        // Check for tool calls in ReAct format
        const hasToolCalls =
          (lastAiMessage instanceof AIMessageChunk ||
            lastAiMessage instanceof AIMessage) &&
          lastAiMessage.tool_calls?.length;
        if (hasToolCalls && lastAiMessage.tool_calls?.length) {
          logger.debug(
            `[Router] ReAct detected ${lastAiMessage.tool_calls.length} tool action, routing to tools node`
          );
          return ExecutorNode.TOOL_EXECUTOR;
        }

        // If it's a thought without action, continue reasoning
        if (reactParsed.steps.length > 0 && !hasToolCalls) {
          logger.debug(
            `[Router] ReAct thought without action, routing to end mode`
          );
          return ExecutorNode.END;
        }
      }
      if (state.last_node === ExecutorNode.TOOL_EXECUTOR) {
        if (
          executionMode === ExecutionMode.REACTIVE &&
          agentMode === AgentMode.INTERACTIVE
        ) {
          logger.debug(
            '[Router] ReAct mode: routing from tools back to reasoning executor'
          );
          return ExecutorNode.END; // Skipping validator for ReAct
        }
      }
    }

    logger.debug('[Router] Routing to end_executor_graph');
    return ExecutorNode.END_EXECUTOR_GRAPH;
  }

  private shouldContinueHybrid(
    state: typeof GraphState.State,
    config?: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): ExecutorNode {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];
    const currentItem = checkAndReturnLastItemFromPlansOrHistories(
      state.plans_or_histories,
      state.currentStepIndex
    );
    if (!currentItem || currentItem.item === null) {
      throw new Error('CurrentItem or Item is undefined or null.');
    }
    if (lastMessage instanceof AIMessageChunk) {
      if (
        lastMessage.additional_kwargs.final === true ||
        lastMessage.content.toString().includes('FINAL ANSWER')
      ) {
        logger.info(`[Router] Final message received, routing to end node`);
        return ExecutorNode.END;
      }
      if (currentItem.item.type === 'human_in_the_loop') {
        return ExecutorNode.HUMAN;
      }
      if (lastMessage.tool_calls?.length) {
        logger.debug(
          `[Router] Detected ${lastMessage.tool_calls.length} tool calls, routing to tools node`
        );
        return ExecutorNode.TOOL_EXECUTOR;
      }
    } else if (lastMessage instanceof ToolMessage) {
      const lastAiMessage = getLatestMessageForMessage(
        messages,
        AIMessageChunk
      );
      if (!lastAiMessage) {
        throw new Error('Error trying to get last AIMessageChunk');
      }
      const graphMaxSteps = config?.configurable?.max_graph_steps as number;

      const iteration = state.currentGraphStep;
      if (graphMaxSteps <= iteration) {
        logger.info(`[Tools] Max steps reached, routing to end node`);
        return ExecutorNode.END;
      }

      logger.debug(
        `[Router] Received ToolMessage, routing back to validator node`
      );
      return ExecutorNode.EXECUTOR_VALIDATOR;
    }
    logger.info('[Router] Routing to validator');
    return ExecutorNode.EXECUTOR_VALIDATOR;
  }

  private executor_router(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): ExecutorNode {
    if (
      (config.configurable?.agent_config?.mode ??
        DEFAULT_GRAPH_CONFIG.agent_config.mode) === AgentMode.HYBRID
    ) {
      logger.debug('[Router] Hybrid mode routing decision');
      return this.shouldContinueHybrid(state, config);
    } else if (config.configurable?.executionMode === ExecutionMode.REACTIVE) {
      logger.debug('[Router] Reactive mode routing decision');
      return this.shouldContinueReactive(state, config);
    } else {
      return this.shouldContinue(state, config);
    }
  }

  private end_planner_graph(state: typeof GraphState.State) {
    logger.info('[EndExecutorGraph] Cleaning up state for graph termination');
    return new Command({
      update: {
        plans_or_histories: undefined,
        currentStepIndex: 0,
        retry: 0,
        skipValidation: { skipValidation: true, goto: 'end_graph' },
      },
      goto: 'end_graph',
      graph: Command.PARENT,
    });
  }
  public getExecutorGraph() {
    return this.graph;
  }

  // TODO ADD End graph and add router for executor validator
  public createAgentExecutorGraph() {
    const tool_executor = this.createToolNode();

    const executor_subgraph = new StateGraph(
      GraphState,
      GraphConfigurableAnnotation
    )
      .addNode(
        ExecutorNode.REASONING_EXECUTOR,
        this.reasoning_executor.bind(this)
      )
      .addNode(ExecutorNode.TOOL_EXECUTOR, tool_executor)
      .addNode(
        ExecutorNode.EXECUTOR_VALIDATOR,
        this.validatorExecutor.bind(this)
      )
      .addNode('human', this.humanNode.bind(this))
      .addNode(
        ExecutorNode.END_EXECUTOR_GRAPH,
        this.end_planner_graph.bind(this)
      )
      .addEdge(START, ExecutorNode.REASONING_EXECUTOR)
      .addConditionalEdges(
        ExecutorNode.REASONING_EXECUTOR,
        this.executor_router.bind(this)
      )
      .addConditionalEdges(
        ExecutorNode.TOOL_EXECUTOR,
        this.executor_router.bind(this)
      )
      .addConditionalEdges(
        ExecutorNode.EXECUTOR_VALIDATOR,
        this.executor_router.bind(this)
      );

    this.graph = executor_subgraph.compile();
  }
}
