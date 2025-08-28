import { AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import { Annotation, START, StateGraph, Command } from '@langchain/langgraph';
import { Agent, ParsedPlan, StepInfo } from '../types/index.js';
import {
  formatParsedPlanSimple,
  formatStepsForContext,
  PlanSchema,
} from '../utils.js';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AnyZodObject, z } from 'zod';
import { AgentConfig, AgentMode, logger } from '@snakagent/core';
import { ModelSelector } from 'agents/operators/modelSelector.js';
import { AutonomousConfigurableAnnotation } from '../autonomous.js';
import {
  AutonomousPlannerNode,
  DEFAULT_AUTONOMOUS_CONFIG,
} from '../config/autonomous-config.js';
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

export type PlannerStateType = typeof PlannerGraphState.State;

export const PlannerGraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  last_message: Annotation<BaseMessage | BaseMessage[]>,
  last_agent: Annotation<Agent>,
  plan: Annotation<ParsedPlan>,
  currentStepIndex: Annotation<number>,
  retry: Annotation<number>,
  currentGraphStep: Annotation<number>,
});

export const parseToolsToJson = (
  tools: (StructuredTool | Tool | DynamicStructuredTool<AnyZodObject>)[]
): string => {
  const toolFunctions = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: toJsonSchema(tool.schema), // This converts Zod schema to JSON schema
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
  private agentConfig: AgentConfig;
  private modelSelector: ModelSelector | null;
  private graph: any;
  private toolsList: (
    | StructuredTool
    | Tool
    | DynamicStructuredTool<AnyZodObject>
  )[] = [];
  constructor(
    agentConfig: AgentConfig,
    modelSelector: ModelSelector,
    toolList: (StructuredTool | Tool | DynamicStructuredTool<AnyZodObject>)[]
  ) {
    this.modelSelector = modelSelector;
    this.agentConfig = agentConfig;
    this.toolsList = toolList;
  }

  private async replanExecution(
    state: typeof PlannerGraphState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation>
  ): Promise<{
    last_message: BaseMessage;
    last_agent: Agent;
    plan?: ParsedPlan;
    currentStepIndex: number;
    currentGraphStep: number;
  }> {
    try {
      logger.info('[PlanRevision] Starting plan revision');
      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('Model not found in ModelSelector');
      }

      const systemPrompt = REPLAN_EXECUTOR_SYSTEM_PROMPT;
      const contextPrompt = REPLANNER_CONTEXT_PROMPT;

      const structuredModel = model.withStructuredOutput(PlanSchema);

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', systemPrompt],
        ['ai', contextPrompt],
      ]);

      const structuredResult = await structuredModel.invoke(
        await prompt.formatMessages({
          objectives: this.agentConfig.prompt,
          toolsAvailable: parseToolsToJson(this.toolsList),
          rejectedReason: (
            state.last_message as BaseMessage
          ).content.toLocaleString(),
          formatPlan: formatParsedPlanSimple(state.plan),
        })
      );

      const aiMessage = new AIMessageChunk({
        content: `Plan revised with ${structuredResult.steps.length} steps:\n${structuredResult.steps
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

      return {
        last_message: aiMessage,
        last_agent: Agent.PLANNER,
        plan: structuredResult as ParsedPlan,
        currentGraphStep: state.currentGraphStep + 1,
        currentStepIndex: 0,
      };
    } catch (error) {
      logger.error(`[PlanRevision] Plan execution failed: ${error}`);

      const errorMessage = new AIMessageChunk({
        content: `Failed to create plan: ${error.message}`,
        additional_kwargs: {
          error: true,
          final: false,
          from: 'planner',
        },
      });

      return {
        last_message: errorMessage,
        last_agent: Agent.PLANNER,
        currentStepIndex: 0,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  private async planExecution(
    state: typeof PlannerGraphState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): Promise<{
    messages: BaseMessage;
    last_message: BaseMessage;
    last_agent: Agent;
    plan?: ParsedPlan;
    currentStepIndex: number;
    currentGraphStep: number;
  }> {
    try {
      logger.info('[Planner] Starting plan execution');
      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('Model not found in ModelSelector');
      }
      let structuredResult: ParsedPlan;
      const structuredModel = model.withStructuredOutput(PlanSchema);
      let systemPrompt;
      let contextPrompt;
      const agent_mode: AgentMode = config.configurable?.agent_config
        ?.mode as AgentMode;
      if (agent_mode === AgentMode.HYBRID) {
        logger.debug('[Planner] Creating initial hybrid plan');
        systemPrompt = HYBRID_PLAN_EXECUTOR_SYSTEM_PROMPT;
        contextPrompt = AUTONOMOUS_PLAN_EXECUTOR_SYSTEM_PROMPT;
      } else if (agent_mode === AgentMode.AUTONOMOUS) {
        logger.debug('[Planner] Creating initial autonomous plan');
        systemPrompt = AUTONOMOUS_PLAN_EXECUTOR_SYSTEM_PROMPT;
        contextPrompt = AUTONOMOUS_PLANNER_CONTEXT_PROMPT;
      } else {
        systemPrompt = INTERACTIVE_PLAN_EXECUTOR_SYSTEM_PROMPT;
        contextPrompt = INTERACTIVE_PLANNER_CONTEXT_PROMPT;
      }
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', systemPrompt],
        ['ai', contextPrompt],
      ]);
      structuredResult = (await structuredModel.invoke(
        await prompt.formatMessages({
          objectives: this.agentConfig.prompt,
          toolsAvailable: parseToolsToJson(this.toolsList),
        })
      )) as ParsedPlan;
      logger.info(
        `[Planner] Successfully created plan with ${structuredResult.steps.length} steps`
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

      return {
        messages: aiMessage,
        last_message: aiMessage,
        last_agent: Agent.PLANNER,
        plan: structuredResult as ParsedPlan,
        currentGraphStep: state.currentGraphStep + 1,
        currentStepIndex: 0,
      };
    } catch (error) {
      logger.error(`[Planner] Plan execution failed: ${error}`);

      const errorMessage = new AIMessageChunk({
        content: `Failed to create plan: ${error.message}`,
        additional_kwargs: {
          error: true,
          final: false,
          from: 'planner',
        },
      });

      return {
        messages: errorMessage,
        last_message: errorMessage,
        last_agent: Agent.PLANNER,
        currentStepIndex: 0,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  private async adaptivePlanner(
    state: typeof PlannerGraphState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): Promise<{
    messages: BaseMessage;
    last_message: BaseMessage;
    last_agent: Agent;
    plan?: ParsedPlan;
    currentGraphStep: number;
  }> {
    try {
      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('Model not found in ModelSelector');
      }
      const structuredModel = model.withStructuredOutput(PlanSchema);
      const systemPrompt = ADAPTIVE_PLANNER_SYSTEM_PROMPT;
      const context: string = ADAPTIVE_PLANNER_CONTEXT_PROMPT;

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', systemPrompt],
        ['ai', context],
      ]);
      const structuredResult = await structuredModel.invoke(
        await prompt.formatMessages({
          stepLength: state.currentStepIndex + 1,
          objectives: this.agentConfig.prompt,
          toolsAvailable: parseToolsToJson(this.toolsList),
          previousSteps: formatStepsForContext(state.plan.steps),
        })
      );

      logger.info(
        `[AdaptivePlanner] Created plan with ${structuredResult.steps.length} steps`
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

      const updatedPlan = state.plan;
      let nextStepNumber = state.plan.steps.length + 1;
      for (const step of structuredResult.steps) {
        step.stepNumber = nextStepNumber;
        updatedPlan.steps.push(step as StepInfo);
        nextStepNumber++;
      }

      updatedPlan.summary = structuredResult.summary as string;

      return {
        messages: aiMessage,
        last_message: aiMessage,
        last_agent: Agent.PLANNER,
        plan: updatedPlan,
        currentGraphStep: state.currentGraphStep + 1,
      };
    } catch (error) {
      logger.error(`[AdaptivePlanner] Plan creation failed: ${error}`);

      const errorMessage = new AIMessageChunk({
        content: `Failed to create plan: ${error.message}`,
        additional_kwargs: {
          error: true,
          from: Agent.ADAPTIVE_PLANNER,
        },
      });

      return {
        messages: errorMessage,
        last_message: errorMessage,
        last_agent: Agent.PLANNER,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  // VALIDATOR

  private async validatorPlanner(
    state: typeof PlannerGraphState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): Promise<{
    messages: BaseMessage;
    last_message: BaseMessage;
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

      const StructuredResponseValidator = z.object({
        success: z.boolean(),
        result: z
          .string()
          .max(300)
          .describe(
            'Explain why the plan is valid or not in maximum 250 character'
          ),
      });

      const structuredModel = model.withStructuredOutput(
        StructuredResponseValidator
      );

      const planDescription = formatParsedPlanSimple(state.plan);
      const systemPrompt = AUTONOMOUS_PLAN_VALIDATOR_SYSTEM_PROMPT;

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', systemPrompt],
      ]);
      const structuredResult = await structuredModel.invoke(
        await prompt.formatMessages({
          agentConfig: config.configurable?.agent_config?.prompt,
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
          messages: successMessage,
          last_message: successMessage,
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
          messages: errorMessage,
          last_message: errorMessage,
          currentStepIndex: state.currentStepIndex,
          last_agent: Agent.PLANNER_VALIDATOR,
          retry: 0,
          currentGraphStep: state.currentGraphStep + 1,
        };
      }
    } catch (error) {
      logger.error(
        `[PlannerValidator] Failed to validate plan: ${error.message}`
      );
      const errorMessage = new AIMessageChunk({
        content: `Failed to validate plan: ${error.message}`,
        additional_kwargs: {
          error: true,
          success: false,
          from: Agent.PLANNER_VALIDATOR,
        },
      });
      return {
        messages: errorMessage,
        last_message: errorMessage,
        currentStepIndex: state.currentStepIndex,
        last_agent: Agent.PLANNER_VALIDATOR,
        retry: state.retry + 1,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  public planning_router(
    state: typeof PlannerGraphState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): AutonomousPlannerNode {
    if (
      state.currentGraphStep >=
      (config.configurable?.max_graph_steps ??
        DEFAULT_AUTONOMOUS_CONFIG.maxGraphSteps)
    ) {
      logger.warn(
        `[MemoryRouter] Memory sub-graph limit reached (${state.currentGraphStep}), routing to END`
      );
      return AutonomousPlannerNode.END_PLANNER_GRAPH;
    }
    const maxRetries = DEFAULT_AUTONOMOUS_CONFIG.maxRetries;

    if (!state.last_agent || state.last_agent === Agent.START) {
      logger.debug(`[PLANNING_ROUTER]: Routing to create_initial_plan`);
      return AutonomousPlannerNode.CREATE_INITIAL_PLAN;
    }

    if (state.last_agent === Agent.EXEC_VALIDATOR) {
      logger.debug(`[PLANNING_ROUTER]: Routing to evolve_from_history`);
      return AutonomousPlannerNode.EVOLVE_FROM_HISTORY;
    }

    if (
      state.last_agent === Agent.PLANNER_VALIDATOR &&
      (state.last_message as BaseMessage).additional_kwargs.success
    ) {
      logger.debug(`[PLANNING_ROUTER]: Routing to end`);
      return AutonomousPlannerNode.END;
    }

    if (
      state.last_agent === Agent.PLANNER_VALIDATOR &&
      !(state.last_message as BaseMessage).additional_kwargs.success
    ) {
      if (state.retry >= maxRetries) {
        logger.debug(
          `[PLANNING_ROUTER]: Max retries (${maxRetries}) reached, routing to end`
        );
        return AutonomousPlannerNode.END_PLANNER_GRAPH;
      }
      logger.debug(
        `[PLANNING_ROUTER]: Retry ${state.retry + 1}/${maxRetries}, routing to plan_revision`
      );
      return AutonomousPlannerNode.PLAN_REVISION;
    }

    return AutonomousPlannerNode.EVOLVE_FROM_HISTORY;
  }

  private end_planner_graph(state: typeof PlannerGraphState.State) {
    logger.info('[EndPlannerGraph] Cleaning up state for graph termination');
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

  public getPlannerGraph() {
    return this.graph;
  }

  public createPlannerGraph() {
    const planner_subgraph = new StateGraph(
      PlannerGraphState,
      AutonomousConfigurableAnnotation
    )
      .addNode('create_initial_plan', this.planExecution.bind(this))
      .addNode('plan_revision', this.replanExecution.bind(this))
      .addNode('evolve_from_history', this.adaptivePlanner.bind(this))
      .addNode('planner_validator', this.validatorPlanner.bind(this))
      .addNode('end_planner_graph', this.end_planner_graph.bind(this))
      .addEdge('create_initial_plan', 'planner_validator')
      .addEdge('evolve_from_history', 'planner_validator')
      .addEdge('plan_revision', 'planner_validator')

      .addConditionalEdges(START, this.planning_router.bind(this))
      .addConditionalEdges(
        'planner_validator',
        this.planning_router.bind(this)
      );
    this.graph = planner_subgraph.compile();
  }
}
