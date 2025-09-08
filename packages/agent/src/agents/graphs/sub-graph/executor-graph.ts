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
import {
  StepInfoSchema,
  StepSchema,
  StepSchemaType,
  ValidatorResponseSchema,
} from '@schemas/graph.schemas.js';
import {
  HistoryItem,
  ParsedPlan,
  History,
  ReturnTypeCheckPlanorHistory,
  ToolCallWithId,
  StepType,
  ToolCall,
  Id,
  TaskType,
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
import { cat } from '@huggingface/transformers';
import { ca } from 'zod/v4/locales';

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

  // Invoke Model with Messages
  private async invokeModelWithMessages(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<StepSchemaType> {
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
    const structuredModel = model.withStructuredOutput(StepSchema);

    const result = (await structuredModel.invoke(
      await prompt.formatMessages({
        header: prompts.generateNumberedList(prompts.getHeader()),
        goal: state.tasks[0].speak,
        constraints: prompts.generateNumberedList(
          prompts.getConstraints(),
          'constraint'
        ),
        short_term_memory: state.memories.stm.items
          .map((item) => {
            if (item) {
              return item.content;
            }
          })
          .join('\n'),
        long_term_memory: '',
        resources: prompts.generateNumberedList(
          prompts.getResources(),
          'resource'
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
    )) as StepSchemaType;
    if (!result) {
      throw new Error(
        'Model invocation returned no result. Please check the model configuration.'
      );
    }

    TokenTracker.trackCall(result, 'selectedModelType.model_name');
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
  ): Promise<StepSchemaType> {
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
    ])) as StepSchemaType;
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
        prompt.addConstraints([
          'INDEPENDENT_DECISION_MAKING',
          'DECISION_BASED_ON_DATA_TOOLS',
          'DECISITION_SAFEST_POSSIBLE',
          'NEVER_WAIT_HUMAN',
          'SUBSEQUENT_TASKS',
          'JSON_RESPONSE_MANDATORY',
        ]);
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
        tasks?: TaskType[];
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
      let toolCall: ToolCall<'id'> | undefined = undefined;
      if (result.tool) {
        if (result.tool.name === `end_task`) {
          logger.info(
            `[Executor] End task signal received. Marking task as completed and terminating execution.`
          );
          // Mark current task as completed
          const currentTask = state.tasks[state.currentTaskIndex];
          if (currentTask) {
            currentTask.status = 'completed';
            logger.info(
              `[Executor] Task "${currentTask.text}" marked as completed`
            );
          }
          return interrupt('End task signal received from executor.');
        } else {
          toolCall = {
            name: result.tool.name,
            args:
              result.tool.args && Object.keys(result.tool.args).length > 0
                ? result.tool.args
                : { noParams: {} },
            id: `snak_${uuidv4()}`,
            type: 'tool_call',
          };
        }
      }
      console.log(toolCall);
      const toolInfo = {
        name: result.tool.name,
        args:
          result.tool.args && Object.keys(result.tool.args).length > 0
            ? result.tool.args
            : { noParams: {} },
        result: '',
        status: 'pending' as 'pending',
      };
      let step_save: StepType = {
        thoughts: result.thoughts,
        tool: toolInfo,
      };
      const newMessage = new AIMessageChunk({
        content: JSON.stringify(result),
        additional_kwargs: { from: ExecutorNode.REASONING_EXECUTOR },
      });
      newMessage.tool_calls = toolCall ? [toolCall] : [];
      state.tasks[state.currentTaskIndex].steps.push(step_save);
      console.log(JSON.stringify(newMessage, null, 2));
      // Handle ReAct responses for INTERACTIVE+REACTIVE mode

      return {
        messages: [newMessage],
        last_node: ExecutorNode.REASONING_EXECUTOR,
        tasks: state.tasks,
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

  private async toolNodeInvoke(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>,
    originalInvoke: Function
  ): Promise<
    | {
        messages: BaseMessage[];
        last_node: ExecutorNode;
        taks: TaskType[];
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
      const currentTask = state.tasks[state.currentTaskIndex];
      if (!currentTask) {
        throw new Error('Current task is undefined');
      }
      currentTask.steps[currentTask.steps.length - 1].tool = {
        name: currentTask.steps[currentTask.steps.length - 1].tool.name,
        args: currentTask.steps[currentTask.steps.length - 1].tool.args,
        result: toolResultContent,
        status: 'completed',
      };
      state.tasks[state.currentTaskIndex] = currentTask;
      logger.debug(
        `[Tools] Token tracking: ${estimatedTokens} tokens for tool result`
      );

      return {
        ...truncatedResult,
        last_node: ExecutorNode.TOOL_EXECUTOR,
        taks: state.tasks,
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
          taks: TaskType[];
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
    logger.info(`[Human] Awaiting human input for: `);
    const input = interrupt('input_content');
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
        return ExecutorNode.END;
      }
    }
    return ExecutorNode.END;
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
      return this.shouldContinue(state, config);
    } else if (config.configurable?.executionMode === ExecutionMode.REACTIVE) {
      logger.debug('[Router] Reactive mode routing decision');
      return this.shouldContinue(state, config);
    } else {
      return this.shouldContinue(state, config);
    }
  }

  private end_planner_graph(state: typeof GraphState.State) {
    logger.info('[EndExecutorGraph] Cleaning up state for graph termination');
    return new Command({
      update: {
        plans_or_histories: undefined,
        currentTaskIndex: 0,
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
      );

    this.graph = executor_subgraph.compile();
  }
}
