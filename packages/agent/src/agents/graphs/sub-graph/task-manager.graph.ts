import { BaseMessage } from '@langchain/core/messages';
import { START, StateGraph, Command } from '@langchain/langgraph';
import {
  GraphErrorType,
  TaskType,
  GraphErrorTypeEnum,
} from '../../../shared/types/index.js';
import {
  GenerateToolCallsFromMessage,
  handleEndGraph,
  handleNodeError,
  hasReachedMaxSteps,
  isValidConfiguration,
  isValidConfigurationType,
} from '../utils/graph-utils.js';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AnyZodObject } from 'zod';
import { AgentConfig, logger } from '@snakagent/core';
import { GraphConfigurableAnnotation, GraphState } from '../graph.js';
import {
  TaskManagerNode,
  ExecutionMode,
} from '../../../shared/enums/agent.enum.js';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { toJsonSchema } from '@langchain/core/utils/json_schema';
import { RunnableConfig } from '@langchain/core/runnables';
import { v4 as uuidv4 } from 'uuid';
import { TaskSchemaType } from '@schemas/graph.schemas.js';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  TASK_MANAGER_HUMAN_PROMPT,
  TASK_MANAGER_MEMORY_PROMPT,
} from '@prompts/agents/task-manager.prompts.js';
import { TaskManagerToolRegistry } from '../tools/task-manager.tools.js';

export function tasks_parser(tasks: TaskType[]): string {
  try {
    if (!tasks || tasks.length === 0) {
      return 'No tasks available.';
    }
    const formattedTasks = tasks.map((task) => {
      return `task_id : ${task.id}\n task : ${task.task.directive}\n status : ${task.status}\n verificiation_result : ${task.task_verification}\n`;
    });
    return formattedTasks.join('\n');
  } catch (error) {
    throw error;
  }
}
export const parseToolsToJson = (
  tools: (StructuredTool | Tool | DynamicStructuredTool<AnyZodObject>)[]
): string => {
  const toolFunctions = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: toJsonSchema(tool.schema),
  }));

  const formatTools = toolFunctions.map((tool, index) => ({
    index: index,
    name: tool.name,
    description: tool.description,
    properties: tool.parameters,
  }));

  return JSON.stringify(formatTools, null, 2);
};

export class TaskManagerGraph {
  private model: BaseChatModel;
  private graph: any;
  private toolsList: (
    | StructuredTool
    | Tool
    | DynamicStructuredTool<AnyZodObject>
  )[] = [];
  private readonly availableToolsName = [
    'create_task',
    'block_task',
    'end_task',
  ];
  constructor(
    agentConfig: AgentConfig.Runtime,
    toolList: (StructuredTool | Tool | DynamicStructuredTool<AnyZodObject>)[]
  ) {
    this.model = agentConfig.graph.model;
    this.toolsList = toolList.concat(
      new TaskManagerToolRegistry(agentConfig).getTools()
    );
  }
  private async planExecution(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<
    | {
        messages: BaseMessage[];
        last_node: TaskManagerNode;
        tasks?: TaskType[];
        executionMode?: ExecutionMode;
        currentGraphStep: number;
        error: GraphErrorType | null;
        skipValidation?: { skipValidation: boolean; goto: string };
      }
    | {
        retry: number;
        last_node: TaskManagerNode;
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
          `[MemoryRouter] Memory sub-graph limit reached (${state.currentGraphStep}), routing to END`
        );
        throw new Error('Max steps reached');
      }
      const agentConfig = config.configurable!.agent_config!;
      const prompt = ChatPromptTemplate.fromMessages([
        agentConfig.prompts.task_manager_prompt,
        ['ai', TASK_MANAGER_MEMORY_PROMPT],
        ['human', TASK_MANAGER_HUMAN_PROMPT],
      ]);

      const modelBind = this.model.bindTools!(this.toolsList);
      const formattedPrompt = await prompt.formatMessages({
        past_tasks: tasks_parser(state.tasks),
        objectives: config.configurable?.user_request?.request
          ? config.configurable.user_request.request
          : config.configurable?.agent_config?.profile.objectives.join(','),
        failed_tasks: state.error
          ? `The previous task failed due to: ${state.error.message}`
          : '',
      });
      let aiMessage;
      try {
        aiMessage = await modelBind.invoke(formattedPrompt);
      } catch (error: any) {
        // Handle Google Gemini API specific errors
        if (
          error.name === 'GoogleGenerativeAIError' ||
          error.message?.includes('Failed to parse stream') ||
          error.message?.includes('Cannot read properties of undefined')
        ) {
          logger.error(
            `[Task Manager] Google Gemini API error: ${error.message}`
          );
          throw new Error(
            `Google Gemini API error - possibly due to incompatible function declarations: ${error.message}`
          );
        }
        // Re-throw other errors
        throw error;
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
      logger.info(`[Task Manager] Successfully created task`);
      if (!aiMessage.tool_calls || aiMessage.tool_calls.length <= 0) {
        logger.warn(
          `[Task Manager] No tool calls detected in model response, retrying execution`
        );
        return {
          retry: (state.retry ?? 0) + 1,
          last_node: TaskManagerNode.CREATE_TASK,
          error: {
            type: GraphErrorTypeEnum.WRONG_NUMBER_OF_TOOLS,
            message: 'No tool calls found in model response',
            hasError: true,
            source: 'task_manager',
            timestamp: Date.now(),
          },
        };
      }
      if (aiMessage.tool_calls.length > 1) {
        logger.warn(
          `[Task Manager] Multiple tool calls found, retrying with single tool call expectation`
        );
        return {
          retry: (state.retry ?? 0) + 1,
          last_node: TaskManagerNode.CREATE_TASK,
          error: {
            type: GraphErrorTypeEnum.WRONG_NUMBER_OF_TOOLS,
            message: 'Multiple tool calls found, expected single tool call',
            hasError: true,
            source: 'task_manager',
            timestamp: Date.now(),
          },
        };
      }
      if (!this.availableToolsName.includes(aiMessage.tool_calls[0].name)) {
        logger.warn(
          `[Task Manager] Unrecognized tool call "${aiMessage.tool_calls[0].name}", retrying`
        );
        return {
          retry: (state.retry ?? 0) + 1,
          last_node: TaskManagerNode.CREATE_TASK,
          error: {
            type: GraphErrorTypeEnum.TOOL_ERROR,
            message: `Tool call name "${aiMessage.tool_calls[0].name}" is not recognized`,
            hasError: true,
            source: 'task_manager',
            timestamp: Date.now(),
          },
        };
      }
      if (aiMessage.tool_calls[0].name === 'block_task') {
        logger.info('[Task Manager] Task creation aborted by model');
        return handleNodeError(
          GraphErrorTypeEnum.TASK_ABORTED,
          new Error('Task creation aborted by model'),
          'Task Manager',
          state
        );
      } else if (aiMessage.tool_calls[0].name === 'end_task') {
        logger.info(
          '[Task Manager] Ending task manager graph as model request'
        );
        return handleEndGraph(
          'task_manager',
          state,
          'Ending task manager graph as model request'
        );
      }
      const parsed_args = JSON.parse(
        typeof aiMessage.tool_calls[0].args === 'string'
          ? aiMessage.tool_calls[0].args
          : JSON.stringify(aiMessage.tool_calls[0].args)
      ) as TaskSchemaType;
      const tasks = {
        id: uuidv4(),
        thought: parsed_args.thought,
        task: parsed_args.task,
        steps: [],
        status: 'pending' as const,
      };
      state.tasks.push(tasks);
      return {
        messages: [aiMessage],
        last_node: TaskManagerNode.CREATE_TASK,
        tasks: state.tasks,
        executionMode: ExecutionMode.PLANNING,
        currentGraphStep: state.currentGraphStep + 1,
        error: null,
      };
    } catch (error: any) {
      logger.error(`[Task Manager] Plan execution failed: ${error}`);
      return handleNodeError(
        GraphErrorTypeEnum.MANAGER_ERROR,
        error,
        'TASK_MANAGER',
        state,
        'Plan creation failed'
      );
    }
  }

  private shouldContinue(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): TaskManagerNode | 'END' {
    if (!config.configurable?.agent_config) {
      throw new Error('Agent configuration is required for routing decisions.');
    }
    if (state.retry > config.configurable?.agent_config?.graph.max_retries) {
      logger.warn(
        '[Task Manager Router] Max retries reached, routing to END node'
      );
      return 'END';
    }
    if (state.last_node === TaskManagerNode.CREATE_TASK) {
      if (state.error && state.error.hasError) {
        if (
          state.error.type === GraphErrorTypeEnum.WRONG_NUMBER_OF_TOOLS ||
          state.error.type === GraphErrorTypeEnum.TOOL_ERROR
        ) {
          logger.warn(
            `[Task Manager Router] Retry condition met, routing back to CREATE_TASK`
          );
          return TaskManagerNode.CREATE_TASK;
        }
      }
    }
    return 'END';
  }

  private task_manager_router(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): TaskManagerNode | 'END' {
    return this.shouldContinue(state, config);
  }

  public getTaskManagerGraph() {
    return this.graph;
  }

  public createTaskManagerGraph() {
    const task_manager_subgraph = new StateGraph(
      GraphState,
      GraphConfigurableAnnotation
    )
      .addNode(TaskManagerNode.CREATE_TASK, this.planExecution.bind(this))
      .addEdge(START, TaskManagerNode.CREATE_TASK)
      .addConditionalEdges(
        TaskManagerNode.CREATE_TASK,
        this.task_manager_router.bind(this)
      );

    this.graph = task_manager_subgraph.compile();
  }
}
