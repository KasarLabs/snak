import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ToolMessage,
} from '@langchain/core/messages';
import {
  Annotation,
  START,
  StateGraph,
  Command,
  interrupt,
} from '@langchain/langgraph';
import {
  Agent,
  History,
  HistoryItem,
  HistoryToolsInfo,
  Memories,
  ParsedPlan,
  StepInfo,
  StepToolsInfo,
} from '../types/index.js';
import {
  checkAndReturnLastItemFromPlansOrHistories,
  checkAndReturnObjectFromPlansOrHistories,
  getCurrentPlanStep,
  getCurrentHistoryItem,
  getCurrentPlan,
  getCurrentHistory,
  createMaxIterationsResponse,
  estimateTokens,
  formatExecutionMessage,
  formatStepsForContext,
  formatToolResponse,
  formatToolsForPlan,
  formatToolsForHistory,
  formatValidatorToolsExecutor,
  getLatestMessageForMessage,
  handleModelError,
  isTerminalMessage,
  ReturnTypeCheckPlanorHistory,
  ValidatorResponseSchema,
} from '../utils.js';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AnyZodObject, z } from 'zod';
import { AgentConfig, AgentMode, logger } from '@snakagent/core';
import { ModelSelector } from '../../../agents/operators/modelSelector.js';
import {
  GraphConfigurableAnnotation,
  GraphState,
  ExecutionMode,
} from '../graph.js';
import { RunnableConfig } from '@langchain/core/runnables';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import {
  ExecutorNode,
  DEFAULT_GRAPH_CONFIG,
  PlannerMode,
} from '../config/default-config.js';
import {
  TOOLS_STEP_VALIDATOR_SYSTEM_PROMPT,
  VALIDATOR_EXECUTOR_CONTEXT,
} from '../../../prompt/validator_prompt.js';
import { truncateToolResults } from '../../../agents/core/utils.js';
import { TokenTracker } from '../../../token/tokenTracking.js';
import {
  MESSAGE_STEP_EXECUTOR_SYSTEM_PROMPT,
  RETRY_MESSAGE_STEP_EXECUTOR_SYSTEM_PROMPT,
  RETRY_STEP_EXECUTOR_CONTEXT_PROMPT,
  RETRY_TOOLS_STEP_EXECUTOR_SYSTEM_PROMPT,
  STEP_EXECUTOR_CONTEXT_PROMPT,
  TOOLS_STEP_EXECUTOR_SYSTEM_PROMPT,
} from '../../../prompt/executor_prompts.js';
import { JSONstringifyLTM } from '../utils/memory-utils.js';
import { v4 as uuidv4 } from 'uuid';
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
  private buildSystemPrompt(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): ChatPromptTemplate {
    let systemPrompt;
    let contextPrompt;

    if (state.executionMode === ExecutionMode.REACTIVE) {
      systemPrompt = TOOLS_STEP_EXECUTOR_SYSTEM_PROMPT;
      contextPrompt = STEP_EXECUTOR_CONTEXT_PROMPT;
    } else if (state.executionMode === ExecutionMode.PLANNING) {
      const currentStep = getCurrentPlanStep(
        state.plans_or_histories,
        state.currentStepIndex
      );
      if (!currentStep) {
        throw new Error(`No step found at index ${state.currentStepIndex}`);
      }

      if (state.retry === 0) {
        if (currentStep.type === 'tools') {
          systemPrompt = TOOLS_STEP_EXECUTOR_SYSTEM_PROMPT;
        } else {
          systemPrompt = MESSAGE_STEP_EXECUTOR_SYSTEM_PROMPT;
        }
        contextPrompt = STEP_EXECUTOR_CONTEXT_PROMPT;
      } else {
        if (currentStep.type === 'tools') {
          systemPrompt = RETRY_TOOLS_STEP_EXECUTOR_SYSTEM_PROMPT;
        } else {
          systemPrompt = RETRY_MESSAGE_STEP_EXECUTOR_SYSTEM_PROMPT;
        }
        contextPrompt = RETRY_STEP_EXECUTOR_CONTEXT_PROMPT;
      }
    } else {
      throw new Error(`Unknown execution mode: ${state.executionMode}`);
    }

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      ['ai', contextPrompt],
    ]);
    return prompt;
  }

  private async invokeModelWithMessages(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>,
    currentItem: ReturnTypeCheckPlanorHistory,
    prompt: ChatPromptTemplate
  ): Promise<AIMessageChunk> {
    const l_msg = state.messages[state.messages.length - 1];

    const execution_context = // This is safe because if item type is step, it meens that we are in a interactive mode
      currentItem.type === 'step'
        ? formatExecutionMessage(currentItem.item)
        : (config.configurable?.user_request ?? '');
    const formattedPrompt = await prompt.formatMessages({
      rejected_reason: l_msg.content,
      short_term_memory: formatStepsForContext(
        state.memories.stm.items
          .map((item) => item?.step_or_history)
          .filter(
            (step_or_history): step_or_history is StepInfo =>
              step_or_history !== undefined
          )
      ),
      long_term_memory: JSONstringifyLTM(state.memories.ltm),
      execution_context: execution_context,
    });

    const selectedModelType = await this.modelSelector!.selectModelForMessages(
      execution_context ?? config.configurable?.user_request ?? ''
    );
    let model;
    if (currentItem.type === 'history' || currentItem.item.type === 'tools') {
      // So we give in case where we are in history mode or tools mode, the tools to the model (the prompt will be different for both cases)
      model =
        typeof selectedModelType.model.bindTools === 'function'
          ? selectedModelType.model.bindTools(this.toolsList)
          : undefined;

      if (model === undefined) {
        throw new Error('Failed to bind tools to model');
      }
    } else {
      model = selectedModelType.model;
    }
    logger.debug(
      `[Executor] Invoking model (${selectedModelType.model_name}) with ${currentItem.item?.type} execution`
    );
    const result = await model.invoke(formattedPrompt);
    if (!result) {
      throw new Error(
        'Model invocation returned no result. Please check the model configuration.'
      );
    }

    TokenTracker.trackCall(result, selectedModelType.model_name);

    // Add metadata to result
    result.additional_kwargs = {
      ...result.additional_kwargs,
      from: Agent.EXECUTOR,
      final: false,
    };
    return result;
  }

  // --- EXECUTOR NODE ---
  private async reasoning_executor(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<{
    messages: BaseMessage[];
    last_agent: Agent;
    plans_or_histories?: ParsedPlan | History;
    currentGraphStep?: number;
  }> {
    if (!this.agentConfig || !this.modelSelector) {
      throw new Error('Agent configuration and ModelSelector are required.');
    }

    // Initialize based on execution mode
    if (state.plans_or_histories.length === 0) {
      if (state.executionMode === ExecutionMode.REACTIVE) {
        state.plans_or_histories.push({
          type: 'history',
          id: uuidv4(),
          items: [],
        });
      } else {
        throw new Error('Planning mode requires a plan to be set');
      }
    }
    const currentItem = checkAndReturnLastItemFromPlansOrHistories(
      state.plans_or_histories,
      state.currentStepIndex
    );
    let currentPlanorHistory = checkAndReturnObjectFromPlansOrHistories(
      state.plans_or_histories
    );
    logger.info(`[Executor] Processing...`);
    const maxGraphSteps =
      config.configurable?.max_graph_steps ??
      DEFAULT_GRAPH_CONFIG.maxGraphSteps;
    const graphStep = state.currentGraphStep;

    if (maxGraphSteps && maxGraphSteps <= graphStep) {
      logger.warn(`[Executor] Maximum iterations (${maxGraphSteps}) reached`);
      return createMaxIterationsResponse(graphStep);
    }

    logger.debug(`[Executor] Current graph step: ${state.currentGraphStep}`);

    const autonomousSystemPrompt = this.buildSystemPrompt(state, config);

    try {
      const modelPromise = this.invokeModelWithMessages(
        state,
        config,
        currentItem,
        autonomousSystemPrompt
      );

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Model invocation timeout')), 45000);
      });

      const result = (await Promise.race([
        modelPromise,
        timeoutPromise,
      ])) as AIMessageChunk;
      if (result.tool_calls?.length) {
        if (state.executionMode === ExecutionMode.REACTIVE) {
          const currentHistory = getCurrentHistory(state.plans_or_histories);
          if (currentHistory && currentHistory.items.length === 0) {
            currentHistory.items.push({
              type: 'tools',
              timestamp: Date.now(),
            });
            return {
              messages: [result],
              last_agent: Agent.EXECUTOR,
              plans_or_histories: currentHistory,
              currentGraphStep: state.currentGraphStep + 1,
            };
          }
        } else {
          return {
            // In planning mode, the tool node will handle updating the plan with tool calls
            messages: [result],
            last_agent: Agent.EXECUTOR,
            plans_or_histories: state.plans_or_histories[0],
            currentGraphStep: state.currentGraphStep + 1,
          };
        }
      }
      const content = result.content.toLocaleString();
      console.log('Executor Result:', content);
      console.log(state.plans_or_histories);
      const tokens = estimateTokens(content);

      let updatedPlanOrHistory: ParsedPlan | History;

      if (state.executionMode === ExecutionMode.REACTIVE) {
        const currentHistory = getCurrentHistory(state.plans_or_histories);
        if (currentHistory) {
          const historyItem: HistoryItem = {
            type: 'message',
            message: {
              content: content,
              tokens: tokens,
            },
            timestamp: Date.now(),
          };
          currentHistory.items.push(historyItem);
          updatedPlanOrHistory = currentHistory;
        } else {
          throw new Error('No history available for message update');
        }
      } else if (state.executionMode === ExecutionMode.PLANNING) {
        const currentPlan = getCurrentPlan(state.plans_or_histories);
        const currentStep = getCurrentPlanStep(
          state.plans_or_histories,
          state.currentStepIndex
        );
        if (currentPlan && currentStep && currentStep.type === 'message') {
          currentPlan.steps[state.currentStepIndex].message = {
            content: content,
            tokens: tokens,
          };
          updatedPlanOrHistory = currentPlan;
        } else {
          throw new Error('No plan step available for message update');
        }
      } else {
        throw new Error(`Unknown execution mode: ${state.executionMode}`);
      }

      currentPlanorHistory = updatedPlanOrHistory;

      logger.debug(
        `[Executor] Token tracking: ${tokens} tokens for step ${state.currentStepIndex + 1}`
      );
      console.log(currentPlanorHistory);
      return {
        messages: [result],
        last_agent: Agent.EXECUTOR,
        plans_or_histories: currentPlanorHistory,
        currentGraphStep: state.currentGraphStep + 1,
      };
    } catch (error: any) {
      logger.error(`[Executor] Model invocation failed: ${error.message}`);
      const result = handleModelError(error);
      return {
        ...result,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  private async validatorExecutor(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<{
    messages: BaseMessage[];
    currentStepIndex?: number; // Optional when we are in history mode
    plans_or_histories?: ParsedPlan | History;
    last_agent: Agent;
    retry: number;
    currentGraphStep: number;
  }> {
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
          console.log(JSON.stringify(state.plans_or_histories, null, 2));
          const successMessage = new AIMessageChunk({
            content: `Executor Validation successfully - History mode`,
            additional_kwargs: {
              error: false,
              final: true,
              from: Agent.EXEC_VALIDATOR,
            },
          });
          return {
            messages: [successMessage],
            last_agent: Agent.EXEC_VALIDATOR,
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
              from: Agent.EXEC_VALIDATOR,
            },
          });
          return {
            messages: [successMessage],
            currentStepIndex: state.currentStepIndex + 1,
            last_agent: Agent.EXEC_VALIDATOR,
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
              from: Agent.EXEC_VALIDATOR,
            },
          });
          return {
            messages: [message],
            currentStepIndex: state.currentStepIndex + 1,
            last_agent: Agent.EXEC_VALIDATOR,
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
          from: Agent.EXEC_VALIDATOR,
        },
      });
      return {
        messages: [notValidateMessage],
        currentStepIndex: state.currentStepIndex,
        last_agent: Agent.EXEC_VALIDATOR,
        retry: retry + 1,
        currentGraphStep: state.currentGraphStep + 1,
      };
    } catch (error) {
      logger.error(
        `[ExecutorValidator] Failed to validate step: ${error.message}`
      );
      const errorPlan = checkAndReturnObjectFromPlansOrHistories(
        state.plans_or_histories
      );
      if (errorPlan.type === 'plan') {
        errorPlan.steps[state.currentStepIndex].status = 'failed';
      }

      const errorMessage = new AIMessageChunk({
        content: `Failed to validate plans_or_histories: ${error.message}`,
        additional_kwargs: {
          error: true,
          final: false,
          success: false,
          from: Agent.EXEC_VALIDATOR,
        },
      });
      return {
        messages: [errorMessage],
        currentStepIndex: state.currentStepIndex,
        last_agent: Agent.EXEC_VALIDATOR,
        plans_or_histories: errorPlan,
        retry: -1,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  private async toolNodeInvoke(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>,
    originalInvoke: Function
  ): Promise<{
    messages: BaseMessage[];
    last_agent: Agent;
    plans_or_histories: ParsedPlan | History;
  } | null> {
    const lastMessage = state.messages[state.messages.length - 1];
    const toolTimeout = DEFAULT_GRAPH_CONFIG.toolTimeout; // TODO add the field in the agent_configuration;

    const toolCalls =
      lastMessage instanceof AIMessageChunk && lastMessage.tool_calls
        ? lastMessage.tool_calls
        : [];

    if (toolCalls.length > 0) {
      toolCalls.forEach((call) => {
        const argsPreview = JSON.stringify(call.args).substring(0, 150);
        const hasMore = JSON.stringify(call.args).length > 150;
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

      const toolsInfos: StepToolsInfo[] | HistoryToolsInfo = [];
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

      let updatedPlanOrHistory: ParsedPlan | History;

      if (state.executionMode === ExecutionMode.REACTIVE) {
        const currentHistory = getCurrentHistory(state.plans_or_histories);
        if (currentHistory && currentHistory.items.length > 0) {
          const tools = formatToolsForHistory(truncatedResult.messages);
          currentHistory.items[currentHistory.items.length - 1].tools = tools;
          updatedPlanOrHistory = currentHistory;
        } else {
          throw new Error('No history available for tool results');
        }
      } else if (state.executionMode === ExecutionMode.PLANNING) {
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
        throw new Error(`Unknown execution mode: ${state.executionMode}`);
      }
      logger.debug(
        `[Tools] Token tracking: ${estimatedTokens} tokens for tool result`
      );

      return {
        ...truncatedResult,
        last_agent: Agent.TOOLS,
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

      throw error;
    }
  }

  private createToolNode(): ToolNode {
    const toolNode = new ToolNode(this.toolsList);
    const originalInvoke = toolNode.invoke.bind(toolNode);
    // Override invoke method
    toolNode.invoke = async (
      state: typeof GraphState.State,
      config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
    ): Promise<{
      messages: BaseMessage[];
      last_agent: Agent;
      plans_or_histories: ParsedPlan | History;
    } | null> => {
      return this.toolNodeInvoke(state, config, originalInvoke);
    };

    return toolNode;
  }

  public async humanNode(state: typeof GraphState.State): Promise<{
    messages: BaseMessage[];
    last_agent: Agent;
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
        from: Agent.HUMAN,
        final: false,
      },
    });

    return {
      messages: [message],
      last_agent: Agent.HUMAN,
      currentGraphStep: state.currentGraphStep + 1,
    };
  }

  private shouldContinueAutonomous(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ):
    | 'reasoning_executor'
    | 'tool_executor'
    | 'executor_validator'
    | 'end'
    | 'planning_orchestrator'
    | 'end_executor_graph' {
    if (state.last_agent === Agent.EXECUTOR) {
      const lastAiMessage = state.messages[state.messages.length - 1];
      if (isTerminalMessage(lastAiMessage)) {
        logger.info(`[Router] Final message received, routing to end node`);
        return 'end';
      }
      if (lastAiMessage.content.toLocaleString().includes('REQUEST_REPLAN')) {
        logger.debug('[Router] REQUEST_REPLAN detected, routing to re_planner');

        return 'planning_orchestrator';
      }
      if (
        (lastAiMessage instanceof AIMessageChunk ||
          lastAiMessage instanceof AIMessage) &&
        lastAiMessage.tool_calls?.length
      ) {
        logger.debug(
          `[Router] Detected ${lastAiMessage.tool_calls.length} tool calls, routing to tools node`
        );
        return 'tool_executor';
      }
    } else if (state.last_agent === Agent.TOOLS) {
      const maxSteps =
        config.configurable?.max_graph_steps ??
        DEFAULT_GRAPH_CONFIG.maxGraphSteps;
      if (maxSteps <= state.currentGraphStep) {
        logger.warn('[Router] Max graph steps reached, routing to END node');
        return 'end_executor_graph';
      } else {
        return 'executor_validator';
      }
    }
    if (state.last_agent === Agent.EXEC_VALIDATOR) {
      if (state.retry != 0 && state.retry < 3) {
        logger.debug(
          '[Router] Execution not validated routing to agent_executor'
        );
        return 'reasoning_executor';
      } else if (state.retry >= 3) {
        logger.debug(
          '[Router] Execution not validated and max retry reach routing to end'
        );
        return 'end_executor_graph';
      }
      return 'end';
    }
    logger.debug('[Router] Routing to validator');
    return 'executor_validator';
  }

  private shouldContinueHybrid(
    state: typeof GraphState.State,
    config?: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): 'tool_executor' | 'executor_validator' | 'end' | 'human' {
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
        return 'end';
      }
      if (currentItem.item.type === 'human_in_the_loop') {
        return 'human';
      }
      if (lastMessage.tool_calls?.length) {
        logger.debug(
          `[Router] Detected ${lastMessage.tool_calls.length} tool calls, routing to tools node`
        );
        return 'tool_executor';
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
        return 'end';
      }

      logger.debug(
        `[Router] Received ToolMessage, routing back to validator node`
      );
      return 'executor_validator';
    }
    logger.info('[Router] Routing to validator');
    return 'executor_validator';
  }

  private executor_router(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): ExecutorNode {
    if (
      (config.configurable?.agent_config?.mode ??
        DEFAULT_GRAPH_CONFIG.agent_config.mode) === AgentMode.HYBRID
    ) {
      console.log('Hybride');
      return this.shouldContinueHybrid(state, config) as ExecutorNode;
    } else {
      return this.shouldContinueAutonomous(state, config) as ExecutorNode;
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
      .addNode('reasoning_executor', this.reasoning_executor.bind(this))
      .addNode('tool_executor', tool_executor)
      .addNode('executor_validator', this.validatorExecutor.bind(this))
      .addNode('human', this.humanNode.bind(this))
      .addNode('end_executor_graph', this.end_planner_graph.bind(this))
      .addEdge(START, 'reasoning_executor')
      .addConditionalEdges(
        'reasoning_executor',
        this.executor_router.bind(this)
      )
      .addConditionalEdges('tool_executor', this.executor_router.bind(this))
      .addConditionalEdges(
        'executor_validator',
        this.executor_router.bind(this)
      );

    this.graph = executor_subgraph.compile();
  }
}
