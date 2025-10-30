import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { START, StateGraph, Command } from '@langchain/langgraph';
import {
  estimateTokens,
  GenerateToolCallsFromMessage,
  getCurrentTask,
  getHITLContraintFromTreshold,
  handleNodeError,
  hasReachedMaxSteps,
  isValidConfiguration,
  isValidConfigurationType,
  routingFromSubGraphToParentGraphEndNode,
  routingFromSubGraphToParentGraphHumanHandlerNode,
} from '../utils/graph.utils.js';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AnyZodObject } from 'zod';
import { AgentConfig, logger } from '@snakagent/core';
import {
  GraphConfigurableAnnotation,
  GraphState,
} from '../core-graph/agent.graph.js';
import { RunnableConfig } from '@langchain/core/runnables';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { TaskExecutorNode } from '../../../shared/enums/agent.enum.js';
import {
  MODEL_TIMEOUTS,
  STRING_LIMITS,
} from '../constants/execution-constants.js';
import { v4 as uuidv4 } from 'uuid';
import { ThoughtsSchemaType } from '@schemas/graph.schema.js';
import {
  TaskType,
  Memories,
  ToolCallType,
  GraphErrorType,
  GraphErrorTypeEnum,
} from '../../../shared/types/index.js';
import { LTMManager, STMManager } from '@lib/memory/index.js';
import { formatSTMToXML } from '../parser/memory/stm-parser.js';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  TASK_EXECUTOR_HUMAN_PROMPT,
  TASK_EXECUTOR_MEMORY_AI_CONVERSATION_PROMPT,
  TASK_EXECUTOR_MEMORY_LONG_TERM_MEMORY_PROMPT,
  TASK_EXECUTOR_MEMORY_RAG_PROMPT,
  TASK_EXECUTOR_SYSTEM_PROMPT,
} from '@prompts/agents/snak/core/task-executor.prompt.js';
import { TaskExecutorToolRegistry } from '../tools/task-executor.tools.js';
import { GraphError } from '../utils/error.utils.js';

export const EXECUTOR_CORE_TOOLS = new Set([
  'response_task',
  'end_task',
  'ask_human',
  'block_task',
]);

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
        process.env.DEV_PROMPT === 'true'
          ? TASK_EXECUTOR_SYSTEM_PROMPT
          : config.configurable!.agent_config!.prompts.task_executor_prompt,
      ],
      ['ai', TASK_EXECUTOR_MEMORY_AI_CONVERSATION_PROMPT],
      ['ai', TASK_EXECUTOR_MEMORY_RAG_PROMPT],
      ['ai', TASK_EXECUTOR_MEMORY_LONG_TERM_MEMORY_PROMPT],
      ['human', TASK_EXECUTOR_HUMAN_PROMPT],
    ]);

    const formattedPrompt = await prompt.formatMessages({
      ai_conversation: formatSTMToXML(state.memories.stm),
      long_term_memory: LTMManager.formatMemoriesForContext(
        state.memories.ltm.items,
        config.configurable!.agent_config!.memory.strategy // Safe to use ! here as we validated config before
      ),
      hitl_constraints: getHITLContraintFromTreshold(
        config.configurable?.user_request?.hitl_threshold ?? 0
      ),
      rag_content: 'No rag content avaible', // TODO integrate RAG content
      current_directive: state.tasks[state.tasks.length - 1].task?.directive,
      success_criteria: state.tasks[state.tasks.length - 1].task?.success_check,
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
        lastNode: TaskExecutorNode;
        currentGraphStep?: number;
        memories: Memories;
        task?: TaskType[];
        error: GraphErrorType | null;
      }
    | {
        retry: number;
        lastNode: TaskExecutorNode;
        error: GraphErrorType;
      }
    | Command
  > {
    try {
      const _isValidConfiguration: isValidConfigurationType =
        isValidConfiguration(config);
      if (_isValidConfiguration.isValid === false) {
        throw new GraphError(
          'E08GC270',
          'Executor.reasoning_executor',
          undefined,
          { error: _isValidConfiguration.error }
        );
      }
      if (
        hasReachedMaxSteps(
          state.currentGraphStep,
          config.configurable!.agent_config!
        )
      ) {
        logger.warn(`[Executor] Max steps reached (${state.currentGraphStep})`);
        throw new GraphError(
          'E08NE370',
          'Executor.reasoning_executor',
          undefined,
          { currentGraphStep: state.currentGraphStep }
        );
      }
      const userRequest = config.configurable!.user_request!;
      if (!userRequest) {
        throw new GraphError('E08GC220', 'Executor.reasoning_executor');
      }
      if (userRequest.hitl_threshold === 0) {
        this.toolsList = this.toolsList.filter(
          (tool) => tool.name !== 'ask_human'
        );
      }
      const currentTask = state.tasks[state.tasks.length - 1];
      if (!currentTask) {
        throw new GraphError('E08ST1050', 'Executor.reasoning_executor');
      }
      const stepId = uuidv4();
      logger.info(
        `[Executor] Step ${state.currentGraphStep + 1}: ${currentTask.task?.directive}`
      );
      let aiMessage = await this.executeModelWithTimeout(state, config);
      if (!aiMessage) {
        throw new GraphError('E08MI510', 'Executor.reasoning_executor');
      }
      if (
        aiMessage.tool_calls &&
        aiMessage.tool_calls?.length === 0 &&
        aiMessage.invalid_tool_calls &&
        aiMessage.invalid_tool_calls.length > 0
      ) {
        aiMessage = GenerateToolCallsFromMessage(aiMessage);
      }
      aiMessage.content = '';
      let thought: ThoughtsSchemaType;
      if (!aiMessage.tool_calls || aiMessage.tool_calls.length <= 0) {
        throw new GraphError('E08TE640', 'Executor.reasoning_executor'); // Force retry after
      }
      const { filteredTools, filteredCoreTools } = aiMessage.tool_calls.reduce(
        (acc, call) => {
          if (!call.id || call.id === undefined || call.id === '') {
            call.id = uuidv4();
          }
          if (EXECUTOR_CORE_TOOLS.has(call.name)) {
            acc.filteredCoreTools.push({
              ...call,
              id: call.id!, // Non-null assertion since we just ensured it exists
              result: undefined,
              status: 'pending',
            });
          } else {
            acc.filteredTools.push({
              ...call,
              id: call.id!, // Non-null assertion since we just ensured it exists
              result: undefined,
              status: 'pending',
            });
          }
          return acc;
        },
        {
          filteredTools: [] as ToolCallType[],
          filteredCoreTools: [] as ToolCallType[],
        }
      );
      if (filteredCoreTools.length != 1) {
        logger.warn(
          `[Executor] Invalid number of core tools used: ${filteredCoreTools.length}`
        );
        return {
          retry: state.retry + 1,
          lastNode: TaskExecutorNode.REASONING_EXECUTOR,
          error: {
            type: GraphErrorTypeEnum.WRONG_NUMBER_OF_TOOLS,
            message: `Invalid number of core tools used: ${filteredCoreTools.length}`,
            hasError: true,
            source: 'reasoning_executor',
            timestamp: Date.now(),
          },
        };
      }
      if (filteredCoreTools[0].name === 'ask_human') {
        thought = JSON.parse(
          typeof filteredCoreTools[0].args === 'string'
            ? filteredCoreTools[0].args
            : JSON.stringify(filteredCoreTools[0].args)
        ) as ThoughtsSchemaType;
        if (!thought) {
          throw new GraphError('E08PR1320', 'Executor.reasoning_executor');
        }
        currentTask.steps.push({
          id: stepId,
          type: 'human',
          thought: thought,
          tool: [filteredCoreTools[0]],
          isSavedInMemory: false,
        });
        state.tasks[state.tasks.length - 1] = currentTask;
        aiMessage.additional_kwargs = {
          task_id: currentTask.id,
          step_id: currentTask.steps[currentTask.steps.length - 1].id,
          from: TaskExecutorNode.REASONING_EXECUTOR,
          final: false,
        };
        return {
          messages: [aiMessage],
          lastNode: TaskExecutorNode.REASONING_EXECUTOR,
          currentGraphStep: state.currentGraphStep + 1,
          memories: state.memories,
          task: state.tasks,
          error: null,
        };
      }

      if (filteredCoreTools[0].name === 'end_task') {
        currentTask.status = 'waiting_validation';
      }
      if (filteredCoreTools[0].name === 'block_task') {
        aiMessage.additional_kwargs = {
          task_id: currentTask.id,
          step_id: stepId,
          from: TaskExecutorNode.REASONING_EXECUTOR,
          final: false,
        };
        state.tasks[state.tasks.length - 1].status = 'failed';
        return {
          messages: [aiMessage],
          lastNode: TaskExecutorNode.REASONING_EXECUTOR,
          currentGraphStep: state.currentGraphStep + 1,
          memories: state.memories,
          task: state.tasks,
          error: {
            type: GraphErrorTypeEnum.BLOCK_TASK,
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
      thought = JSON.parse(
        typeof filteredCoreTools[0].args === 'string'
          ? filteredCoreTools[0].args
          : JSON.stringify(filteredCoreTools[0].args)
      ) as ThoughtsSchemaType;
      if (!thought) {
        throw new GraphError('E08PR1320', 'Executor.reasoning_executor');
      }
      currentTask.steps.push({
        id: stepId,
        type: 'tools',
        thought: thought!, // Assertion since we checked above
        tool: filteredCoreTools.concat(filteredTools),
        isSavedInMemory: false,
      });
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
      aiMessage.additional_kwargs = {
        task_id: currentTask.id,
        step_id: currentTask.steps[currentTask.steps.length - 1].id,
        from: TaskExecutorNode.REASONING_EXECUTOR,
        final: false,
      };
      return {
        messages: [aiMessage],
        lastNode: TaskExecutorNode.REASONING_EXECUTOR,
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
        { currentGraphStep: state.currentGraphStep },
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
        lastNode: TaskExecutorNode;
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
      throw new GraphError('E08MI550', 'Executor.toolExecutor');
    }
    const currentTask = state.tasks[state.tasks.length - 1];
    if (!currentTask) {
      throw new GraphError('E08ST1050', 'Executor.toolExecutor');
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
      await Promise.all(
        tools.messages.map(async (tool) => {
          if (
            config.configurable?.agent_config?.memory.size_limits
              .limit_before_summarization &&
            estimateTokens(tool.content.toLocaleString()) >=
              config.configurable?.agent_config?.memory.size_limits
                .limit_before_summarization
          ) {
            const summarize_content =
              await STMManager.summarize_before_inserting(
                tool.content.toLocaleString(),
                this.model
              );
            tool.content = summarize_content.message.content.toLocaleString();
          }

          currentTask.steps[currentTask.steps.length - 1].tool.forEach(
            (t: ToolCallType) => {
              if (t.id === tool.tool_call_id) {
                t.status = 'completed';
                t.result = tool.content.toLocaleString();
              }
            }
          );

          tool.additional_kwargs = {
            from: 'tools',
            final: false,
          };
        })
      );

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
        messages: tools.messages,
        task: state.tasks,
        lastNode: TaskExecutorNode.TOOL_EXECUTOR,
        memories: state.memories,
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      if (error?.message?.includes('timed out')) {
        logger.error(`[Tools] Execution timed out after ${toolTimeout}ms`);
      } else {
        logger.error(
          `[Tools] Execution failed after ${executionTime}ms: ${error}`
        );
      }

      return handleNodeError(
        GraphErrorTypeEnum.TIMEOUT_ERROR,
        error,
        'TOOLS',
        { currentGraphStep: state.currentGraphStep },
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
          lastNode: TaskExecutorNode;
          memories: Memories;
        }
      | Command
      | null
    > => {
      return this.toolNodeInvoke(state, config, originalInvoke);
    };

    return toolNode;
  }

  public async humanNode(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<Command> {
    return routingFromSubGraphToParentGraphHumanHandlerNode(state, config);
  }

  private executor_router(
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
    if (state.lastNode === TaskExecutorNode.REASONING_EXECUTOR) {
      const lastAiMessage = state.messages[state.messages.length - 1];
      const currentTask = getCurrentTask(state.tasks);
      if (!currentTask) {
        logger.error('[Router] Current task is undefined, routing to END node');
        return TaskExecutorNode.END_GRAPH;
      }
      if (state.error && state.error.hasError) {
        if (state.error.type === GraphErrorTypeEnum.BLOCK_TASK) {
          return TaskExecutorNode.END;
        }
        if (state.error.type === GraphErrorTypeEnum.WRONG_NUMBER_OF_TOOLS) {
          return TaskExecutorNode.REASONING_EXECUTOR;
        }
      }
      if (
        (lastAiMessage instanceof AIMessageChunk ||
          lastAiMessage instanceof AIMessage) &&
        lastAiMessage.tool_calls?.length
      ) {
        if (currentTask.steps[currentTask.steps.length - 1]?.type === 'human') {
          logger.info(`[Executor] Human input requested`);
          return TaskExecutorNode.HUMAN;
        }
        return TaskExecutorNode.TOOL_EXECUTOR;
      }
    } else if (state.lastNode === TaskExecutorNode.TOOL_EXECUTOR) {
      if (
        config.configurable.agent_config.graph.max_steps <=
        state.currentGraphStep
      ) {
        logger.warn('[Executor] Max steps reached');
        return TaskExecutorNode.END_GRAPH;
      } else {
        return TaskExecutorNode.END;
      }
    } else if (state.lastNode === TaskExecutorNode.HUMAN) {
      return TaskExecutorNode.REASONING_EXECUTOR;
    }
    return TaskExecutorNode.END;
  }

  public getExecutorGraph() {
    return this.graph;
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
