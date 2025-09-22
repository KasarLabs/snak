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
      const agent_mode: AgentMode =
        (config.configurable?.agent_config?.mode as AgentMode) ??
        DEFAULT_GRAPH_CONFIG.agent_config.mode;
      const prompts = '';
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', TASK_MANAGER_SYSTEM_PROMPT],
        ['ai', TASK_MANAGER_MEMORY_PROMPT],
        ['human', TASK_MANAGER_HUMAN_PROMPT],
      ]);

      const modelWithRequiredTool = this.model.bindTools(
        [...this.toolsList, createTask],
        {
          tool_choice: 'any',
        }
      );
      const formattedPrompt = await prompt.formatMessages({
        header: '', //TODO
        objectives: '', // TODO
        messages: '', // TODO
        past_tasks: '',
        goals: '',
        tools: '',
        output_format: '',
      });
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

  public planning_router(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): PlannerNode {
    const agent_config = config.configurable?.agent_config;
    if (!agent_config) {
      throw new Error(
        '[PLANNING_ROUTER] AgentConfig is not configured. routing to END_GRAPH'
      );
    }
    const currentMode = agent_config.mode;
    const l_msg = state.messages[state.messages.length - 1];
    const maxRetries = DEFAULT_GRAPH_CONFIG.maxRetries;

    if (
      state.currentGraphStep >=
      (config.configurable?.max_graph_steps ??
        DEFAULT_GRAPH_CONFIG.maxGraphSteps)
    ) {
      logger.warn(
        `[PLANNING_ROUTER] PlannerOrchestrator sub-graph limit reached (${state.currentGraphStep}), routing to END_GRAPH`
      );
      return PlannerNode.END_PLANNER_GRAPH;
    }
    // INTERACTIVE START PART
    const executionMode = config.configurable?.executionMode;
    if (currentMode === AgentMode.INTERACTIVE) {
      if (executionMode === ExecutionMode.REACTIVE) {
        logger.debug(
          `[PLANNING_ROUTER] ExecutionMode is REACTIVE. routing to create_initial_history`
        );
        return PlannerNode.CREATE_INITIAL_HISTORY;
      }
      if (executionMode === ExecutionMode.AUTOMATIC) {
        logger.debug(
          '[PLANNING_ROUTER] ExecutionMode is AUTOMATIC. routing to get_planner_status'
        );
        return PlannerNode.GET_PLANNER_STATUS;
      }
      // Default to PLANNING for INTERACTIVE mode if not specified
      if (executionMode === ExecutionMode.PLANNING) {
        logger.debug(`[PLANNING_ROUTER]: Routing to create_initial_plan`);
        return PlannerNode.CREATE_INITIAL_PLAN;
      }
    }

    // GLOBAL START PART
    if (!state.last_node || state.last_node === 'start') {
      logger.debug(`[PLANNING_ROUTER]: Routing to create_initial_plan`);
      return PlannerNode.CREATE_INITIAL_PLAN;
    }
    if (
      state.last_node === PlannerNode.PLANNER_VALIDATOR &&
      l_msg.additional_kwargs.success
    ) {
      logger.debug(`[PLANNING_ROUTER]: Routing to end`);
      return PlannerNode.END;
    }

    if (
      state.last_node === PlannerNode.PLANNER_VALIDATOR &&
      !l_msg.additional_kwargs.success
    ) {
      if (state.retry >= maxRetries) {
        logger.debug(
          `[PLANNING_ROUTER]: Max retries (${maxRetries}) reached, routing to end`
        );
        return PlannerNode.END_PLANNER_GRAPH;
      }
      logger.debug(
        `[PLANNING_ROUTER]: Retry ${state.retry + 1}/${maxRetries}, routing to plan_revision`
      );
      return PlannerNode.PLAN_REVISION;
    }
    if (
      currentMode === AgentMode.AUTONOMOUS ||
      currentMode === AgentMode.HYBRID
    ) {
      if (
        isInEnum(ExecutorNode, state.last_node) ||
        isInEnum(MemoryNode, state.last_node)
      ) {
        logger.debug(`[PLANNING_ROUTER]: Routing to evolve_from_history`);
        return PlannerNode.EVOLVE_FROM_HISTORY;
      }
    }
    logger.warn(`[PLANNER_ROUTER] No routing find. routing to END`);
    return PlannerNode.END_PLANNER_GRAPH;
  }

  private createInitialHistory(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ) {
    logger.info('[CreateInitialHistory] Initializing empty history state');
    return new Command({
      update: {
        executionMode: ExecutionMode.REACTIVE,
        currentTaskIndex: 0,
        retry: 0,
      },
      goto: 'end',
    });
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
