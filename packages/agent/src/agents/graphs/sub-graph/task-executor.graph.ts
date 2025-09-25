import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { START, StateGraph, Command, interrupt } from '@langchain/langgraph';
import {
  estimateTokens,
  GenerateToolCallsFromMessage,
  handleNodeError,
  hasReachedMaxSteps,
  isValidConfiguration,
  isValidConfigurationType,
  routingFromSubGraphToParentGraphEndNode,
} from '../utils/graph.utils.js';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AnyZodObject } from 'zod';
import { AgentConfig, logger } from '@snakagent/core';
import { GraphConfigurableAnnotation, GraphState } from '../graph.js';
import { RunnableConfig } from '@langchain/core/runnables';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import {
  DynamicStructuredTool,
  StructuredTool,
  tool,
  Tool,
} from '@langchain/core/tools';
import { TaskExecutorNode } from '../../../shared/enums/agent.enum.js';
import {
  MODEL_TIMEOUTS,
  STRING_LIMITS,
} from '../constants/execution-constants.js';
import { v4 as uuidv4 } from 'uuid';
import { ThoughtsSchemaType } from '@schemas/graph.schemas.js';
import {
  TaskType,
  Memories,
  ToolCallType,
  GraphErrorType,
  GraphErrorTypeEnum,
} from '../../../shared/types/index.js';
import { LTMManager, STMManager } from '@lib/memory/index.js';
import { stm_format_for_history } from '../parser/memory/stm-parser.js';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  TASK_EXECUTOR_HUMAN_PROMPT,
  TASK_EXECUTOR_MEMORY_PROMPT,
} from '@prompts/agents/task-executor.prompt.js';
import { TaskExecutorToolRegistry } from '../tools/task-executor.tools.js';
import { TokenTracker } from '@lib/token/token-tracking.js';
import { cat } from '@huggingface/transformers';

export class AgentExecutorGraph {
  private agentConfig: AgentConfig.Runtime;
  private model: BaseChatModel;
  private toolsList: (
    | StructuredTool
    | Tool
    | DynamicStructuredTool<AnyZodObject>
  )[] = [];
  private graph: any;
  constructor(
    agentConfig: AgentConfig.Runtime,
    model: BaseChatModel,
    toolList: (StructuredTool | Tool | DynamicStructuredTool<AnyZodObject>)[]
  ) {
    this.model = model;
    this.agentConfig = agentConfig;
    this.toolsList = toolList.concat(new TaskExecutorToolRegistry().getTools());
  }

  // Invoke Model with Messages
  private async invokeModelWithMessages(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<AIMessageChunk> {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        config.configurable!.agent_config!.prompts.task_executor_prompt,
      ],
      ['ai', TASK_EXECUTOR_MEMORY_PROMPT],
      ['human', TASK_EXECUTOR_HUMAN_PROMPT],
    ]);

    logger.debug(`[Executor] Invoking model with execution`);
    const formattedPrompt = await prompt.formatMessages({
      messages: stm_format_for_history(state.memories.stm),
      long_term_memory: LTMManager.formatMemoriesForContext(
        state.memories.ltm.items
      ),
      current_task: state.tasks[state.tasks.length - 1].task.directive,
      success_criteria: state.tasks[state.tasks.length - 1].task.success_check,
    });
    const modelBind = this.model.bindTools!(this.toolsList);

    const result = modelBind.invoke(formattedPrompt);
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
        config.configurable?.agent_config?.graph.execution_timeout_ms ??
          MODEL_TIMEOUTS.DEFAULT_MODEL_TIMEOUT
      );
    });
    return await Promise.race([modelPromise, timeoutPromise]);
  }
  // --- EXECUTOR NODE ---
  private async reasoning_executor(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<
    | {
        messages: BaseMessage[];
        last_node: TaskExecutorNode;
        currentGraphStep?: number;
        memories: Memories;
        task?: TaskType[];
        error: GraphErrorType | null;
      }
    | {
        retry: number;
        last_node: TaskExecutorNode;
        error: GraphErrorType;
      }
    | Command
  > {
    try {
      const _isValidConfiguration: isValidConfigurationType =
        isValidConfiguration(config);
      if (_isValidConfiguration.isValid === false) {
        throw new Error(_isValidConfiguration.error);
      }
      if (
        hasReachedMaxSteps(
          state.currentGraphStep,
          config.configurable!.agent_config!
        )
      ) {
        logger.warn(
          `[TaskManager] Memory sub-graph limit reached (${state.currentGraphStep}), routing to END`
        );
        throw new Error('Max steps reached');
      }
      const agentConfig = config.configurable!.agent_config!; // Safe due to validation above
      const userRequest = config.configurable!.user_request!;
      if (!userRequest) {
        throw new Error('User request is missing in configuration');
      }
      if (userRequest.hitl_threshold === 0) {
        this.toolsList = this.toolsList.filter(
          (tool) => tool.name !== 'ask_human'
        );
      }
      const currentTask = state.tasks[state.tasks.length - 1];
      if (!currentTask) {
        throw new Error('Current task is undefined');
      }
      const stepId = uuidv4();
      logger.info(
        `[Executor] Executing task: ${currentTask.task.directive} (Step ${
          state.currentGraphStep + 1
        })`
      );
      // Validate current execution context
      logger.debug(`[Executor] Current graph step: ${state.currentGraphStep}`);
      // Execute model with timeout protection
      let aiMessage = await this.executeModelWithTimeout(state, config);
      if (!aiMessage) {
        throw new Error('Model returned no response');
      }
      if (
        aiMessage.tool_calls &&
        aiMessage.tool_calls?.length === 0 &&
        aiMessage.invalid_tool_calls &&
        aiMessage.invalid_tool_calls.length > 0
      ) {
        aiMessage = GenerateToolCallsFromMessage(aiMessage);
      }
      aiMessage.content = ''; // Clear content because we are using tool calls only
      logger.debug(`[Executor] Model response received`);
      let isEnd = false;
      let isBlocked = false;
      let thought: ThoughtsSchemaType;
      let tools: ToolCallType[] = [];
      if (aiMessage.tool_calls && aiMessage.tool_calls.length >= 2) {
        aiMessage.tool_calls.forEach((call) => {
          !call.id ? (call.id = uuidv4()) : call.id;
          if (call.name === 'response_task') {
            try {
              thought = JSON.parse(
                typeof call.args === 'string'
                  ? call.args
                  : JSON.stringify(call.args)
              ) as ThoughtsSchemaType;
            } catch (e) {
              throw new Error(
                `Failed to parse thought from model response: ${e.message}`
              );
            }
          } else {
            tools.push({
              tool_call_id: call.id,
              name: call.name,
              args: call.args,
              status: 'pending',
            });
          }
          if (call.name === 'end_task') {
            isEnd = true;
          }
          if (call.name === 'block_task') {
            isBlocked = true;
          }
          if (Object.keys(call.args).length === 0) {
            call.args = { noParams: {} };
          }
        });
      } else {
        logger.warn(
          `[Executor] No tool calls detected in model response or insufficient tool calls retry the execution`
        );
        return {
          retry: (state.retry ?? 0) + 1,
          last_node: TaskExecutorNode.REASONING_EXECUTOR,
          error: {
            type: GraphErrorTypeEnum.WRONG_NUMBER_OF_TOOLS,
            message: 'No tool calls detected in model response',
            hasError: true,
            source: 'reasoning_executor',
            timestamp: Date.now(),
          },
        };
      }
      aiMessage.additional_kwargs = {
        from: TaskExecutorNode.REASONING_EXECUTOR,
        final: isEnd || isBlocked ? true : false,
      };

      // Parse for task
      currentTask.steps.push({
        id: stepId,
        thought: thought!,
        tool: tools,
      });
      if (isEnd) {
        currentTask.status = 'waiting_validation';
      }
      if (isBlocked) {
        return {
          messages: [aiMessage],
          last_node: TaskExecutorNode.REASONING_EXECUTOR,
          currentGraphStep: state.currentGraphStep + 1,
          memories: state.memories,
          task: state.tasks,
          error: {
            type: GraphErrorTypeEnum.BLOCKED_TASK,
            message: (
              JSON.parse(
                JSON.stringify(
                  aiMessage.tool_calls.find(
                    (call) => call.name === 'block_task'
                  )?.args
                )
              ) as ThoughtsSchemaType
            ).reasoning,
            hasError: true,
            source: 'reasoning_executor',
            timestamp: Date.now(),
          },
        };
      }
      state.tasks[state.tasks.length - 1] = currentTask;

      const newMemories = STMManager.addMemory(
        state.memories.stm,
        [aiMessage],
        currentTask.id,
        currentTask.steps[currentTask.steps.length - 1].id
      );
      if (!newMemories.success || !newMemories.data) {
        throw new Error(
          `Failed to add AI message to STM: ${newMemories.error}`
        );
      }
      state.memories.stm = newMemories.data;

      return {
        messages: [aiMessage],
        last_node: TaskExecutorNode.REASONING_EXECUTOR,
        currentGraphStep: state.currentGraphStep + 1,
        memories: state.memories,
        task: state.tasks,
        error: null,
      };
    } catch (error: any) {
      logger.error(`[Executor] Model invocation failed: ${error.message}`);
      return handleNodeError(
        GraphErrorTypeEnum.EXECUTION_ERROR,
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
        last_node: TaskExecutorNode;
        memories: Memories;
        task: TaskType[];
      }
    | Command
    | null
  > {
    const lastMessage = state.messages[state.messages.length - 1];
    const toolTimeout =
      config.configurable?.agent_config?.graph.execution_timeout_ms;
    if (!this.model) {
      throw new Error('Model not found in ModelSelector');
    }
    const currentTask = state.tasks[state.tasks.length - 1];
    if (!currentTask) {
      throw new Error('Current task is undefined');
    }
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
      const tools: { messages: ToolMessage[] } = await Promise.race([
        executionPromise,
        timeoutPromise,
      ]);

      const executionTime = Date.now() - startTime;
      logger.debug(`[Tools] Tool execution completed in ${executionTime}ms`);
      tools.messages.forEach(async (tool) => {
        if (
          config.configurable?.agent_config?.memory.size_limits
            .limit_before_summarization &&
          estimateTokens(tool.content.toLocaleString()) >=
            config.configurable?.agent_config?.memory.size_limits
              .limit_before_summarization
        ) {
          const summarize_content = await STMManager.summarize_before_inserting(
            tool.content.toLocaleString(),
            this.model
          ).then((res) => res.message.content);
          tool.content = summarize_content;
        }
        currentTask.steps[currentTask.steps.length - 1].tool.forEach(
          (t: ToolCallType) => {
            if (t.tool_call_id === tool.tool_call_id) {
              t.status = 'completed';
              t.result = tool.content.toLocaleString();
            }
          }
        );
        tool.additional_kwargs = {
          from: 'tools',
          final: false,
        };
      });

      const newMemories = STMManager.updateMessageRecentMemory(
        state.memories.stm,
        tools.messages
      );
      if (!newMemories.success || !newMemories.data) {
        throw new Error(
          `Failed to update memory with tool results: ${newMemories.error}`
        );
      }
      state.memories.stm = newMemories.data;
      return {
        ...tools,
        task: state.tasks,
        last_node: TaskExecutorNode.TOOL_EXECUTOR,
        memories: state.memories,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      if (error.message.includes('timed out')) {
        logger.error(`[Tools] Tool execution timed out after ${toolTimeout}ms`);
      } else {
        logger.error(
          `[Tools] Tool execution failed after ${executionTime}ms: ${error}`
        );
      }

      return handleNodeError(
        GraphErrorTypeEnum.TIMEAOUT_ERROR,
        error,
        'TOOLS',
        state,
        'Tool execution failed'
      );
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
          last_node: TaskExecutorNode;
          memories: Memories;
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
    last_node: TaskExecutorNode;
    currentGraphStep?: number;
  }> {
    logger.info(`[Human] Awaiting human input for: `);
    const input = interrupt('input_content');
    const message = new AIMessageChunk({
      content: input,
      additional_kwargs: {
        from: TaskExecutorNode.HUMAN,
        final: false,
      },
    });

    return {
      messages: [message],
      last_node: TaskExecutorNode.HUMAN,
      currentGraphStep: state.currentGraphStep + 1,
    };
  }

  private shouldContinue(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): TaskExecutorNode {
    if (!config.configurable?.agent_config) {
      throw new Error('Agent configuration is required for routing decisions.');
    }
    if (state.retry > config.configurable?.agent_config?.graph.max_retries) {
      logger.warn('[Router] Max retries reached, routing to END node');
      return TaskExecutorNode.END_GRAPH;
    }
    if (state.last_node === TaskExecutorNode.REASONING_EXECUTOR) {
      const lastAiMessage = state.messages[state.messages.length - 1];
      if (state.error && state.error.hasError) {
        if (state.error.type === GraphErrorTypeEnum.BLOCKED_TASK) {
          logger.warn(`[Router] Blocked task detected, routing to END node`);
          return TaskExecutorNode.END;
        }
        if (state.error.type === GraphErrorTypeEnum.WRONG_NUMBER_OF_TOOLS) {
          logger.warn(
            `[Router] Wrong number of tools used, routing to reasoning node`
          );
          return TaskExecutorNode.REASONING_EXECUTOR;
        }
      }
      if (
        (lastAiMessage instanceof AIMessageChunk ||
          lastAiMessage instanceof AIMessage) &&
        lastAiMessage.tool_calls?.length
      ) {
        logger.debug(
          `[Router] Detected ${lastAiMessage.tool_calls.length} tool calls, routing to tools node`
        );
        return TaskExecutorNode.TOOL_EXECUTOR;
      }
    } else if (state.last_node === TaskExecutorNode.TOOL_EXECUTOR) {
      if (
        config.configurable.agent_config.graph.max_steps <=
        state.currentGraphStep
      ) {
        logger.warn('[Router] Max graph steps reached, routing to END node');
        return TaskExecutorNode.END_GRAPH;
      } else {
        return TaskExecutorNode.END;
      }
    }
    return TaskExecutorNode.END;
  }

  public getExecutorGraph() {
    return this.graph;
  }

  private executor_router(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): TaskExecutorNode {
    return this.shouldContinue(state, config);
  }

  public createAgentExecutorGraph() {
    const tool_executor = this.createToolNode();

    const executor_subgraph = new StateGraph(
      GraphState,
      GraphConfigurableAnnotation
    )
      .addNode(
        TaskExecutorNode.REASONING_EXECUTOR,
        this.reasoning_executor.bind(this)
      )
      .addNode(TaskExecutorNode.TOOL_EXECUTOR, tool_executor)
      .addNode(TaskExecutorNode.HUMAN, this.humanNode.bind(this))
      .addNode(
        TaskExecutorNode.END_GRAPH,
        routingFromSubGraphToParentGraphEndNode.bind(this)
      )
      .addEdge(START, TaskExecutorNode.REASONING_EXECUTOR)
      .addConditionalEdges(
        TaskExecutorNode.REASONING_EXECUTOR,
        this.executor_router.bind(this)
      )
      .addConditionalEdges(
        TaskExecutorNode.TOOL_EXECUTOR,
        this.executor_router.bind(this)
      );

    this.graph = executor_subgraph.compile();
  }
}
