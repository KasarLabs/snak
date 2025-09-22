import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
} from '@langchain/core/messages';
import { START, StateGraph, Command, END } from '@langchain/langgraph';
import {
  GraphErrorType,
  isPlannerActivateSchema,
  TaskType,
} from '../../../shared/types/index.js';
import { handleNodeError } from '../utils/graph-utils.js';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AnyZodObject } from 'zod';
import { AgentConfig, AgentMode, logger } from '@snakagent/core';
import { GraphConfigurableAnnotation, GraphState } from '../graph.js';
import { DEFAULT_GRAPH_CONFIG } from '../config/default-config.js';
import {
  PlannerNode,
  ExecutorNode,
  MemoryNode,
  ExecutionMode,
} from '../../../shared/enums/agent-modes.enum.js';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { toJsonSchema } from '@langchain/core/utils/json_schema';
import { RunnableConfig } from '@langchain/core/runnables';
import { v4 as uuidv4 } from 'uuid';
import { isInEnum } from '@enums/utils.js';
import { TaskSchemaType } from '@schemas/graph.schemas.js';
import { createTask } from '@tools/tools.js';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  TASK_MANAGER_HUMAN_PROMPT,
  TASK_MANAGER_MEMORY_PROMPT,
  TASK_MANAGER_SYSTEM_PROMPT,
} from '@prompts/agents/task-manager.prompts.js';
import { th } from 'zod/v4/locales';

export function tasks_parser(tasks: TaskType[]): string {
  try {
    if (!tasks || tasks.length === 0) {
      return 'No tasks available.';
    }
    const formattedTasks = tasks.map((task, index) => {
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

export class PlannerGraph {
  private agentConfig: AgentConfig.Runtime;
  private model: BaseChatModel;
  private graph: any;
  private toolsList: (
    | StructuredTool
    | Tool
    | DynamicStructuredTool<AnyZodObject>
  )[] = [];
  constructor(
    agentConfig: AgentConfig.Runtime,
    model: BaseChatModel,
    toolList: (StructuredTool | Tool | DynamicStructuredTool<AnyZodObject>)[]
  ) {
    this.model = model;
    this.agentConfig = agentConfig;
    this.toolsList = toolList;
  }
  private async planExecution(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<
    | {
        messages: BaseMessage[];
        last_node: PlannerNode;
        tasks?: TaskType[];
        executionMode?: ExecutionMode;
        currentGraphStep: number;
        error: GraphErrorType | null;
        skipValidation?: { skipValidation: boolean; goto: string };
      }
    | Command
  > {
    try {
      logger.info('[Planner] Starting plan_or_history execution');
      if (!this.model) {
        throw new Error('Model not found in ModelSelector');
      }
      if (!this.model.bindTools) {
        throw new Error('Model does not support tool binding');
      }
      const prompt = ChatPromptTemplate.fromMessages([
        this.agentConfig.prompts.taskManagerPrompt,
        ['ai', TASK_MANAGER_MEMORY_PROMPT],
        ['human', TASK_MANAGER_HUMAN_PROMPT],
      ]);

      const modelWithRequiredTool = this.model.bindTools(
        [...this.toolsList, createTask],
        {
          tool_choice: 'any',
        }
      );
      const formattedPrompt = await prompt.formatMessages({});
      const aiMessage = await modelWithRequiredTool.invoke(formattedPrompt);
      logger.info(`[Planner] Successfully created task`);
      if (!aiMessage.tool_calls || aiMessage.tool_calls.length <= 0) {
        throw new Error('[Planner] No tool calls found in model response');
      }
      if (aiMessage.tool_calls.length > 1) {
        logger.warn(
          `[Planner] Multiple tool calls found, only the first will be processed`
        );
        throw new Error('[Planner] Multiple tool calls found');
      }
      if (
        aiMessage.tool_calls[0].name !== 'create_task' &&
        aiMessage.tool_calls[0].name !== 'block_task'
      ) {
        throw new Error(
          `[Planner] Unexpected tool call: ${aiMessage.tool_calls[0].name}`
        );
      }
      if (aiMessage.tool_calls[0].name === 'block_task') {
        logger.info('[Planner] Task creation aborted by model');
        return handleNodeError(
          new Error('Task creation aborted by model'),
          'PLANNER',
          state,
          'Task creation aborted by model'
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
        status: 'pending' as 'pending',
      };
      state.tasks.push(tasks);
      return {
        messages: [aiMessage],
        last_node: PlannerNode.CREATE_INITIAL_PLAN,
        tasks: state.tasks,
        executionMode: ExecutionMode.PLANNING,
        currentGraphStep: state.currentGraphStep + 1,
        error: null,
      };
    } catch (error: any) {
      logger.error(`[Planner] Plan execution failed: ${error}`);
      return handleNodeError(error, 'PLANNER', state, 'Plan creation failed');
    }
  }

  private end_planner_graph(state: typeof GraphState.State) {
    logger.info('[EndPlannerGraph] Cleaning up state for graph termination');
    return new Command({
      update: {
        currentTaskIndex: 0,
        retry: 0,
        skipValidation: { skipValidation: true, goto: 'end_graph' },
      },
      goto: 'end_graph',
      graph: Command.PARENT,
    });
  }

  public getPlannerGraph() {
    return this.graph;
  }

  public createPlannerGraph() {
    const planner_subgraph = new StateGraph(
      GraphState,
      GraphConfigurableAnnotation
    )
      .addNode('create_initial_plan', this.planExecution.bind(this))
      .addEdge('create_initial_plan', END)
      .addEdge(START, 'create_initial_plan');

    this.graph = planner_subgraph.compile();
  }
}
