import { AgentConfig, AgentMode, logger } from '@snakagent/core';
import { SnakAgentInterface } from '../../tools/tools.js';
import { createAllowedTools } from '../../tools/tools.js';
import {
  StateGraph,
  MemorySaver,
  Annotation,
  END,
  START,
  interrupt,
  MessagesAnnotation,
} from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { MCP_CONTROLLER } from '../../services/mcp/src/mcp.js';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { AnyZodObject, z } from 'zod';
import {
  BaseMessage,
  ToolMessage,
  HumanMessage,
  AIMessageChunk,
} from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { ModelSelector } from '../operators/modelSelector.js';
import { LangGraphRunnableConfig } from '@langchain/langgraph';
import {
  initializeDatabase,
  initializeToolsList,
  truncateToolResults,
} from '../core/utils.js';
import {
  PLAN_EXECUTOR_SYSTEM_PROMPT,
  PLAN_VALIDATOR_SYSTEM_PROMPT,
  PromptPlanInteractive,
  REPLAN_EXECUTOR_SYSTEM_PROMPT,
  STEPS_VALIDATOR_SYSTEM_PROMPT,
} from '../../prompt/prompts.js';
import { TokenTracker } from '../../token/tokenTracking.js';
import { RunnableConfig } from '@langchain/core/runnables';
import { MemoryAgent } from 'agents/operators/memoryAgent.js';
import { RagAgent } from 'agents/operators/ragAgent.js';
import { Agent, ParsedPlan } from './interactive.js';
import {
  calculateIterationNumber,
  createMaxIterationsResponse,
  filterMessagesByShortTermMemory,
  formatParsedPlanSimple,
  getLatestMessageForMessage,
  handleModelError,
  isTerminalMessage,
} from './utils.js';
/**
 * Defines the state structure for the autonomous agent graph.
 */
const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (
      x: BaseMessage[],
      y: BaseMessage | BaseMessage[]
    ): BaseMessage[] => x.concat(y),
    default: (): BaseMessage[] => [],
  }),
});

export interface AgentReturn {
  app: any;
  agent_config: AgentConfig;
}

export class AutonomousAgent {
  private agent_config: AgentConfig;
  private modelSelector: ModelSelector | null;
  private toolsList: (
    | StructuredTool
    | Tool
    | DynamicStructuredTool<AnyZodObject>
  )[] = [];
  private memoryAgent: MemoryAgent | null = null;
  private ragAgent: RagAgent | null = null;
  private checkpointer: MemorySaver;
  private app: any;

  private ConfigurableAnnotation = Annotation.Root({
    max_graph_steps: Annotation<number>({
      reducer: (x, y) => y,
      default: () => 15,
    }),
    short_term_memory: Annotation<number>({
      reducer: (x, y) => y,
      default: () => 15,
    }),
    memorySize: Annotation<number>({
      reducer: (x, y) => y,
      default: () => 20,
    }),
    human_in_the_loop: Annotation<boolean>({
      reducer: (x, y) => y,
      default: () => false,
    }),
  });

  private GraphState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
      reducer: (x, y) => x.concat(y),
      default: () => [],
    }),
    last_agent: Annotation<Agent>({
      reducer: (x, y) => y,
      default: () => Agent.PLANNER,
    }),
    memories: Annotation<string>({
      reducer: (x, y) => y,
      default: () => '',
    }),
    rag: Annotation<string>({
      reducer: (x, y) => y,
      default: () => '',
    }),
    plan: Annotation<ParsedPlan>({
      reducer: (x, y) => y,
      default: () => ({
        steps: [],
        summary: '',
      }),
    }),
    currentStepIndex: Annotation<number>({
      reducer: (x, y) => y,
      default: () => 0,
    }),
    retry: Annotation<number>({
      reducer: (x, y) => y,
      default: () => 0,
    }),
    currentGraphStep: Annotation<number>({
      reducer: (x, y) => y,
      default: () => 0,
    }),
  });

  constructor(
    private snakAgent: SnakAgentInterface,
    modelSelector: ModelSelector | null
  ) {
    this.modelSelector = modelSelector;
    this.checkpointer = new MemorySaver();
  }

  private async initializeMemoryAgent(): Promise<void> {
    try {
      this.memoryAgent = this.snakAgent.getMemoryAgent();
      if (this.memoryAgent) {
        logger.debug('InteractiveAgent: Successfully retrieved memory agent');
        const memoryTools = this.memoryAgent.prepareMemoryTools();
        this.toolsList.push(...memoryTools);
      } else {
        logger.warn(
          'InteractiveAgent: Memory agent not available, memory features will be limited'
        );
      }
    } catch (error) {
      logger.error(`InteractiveAgent: Error retrieving memory agent: ${error}`);
    }
  }

  private async initializeRagAgent(): Promise<void> {
    try {
      this.ragAgent = this.snakAgent.getRagAgent();
      if (!this.ragAgent) {
        logger.warn(
          'InteractiveAgent: Rag agent not available, rag context will be skipped'
        );
      }
    } catch (error) {
      logger.error(`InteractiveAgent: Error retrieving rag agent: ${error}`);
    }
  }

  // ============================================
  // GRAPH NODES
  // ============================================

  // --- PLANNER NODE ---
  private async planExecution(
    state: typeof this.GraphState.State,
    config: RunnableConfig<typeof this.ConfigurableAnnotation.State>
  ): Promise<{
    messages: BaseMessage[];
    last_agent: Agent;
    plan: ParsedPlan;
    currentGraphStep: number;
  }> {
    try {
      logger.info('Planner: Starting plan execution');
      const lastAiMessage = getLatestMessageForMessage(
        state.messages,
        AIMessageChunk
      );

      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('Planner: Model not found in ModelSelector');
      }

      const StepInfoSchema = z.object({
        stepNumber: z
          .number()
          .int()
          .min(1)
          .max(100)
          .describe('Step number in the sequence'),
        stepName: z
          .string()
          .min(1)
          .max(200)
          .describe('Brief name/title of the step'),
        description: z
          .string()
          .describe('Detailed description of what this step does'),
        status: z
          .enum(['pending', 'completed', 'failed'])
          .default('pending')
          .describe('Current status of the step'),
      });

      const PlanSchema = z.object({
        steps: z
          .array(StepInfoSchema)
          .min(1)
          .max(20)
          .describe('Array of steps to complete the task'),
        summary: z.string().describe('Brief summary of the overall plan'),
      });

      const structuredModel = model.withStructuredOutput(PlanSchema);

      const filteredMessages = state.messages.filter(
        (msg) =>
          !(
            msg instanceof AIMessageChunk &&
            msg.additional_kwargs?.from === 'model-selector'
          )
      );

      const originalUserMessage = filteredMessages.find(
        (msg): msg is HumanMessage => msg instanceof HumanMessage
      );

      const originalUserQuery = originalUserMessage
        ? typeof originalUserMessage.content === 'string'
          ? originalUserMessage.content
          : JSON.stringify(originalUserMessage.content)
        : '';

      let systemPrompt;
      if (state.last_agent === Agent.PLANNER_VALIDATOR && lastAiMessage) {
        logger.debug('Planner: Creating re-plan based on validator feedback');
        systemPrompt = REPLAN_EXECUTOR_SYSTEM_PROMPT(
          lastAiMessage,
          formatParsedPlanSimple(state.plan),
          originalUserQuery
        );
      } else {
        logger.debug('Planner: Creating initial plan');
        systemPrompt = PLAN_EXECUTOR_SYSTEM_PROMPT(
          this.toolsList,
          originalUserQuery
        );
      }

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', systemPrompt],
        new MessagesPlaceholder('messages'),
      ]);

      const structuredResult = await structuredModel.invoke(
        await prompt.formatMessages({ messages: filteredMessages })
      );

      logger.info(
        `Planner: Successfully created plan with ${structuredResult.steps.length} steps`
      );

      const aiMessage = new AIMessageChunk({
        content: `Plan created with ${structuredResult.steps.length} steps:\n${structuredResult.steps
          .map((s) => `${s.stepNumber}. ${s.stepName}: ${s.description}`)
          .join('\n')}`,
        additional_kwargs: {
          structured_output: structuredResult,
          from: 'planner',
        },
      });

      return {
        messages: [aiMessage],
        last_agent: Agent.PLANNER,
        plan: structuredResult as ParsedPlan,
        currentGraphStep: state.currentGraphStep + 1,
      };
    } catch (error) {
      logger.error(`Planner: Error in planExecution - ${error}`);

      const errorMessage = new AIMessageChunk({
        content: `Failed to create plan: ${error.message}`,
        additional_kwargs: {
          error: true,
          from: 'planner',
        },
      });

      const error_plan: ParsedPlan = {
        steps: [
          {
            stepNumber: 0,
            stepName: 'Error',
            description: 'Error trying to create the plan',
            status: 'failed',
          },
        ],
        summary: 'Error',
      };

      return {
        messages: [errorMessage],
        last_agent: Agent.PLANNER,
        plan: error_plan,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  // --- VALIDATOR NODE ---
  private async validator(state: typeof this.GraphState.State): Promise<{
    messages: BaseMessage;
    currentStepIndex: number;
    plan?: ParsedPlan;
    last_agent: Agent;
    retry: number;
    currentGraphStep: number;
  }> {
    logger.debug(
      `Validator: Processing validation for agent ${state.last_agent}`
    );
    if (state.last_agent === Agent.PLANNER) {
      const result = await this.validatorPlanner(state);
      return result;
    } else {
      const result = await this.validatorExecutor(state);
      return result;
    }
  }

  private async validatorPlanner(state: typeof this.GraphState.State): Promise<{
    messages: BaseMessage;
    currentStepIndex: number;
    last_agent: Agent;
    retry: number;
    currentGraphStep: number;
  }> {
    try {
      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('PlannerValidator: Model not found in ModelSelector');
      }

      const StructuredResponseValidator = z.object({
        isValidated: z.boolean(),
        description: z
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

      const originalUserMessage = state.messages.find(
        (msg: BaseMessage): msg is HumanMessage => msg instanceof HumanMessage
      );

      const originalUserQuery = originalUserMessage
        ? typeof originalUserMessage.content === 'string'
          ? originalUserMessage.content
          : JSON.stringify(originalUserMessage.content)
        : '';

      const structuredResult = await structuredModel.invoke([
        {
          role: 'system',
          content: PLAN_VALIDATOR_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `USER REQUEST:\n"${originalUserQuery}"\n\nPROPOSED PLAN:\n${planDescription}\n\nValidate if this plan correctly addresses the user's request and is feasible to execute.`,
        },
      ]);

      if (structuredResult.isValidated) {
        const successMessage = new AIMessageChunk({
          content: `Plan validated: ${structuredResult.description}`,
          additional_kwargs: {
            error: false,
            validated: true,
            from: Agent.PLANNER_VALIDATOR,
          },
        });
        logger.info(`PlannerValidator: Plan validated successfully`);
        return {
          messages: successMessage,
          last_agent: Agent.PLANNER_VALIDATOR,
          currentStepIndex: state.currentStepIndex,
          retry: state.retry,
          currentGraphStep: state.currentGraphStep + 1,
        };
      } else {
        const errorMessage = new AIMessageChunk({
          content: `Plan validation failed: ${structuredResult.description}`,
          additional_kwargs: {
            error: false,
            validated: false,
            from: Agent.PLANNER_VALIDATOR,
          },
        });
        logger.warn(
          `PlannerValidator: Plan validation failed - ${structuredResult.description}`
        );
        return {
          messages: errorMessage,
          currentStepIndex: state.currentStepIndex,
          last_agent: Agent.PLANNER_VALIDATOR,
          retry: state.retry + 1,
          currentGraphStep: state.currentGraphStep + 1,
        };
      }
    } catch (error) {
      logger.error(
        `PlannerValidator: Failed to validate plan - ${error.message}`
      );
      const errorMessage = new AIMessageChunk({
        content: `Failed to validate plan: ${error.message}`,
        additional_kwargs: {
          error: true,
          validated: false,
          from: Agent.PLANNER_VALIDATOR,
        },
      });
      return {
        messages: errorMessage,
        currentStepIndex: state.currentStepIndex,
        last_agent: Agent.PLANNER_VALIDATOR,
        retry: state.retry + 1,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  private async validatorExecutor(
    state: typeof this.GraphState.State
  ): Promise<{
    messages: BaseMessage;
    currentStepIndex: number;
    plan?: ParsedPlan;
    last_agent: Agent;
    retry: number;
    currentGraphStep: number;
  }> {
    try {
      const retry: number = state.retry;
      const lastMessage = state.messages[state.messages.length - 1];

      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('ExecutorValidator: Model not found in ModelSelector');
      }

      const StructuredStepsResponseValidator = z.object({
        validated: z
          .boolean()
          .describe('Whether the step was successfully completed'),
        reason: z
          .string()
          .max(300)
          .describe(
            'If validated=false: concise explanation (<300 chars) of what was missing/incorrect to help AI retry. If validated=true: just "step validated"'
          ),
        isFinal: z
          .boolean()
          .describe('True only if this was the final step of the entire plan'),
      });

      const structuredModel = model.withStructuredOutput(
        StructuredStepsResponseValidator
      );

      const originalUserMessage = state.messages.find(
        (msg: BaseMessage): msg is HumanMessage => msg instanceof HumanMessage
      );

      const originalUserQuery = originalUserMessage
        ? typeof originalUserMessage.content === 'string'
          ? originalUserMessage.content
          : JSON.stringify(originalUserMessage.content)
        : '';

      let content: String;
      if (lastMessage instanceof ToolMessage) {
        logger.debug('ExecutorValidator: Last Message is a ToolMessage');
        content = `VALIDATION_TYPE : TOOL_EXECUTION_MODE, TOOL_CALL TO ANALYZE : tool_call : { result :${lastMessage.content}, name :${lastMessage.name}, tool_call_id : ${lastMessage.tool_call_id}}`;
      } else {
        logger.debug('ExecutorValidator: Last Message is an AIMessageChunk');
        content = `VALIDATION_TYPE : AI_RESPONSE_MODE, AI_MESSAGE TO ANALYZE : ${lastMessage.content.toString()}`;
      }

      const structuredResult = await structuredModel.invoke([
        {
          role: 'system',
          content: STEPS_VALIDATOR_SYSTEM_PROMPT,
        },
        {
          role: 'assistant',
          content: `USER REQUEST:\n"${originalUserQuery}"\n\ STEPS WHO NEED TO BE VALIDATED:\nName : ${state.plan.steps[state.currentStepIndex].stepName}, description ${state.plan.steps[state.currentStepIndex].description}\n\n ${content}`,
        },
      ]);

      if (structuredResult.validated === true) {
        const plan = state.plan;
        plan.steps[state.currentStepIndex].status = 'completed';

        if (state.currentStepIndex === state.plan.steps.length - 1) {
          logger.info('ExecutorValidator: Final Step Reached - Plan completed');
          const successMessage = new AIMessageChunk({
            content: `Steps Final Reach`,
            additional_kwargs: {
              error: false,
              isFinal: true,
              from: Agent.EXECT_VALIDATOR,
            },
          });
          return {
            messages: successMessage,
            currentStepIndex: state.currentStepIndex + 1,
            last_agent: Agent.EXECT_VALIDATOR,
            retry: retry,
            plan: plan,
            currentGraphStep: state.currentGraphStep + 1,
          };
        } else {
          logger.info(
            `ExecutorValidator: Step ${state.currentStepIndex + 1} validated successfully`
          );
          const message = new AIMessageChunk({
            content: `Steps ${state.currentStepIndex + 1} has been validated.`,
            additional_kwargs: {
              error: false,
              isFinal: false,
              from: Agent.EXECT_VALIDATOR,
            },
          });
          return {
            messages: message,
            currentStepIndex: state.currentStepIndex + 1,
            last_agent: Agent.EXECT_VALIDATOR,
            retry: 0,
            plan: plan,
            currentGraphStep: state.currentGraphStep + 1,
          };
        }
      }

      logger.warn(
        `ExecutorValidator: Step ${state.currentStepIndex + 1} validation failed - Reason: ${structuredResult.reason}`
      );
      const notValidateMessage = new AIMessageChunk({
        content: `Steps ${state.currentStepIndex + 1} has not been validated reason : ${structuredResult.reason}`,
        additional_kwargs: {
          error: false,
          isFinal: false,
          from: Agent.EXECT_VALIDATOR,
        },
      });
      return {
        messages: notValidateMessage,
        currentStepIndex: state.currentStepIndex,
        last_agent: Agent.EXECT_VALIDATOR,
        retry: retry + 1,
        currentGraphStep: state.currentGraphStep + 1,
      };
    } catch (error) {
      logger.error(
        `ExecutorValidator: Failed to validate step - ${error.message}`
      );
      const error_plan = state.plan;
      error_plan.steps[state.currentStepIndex].status = 'failed';

      const errorMessage = new AIMessageChunk({
        content: `Failed to validate plan: ${error.message}`,
        additional_kwargs: {
          error: true,
          isFinal: false,
          validated: false,
          from: Agent.EXECT_VALIDATOR,
        },
      });
      return {
        messages: errorMessage,
        currentStepIndex: state.currentStepIndex,
        last_agent: Agent.EXECT_VALIDATOR,
        plan: error_plan,
        retry: -1,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  // --- EXECUTOR NODE ---
  private async callModel(
    state: typeof this.GraphState.State,
    config: RunnableConfig<typeof this.ConfigurableAnnotation.State>
  ): Promise<{ messages: BaseMessage[]; last_agent: Agent }> {
    if (!this.agent_config || !this.modelSelector) {
      throw new Error(
        'Executor: Agent configuration and ModelSelector are required.'
      );
    }

    logger.info(
      `Executor: Processing step ${state.currentStepIndex + 1} - ${state.plan.steps[state.currentStepIndex]?.stepName}`
    );

    const maxGraphSteps = config.configurable?.max_graph_steps as number;
    const shortTermMemory = config.configurable?.short_term_memory as number;
    const human_in_the_loop = config.configurable?.human_in_the_loop as boolean;
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];

    let iteration_number = state.currentGraphStep;

    if (maxGraphSteps)
      if (maxGraphSteps <= iteration_number) {
        logger.warn(`Executor: Maximum iterations (${maxGraphSteps}) reached`);
        return createMaxIterationsResponse(iteration_number);
      }

    logger.debug(`Executor: currentGraphStep : ${state.currentGraphStep}`);

    const interactiveSystemPrompt = this.buildSystemPrompt(state, config);

    try {
      const filteredMessages = filterMessagesByShortTermMemory(
        state.messages,
        iteration_number,
        shortTermMemory
      );

      const result = await this.invokeModelWithMessages(
        filteredMessages,
        interactiveSystemPrompt
      );

      return { messages: [result], last_agent: Agent.EXECUTOR };
    } catch (error: any) {
      logger.error(
        `Executor: Error during model invocation - ${error.message}`
      );
      return handleModelError(error);
    }
  }

  // --- TOOLS NODE ---
  private async toolNodeInvoke(
    state: typeof this.GraphState.State,
    config: LangGraphRunnableConfig | undefined,
    originalInvoke: Function
  ): Promise<{ messages: BaseMessage[] } | null> {
    const lastMessage = state.messages[state.messages.length - 1];
    const lastIterationNumber = state.currentGraphStep;

    const toolCalls =
      lastMessage instanceof AIMessageChunk && lastMessage.tool_calls
        ? lastMessage.tool_calls
        : [];

    if (toolCalls.length > 0) {
      toolCalls.forEach((call) => {
        logger.info(
          `Tools: Executing tool: ${call.name} with args: ${JSON.stringify(call.args).substring(0, 150)}${
            JSON.stringify(call.args).length > 150 ? '...' : ''
          }`
        );
      });
    }

    const startTime = Date.now();
    try {
      const result = await originalInvoke(state, config);
      const executionTime = Date.now() - startTime;
      const truncatedResult: { messages: [ToolMessage] } = truncateToolResults(
        result,
        5000
      );

      logger.debug(
        `Tools: Tool execution completed in ${executionTime}ms. Results: ${
          Array.isArray(truncatedResult)
            ? truncatedResult.length
            : typeof truncatedResult
        }`
      );

      truncatedResult.messages.forEach((res) => {
        res.additional_kwargs = {
          from: 'tools',
          final: false,
        };
      });
      return truncatedResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(
        `Tools: Tool execution failed after ${executionTime}ms: ${error}`
      );
      throw error;
    }
  }

  public async humanNode(
    state: typeof this.GraphState.State
  ): Promise<{ messages: BaseMessage[] }> {
    const lastAiMessage = getLatestMessageForMessage(
      state.messages,
      AIMessageChunk
    );
    const input = interrupt(lastAiMessage?.content);

    return {
      messages: [
        new AIMessageChunk({
          content: input,
          additional_kwargs: {
            from: 'human',
            final: false,
          },
        }),
      ],
    };
  }

  // --- END GRAPH NODE ---
  private end_graph(state: typeof this.GraphState): {
    plan: ParsedPlan;
    currentStepIndex: number;
    retry: number;
  } {
    logger.info('EndGraph: Cleaning up state for graph termination');
    const plan: ParsedPlan = {
      steps: [],
      summary: '',
    };
    return {
      plan: plan,
      currentStepIndex: 0,
      retry: 0,
    };
  }

  // TODO Sync
  // --- Prompt Building ---
  private buildSystemPrompt(
    state: typeof this.GraphState.State,
    config: RunnableConfig<typeof this.ConfigurableAnnotation.State>
  ): string {
    const rules = PromptPlanInteractive(
      state.plan.steps[state.currentStepIndex]
    );
    return `
          ${this.agent_config.prompt.content}
          ${rules}
          
          Available tools: ${this.toolsList.map((tool) => tool.name).join(', ')}`;
  }

  // --- Model Invocation ---
  private async invokeModelWithMessages(
    filteredMessages: BaseMessage[],
    interactiveSystemPrompt: string
  ): Promise<AIMessageChunk> {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', interactiveSystemPrompt],
      new MessagesPlaceholder('messages'),
    ]);

    const formattedPrompt = await prompt.formatMessages({
      messages: filteredMessages,
    });

    const selectedModelType =
      await this.modelSelector!.selectModelForMessages(filteredMessages);
    const boundModel =
      typeof selectedModelType.model.bindTools === 'function'
        ? selectedModelType.model.bindTools(this.toolsList)
        : selectedModelType.model;

    logger.debug(
      `Executor: Invoking model (${selectedModelType.model_name}) with ${filteredMessages.length} messages.`
    );

    const result = await boundModel.invoke(formattedPrompt);
    if (!result) {
      throw new Error(
        'Executor: Model invocation returned no result. Please check the model configuration.'
      );
    }

    TokenTracker.trackCall(result, selectedModelType.model_name);

    // Add metadata to result
    result.additional_kwargs = {
      ...result.additional_kwargs,
      from: Agent.EXECUTOR,
      final: false,
    };

    return result;
  }

  private createToolNode(): ToolNode {
    const toolNode = new ToolNode(this.toolsList);
    const originalInvoke = toolNode.invoke.bind(toolNode);

    // Override invoke method
    toolNode.invoke = async (
      state: typeof this.GraphState.State,
      config: RunnableConfig<typeof this.ConfigurableAnnotation.State>
    ): Promise<{ messages: BaseMessage[] } | null> => {
      return this.toolNodeInvoke(state, config, originalInvoke);
    };

    return toolNode;
  }

  private handleValidatorRouting(
    state: typeof this.GraphState.State
  ): 're_planner' | 'executor' | 'end' | 'validator' {
    try {
      logger.debug(
        `ValidatorRouter: Processing routing for ${state.last_agent}`
      );

      if (state.last_agent === Agent.PLANNER_VALIDATOR) {
        const lastAiMessage = state.messages[state.messages.length - 1];
        if (lastAiMessage.additional_kwargs.error === true) {
          logger.error(
            'ValidatorRouter: Error found in the last validator messages.'
          );
          return 'validator';
        }
        if (lastAiMessage.additional_kwargs.from != 'planner_validator') {
          throw new Error(
            'ValidatorRouter: Last AI message is not from the planner_validator - check graph edges configuration.'
          );
        }
        if (lastAiMessage.additional_kwargs.validated) {
          logger.info('ValidatorRouter: Plan validated, routing to executor');
          return 'executor';
        } else if (
          lastAiMessage.additional_kwargs.validated === false &&
          state.retry <= 3
        ) {
          logger.info(
            `ValidatorRouter: Plan validation failed (retry ${state.retry}/3), routing to re-planner`
          );
          return 're_planner';
        }
        logger.warn('ValidatorRouter: Max retries exceeded, routing to end');
        return 'end';
      }

      if (state.last_agent === Agent.EXECT_VALIDATOR) {
        const lastAiMessage = getLatestMessageForMessage(
          state.messages,
          AIMessageChunk
        );
        if (
          !lastAiMessage ||
          lastAiMessage.additional_kwargs.from != 'exec_validator'
        ) {
          throw new Error(
            'ValidatorRouter: Last AI message is not from the exec_validator - check graph edges configuration.'
          );
        }
        if (lastAiMessage.additional_kwargs.isFinal === true) {
          logger.info('ValidatorRouter: Final step reached, routing to end');
          return 'end';
        }
        if (state.retry >= 3) {
          logger.warn(
            `ValidatorRouter: Max retries (${state.retry}) exceeded for step execution, routing to end`
          );
          return 'end';
        }
        logger.info(
          'ValidatorRouter: Step requires execution/retry, routing to executor'
        );
        return 'executor';
      }

      logger.warn('ValidatorRouter: Unknown agent state, defaulting to end');
      return 'end';
    } catch (error) {
      logger.error(
        `ValidatorRouter: Error in routing logic - ${error.message}`
      );
      return 'end';
    }
  }

  private shouldContinue(
    state: typeof this.GraphState.State,
    config: RunnableConfig<typeof this.ConfigurableAnnotation.State>
  ): 'tools' | 'validator' | 'human' | 'end' {
    if (config.configurable?.human_in_the_loop === true) {
      return this.shouldContinueHybrid(state, config);
    } else {
      return this.shouldContinueAutonomous(state, config);
    }
  }

  private shouldContinueAutonomous(
    state: typeof this.GraphState.State,
    config: RunnableConfig<typeof this.ConfigurableAnnotation.State>
  ): 'tools' | 'validator' | 'end' {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];

    if (lastMessage instanceof AIMessageChunk) {
      if (isTerminalMessage(lastMessage)) {
        logger.info(
          `Router: Final message received, routing to end node. Message: ${lastMessage.content}`
        );
        return 'end';
      }
      if (lastMessage.tool_calls?.length) {
        logger.debug(
          `Router: Detected ${lastMessage.tool_calls.length} tool calls, routing to tools node.`
        );
        return 'tools';
      }
    } else if (lastMessage instanceof ToolMessage) {
      if (
        (config.configurable?.max_graph_steps as number) <=
        state.currentGraphStep
      ) {
        logger.warn('Router : Routing to END node.');
        return 'end';
      } else {
        return 'validator';
      }
    }
    logger.debug('Router: Routing to validator');
    return 'validator';
  }

  private shouldContinueHybrid(
    state: typeof this.GraphState.State,
    config?: RunnableConfig<typeof this.ConfigurableAnnotation.State>
  ): 'tools' | 'validator' | 'end' | 'human' {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage instanceof AIMessageChunk) {
      if (
        lastMessage.additional_kwargs.final === true ||
        lastMessage.content.toString().includes('FINAL ANSWER')
      ) {
        logger.info(
          `Final message received, routing to end node. Message: ${lastMessage.content}`
        );
        return 'end';
      }
      if (lastMessage.content.toString().includes('WAITING_FOR_HUMAN_INPUT')) {
        return 'human';
      }
      if (lastMessage.tool_calls?.length) {
        logger.debug(
          `Detected ${lastMessage.tool_calls.length} tool calls, routing to tools node.`
        );
        return 'tools';
      }
    } else if (lastMessage instanceof ToolMessage) {
      const lastAiMessage = getLatestMessageForMessage(
        messages,
        AIMessageChunk
      );
      if (!lastAiMessage) {
        throw new Error('Error trying to get last AIMessageChunk');
      }
      const graphMaxSteps = config?.configurable?.max_graph_steps as number;

      const iteration = state.currentGraphStep;
      if (graphMaxSteps <= iteration) {
        logger.info(
          `Tools : Final message received, routing to end node. Message: ${lastMessage.content}`
        );
        return 'end';
      }

      logger.debug(
        `Received ToolMessage, routing back to Validator node. Message: ${lastMessage.content}`
      );
      return 'validator';
    }
    logger.info('Routing to Validator');
    return 'validator';
  }

  private getCompileOptions(): any {
    return this.agent_config.memory
      ? {
          checkpointer: this.checkpointer,
          configurable: {},
        }
      : {};
  }

  private buildWorkflow(): any {
    const toolNode = this.createToolNode();

    // Build workflow
    let workflow = new StateGraph(this.GraphState, this.ConfigurableAnnotation)
      .addNode('plan_node', this.planExecution.bind(this))
      .addNode('validator', this.validator.bind(this))
      .addNode('executor', this.callModel.bind(this))
      .addNode('human', this.humanNode.bind(this))
      .addNode('end_graph', this.end_graph.bind(this))
      .addNode('tools', toolNode)
      .addEdge('__start__', 'plan_node')
      .addEdge('plan_node', 'validator')
      .addEdge('end_graph', END);

    workflow.addConditionalEdges(
      'validator',
      this.handleValidatorRouting.bind(this),
      {
        re_planner: 'plan_node',
        executor: 'executor',
        validator: 'validator',
        end: 'end_graph',
      }
    );

    workflow.addConditionalEdges('executor', this.shouldContinue.bind(this), {
      validator: 'validator',
      human: 'human',
      tools: 'tools',
      end: 'end_graph',
    });
    workflow.addConditionalEdges('tools', this.shouldContinue.bind(this), {
      validator: 'validator',
      tools: 'tools',
      end: 'end_graph',
    });
    return workflow;
  }

  async initialize(): Promise<AgentReturn> {
    try {
      // Get agent configuration
      this.agent_config = this.snakAgent.getAgentConfig();
      if (!this.agent_config) {
        throw new Error('Autonomous: Agent configuration is required');
      }

      // Initialize database
      await initializeDatabase(this.snakAgent.getDatabaseCredentials());

      // Initialize tools
      this.toolsList = await initializeToolsList(
        this.snakAgent,
        this.agent_config
      );

      // Initialize memory agent if enabled
      if (this.agent_config.memory) {
        await this.initializeMemoryAgent();
      }

      // Initialize RAG agent if enabled
      if (this.agent_config.rag?.enabled !== false) {
        await this.initializeRagAgent();
      }

      // Build and compile the workflow
      const workflow = this.buildWorkflow();
      this.app = workflow.compile(this.getCompileOptions());

      return {
        app: this.app,
        agent_config: this.agent_config,
      };
    } catch (error) {
      logger.error(
        'InteractiveAgent: Failed to create an interactive agent:',
        error
      );
      throw error;
    }
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export const createAutonomousAgent = async (
  snakAgent: SnakAgentInterface,
  modelSelector: ModelSelector | null
): Promise<AgentReturn> => {
  const agent = new AutonomousAgent(snakAgent, modelSelector);
  return agent.initialize();
};

// /**
//  * Creates and configures an autonomous agent using a StateGraph.
//  * This agent can use tools, interact with models, and follow a defined workflow.
//  * @async
//  * @param {SnakAgentInterface} snakAgent - The Starknet agent instance providing configuration and context
//  * @param {ModelSelector | null} modelSelector - The model selection agent for choosing appropriate LLMs
//  * @returns {Promise<Object>} Promise resolving to compiled LangGraph app, agent config, and max iterations
//  * @throws {Error} If agent configuration or model selector is missing, or if MCP tool initialization fails
//  *
//  */
// export const createAutonomousAgent = async (
//   snakAgent: SnakAgentInterface,
//   modelSelector: ModelSelector | null
// ): Promise<AgentReturn> => {
//   try {
//     const agent_config = snakAgent.getAgentConfig();
//     if (!agent_config) {
//       throw new Error('Agent configuration is required.');
//     }

//     if (!modelSelector) {
//       logger.error(
//         'ModelSelector is required for autonomous mode but was not provided.'
//       );
//       throw new Error('ModelSelector is required for autonomous mode.');
//     }

//     let toolsList: (
//       | StructuredTool
//       | Tool
//       | DynamicStructuredTool<AnyZodObject>
//     )[] = await createAllowedTools(snakAgent, agent_config.plugins);

//     if (
//       agent_config.mcpServers &&
//       Object.keys(agent_config.mcpServers).length > 0
//     ) {
//       try {
//         const mcp = MCP_CONTROLLER.fromAgentConfig(agent_config);
//         await mcp.initializeConnections();
//         const mcpTools = mcp.getTools();
//         logger.info(
//           `Initialized ${mcpTools.length} MCP tools for the autonomous agent.`
//         );
//         toolsList = [...toolsList, ...mcpTools];
//       } catch (error) {
//         logger.error(`Failed to initialize MCP tools: ${error}`);
//       }
//     }

//     const toolNode = new ToolNode(toolsList);
//     const originalToolNodeInvoke = toolNode.invoke.bind(toolNode);

//     /**
//      * Custom tool node invoker with logging and result truncation
//      */
//     toolNode.invoke = async (
//       state: typeof GraphState.State,
//       config?: LangGraphRunnableConfig
//     ): Promise<{ messages: BaseMessage[] } | null> => {
//       const lastMessage = state.messages[state.messages.length - 1];
//       const lastIterationNumber = getLatestMessageForMessage(
//         state.messages,
//         AIMessageChunk
//       )?.additional_kwargs.iteration_number;
//       const toolCalls =
//         lastMessage instanceof AIMessageChunk && lastMessage.tool_calls
//           ? lastMessage.tool_calls
//           : [];

//       if (toolCalls.length > 0) {
//         toolCalls.forEach((call) => {
//           logger.info(
//             `Executing tool: ${call.name} with args: ${JSON.stringify(call.args).substring(0, 150)}${JSON.stringify(call.args).length > 150 ? '...' : ''}`
//           );
//         });
//       }

//       const startTime = Date.now();
//       try {
//         const result = await originalToolNodeInvoke(state, config);
//         const executionTime = Date.now() - startTime;
//         const truncatedResult: { messages: [ToolMessage] } =
//           truncateToolResults(result, 5000); // Max 5000 chars for tool output

//         logger.debug(
//           `Tool execution completed in ${executionTime}ms. Results: ${Array.isArray(truncatedResult) ? truncatedResult.length : typeof truncatedResult}`
//         );

//         truncatedResult.messages.forEach((res) => {
//           res.additional_kwargs = {
//             from: 'tools',
//             final: false,
//             iteration_number: lastIterationNumber,
//           };
//         });
//         return truncatedResult;
//       } catch (error) {
//         const executionTime = Date.now() - startTime;
//         logger.error(
//           `Tool execution failed after ${executionTime}ms: ${error}`
//         );
//         throw error;
//       }
//     };

//     /**
//      * Language model node that formats prompts, invokes the selected model, and processes responses
//      *
//      * @param {typeof GraphState.State} state - Current graph state containing messages
//      * @returns {Promise<{ messages: BaseMessage[] }>} Object containing new messages from the model
//      * @throws {Error} If agent configuration or model selector is unavailable
//      */

//     function getLatestMessageForMessage(
//       messages: BaseMessage[],
//       MessageClass: typeof ToolMessage
//     ): ToolMessage | null;
//     function getLatestMessageForMessage(
//       messages: BaseMessage[],
//       MessageClass: typeof AIMessageChunk
//     ): AIMessageChunk | null;
//     function getLatestMessageForMessage(
//       messages: BaseMessage[],
//       MessageClass: typeof AIMessage
//     ): AIMessage | null;
//     function getLatestMessageForMessage(
//       messages: BaseMessage[],
//       MessageClass: typeof HumanMessage
//     ): HumanMessage | null {
//       try {
//         for (let i = messages.length - 1; i >= 0; i--) {
//           if (messages[i] instanceof MessageClass) {
//             return messages[i];
//           }
//         }
//         return null;
//       } catch (error: any) {
//         logger.error(error);
//         throw error;
//       }
//     }
//     async function callModel(
//       state: typeof GraphState.State,
//       config?: RunnableConfig<typeof this.ConfigurableAnnotation.State>
//     ): Promise<{ messages: BaseMessage[] }> {
//       if (!agent_config || !modelSelector) {
//         throw new Error('Agent configuration and ModelSelector are required.');
//       }

//       // Configuration extraction
//       const maxGraphSteps = config?.configurable?.config.max_graph_steps;
//       const shortTermMemory = config?.configurable?.config.short_term_memory;
//       const human_in_the_loop = config?.configurable?.config.human_in_the_loop;
//       const messages = state.messages;
//       const lastMessage = messages[messages.length - 1];

//       if (maxGraphSteps <= config?.configurable.max_graph_steps) {
//         return {
//           messages: [
//             new AIMessageChunk({
//               content: `Reaching maximum iterations for autonomous agent. Ending workflow.`,
//               additional_kwargs: {
//                 final: true,
//                 iteration_number: iteration_number,
//               },
//             }),
//           ],
//         };
//       }

//       iteration_number++;

//       // Determine start iteration
//       let startIteration = 0;
//       if ((config?.metadata?.langgraph_step as number) === 1) {
//         startIteration = 1;
//       } else if (
//         Array.isArray(config?.metadata?.langgraph_triggers) &&
//         typeof config.metadata.langgraph_triggers[0] === 'string' &&
//         config.metadata.langgraph_triggers[0] === '__start__:agent'
//       ) {
//         startIteration = config?.metadata?.langgraph_step as number;
//       } else {
//         const lastAiMessage = getLatestMessageForMessage(
//           state.messages,
//           AIMessageChunk
//         );
//         if (!lastAiMessage) {
//           throw new Error('Error trying to get latest AI Message Chunk');
//         }
//         startIteration = lastAiMessage.additional_kwargs
//           .start_iteration as number;
//       }

//       logger.info(
//         `startIteration: ${startIteration}, iteration: ${iteration_number}`
//       );

//       // Check max iterations

//       logger.info('Autonomous agent callModel invoked.');

//       // Build system prompt
//       let rules;
//       if (human_in_the_loop) {
//         rules = hybridRules;
//       } else {
//         rules = autonomousRules;
//       }
//       const autonomousSystemPrompt = `
//         ${agent_config.prompt.content}
//         ${rules}

//         Available tools: ${toolsList.map((tool) => tool.name).join(', ')}`;

//       try {
//         // Filter messages based on short-term memory
//         const filteredMessages = [];
//         let lastIterationCount = iteration_number - 1;
//         let s_temp = shortTermMemory;

//         for (let i = state.messages.length - 1; i >= 0; i--) {
//           const msg = state.messages[i];

//           // Skip model-selector messages
//           if (
//             (msg instanceof AIMessageChunk || msg instanceof ToolMessage) &&
//             msg.additional_kwargs?.from === 'model-selector'
//           ) {
//             continue;
//           }

//           // Handle iteration filtering
//           if (lastIterationCount !== msg.additional_kwargs?.iteration_number) {
//             lastIterationCount =
//               (msg.additional_kwargs?.iteration_number as number) || 0;
//             s_temp--;
//           }

//           if (s_temp === 0) break;

//           filteredMessages.unshift(msg);
//         }

//         // Create and format prompt
//         const prompt = ChatPromptTemplate.fromMessages([
//           ['system', autonomousSystemPrompt],
//           new MessagesPlaceholder('messages'),
//         ]);

//         const formattedPrompt = await prompt.formatMessages({
//           messages: filteredMessages,
//         });

//         // Model selection and invocation
//         const selectedModelType =
//           await modelSelector.selectModelForMessages(filteredMessages);
//         const boundModel =
//           typeof selectedModelType.model.bindTools === 'function'
//             ? selectedModelType.model.bindTools(toolsList)
//             : selectedModelType.model;

//         logger.debug(
//           `Autonomous agent invoking model (${selectedModelType.model_name}) with ${filteredMessages.length} messages.`
//         );

//         const result = await boundModel.invoke(formattedPrompt);
//         if (!result) {
//           throw new Error(
//             'Model invocation returned no result. Please check the model configuration.'
//           );
//         }
//         TokenTracker.trackCall(result, selectedModelType.model_name);

//         // Add metadata to result
//         result.additional_kwargs = {
//           ...result.additional_kwargs,
//           from: 'autonomous-agent',
//           final: false,
//           start_iteration: startIteration,
//           iteration_number: iteration_number,
//         };

//         return { messages: [result] };
//       } catch (error: any) {
//         logger.error(`Error calling model in autonomous agent: ${error}`);

//         // Handle token limit errors
//         if (
//           error.message?.includes('token limit') ||
//           error.message?.includes('tokens exceed') ||
//           error.message?.includes('context length')
//         ) {
//           logger.error(
//             `Token limit error during autonomous callModel: ${error.message}`
//           );
//           return {
//             messages: [
//               new AIMessageChunk({
//                 content:
//                   'Error: The conversation history has grown too large, exceeding token limits. Cannot proceed.',
//                 additional_kwargs: {
//                   error: 'token_limit_exceeded',
//                   final: true,
//                 },
//               }),
//             ],
//           };
//         }

//         // Handle other errors
//         return {
//           messages: [
//             new AIMessageChunk({
//               content: `Error: An unexpected error occurred while processing the request. Error : ${error}`,
//               additional_kwargs: {
//                 error: 'unexpected_error',
//                 final: true,
//               },
//             }),
//           ],
//         };
//       }
//     }

//     /**
//      * Determines the next step in the agent's workflow based on the last message
//      *
//      * @param {typeof GraphState.State} state - Current graph state
//      * @returns {'tools' | 'agent'} Next node to execute
//      */
//     function shouldContinue(
//       state: typeof GraphState.State,
//       config?: RunnableConfig
//     ): 'tools' | 'agent' | 'end' {
//       const messages = state.messages;
//       const lastMessage = messages[messages.length - 1];
//       if (lastMessage instanceof AIMessageChunk) {
//         if (
//           lastMessage.additional_kwargs.final === true ||
//           lastMessage.content.toString().includes('FINAL ANSWER')
//         ) {
//           logger.info(
//             `Final message received, routing to end node. Message: ${lastMessage.content}`
//           );
//           return 'end';
//         }
//         if (lastMessage.tool_calls?.length) {
//           logger.debug(
//             `Detected ${lastMessage.tool_calls.length} tool calls, routing to tools node.`
//           );
//           return 'tools';
//         }
//       } else if (lastMessage instanceof ToolMessage) {
//         const lastAiMessage = getLatestMessageForMessage(
//           messages,
//           AIMessageChunk
//         );
//         if (!lastAiMessage) {
//           throw new Error('Error trying to get last AIMessageChunk');
//         }
//         const graphMaxSteps = config?.configurable?.config
//           .max_graph_steps as number;

//         const iteration = lastMessage.additional_kwargs
//           ?.iteration_number as number;
//         if (graphMaxSteps <= iteration) {
//           logger.info(
//             `Tools : Final message received, routing to end node. Message: ${lastMessage.content}`
//           );
//           return 'end';
//         }

//         logger.debug(
//           `Received ToolMessage, routing back to agent node. Message: ${lastMessage.content}`
//         );
//         return 'agent';
//       }
//       logger.info('Routing to AgentMode');
//       return 'agent';
//     }

//     function shouldContinueHybrid(
//       state: typeof GraphState.State,
//       config?: RunnableConfig
//     ): 'tools' | 'agent' | 'end' | 'human' {
//       const messages = state.messages;
//       const lastMessage = messages[messages.length - 1];
//       if (lastMessage instanceof AIMessageChunk) {
//         if (
//           lastMessage.additional_kwargs.final === true ||
//           lastMessage.content.toString().includes('FINAL ANSWER')
//         ) {
//           logger.info(
//             `Final message received, routing to end node. Message: ${lastMessage.content}`
//           );
//           return 'end';
//         }
//         if (
//           lastMessage.content.toString().includes('WAITING_FOR_HUMAN_INPUT')
//         ) {
//           return 'human';
//         }
//         if (lastMessage.tool_calls?.length) {
//           logger.debug(
//             `Detected ${lastMessage.tool_calls.length} tool calls, routing to tools node.`
//           );
//           return 'tools';
//         }
//       } else if (lastMessage instanceof ToolMessage) {
//         const lastAiMessage = getLatestMessageForMessage(
//           messages,
//           AIMessageChunk
//         );
//         if (!lastAiMessage) {
//           throw new Error('Error trying to get last AIMessageChunk');
//         }
//         const graphMaxSteps = config?.configurable?.config
//           .max_graph_steps as number;

//         const iteration = lastMessage.additional_kwargs
//           ?.iteration_number as number;
//         if (graphMaxSteps <= iteration) {
//           logger.info(
//             `Tools : Final message received, routing to end node. Message: ${lastMessage.content}`
//           );
//           return 'end';
//         }

//         logger.debug(
//           `Received ToolMessage, routing back to agent node. Message: ${lastMessage.content}`
//         );
//         return 'agent';
//       }
//       logger.info('Routing to AgentMode');
//       return 'agent';
//     }

//     async function humanNode(
//       state: typeof MessagesAnnotation.State
//     ): Promise<{ messages: BaseMessage[] }> {
//       const lastAiMessage = getLatestMessageForMessage(
//         state.messages,
//         AIMessageChunk
//       );
//       const input = interrupt(lastAiMessage?.content);

//       return {
//         messages: [
//           new AIMessageChunk({
//             content: input,
//             additional_kwargs: {
//               from: 'human',
//               final: false,
//               iteration_number:
//                 (lastAiMessage?.additional_kwargs.iteration_number as number) ||
//                 0,
//             },
//           }),
//         ],
//       };
//     }
//     const human_in_the_loop = agent_config.mode === AgentMode.HYBRID;
//     let workflow;
//     if (!human_in_the_loop) {
//       workflow = new StateGraph(GraphState)
//         .addNode('agent', callModel)
//         .addNode('tools', toolNode);

//       workflow.addEdge(START, 'agent');

//       workflow.addConditionalEdges('agent', shouldContinue, {
//         tools: 'tools',
//         agent: 'agent',
//         end: END,
//       });

//       workflow.addConditionalEdges('tools', shouldContinue, {
//         tools: 'tools',
//         agent: 'agent',
//         end: END,
//       });
//     } else {
//       workflow = new StateGraph(GraphState)
//         .addNode('agent', callModel)
//         .addNode('tools', toolNode)
//         .addNode('human', humanNode);

//       workflow.addEdge(START, 'agent');
//       workflow.addEdge('human', 'agent');
//       workflow.addConditionalEdges('agent', shouldContinueHybrid, {
//         tools: 'tools',
//         agent: 'agent',
//         human: 'human',
//         end: END,
//       });

//       workflow.addConditionalEdges('tools', shouldContinueHybrid, {
//         tools: 'tools',
//         agent: 'agent',
//         end: END,
//       });
//     }
//     const checkpointer = new MemorySaver(); // For potential state persistence
//     const app = workflow.compile({ checkpointer });

//     return {
//       app,
//       agent_config,
//     };
//   } catch (error) {
//     logger.error(`Failed to create autonomous agent graph: ${error}`);
//     throw error;
//   }
// };
