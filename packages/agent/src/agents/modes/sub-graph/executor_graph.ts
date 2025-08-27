import {
  AIMessageChunk,
  BaseMessage,
  ToolMessage,
} from '@langchain/core/messages';
import {
  Annotation,
  START,
  END,
  StateGraph,
  CompiledStateGraph,
  Command,
  interrupt,
} from '@langchain/langgraph';
import { Agent, Memories, ParsedPlan } from '../types/index.js';
import {
  createMaxIterationsResponse,
  estimateTokens,
  filterMessagesByShortTermMemory,
  formatExecutionMessage,
  formatShortMemoryMessage,
  formatStepForSTM,
  formatSTMforContext,
  formatToolResponse,
  formatValidatorToolsExecutor,
  getLatestMessageForMessage,
  handleModelError,
  isTerminalMessage,
  ValidatorResponseSchema,
} from '../utils.js';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AnyZodObject, z } from 'zod';
import { AgentConfig, AgentMode, logger } from '@snakagent/core';
import { ModelSelector } from '../../../agents/operators/modelSelector.js';
import { AutonomousConfigurableAnnotation } from '../autonomous.js';
import { RunnableConfig } from '@langchain/core/runnables';
import { v4 as uuidv4 } from 'uuid';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import {
  ExecutorNode,
  DEFAULT_AUTONOMOUS_CONFIG,
} from '../config/autonomous-config.js';
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
import {
  JSONstringifyLTM,
  JSONstringifySTM,
  MemoryStateManager,
} from '../utils/memory-utils.js';

export type ExecutorStateType = typeof ExecutorState.State;

export const ExecutorState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  last_message: Annotation<BaseMessage | BaseMessage[]>,
  last_agent: Annotation<Agent>,
  memories: Annotation<Memories>,
  plan: Annotation<ParsedPlan>,
  currentStepIndex: Annotation<number>,
  currentGraphStep: Annotation<number>,
  retry: Annotation<number>,
});

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
    state: typeof ExecutorState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): ChatPromptTemplate {
    const currentStep = state.plan.steps[state.currentStepIndex];
    if (!currentStep) {
      throw new Error(`No step found at index ${state.currentStepIndex}`);
    }
    let systemPrompt;
    let contextPrompt;
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
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      ['ai', contextPrompt],
    ]);
    return prompt;
  }

  private async invokeModelWithMessages(
    state: typeof ExecutorState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>,
    prompt: ChatPromptTemplate
  ): Promise<AIMessageChunk> {
    const currentStep = state.plan.steps[state.currentStepIndex];
    const execution_context = formatExecutionMessage(currentStep);
    const formattedPrompt = await prompt.formatMessages({
      rejected_reason: Array.isArray(state.last_message)
        ? state.last_message[0].content
        : (state.last_message as BaseMessage).content,
      short_term_memory: JSONstringifySTM(state.memories.stm),
      long_term_memory: JSONstringifyLTM(state.memories.ltm),
      execution_context: execution_context,
    });

    const selectedModelType = await this.modelSelector!.selectModelForMessages(
      state.plan.steps[state.currentStepIndex].description
    );
    let model;
    if (currentStep.type === 'tools') {
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
      `[Executor] Invoking model (${selectedModelType.model_name}) with ${currentStep.type} execution`
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
    state: typeof ExecutorState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): Promise<{
    last_message: BaseMessage;
    messages: BaseMessage;
    last_agent: Agent;
    plan?: ParsedPlan;
    currentGraphStep?: number;
  }> {
    if (!this.agentConfig || !this.modelSelector) {
      throw new Error('Agent configuration and ModelSelector are required.');
    }

    const currentStep = state.plan.steps[state.currentStepIndex];
    if (!currentStep) {
      const errorMessage = `No step found at index ${state.currentStepIndex}. Plan has ${state.plan.steps.length} steps.`;
      logger.error(`[Executor] ${errorMessage}`);
      throw new Error(errorMessage);
    }
    logger.info(
      `[Executor] Processing step ${state.currentStepIndex + 1} - ${currentStep.stepName}`
    );

    const maxGraphSteps =
      config.configurable?.max_graph_steps ??
      DEFAULT_AUTONOMOUS_CONFIG.maxGraphSteps;
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
        return {
          messages: result,
          last_message: result,
          last_agent: Agent.EXECUTOR,
          currentGraphStep: state.currentGraphStep + 1,
        };
      }

      const content = result.content.toLocaleString();
      const updatedPlan = state.plan;

      let tokens = 0;
      if (currentStep.type === 'tools') {
        tokens =
          result.response_metadata?.usage?.completion_tokens ||
          result.response_metadata?.usage?.total_tokens ||
          estimateTokens(content);
      } else {
        tokens = estimateTokens(content);
      }

      updatedPlan.steps[state.currentStepIndex].result = {
        content: content,
        tokens: tokens,
      };

      logger.debug(
        `[Executor] Token tracking: ${tokens} tokens for step ${state.currentStepIndex + 1}`
      );

      return {
        messages: result,
        last_message: result,
        last_agent: Agent.EXECUTOR,
        plan: updatedPlan,
        currentGraphStep: state.currentGraphStep + 1,
      };
    } catch (error: any) {
      logger.error(`[Executor] Model invocation failed: ${error.message}`);
      const result = handleModelError(error);
      return {
        ...result,
        last_message: result.messages,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  private async validatorExecutor(
    state: typeof ExecutorState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): Promise<{
    last_message: BaseMessage;
    currentStepIndex: number;
    plan?: ParsedPlan;
    last_agent: Agent;
    retry: number;
    currentGraphStep: number;
  }> {
    try {
      const retry: number = state.retry;
      const currentStep = state.plan.steps[state.currentStepIndex];

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
          formatValidatorInput: formatValidatorToolsExecutor(currentStep),
        })
      );
      if (structuredResult.success === true) {
        const updatedPlan = state.plan;
        updatedPlan.steps[state.currentStepIndex].status = 'completed';

        if (state.currentStepIndex === state.plan.steps.length - 1) {
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
            last_message: successMessage,
            currentStepIndex: state.currentStepIndex + 1,
            last_agent: Agent.EXEC_VALIDATOR,
            retry: retry,
            plan: updatedPlan,
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
            last_message: message,
            currentStepIndex: state.currentStepIndex + 1,
            last_agent: Agent.EXEC_VALIDATOR,
            retry: 0,
            plan: updatedPlan,
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
        last_message: notValidateMessage,
        currentStepIndex: state.currentStepIndex,
        last_agent: Agent.EXEC_VALIDATOR,
        retry: retry + 1,
        currentGraphStep: state.currentGraphStep + 1,
      };
    } catch (error) {
      logger.error(
        `[ExecutorValidator] Failed to validate step: ${error.message}`
      );
      const errorPlan = state.plan;
      errorPlan.steps[state.currentStepIndex].status = 'failed';

      const errorMessage = new AIMessageChunk({
        content: `Failed to validate plan: ${error.message}`,
        additional_kwargs: {
          error: true,
          final: false,
          success: false,
          from: Agent.EXEC_VALIDATOR,
        },
      });
      return {
        last_message: errorMessage,
        currentStepIndex: state.currentStepIndex,
        last_agent: Agent.EXEC_VALIDATOR,
        plan: errorPlan,
        retry: -1,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  private async toolNodeInvoke(
    state: typeof ExecutorState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>,
    originalInvoke: Function
  ): Promise<{
    messages: BaseMessage[];
    last_message: BaseMessage[];
    last_agent: Agent;
    plan: ParsedPlan;
  } | null> {
    const lastMessage = state.last_message;
    const toolTimeout = DEFAULT_AUTONOMOUS_CONFIG.toolTimeout; // TODO add the field in the agent_configuration;

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
        truncatedResult = truncateToolResults(
          result,
          100000,
          state.plan.steps[state.currentStepIndex]
        );
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

      const updatedPlan = { ...state.plan };
      const currentStep = { ...updatedPlan.steps[state.currentStepIndex] };

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

      currentStep.result = {
        content: toolResultContent,
        tokens: estimatedTokens,
      };

      updatedPlan.steps[state.currentStepIndex] = formatToolResponse(
        truncatedResult.messages,
        currentStep
      );

      logger.debug(
        `[Tools] Token tracking: ${estimatedTokens} tokens for tool result`
      );

      return {
        ...truncatedResult,
        last_message: truncatedResult.messages,
        last_agent: Agent.TOOLS,
        plan: updatedPlan,
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
      state: typeof ExecutorState.State,
      config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
    ): Promise<{
      messages: BaseMessage[];
      last_agent: Agent;
      last_message: BaseMessage | BaseMessage[];
      plan: ParsedPlan;
    } | null> => {
      return this.toolNodeInvoke(state, config, originalInvoke);
    };

    return toolNode;
  }

  public async humanNode(state: typeof ExecutorState.State): Promise<{
    last_message: BaseMessage;
    messages: BaseMessage;
    last_agent: Agent;
    currentGraphStep?: number;
  }> {
    const currentStep = state.plan.steps[state.currentStepIndex];
    const input = interrupt(currentStep.description);
    const message = new AIMessageChunk({
      content: input,
      additional_kwargs: {
        from: Agent.HUMAN,
        final: false,
      },
    });

    return {
      messages: message,
      last_agent: Agent.HUMAN,
      last_message: message,
      currentGraphStep: state.currentGraphStep + 1,
    };
  }

  private shouldContinueAutonomous(
    state: typeof ExecutorState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ):
    | 'tool_executor'
    | 'executor_validator'
    | 'end'
    | 'planning_orchestrator'
    | 'end_executor_graph' {
    if (state.last_agent === Agent.EXECUTOR) {
      const lastAiMessage = state.last_message as AIMessageChunk;
      if (isTerminalMessage(lastAiMessage)) {
        logger.info(`[Router] Final message received, routing to end node`);
        return 'end';
      }
      if (lastAiMessage.content.toLocaleString().includes('REQUEST_REPLAN')) {
        logger.debug('[Router] REQUEST_REPLAN detected, routing to re_planner');

        return 'planning_orchestrator';
      }
      if (lastAiMessage.tool_calls?.length) {
        logger.debug(
          `[Router] Detected ${lastAiMessage.tool_calls.length} tool calls, routing to tools node`
        );
        return 'tool_executor';
      }
    } else if (state.last_agent === Agent.TOOLS) {
      const maxSteps = config.configurable?.max_graph_steps ?? 100;
      if (maxSteps <= state.currentGraphStep) {
        logger.warn('[Router] Max graph steps reached, routing to END node');
        return 'end_executor_graph';
      } else {
        return 'executor_validator';
      }
    }
    logger.debug('[Router] Routing to validator');
    return 'executor_validator';
  }

  private shouldContinueHybrid(
    state: typeof ExecutorState.State,
    config?: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): 'tool_executor' | 'executor_validator' | 'end' | 'human' {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];

    if (lastMessage instanceof AIMessageChunk) {
      if (
        lastMessage.additional_kwargs.final === true ||
        lastMessage.content.toString().includes('FINAL ANSWER')
      ) {
        logger.info(`[Router] Final message received, routing to end node`);
        return 'end';
      }
      if (
        state.plan.steps[state.currentStepIndex].type === 'human_in_the_loop'
      ) {
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
    state: typeof ExecutorState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): ExecutorNode {
    if (config.configurable?.agent_config?.mode === AgentMode.HYBRID) {
      return this.shouldContinueHybrid(state, config) as ExecutorNode;
    } else {
      return this.shouldContinueAutonomous(state, config) as ExecutorNode;
    }
  }

  private end_planner_graph(state: typeof ExecutorState.State) {
    logger.info('[EndExecutorGraph] Cleaning up state for graph termination');
    const emptyPlan: ParsedPlan = {
      steps: [],
      summary: '',
    };
    return new Command({
      update: {
        plan: emptyPlan,
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
      ExecutorState,
      AutonomousConfigurableAnnotation
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
      .addConditionalEdges('tool_executor', this.executor_router.bind(this));

    this.graph = executor_subgraph.compile();
  }
}
