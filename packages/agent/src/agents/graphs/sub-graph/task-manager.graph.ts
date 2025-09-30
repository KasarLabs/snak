import { AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import { START, StateGraph, Command, interrupt } from '@langchain/langgraph';
import {
  GraphErrorType,
  TaskType,
  GraphErrorTypeEnum,
} from '../../../shared/types/index.js';
import {
  GenerateToolCallsFromMessage,
  getCurrentTask,
  getHITLContraintFromTreshold,
  handleEndGraph,
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
import {
  TaskManagerNode,
  TaskExecutorNode,
} from '../../../shared/enums/agent.enum.js';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { toJsonSchema } from '@langchain/core/utils/json_schema';
import { RunnableConfig } from '@langchain/core/runnables';
import { v4 as uuidv4 } from 'uuid';
import { TaskSchemaType, ThoughtsSchemaType } from '@schemas/graph.schemas.js';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  TASK_MANAGER_HUMAN_PROMPT,
  TASK_MANAGER_MEMORY_PROMPT,
  TASK_MANAGER_SYSTEM_PROMPT,
} from '@prompts/agents/task-manager.prompts.js';
import { TaskManagerToolRegistryInstance } from '../tools/task-manager.tools.js';

export function tasks_parser(
  tasks: TaskType[],
  isHumanTask: boolean = false
): string {
  try {
    if (!tasks || tasks.length === 0) {
      return '<tasks-history>\n  <!-- No tasks available -->\n</tasks-history>';
    }

    // Filter tasks based on isHumanTask parameter
    let filteredTasks = tasks;
    if (isHumanTask) {
      // For human tasks, only include tasks that have human steps or human responses
      filteredTasks = tasks.filter(
        (task) =>
          task.isHumanTask ||
          task.human ||
          (task.steps && task.steps.some((step) => step.type === 'human'))
      );
    }

    const formattedTasks: string[] = [];
    formattedTasks.push('<tasks-history>');

    filteredTasks.forEach((task) => {
      const escapeXML = (str: string) => {
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      };

      formattedTasks.push(
        `  <task name="${task.task?.directive}" id="${task.id}"">`
      );
      formattedTasks.push(`    <status>${escapeXML(task.status)}</status>`);
      if (task.task_verification) {
        formattedTasks.push(
          `    <verification_result>${escapeXML(task.task_verification)}</verification_result>`
        );
      } else if (task.human) {
        formattedTasks.push(
          `    <ai_request>${escapeXML(JSON.stringify(task.thought.speak))}</ai_request>`
        );
        formattedTasks.push(
          `    <human_response>${escapeXML(task.human)}</human_response>`
        );
      }
      formattedTasks.push(`</task>`);
    });

    formattedTasks.push('</tasks-history>');
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
    'ask_human',
  ];
  constructor(
    agentConfig: AgentConfig.Runtime,
    toolList: (StructuredTool | Tool | DynamicStructuredTool<AnyZodObject>)[]
  ) {
    this.model = agentConfig.graph.model;
    this.toolsList = toolList.concat(
      TaskManagerToolRegistryInstance.getTools()
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
          `[TaskManager] Memory sub-graph limit reached (${state.currentGraphStep}), routing to END`
        );
        throw new Error('Max steps reached');
      }
      const agentConfig = config.configurable!.agent_config!;
      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          process.env.DEV_PROMPT === 'true'
            ? TASK_MANAGER_SYSTEM_PROMPT
            : agentConfig.prompts.task_manager_prompt,
        ],
        ['ai', TASK_MANAGER_MEMORY_PROMPT],
        ['human', TASK_MANAGER_HUMAN_PROMPT],
      ]);

      const modelBind = this.model.bindTools!(this.toolsList);
      const formattedPrompt = await prompt.formatMessages({
        agent_name: agentConfig.profile.name,
        agent_description: agentConfig.profile.description,
        past_tasks: tasks_parser(state.tasks),
        objectives: config.configurable!.user_request?.request,
        failed_tasks: state.error
          ? `The previous task failed due to: ${state.error.message}`
          : '',
        rag_content: '', // RAG content can be added here if available
        hitl_constraints: getHITLContraintFromTreshold(
          config.configurable!.user_request?.hitl_threshold ?? 0
        ),
        tools: parseToolsToJson(this.toolsList),
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
        logger.info('[Task Manager] Regenerating tool calls from message');
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
      if (aiMessage.tool_calls[0].name === 'ask_human') {
        logger.info(
          '[Task Manager] Routing to human-in-the-loop for task creation'
        );
        const parsed_args = JSON.parse(
          typeof aiMessage.tool_calls[0].args === 'string'
            ? aiMessage.tool_calls[0].args
            : JSON.stringify(aiMessage.tool_calls[0].args)
        ) as ThoughtsSchemaType;
        const task: TaskType = {
          id: uuidv4(),
          thought: parsed_args,
          human: '',
          request: config.configurable?.user_request?.request ?? '',
          steps: [],
          isHumanTask: true,
          status: 'waiting_human' as const,
        };
        state.tasks.push(task);
        return {
          messages: [aiMessage],
          last_node: TaskManagerNode.CREATE_TASK,
          tasks: state.tasks,
          currentGraphStep: state.currentGraphStep + 1,
          error: null,
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
      const task: TaskType = {
        id: uuidv4(),
        thought: parsed_args.thought,
        task: parsed_args.task,
        request: config.configurable?.user_request?.request ?? '',
        steps: [],
        isHumanTask: false,
        status: 'pending' as const,
      };
      state.tasks.push(task);
      return {
        messages: [aiMessage],
        last_node: TaskManagerNode.CREATE_TASK,
        tasks: state.tasks,
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

  public async humanNode(state: typeof GraphState.State): Promise<{
    messages: BaseMessage[];
    tasks: TaskType[];
    last_node: TaskManagerNode;
    currentGraphStep?: number;
  }> {
    const currentTask = getCurrentTask(state.tasks);
    if (!currentTask) {
      logger.error('[HUMAN] No current task available for human input');
      throw new Error('No current task available for human input');
    }

    logger.info(
      `[Human] Awaiting human input for: ${currentTask.thought.speak}`
    );

    const h_input = interrupt(currentTask.thought.speak);

    if (!h_input) {
      logger.error('[HUMAN] No human input received');
      throw new Error('No human input received');
    }

    const message = new AIMessageChunk({
      content: h_input,
      additional_kwargs: {
        from: TaskManagerNode.HUMAN,
        final: false,
      },
    });

    currentTask.human = h_input;
    currentTask.status = 'completed';
    state.tasks[state.tasks.length - 1] = currentTask;

    logger.info('[Human] Successfully processed human input');
    return {
      messages: [message],
      tasks: state.tasks,
      last_node: TaskManagerNode.HUMAN,
      currentGraphStep: state.currentGraphStep + 1,
    };
  }
  private task_manager_router(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): TaskManagerNode {
    const currentTask = getCurrentTask(state.tasks);
    if (!currentTask) {
      throw new Error('No current task avaible');
    }
    console.log(currentTask);
    if (!config.configurable?.agent_config) {
      throw new Error('Agent configuration is required for routing decisions.');
    }
    if (state.retry > config.configurable?.agent_config?.graph.max_retries) {
      logger.warn(
        '[Task Manager Router] Max retries reached, routing to END node'
      );
      return TaskManagerNode.END_GRAPH;
    }
    if (state.last_node === TaskManagerNode.CREATE_TASK) {
      if (currentTask.status === 'waiting_human') {
        return TaskManagerNode.HUMAN;
      }
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
      } else {
        logger.info('[Task Manager Router] Task created, routing to END');
        return TaskManagerNode.END;
      }
    }
    if (state.last_node === TaskManagerNode.HUMAN) {
      logger.info(
        '[Task Manager Router] Routing from HUMAN back to CREATE_TASK'
      );
      return TaskManagerNode.CREATE_TASK;
    }
    logger.warn('[Task Manager Router] Routing to END_GRAPH node');
    return TaskManagerNode.END_GRAPH;
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
      .addNode(
        TaskManagerNode.END_GRAPH,
        routingFromSubGraphToParentGraphEndNode.bind(this)
      )
      .addNode(TaskExecutorNode.HUMAN, this.humanNode.bind(this))
      .addEdge(START, TaskManagerNode.CREATE_TASK)
      .addConditionalEdges(
        TaskManagerNode.CREATE_TASK,
        this.task_manager_router.bind(this)
      );

    this.graph = task_manager_subgraph.compile();
  }
}
