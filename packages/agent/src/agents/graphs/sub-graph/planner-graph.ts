import { AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import { START, StateGraph, Command, END } from '@langchain/langgraph';
import {
  History,
  isPlannerActivateSchema,
  ParsedPlan,
  StepInfo,
  TasksType,
  TaskType,
} from '../../../shared/types/index.js';
import {
  checkAndReturnObjectFromPlansOrHistories,
  formatParsedPlanSimple,
  handleNodeError,
} from '../utils/graph-utils.js';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AnyZodObject } from 'zod';
import { AgentConfig, AgentMode, logger } from '@snakagent/core';
import { ModelSelector } from '../../operators/modelSelector.js';
import {
  appendToRunFile,
  GraphConfigurableAnnotation,
  GraphState,
} from '../graph.js';
import { DEFAULT_GRAPH_CONFIG } from '../config/default-config.js';
import {
  PlannerNode,
  GraphNode,
  ExecutorNode,
  MemoryNode,
  ExecutionMode,
} from '../../../shared/enums/agent-modes.enum.js';
import {
  ADAPTIVE_PLANNER_CONTEXT_PROMPT,
  ADAPTIVE_PLANNER_SYSTEM_PROMPT,
  AUTONOMOUS_PLAN_EXECUTOR_SYSTEM_PROMPT,
  AUTONOMOUS_PLANNER_CONTEXT_PROMPT,
  GET_PLANNER_STATUS_PROMPT,
  HYBRID_PLAN_EXECUTOR_SYSTEM_PROMPT,
  INTERACTIVE_PLAN_EXECUTOR_SYSTEM_PROMPT,
  INTERACTIVE_PLANNER_CONTEXT_PROMPT,
  REPLAN_EXECUTOR_SYSTEM_PROMPT,
  REPLANNER_CONTEXT_PROMPT,
} from '../../../shared/prompts/graph/planner/index.js';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { AUTONOMOUS_PLAN_VALIDATOR_SYSTEM_PROMPT } from '../../../shared/prompts/graph/executor/validator_prompt.js';
import { toJsonSchema } from '@langchain/core/utils/json_schema';
import { RunnableConfig } from '@langchain/core/runnables';
import { v4 as uuidv4 } from 'uuid';
import { isInEnum } from '@enums/utils.js';
import TasksSchema, {
  PlanSchema,
  PlanSchemaType,
  TaskSchema,
  TaskSchemaType,
  TasksSchemaType,
} from '@schemas/graph.schemas.js';
import * as z from 'zod';

import { parseEvolveFromHistoryContext } from '../parser/plan-or-histories/plan-or-histoires.parser.js';
import { PromptGenerator } from '../manager/prompts/prompt-generator-manager.js';
import { headerPromptStandard } from '@prompts/agents/header.prompt.js';
import { INSTRUCTION_TASK_INITALIZER } from '@prompts/agents/instruction.prompts.js';
import { PERFORMANCE_EVALUATION_PROMPT } from '@prompts/agents/performance-evaluation.prompt.js';
import { tr } from 'zod/v4/locales';
import { CORE_AGENT_PROMPT } from '@prompts/agents/core.prompts.js';
import { stat } from 'fs';
import { stm_format_for_history } from '../parser/memory/stm-parser.js';
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

export interface PlannerPromptsKeyPairs {
  mode: AgentMode;
  context: PlannerNode;
}

export interface PromptValuePairs {
  system: string;
  context: string;
}

export class PlannerGraph {
  private agentConfig: AgentConfig;
  private modelSelector: ModelSelector | null;
  private graph: any;
  private toolsList: (
    | StructuredTool
    | Tool
    | DynamicStructuredTool<AnyZodObject>
  )[] = [];
  private planner_prompts: Map<string, PromptValuePairs>;
  constructor(
    agentConfig: AgentConfig,
    modelSelector: ModelSelector,
    toolList: (StructuredTool | Tool | DynamicStructuredTool<AnyZodObject>)[]
  ) {
    this.modelSelector = modelSelector;
    this.agentConfig = agentConfig;
    this.toolsList = toolList;
    this.planner_prompts = new Map();
    this.initializePrompts();
  }

  private initializePrompts(): void {
    // Plan Execution prompts for different agent modes
    this.planner_prompts.set(
      `${AgentMode.HYBRID}-${PlannerNode.CREATE_INITIAL_PLAN}`,
      {
        system: HYBRID_PLAN_EXECUTOR_SYSTEM_PROMPT,
        context: AUTONOMOUS_PLANNER_CONTEXT_PROMPT,
      }
    );

    this.planner_prompts.set(
      `${AgentMode.AUTONOMOUS}-${PlannerNode.CREATE_INITIAL_PLAN}`,
      {
        system: AUTONOMOUS_PLAN_EXECUTOR_SYSTEM_PROMPT,
        context: AUTONOMOUS_PLANNER_CONTEXT_PROMPT,
      }
    );

    this.planner_prompts.set(
      `${AgentMode.INTERACTIVE}-${PlannerNode.CREATE_INITIAL_PLAN}`,
      {
        system: INTERACTIVE_PLAN_EXECUTOR_SYSTEM_PROMPT,
        context: INTERACTIVE_PLANNER_CONTEXT_PROMPT,
      }
    );

    const sharedPrompts = [
      {
        node: PlannerNode.PLAN_REVISION,
        prompts: {
          system: REPLAN_EXECUTOR_SYSTEM_PROMPT,
          context: REPLANNER_CONTEXT_PROMPT,
        },
      },
      {
        node: PlannerNode.EVOLVE_FROM_HISTORY,
        prompts: {
          system: ADAPTIVE_PLANNER_SYSTEM_PROMPT,
          context: ADAPTIVE_PLANNER_CONTEXT_PROMPT,
        },
      },
      {
        node: PlannerNode.PLANNER_VALIDATOR,
        prompts: {
          system: AUTONOMOUS_PLAN_VALIDATOR_SYSTEM_PROMPT,
          context: '',
        },
      },
    ];

    // Add shared prompts for all agent modes
    sharedPrompts.forEach(({ node, prompts }) => {
      [AgentMode.HYBRID, AgentMode.AUTONOMOUS, AgentMode.INTERACTIVE].forEach(
        (mode) => {
          this.planner_prompts.set(`${mode}-${node}`, prompts);
        }
      );
    });
  }

  private build_prompt_generator(
    mode: AgentMode,
    context: PlannerNode
  ): PromptGenerator {
    try {
      let prompt: PromptGenerator;
      if (mode != AgentMode.AUTONOMOUS) {
        throw new Error(`[PlannerGraph] Unsupported agent mode: ${mode}`);
      }
      if (context === PlannerNode.CREATE_INITIAL_PLAN) {
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
        prompt.addGoal(this.agentConfig.prompt.content.toLocaleString());
        prompt.addInstruction(INSTRUCTION_TASK_INITALIZER);
        prompt.addTools(parseToolsToJson(this.toolsList));
        prompt.addPerformanceEvaluation(PERFORMANCE_EVALUATION_PROMPT);
        prompt.setActiveResponseFormat('task_initializer');
        return prompt;
      }
      throw new Error(`[PlannerGraph] No prompt found for context: ${context}`);
    } catch (error) {
      throw error;
    }
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
      }
    | Command
  > {
    try {
      logger.info('[Planner] Starting plan_or_history execution');
      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('Model not found in ModelSelector');
      }
      const structuredModel = model.withStructuredOutput(TaskSchema);
      const agent_mode: AgentMode =
        (config.configurable?.agent_config?.mode as AgentMode) ??
        DEFAULT_GRAPH_CONFIG.agent_config.mode;
      const prompts = this.build_prompt_generator(
        agent_mode,
        PlannerNode.CREATE_INITIAL_PLAN
      );
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', CORE_AGENT_PROMPT],
      ]);

      const formattedResponseFormat = JSON.stringify(
        prompts.getResponseFormat(),
        null,
        4
      );

      const formattedPrompt = await prompt.formatMessages({
        header: prompts.generateNumberedList(prompts.getHeader()),
        goal:
          config.configurable?.objectives ??
          this.agentConfig.prompt.content.toLocaleString(),
        constraints: prompts.generateNumberedList(
          prompts.getConstraints(),
          'constraint'
        ),
        short_term_memory: stm_format_for_history(state.memories.stm),
        long_term_memory: '',
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
      });
      const structuredResult = (await structuredModel.invoke(
        formattedPrompt
      )) as TaskSchemaType;
      logger.info(
        `[Planner] Successfully created task : ${structuredResult.text}`
      );
      appendToRunFile(JSON.stringify(formattedPrompt, null, 2));

      const aiMessage = new AIMessageChunk({
        content: `Plan created with task : ${structuredResult.text}`,
        additional_kwargs: {
          error: false,
          final: false,
          from: GraphNode.PLANNING_ORCHESTRATOR,
        },
      });

      const tasks = {
        id: uuidv4(),
        text: structuredResult.text,
        reasoning: structuredResult.reasoning,
        plan: structuredResult.plan,
        criticism: structuredResult.criticism,
        speak: structuredResult.speak,
        steps: [],
        status: 'pending' as 'pending',
      };
      state.tasks.push(tasks); // Push task to state
      return {
        messages: [aiMessage],
        last_node: PlannerNode.CREATE_INITIAL_PLAN,
        tasks: state.tasks,
        executionMode: ExecutionMode.PLANNING,
        currentGraphStep: state.currentGraphStep + 1,
      };
    } catch (error: any) {
      logger.error(`[Planner] Plan execution failed: ${error}`);
      return handleNodeError(error, 'PLANNER', state, 'Plan creation failed');
    }
  }

  private async get_planner_status(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ) {
    try {
      const agent_config = config.configurable?.agent_config;
      if (!agent_config) {
        throw new Error(
          '[PLANNING_ROUTER] AgentConfig is not configured. routing to END_GRAPH'
        );
      }
      const user_q = config.configurable?.user_request ?? '';
      if (!user_q) {
        throw new Error('[GET_PLANNER_STATUS] User query is undefined.');
      }
      if (!this.modelSelector) {
        logger.warn(
          '[GET_PLANNER_STATUS] Missing dependencies, skipping LTM processing'
        );
        return {};
      }

      const model = this.modelSelector.getModels()['cheap'];
      if (!model) {
        throw new Error(
          '[GET_PLANNER_STATUS] Cheap model not available for LTM processing'
        );
      }
      const structuredModel = model.withStructuredOutput(
        isPlannerActivateSchema
      );
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', GET_PLANNER_STATUS_PROMPT],
      ]);

      const result = await structuredModel.invoke(
        await prompt.formatMessages({
          agentConfig: agent_config.prompt,
          userQuery: user_q,
        })
      );

      logger.info(
        `[GET_PLANNER_STATUS] Planner activation decision: ${result.planner_actived ? 'ENABLED' : 'DISABLED'}`
      );

      return {
        executionMode: result.planner_actived
          ? ExecutionMode.PLANNING
          : ExecutionMode.REACTIVE,
        currentGraphStep: state.currentGraphStep + 1,
      };
    } catch (error) {
      logger.error(
        `[GET_PLANNER_STATUS] Failed to determine planner status: ${error.message}`
      );
      // Default to reactive on error to prevent getting stuck in planning loop
      return {
        executionMode: ExecutionMode.REACTIVE,
        currentGraphStep: state.currentGraphStep + 1,
      };
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
        plans_or_histories: {
          id: uuidv4(),
          type: 'history',
          items: [],
        } as History,
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
    // .addNode('create_initial_history', this.createInitialHistory.bind(this))
    // .addNode('plan_revision', this.replanExecution.bind(this))
    // .addNode('planner_validator', this.validatorPlanner.bind(this))
    // .addNode('end_planner_graph', this.end_planner_graph.bind(this))
    // .addNode('get_planner_status', this.get_planner_status.bind(this))
    // .addNode('evolve_from_history', this.adaptivePlanner.bind(this))
    // .addEdge('evolve_from_history', 'planner_validator')
    // .addEdge('create_initial_plan', 'planner_validator')
    // .addEdge('plan_revision', 'planner_validator')
    // .addConditionalEdges(START, this.planning_router.bind(this))
    // .addConditionalEdges(
    //   'planner_validator',
    //   this.planning_router.bind(this)
    // );

    this.graph = planner_subgraph.compile();
  }
}
