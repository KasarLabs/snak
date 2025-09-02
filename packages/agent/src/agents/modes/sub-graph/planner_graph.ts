import { AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import { Annotation, START, StateGraph, Command } from '@langchain/langgraph';
import {
  Agent,
  History,
  isPlannerActivateSchema,
  ParsedPlan,
  StepInfo,
} from '../types/index.js';
import {
  checkAndReturnObjectFromPlansOrHistories,
  formatParsedPlanSimple,
  formatStepsForContext,
  PlanSchema,
  PlanSchemaType,
} from '../utils.js';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AnyZodObject, z } from 'zod';
import { AgentConfig, AgentMode, logger } from '@snakagent/core';
import { ModelSelector } from '../../../agents/operators/modelSelector.js';
import {
  GraphConfigurableAnnotation,
  GraphState,
  PlannerMode,
} from '../graph.js';
import { PlannerNode, DEFAULT_GRAPH_CONFIG } from '../config/default-config.js';
import {
  ADAPTIVE_PLANNER_CONTEXT_PROMPT,
  ADAPTIVE_PLANNER_SYSTEM_PROMPT,
  AUTONOMOUS_PLAN_EXECUTOR_SYSTEM_PROMPT,
  AUTONOMOUS_PLANNER_CONTEXT_PROMPT,
  HYBRID_PLAN_EXECUTOR_SYSTEM_PROMPT,
  INTERACTIVE_PLAN_EXECUTOR_SYSTEM_PROMPT,
  INTERACTIVE_PLANNER_CONTEXT_PROMPT,
  REPLAN_EXECUTOR_SYSTEM_PROMPT,
  REPLANNER_CONTEXT_PROMPT,
} from '../../../prompt/planner_prompt.js';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { AUTONOMOUS_PLAN_VALIDATOR_SYSTEM_PROMPT } from '../../../prompt/validator_prompt.js';
import { toJsonSchema } from '@langchain/core/utils/json_schema';
import { RunnableConfig } from '@langchain/core/runnables';
import { v4 as uuidv4 } from 'uuid';

export const GET_PLANNER_STATUS_PROMPT = `
You are a strategic routing agent that determines whether a user query requires complex planning (CoT) or can be handled by simple reactive execution (ReAct).

## DECISION CRITERIA

**USE PLANNER (CoT) - Set planner_actived: true** when the query has ANY of these characteristics:
- **Multi-step processes**: Requires sequential actions with dependencies between steps
- **Complex analysis**: Needs data gathering, analysis, and synthesis across multiple sources  
- **Strategic planning**: Involves goal decomposition, prioritization, or long-term thinking
- **Research workflows**: Requires systematic information collection and evaluation
- **Integration tasks**: Combines multiple tools/services with coordination requirements
- **Conditional logic**: Has if-then scenarios or branching decision paths
- **Quality gates**: Needs validation, review, or iterative refinement steps
- **Resource optimization**: Requires planning for efficiency, cost, or time constraints

**USE REACT (Simple) - Set planner_actived: false** when the query is:
- **Single action**: Can be completed with one tool call or simple response
- **Direct lookup**: Straightforward information retrieval or data access
- **Simple calculations**: Basic math, conversions, or formatting tasks
- **Status checks**: Getting current state or simple diagnostics
- **Immediate responses**: Requires real-time interaction without planning delay

## EXAMPLES

**PLANNER REQUIRED (true):**
- "Analyze competitor pricing and create a market positioning strategy"
- "Research and implement a new authentication system for our app"
- "Plan and execute a data migration from MySQL to PostgreSQL"
- "Create a comprehensive marketing campaign for our product launch"
- "Build a financial dashboard with multiple data sources and visualizations"

**REACT SUFFICIENT (false):**
- "What's the current Bitcoin price?"
- "Convert 100 USD to EUR"
- "Check the status of our server"
- "Generate a random password"
- "What time is it in Tokyo?"

## AGENT CONTEXT
Agent Configuration: {agentConfig}
UserQuery: {userQuery}

## DECISION RULE
Analyze the user query against the criteria above. When in doubt, prefer the planner for better execution quality, but avoid over-planning for simple tasks.
`;

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

  private build_prompt(
    mode: AgentMode,
    context: PlannerNode
  ): PromptValuePairs {
    const key = `${mode}-${context}`;
    const prompts = this.planner_prompts.get(key);

    if (!prompts) {
      throw new Error(
        `No prompts found for mode: ${mode}, context: ${context}`
      );
    }

    return prompts;
  }

  private async replanExecution(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<{
    messages: BaseMessage[];
    last_agent: Agent;
    plans_or_histories?: ParsedPlan;
    currentStepIndex: number;
    currentGraphStep: number;
  }> {
    try {
      const l_msg = state.messages[state.messages.length - 1];
      logger.info('[PlanRevision] Starting plan_or_history revision');
      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('Model not found in ModelSelector');
      }
      const plan_or_history = checkAndReturnObjectFromPlansOrHistories(
        state.plans_or_histories
      );
      if (!plan_or_history || plan_or_history.type !== 'plan') {
        throw new Error('No existing plan_or_history to revise');
      }
      const agent_mode =
        config.configurable?.agent_config?.mode ??
        DEFAULT_GRAPH_CONFIG.agent_config.mode;
      const prompts = this.build_prompt(agent_mode, PlannerNode.PLAN_REVISION);
      const systemPrompt = prompts.system;
      const contextPrompt = prompts.context;

      const structuredModel = model.withStructuredOutput(PlanSchema);

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', systemPrompt],
        ['ai', contextPrompt],
      ]);

      const structuredResult = (await structuredModel.invoke(
        await prompt.formatMessages({
          agentConfig: this.agentConfig.prompt,
          toolsAvailable: parseToolsToJson(this.toolsList),
          rejectedReason: l_msg.content.toLocaleString(),
          formatPlan: formatParsedPlanSimple(plan_or_history),
          userQuery: config.configurable?.user_request || '',
        })
      )) as PlanSchemaType;

      const aiMessage = new AIMessageChunk({
        content: `Plan revised with ${structuredResult.steps.length} steps:\n${structuredResult.steps
          .map((s) => `${s.stepNumber}. ${s.stepName}: ${s.description}`)
          .join('\n')}`,
        additional_kwargs: {
          error: false,
          final: false,
          from: Agent.PLANNER,
        },
      });
      const newPlan: ParsedPlan = {
        ...structuredResult,
        id: plan_or_history.id,
        type: 'plan' as const,
      };
      return {
        messages: [aiMessage],
        last_agent: Agent.PLANNER,
        plans_or_histories: newPlan,
        currentGraphStep: state.currentGraphStep + 1,
        currentStepIndex: 0,
      };
    } catch (error) {
      logger.error(`[PlanRevision] Plan execution failed: ${error}`);

      const errorMessage = new AIMessageChunk({
        content: `Failed to create plans_or_histories: ${error.message}`,
        additional_kwargs: {
          error: true,
          final: false,
          from: 'planner',
        },
      });

      return {
        messages: [errorMessage],
        last_agent: Agent.PLANNER,
        currentStepIndex: 0,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  private async planExecution(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<{
    messages: BaseMessage[];
    last_agent: Agent;
    plans_or_histories?: ParsedPlan;
    currentStepIndex: number;
    currentGraphStep: number;
  }> {
    try {
      logger.info('[Planner] Starting plan_or_history execution');
      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('Model not found in ModelSelector');
      }
      const structuredModel = model.withStructuredOutput(PlanSchema);
      const agent_mode: AgentMode =
        (config.configurable?.agent_config?.mode as AgentMode) ??
        DEFAULT_GRAPH_CONFIG.agent_config.mode;
      const prompts = this.build_prompt(
        agent_mode,
        PlannerNode.CREATE_INITIAL_PLAN
      );
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', prompts.system],
        ['ai', prompts.context],
      ]);
      const structuredResult = (await structuredModel.invoke(
        await prompt.formatMessages({
          agentConfig: this.agentConfig.prompt,
          toolsAvailable: parseToolsToJson(this.toolsList),
          userQuery: config.configurable?.user_request ?? '',
        })
      )) as PlanSchemaType;
      logger.info(
        `[Planner] Successfully created plan_or_history with ${structuredResult.steps.length} steps`
      );

      const aiMessage = new AIMessageChunk({
        content: `Plan created with ${structuredResult.steps.length} steps:\n${structuredResult.steps
          .map(
            (s: StepInfo) => `${s.stepNumber}. ${s.stepName}: ${s.description}`
          )
          .join('\n')}`,
        additional_kwargs: {
          error: false,
          final: false,
          from: Agent.PLANNER,
        },
      });
      const created_plan: ParsedPlan = {
        ...structuredResult,
        id: uuidv4(),
        type: 'plan' as const,
      };

      return {
        messages: [aiMessage],
        last_agent: Agent.PLANNER,
        plans_or_histories: created_plan,
        currentGraphStep: state.currentGraphStep + 1,
        currentStepIndex: 0,
      };
    } catch (error) {
      logger.error(`[Planner] Plan execution failed: ${error}`);

      const errorMessage = new AIMessageChunk({
        content: `Failed to create plans_or_histories: ${error.message}`,
        additional_kwargs: {
          error: true,
          final: false,
          from: 'planner',
        },
      });

      return {
        messages: [errorMessage],
        last_agent: Agent.PLANNER,
        currentStepIndex: 0,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  private async adaptivePlanner(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<{
    messages: BaseMessage[];
    last_agent: Agent;
    plans_or_histories?: ParsedPlan;
    currentGraphStep: number;
    currentStepIndex: number;
  }> {
    try {
      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('Model not found in ModelSelector');
      }
      const plan_or_history = checkAndReturnObjectFromPlansOrHistories(
        state.plans_or_histories
      );
      if (!plan_or_history || plan_or_history.type !== 'plan') {
        throw new Error('No existing plan_or_history to revise');
      }
      const structuredModel = model.withStructuredOutput(PlanSchema);

      const agent_mode =
        config.configurable?.agent_config?.mode ??
        DEFAULT_GRAPH_CONFIG.agent_config.mode;
      const prompts = this.build_prompt(
        agent_mode,
        PlannerNode.EVOLVE_FROM_HISTORY
      );
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', prompts.system],
        ['ai', prompts.context],
      ]);
      const structuredResult = (await structuredModel.invoke(
        await prompt.formatMessages({
          stepLength: state.currentStepIndex + 1,
          agentConfig: this.agentConfig.prompt,
          toolsAvailable: parseToolsToJson(this.toolsList),
          previousSteps: formatStepsForContext(plan_or_history.steps),
        })
      )) as PlanSchemaType;

      logger.info(
        `[AdaptivePlanner] Created plan_or_history with ${structuredResult.steps.length} steps`
      );

      const aiMessage = new AIMessageChunk({
        content: `Plan created with ${structuredResult.steps.length} steps:\n${structuredResult.steps
          .map((s: StepInfo) => `${s.stepNumber}. ${s.stepName}:`)
          .join('\n')}`,
        additional_kwargs: {
          structured_output: structuredResult,
          from: 'planner',
        },
      });
      const newPlan: ParsedPlan = {
        ...structuredResult,
        id: uuidv4(),
        type: 'plan' as const,
      };
      return {
        messages: [aiMessage],
        last_agent: Agent.PLANNER,
        plans_or_histories: newPlan,
        currentStepIndex: 0,
        currentGraphStep: state.currentGraphStep + 1,
      };
    } catch (error) {
      logger.error(`[AdaptivePlanner] Plan creation failed: ${error}`);

      const errorMessage = new AIMessageChunk({
        content: `Failed to create plans_or_histories: ${error.message}`,
        additional_kwargs: {
          error: true,
          from: Agent.ADAPTIVE_PLANNER,
        },
      });

      return {
        messages: [errorMessage],
        last_agent: Agent.PLANNER,
        currentGraphStep: state.currentGraphStep + 1,
        currentStepIndex: state.currentStepIndex,
      };
    }
  }

  // VALIDATOR

  private async validatorPlanner(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<{
    messages: BaseMessage[];
    currentStepIndex: number;
    last_agent: Agent;
    retry: number;
    currentGraphStep: number;
  }> {
    try {
      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('Model not found in ModelSelector');
      }
      const plan_or_history = checkAndReturnObjectFromPlansOrHistories(
        state.plans_or_histories
      );
      if (!plan_or_history || plan_or_history.type !== 'plan') {
        throw new Error('No existing plan_or_history to revise');
      }
      const StructuredResponseValidator = z.object({
        success: z.boolean(),
        result: z
          .string()
          .max(300)
          .describe(
            'Explain why the plan_or_history is valid or not in maximum 250 character'
          ),
      });

      const structuredModel = model.withStructuredOutput(
        StructuredResponseValidator
      );

      const planDescription = formatParsedPlanSimple(plan_or_history);

      const agent_mode =
        config.configurable?.agent_config?.mode ??
        DEFAULT_GRAPH_CONFIG.agent_config.mode;
      const prompts = this.build_prompt(
        agent_mode,
        PlannerNode.PLANNER_VALIDATOR
      );
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', prompts.system],
      ]);
      const structuredResult = await structuredModel.invoke(
        await prompt.formatMessages({
          agentConfig:
            config.configurable?.agent_config?.prompt ??
            DEFAULT_GRAPH_CONFIG.agent_config.prompt,
          currentPlan: planDescription,
        })
      );

      if (structuredResult.success) {
        const successMessage = new AIMessageChunk({
          content: `Plan success: ${structuredResult.result}`,
          additional_kwargs: {
            error: false,
            success: true,
            from: Agent.PLANNER_VALIDATOR,
          },
        });
        logger.info(`[PlannerValidator] Plan success successfully`);
        return {
          messages: [successMessage],
          last_agent: Agent.PLANNER_VALIDATOR,
          currentStepIndex: state.currentStepIndex,
          retry: state.retry,
          currentGraphStep: state.currentGraphStep + 1,
        };
      } else {
        const errorMessage = new AIMessageChunk({
          content: `Plan validation failed: ${structuredResult.result}`,
          additional_kwargs: {
            error: false,
            success: false,
            from: Agent.PLANNER_VALIDATOR,
          },
        });
        logger.warn(
          `[PlannerValidator] Plan validation failed: ${structuredResult.result}`
        );
        return {
          messages: [errorMessage],
          currentStepIndex: state.currentStepIndex,
          last_agent: Agent.PLANNER_VALIDATOR,
          retry: 0,
          currentGraphStep: state.currentGraphStep + 1,
        };
      }
    } catch (error) {
      logger.error(
        `[PlannerValidator] Failed to validate plans_or_histories: ${error.message}`
      );
      const errorMessage = new AIMessageChunk({
        content: `Failed to validate plans_or_histories: ${error.message}`,
        additional_kwargs: {
          error: true,
          success: false,
          from: Agent.PLANNER_VALIDATOR,
        },
      });
      return {
        messages: [errorMessage],
        currentStepIndex: state.currentStepIndex,
        last_agent: Agent.PLANNER_VALIDATOR,
        retry: state.retry + 1,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  private async get_planner_status(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ) {
    try {
      const agent_config =
        config.configurable?.agent_config ?? DEFAULT_GRAPH_CONFIG.agent_config;
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
        isPlannerActivate: result.planner_actived
          ? PlannerMode.ACTIVATED
          : PlannerMode.DISABLED,
        currentGraphStep: state.currentGraphStep + 1,
      };
    } catch (error) {
      logger.error(
        `[GET_PLANNER_STATUS] Failed to determine planner status: ${error.message}`
      );
      // Default to disabled on error to prevent getting stuck in planning loop
      return {
        isPlannerActivate: PlannerMode.DISABLED,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  public planning_router(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): PlannerNode {
    const agent_config =
      config.configurable?.agent_config ?? DEFAULT_GRAPH_CONFIG.agent_config;
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
    // INTERACTIVE STRART PART
    console.log('PLANNER_ROUTER - Current Mode:', currentMode);
    console.log(config.configurable?.planner_mode);
    console.log(config.configurable?.planner_mode === PlannerMode.DISABLED);
    if (currentMode === AgentMode.INTERACTIVE) {
      if (
        (config.configurable?.planner_mode ??
          DEFAULT_GRAPH_CONFIG.planner_mode) === PlannerMode.DISABLED
      ) {
        logger.debug(
          `[PLANNING_ROUTER] PlannerMode is disabled. routing to create_initial_history`
        );
        return PlannerNode.CREATE_INITIAL_HISTORY;
      }
      if (
        (config.configurable?.planner_mode ??
          DEFAULT_GRAPH_CONFIG.planner_mode) === PlannerMode.AUTOMATIC
      ) {
        logger.debug(
          '[PLANNING_ROUTER] PlannerMode is automatic. routing to get_planner_status'
        );
        return PlannerNode.GET_PLANNER_STATUS;
      }
    }

    // GLOBAL START PART
    if (!state.last_agent || state.last_agent === Agent.START) {
      logger.debug(`[PLANNING_ROUTER]: Routing to create_initial_plan`);
      return PlannerNode.CREATE_INITIAL_PLAN;
    }
    if (
      state.last_agent === Agent.PLANNER_VALIDATOR &&
      l_msg.additional_kwargs.success
    ) {
      logger.debug(`[PLANNING_ROUTER]: Routing to end`);
      return PlannerNode.END;
    }

    if (
      state.last_agent === Agent.PLANNER_VALIDATOR &&
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

    console.log(currentMode);
    console.log(state.last_agent);
    if (
      currentMode === AgentMode.AUTONOMOUS ||
      currentMode === AgentMode.HYBRID
    ) {
      if (
        state.last_agent === Agent.EXEC_VALIDATOR ||
        state.last_agent === Agent.MEMORY_MANAGER
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
        currentStepIndex: 0,
        retry: 0,
      },
      goto: 'end',
    });
  }
  private end_planner_graph(state: typeof GraphState.State) {
    logger.info('[EndPlannerGraph] Cleaning up state for graph termination');
    return new Command({
      update: {
        currentStepIndex: 0,
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
      .addNode('create_initial_history', this.createInitialHistory.bind(this))
      .addNode('plan_revision', this.replanExecution.bind(this))
      .addNode('planner_validator', this.validatorPlanner.bind(this))
      .addNode('end_planner_graph', this.end_planner_graph.bind(this))
      .addNode('get_planner_status', this.get_planner_status.bind(this))
      .addNode('evolve_from_history', this.adaptivePlanner.bind(this))
      .addEdge('evolve_from_history', 'planner_validator')
      .addEdge('create_initial_plan', 'planner_validator')
      .addEdge('plan_revision', 'planner_validator')
      .addConditionalEdges(START, this.planning_router.bind(this))
      .addConditionalEdges(
        'planner_validator',
        this.planning_router.bind(this)
      );

    this.graph = planner_subgraph.compile();
  }
}
