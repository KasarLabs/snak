import {
  StateGraph,
  MemorySaver,
  Annotation,
  LangGraphRunnableConfig,
  END,
} from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  ToolMessage,
} from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { logger, AgentConfig } from '@snakagent/core';
import { SnakAgentInterface } from '../../tools/tools.js';
import {
  initializeToolsList,
  initializeDatabase,
  truncateToolResults,
} from '../core/utils.js';
import { ModelSelector } from '../operators/modelSelector.js';
import {
  INTERACTIVE_PLAN_EXECUTOR_SYSTEM_PROMPT,
  INTERACTIVE_PLAN_VALIDATOR_SYSTEM_PROMPT,
  STEP_EXECUTOR_SYSTEM_PROMPT,
  REPLAN_EXECUTOR_SYSTEM_PROMPT,
  STEPS_VALIDATOR_SYSTEM_PROMPT,
  RETRY_EXECUTOR_SYSTEM_PROMPT,
} from '../../prompt/prompts.js';
import { TokenTracker } from '../../token/tokenTracking.js';
import { AgentReturn, ParsedPlan } from './types/index.js';
import { MemoryAgent } from 'agents/operators/memoryAgent.js';
import { RagAgent } from 'agents/operators/ragAgent.js';
import { RunnableConfig } from '@langchain/core/runnables';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { AnyZodObject, z } from 'zod';
import {
  calculateIterationNumber,
  createMaxIterationsResponse,
  filterMessagesByShortTermMemory,
  formatParsedPlanSimple,
  getLatestMessageForMessage,
  handleModelError,
  isTerminalMessage,
} from './utils.js';
import { Agent } from './types/index.js';

// ============================================
// MAIN CLASS
// ============================================

/**
 * Creates and configures an interactive agent.
 * @param snakAgent - The SnakAgentInterface instance.
 * @param modelSelector - An optional ModelSelector instance for dynamic model selection.
 * @returns A promise that resolves to the compiled agent application.
 * @throws Will throw an error if agent configuration is missing or invalid.
 */
export class InteractiveAgent {
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

  // ============================================
  // ANNOTATIONS
  // ============================================

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

  // ============================================
  // CONSTRUCTOR & INITIALIZATION
  // ============================================

  constructor(
    private snakAgent: SnakAgentInterface,
    modelSelector: ModelSelector | null
  ) {
    this.modelSelector = modelSelector;
    this.checkpointer = new MemorySaver();
  }

  async initialize(): Promise<AgentReturn> {
    try {
      // Get agent configuration
      this.agent_config = this.snakAgent.getAgentConfig();
      if (!this.agent_config) {
        throw new Error('InteractiveAgent: Agent configuration is required');
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
  // WORKFLOW BUILDING
  // ============================================

  private buildWorkflow(): any {
    const toolNode = this.createToolNode();

    // Build workflow
    let workflow = new StateGraph(this.GraphState, this.ConfigurableAnnotation)
      .addNode('plan_node', this.planExecution.bind(this))
      .addNode('validator', this.validator.bind(this))
      .addNode('executor', this.callModel.bind(this))
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
        end: 'end_graph',
      }
    );

    workflow.addConditionalEdges('executor', this.shouldContinue.bind(this), {
      validator: 'validator',
      tools: 'tools',
      end: END,
    });
    workflow.addConditionalEdges('tools', this.shouldContinue.bind(this), {
      validator: 'validator',
      end: 'end_graph',
    });
    return workflow;
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

  private getCompileOptions(): any {
    return this.agent_config.memory
      ? {
          checkpointer: this.checkpointer,
          configurable: {},
        }
      : {};
  }

  // ============================================
  // GRAPH NODES
  // ============================================

  // --- PLANNER NODE ---
  private async planExecution(
    state: typeof this.GraphState.State,
    config: RunnableConfig<typeof this.ConfigurableAnnotation.State>
  ): Promise<{
    messages: BaseMessage;
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
        result: z
          .string()
          .default('')
          .describe('Result of the step need to be empty'),
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
      let lastContent;
      if (state.last_agent === Agent.PLANNER_VALIDATOR && lastAiMessage) {
        logger.debug('Planner: Creating re-plan based on validator feedback');
        systemPrompt = REPLAN_EXECUTOR_SYSTEM_PROMPT;
      } else {
        logger.debug('Planner: Creating initial plan');
        systemPrompt = INTERACTIVE_PLAN_EXECUTOR_SYSTEM_PROMPT;
      }

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', systemPrompt],
        new MessagesPlaceholder('messages'),
      ]);

      const toolsList = this.toolsList
        .map(
          (tool) =>
            `Tool Name : ${tool.name} Description : ${tool.description}, Schema : ${JSON.stringify(tool.schema)}`
        )
        .join(', ');

      console.log(toolsList);
      const structuredResult = await structuredModel.invoke(
        await prompt.formatMessages({
          messages: filteredMessages,
          userRequest: originalUserQuery,
          agentConfig: this.agent_config.prompt,
          toolsAvailable: toolsList,
          formatPlan: formatParsedPlanSimple(state.plan),
          lastAiMessage: lastAiMessage?.content.toLocaleString() || '',
        })
      );

      logger.info(
        `Planner: Successfully created plan with ${structuredResult.steps.length} steps`
      );

      const aiMessage = new AIMessageChunk({
        content: `Plan created with ${structuredResult.steps.length} steps:\n${structuredResult.steps
          .map((s) => `${s.stepNumber}. ${s.stepName}: ${s.description}`)
          .join('\n')}`,
        additional_kwargs: {
          from: Agent.PLANNER,
          error: false,
          isFinal: false,
        },
      });

      return {
        messages: aiMessage,
        last_agent: Agent.PLANNER,
        plan: structuredResult as ParsedPlan,
        currentGraphStep: state.currentGraphStep + 1,
      };
    } catch (error) {
      logger.error(`Planner: Error in planExecution - ${error}`);

      const errorMessage = new AIMessageChunk({
        content: `Failed to create plan: ${error.message}`,
        additional_kwargs: {
          error: false,
          isFinal: false,
          from: Agent.PLANNER,
        },
      });

      const error_plan: ParsedPlan = {
        steps: [
          {
            stepNumber: 0,
            stepName: 'Error',
            description: 'Error trying to create the plan',
            status: 'failed',
            type: 'tools',
            result: '',
          },
        ],
        summary: 'Error',
      };

      return {
        messages: errorMessage,
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
          content: INTERACTIVE_PLAN_VALIDATOR_SYSTEM_PROMPT,
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
            isFinal: false,
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
            isFinal: false,
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
          isFinal: false,
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
              from: Agent.EXEC_VALIDATOR,
            },
          });
          return {
            messages: successMessage,
            currentStepIndex: state.currentStepIndex + 1,
            last_agent: Agent.EXEC_VALIDATOR,
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
              from: Agent.EXEC_VALIDATOR,
            },
          });
          return {
            messages: message,
            currentStepIndex: state.currentStepIndex + 1,
            last_agent: Agent.EXEC_VALIDATOR,
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
          from: Agent.EXEC_VALIDATOR,
        },
      });
      return {
        messages: notValidateMessage,
        currentStepIndex: state.currentStepIndex,
        last_agent: Agent.EXEC_VALIDATOR,
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
          from: Agent.EXEC_VALIDATOR,
        },
      });
      return {
        messages: errorMessage,
        currentStepIndex: state.currentStepIndex,
        last_agent: Agent.EXEC_VALIDATOR,
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
  ): Promise<{
    messages: BaseMessage;
    last_agent: Agent;
    currentGraphStep?: number;
  }> {
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
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];

    let iteration_number = calculateIterationNumber(
      state.messages,
      lastMessage
    );

    if (maxGraphSteps)
      if (maxGraphSteps <= iteration_number) {
        logger.warn(`Executor: Maximum iterations (${maxGraphSteps}) reached`);
        return createMaxIterationsResponse(iteration_number);
      }

    const interactiveSystemPrompt = this.buildSystemPrompt(state);

    try {
      const filteredMessages = filterMessagesByShortTermMemory(
        state.messages,
        shortTermMemory
      );

      const result = await this.invokeModelWithMessages(
        state,
        filteredMessages,
        interactiveSystemPrompt
      );

      return {
        messages: result,
        last_agent: Agent.EXECUTOR,
        currentGraphStep: state.currentGraphStep + 1,
      };
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
    const lastIterationNumber = getLatestMessageForMessage(
      state.messages,
      AIMessageChunk
    )?.additional_kwargs.iteration_number;

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
        5000,
        state.plan.steps[state.currentStepIndex]
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
          error: false,
          from: Agent.TOOLS,
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

  // ============================================
  // ROUTING FUNCTIONS
  // ============================================

  private shouldContinue(
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
      return this.handleToolMessageRouting(messages, config);
    }

    logger.debug('Router: Routing to validator');
    return 'validator';
  }

  private handleValidatorRouting(
    state: typeof this.GraphState.State
  ): 're_planner' | 'executor' | 'end' {
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
          return 'end';
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

      if (state.last_agent === Agent.EXEC_VALIDATOR) {
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

  private handleToolMessageRouting(
    messages: BaseMessage[],
    config: RunnableConfig<typeof this.ConfigurableAnnotation.State>
  ): 'validator' | 'end' {
    const lastAiMessage = getLatestMessageForMessage(messages, AIMessageChunk);
    if (!lastAiMessage) {
      throw new Error('Router: Error trying to get last AIMessageChunk');
    }

    const graphMaxSteps = config?.configurable?.max_graph_steps as number;
    const iteration = getLatestMessageForMessage(messages, ToolMessage)
      ?.additional_kwargs?.iteration_number as number;

    if (graphMaxSteps <= iteration) {
      logger.info(
        `Router: Maximum iterations reached in tools, routing to end node.`
      );
      return 'end';
    }

    logger.debug(
      'Router: Received ToolMessage, routing back to validator node.'
    );
    return 'validator';
  }

  // TODO REMOVE THIS TO A BETTER IMPLEMENTATION
  private calculateStartIteration(
    config: RunnableConfig<typeof this.ConfigurableAnnotation.State>,
    messages: BaseMessage[]
  ): number {
    if ((config?.metadata?.langgraph_step as number) === 1) {
      return 1;
    } else if (
      Array.isArray(config.metadata?.langgraph_triggers) &&
      typeof config.metadata.langgraph_triggers[0] === 'string' &&
      config.metadata.langgraph_triggers[0] === '__start__:agent'
    ) {
      return config?.metadata?.langgraph_step as number;
    } else {
      const lastAiMessage = getLatestMessageForMessage(
        messages,
        AIMessageChunk
      );
      if (!lastAiMessage) {
        throw new Error(
          'Executor: Error trying to get latest AI Message Chunk for iteration calculation'
        );
      }
      return lastAiMessage.additional_kwargs.start_iteration as number;
    }
  }

  // --- Prompt Building ---
  private buildSystemPrompt(state: typeof this.GraphState.State): string {
    const rules = STEP_EXECUTOR_SYSTEM_PROMPT;
    return `
          ${this.agent_config.prompt.content}
          ${rules}
      `;
  }

  // --- Model Invocation ---
  private async invokeModelWithMessages(
    state: typeof this.GraphState.State,
    filteredMessages: BaseMessage[],
    interactiveSystemPrompt: string
  ): Promise<AIMessageChunk> {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', interactiveSystemPrompt],
      new MessagesPlaceholder('messages'),
    ]);

    const currentStep = state.plan.steps[state.currentStepIndex];
    const formattedPrompt = await prompt.formatMessages({
      messages: filteredMessages,
      stepNumber: currentStep.stepNumber,
      stepName: currentStep.stepName,
      stepDescription: currentStep.description,
      retryPrompt: RETRY_EXECUTOR_SYSTEM_PROMPT,
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
      error: false,
    };

    return result;
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export const createInteractiveAgent = async (
  snakAgent: SnakAgentInterface,
  modelSelector: ModelSelector | null
): Promise<AgentReturn> => {
  const agent = new InteractiveAgent(snakAgent, modelSelector);
  return agent.initialize();
};
