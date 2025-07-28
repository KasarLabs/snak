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
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import {
  logger,
  AgentConfig,
  AgentMode,
  ModelLevelConfig,
  ModelProviders,
} from '@snakagent/core';
import { SnakAgentInterface } from '../../tools/tools.js';
import {
  initializeToolsList,
  initializeDatabase,
  truncateToolResults,
} from '../core/utils.js';
import {
  ModelSelector,
  ModelSelectorConfig,
} from '../operators/modelSelector.js';
import {
  PLAN_EXECUTOR_SYSTEM_PROMPT,
  PLAN_VALIDATOR_SYSTEM_PROMPT,
  planPrompt,
  PromptPlanInteractive,
  REPLAN_EXECUTOR_SYSTEM_PROMPT,
  STEPS_VALIDATOR_SYSTEM_PROMPT,
} from '../../prompt/prompts.js';
import { TokenTracker } from '../../token/tokenTracking.js';
import { AgentReturn } from './autonomous.js';
import { MemoryAgent } from 'agents/operators/memoryAgent.js';
import { RagAgent } from 'agents/operators/ragAgent.js';
import { RunnableConfig } from '@langchain/core/runnables';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { AnyZodObject, z } from 'zod';

export interface StepInfo {
  stepNumber: number;
  stepName: string;
  description: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface ParsedPlan {
  steps: StepInfo[];
  summary: string;
}

interface StepResponse {
  number: number;
  validated: boolean;
}

interface ValidatorStepResponse {
  steps: StepResponse[];
  nextSteps: number;
  isFinal: boolean;
}

export enum Agent {
  PLANNER = 'planner',
  EXECT_VALIDATOR = 'exec_validator',
  PLANNER_VALIDATOR = 'planner_validator',
  EXECUTOR = 'executor',
}

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

  private ConfigurableAnnotation = Annotation.Root({
    max_graph_steps: Annotation<number>({
      reducer: (x, y) => y, // Remplacer par le nouvel index
      default: () => 15,
    }),
    short_term_memory: Annotation<number>({
      reducer: (x, y) => y, // Remplacer par le nouvel index
      default: () => 15,
    }),
    memorySize: Annotation<number>({
      reducer: (x, y) => y, // Remplacer par le nouvel index
      default: () => 20,
    }),
  });

  // Define GraphState as a class property for better type safety
  private GraphState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
      reducer: (x, y) => x.concat(y),
      default: () => [],
    }),
    agent: Annotation<Agent>({
      reducer: (x, y) => y, // Toujours remplacer par la nouvelle valeur
      default: () => Agent.PLANNER,
    }),
    memories: Annotation<string>({
      reducer: (x, y) => y, // Remplacer par la nouvelle valeur
      default: () => '',
    }),
    rag: Annotation<string>({
      reducer: (x, y) => y, // Remplacer par la nouvelle valeur
      default: () => '',
    }),
    plan: Annotation<ParsedPlan>({
      reducer: (x, y) => y, // Remplacer le plan entier
      default: () => ({
        steps: [],
        summary: '',
      }),
    }),
    currentStepIndex: Annotation<number>({
      reducer: (x, y) => y, // Remplacer par le nouvel index
      default: () => 0,
    }),
    retry: Annotation<number>({
      reducer: (x, y) => y, // Remplacer par le nouveau nombre de retry
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

  async initialize(): Promise<AgentReturn> {
    try {
      // Get agent configuration
      this.agent_config = this.snakAgent.getAgentConfig();
      if (!this.agent_config) {
        throw new Error('Agent configuration is required');
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
      logger.error('Failed to create an interactive agent:', error);
      throw error;
    }
  }

  private async initializeMemoryAgent(): Promise<void> {
    try {
      this.memoryAgent = this.snakAgent.getMemoryAgent();
      if (this.memoryAgent) {
        logger.debug('Successfully retrieved memory agent');
        const memoryTools = this.memoryAgent.prepareMemoryTools();
        this.toolsList.push(...memoryTools);
      } else {
        logger.warn(
          'Memory agent not available, memory features will be limited'
        );
      }
    } catch (error) {
      logger.error(`Error retrieving memory agent: ${error}`);
    }
  }

  private async initializeRagAgent(): Promise<void> {
    try {
      this.ragAgent = this.snakAgent.getRagAgent();
      if (!this.ragAgent) {
        logger.warn('Rag agent not available, rag context will be skipped');
      }
    } catch (error) {
      logger.error(`Error retrieving rag agent: ${error}`);
    }
  }

  private buildWorkflow(): any {
    // Create tool node with custom invoke
    const toolNode = this.createToolNode();

    // Build workflow
    let workflow = new StateGraph(this.GraphState, this.ConfigurableAnnotation)
      .addNode('executor', this.callModel.bind(this))
      .addNode('tools', toolNode)
      .addNode('plan_node', this.planExecution.bind(this))
      .addNode('validator', this.validator.bind(this))
      .addEdge('__start__', 'plan_node')
      .addEdge('plan_node', 'validator');

    // Add memory and RAG nodes based on configuration

    // workflow.addEdge('plan_node', 'agent');
    workflow.addConditionalEdges(
      'validator',
      this.handleValidatorRouting.bind(this),
      {
        re_planner: 'plan_node',
        executor: 'executor',
        end: END,
      }
    );
    // workflow.addEdge('tools', 'executor');

    workflow.addConditionalEdges('executor', this.shouldContinue.bind(this), {
      validator: 'validator',
      tools: 'tools',
      end: END,
    });
    workflow.addConditionalEdges('tools', this.shouldContinue.bind(this), {
      validator: 'validator',
      tools: 'tools',
      end: END,
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

  private async toolNodeInvoke(
    state: typeof this.GraphState.State,
    config: LangGraphRunnableConfig | undefined,
    originalInvoke: Function
  ): Promise<{ messages: BaseMessage[] } | null> {
    const lastMessage = state.messages[state.messages.length - 1];
    const lastIterationNumber = this.getLatestMessageForMessage(
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
          `Executing tool: ${call.name} with args: ${JSON.stringify(call.args).substring(0, 150)}${
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
        `Tool execution completed in ${executionTime}ms. Results: ${
          Array.isArray(truncatedResult)
            ? truncatedResult.length
            : typeof truncatedResult
        }`
      );

      truncatedResult.messages.forEach((res) => {
        res.additional_kwargs = {
          from: 'tools',
          final: false,
          iteration_number: lastIterationNumber,
        };
      });

      logger.warn(JSON.stringify(truncatedResult));
      return truncatedResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`Tool execution failed after ${executionTime}ms: ${error}`);
      throw error;
    }
  }

  private getCompileOptions(): any {
    return this.agent_config.memory
      ? {
          checkpointer: this.checkpointer,
          configurable: {},
        }
      : {};
  }

  public formatParsedPlanSimple(plan: ParsedPlan): string {
    let formatted = `Plan Summary: ${plan.summary}\n\n`;
    formatted += `Steps (${plan.steps.length} total):\n`;

    plan.steps.forEach((step) => {
      const status =
        step.status === 'completed'
          ? '✓'
          : step.status === 'failed'
            ? '✗'
            : '○';
      formatted += `${status} ${step.stepNumber}. ${step.stepName} - ${step.description}\n`;
    });

    return formatted;
  }

  private async validatorPlanner(state: typeof this.GraphState.State): Promise<{
    messages: BaseMessage;
    currentStepIndex: number;
    agent: Agent;
    retry: number;
  }> {
    try {
      const retry: number = state.retry;
      console.log(retry);
      console.log(state.retry);
      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('Model not found in ModelSelector');
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

      // Formater le plan
      const planDescription = this.formatParsedPlanSimple(state.plan);

      const originalUserMessage = state.messages.find(
        (msg: BaseMessage): msg is HumanMessage => msg instanceof HumanMessage
      );

      const originalUserQuery = originalUserMessage
        ? typeof originalUserMessage.content === 'string'
          ? originalUserMessage.content
          : JSON.stringify(originalUserMessage.content)
        : '';

      // Invoquer directement avec un tableau de messages
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

      console.log(
        'Structured result:',
        JSON.stringify(structuredResult, null, 2)
      );

      // Traiter le résultat
      if (structuredResult.isValidated) {
        console.log('Validated');
        const successMessage = new AIMessageChunk({
          content: `Plan validated: ${structuredResult.description}`,
          additional_kwargs: {
            error: false,
            validated: true,
            from: Agent.PLANNER_VALIDATOR,
          },
        });
        return {
          messages: successMessage,
          agent: Agent.PLANNER_VALIDATOR,
          currentStepIndex: state.currentStepIndex,
          retry: retry,
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
        return {
          messages: errorMessage,
          currentStepIndex: state.currentStepIndex,
          agent: Agent.PLANNER_VALIDATOR,
          retry: retry + 1,
        };
      }
    } catch (error) {
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
        agent: Agent.PLANNER_VALIDATOR,
        retry: -1,
      };
    }
  }

  public formatStepsStatusCompact(response: ValidatorStepResponse): string {
    const validated = response.steps
      .filter((s) => s.validated)
      .map((s) => s.number);
    const total = response.steps.length;

    if (response.isFinal) {
      return `✅ Complete (${validated.length}/${total})`;
    }

    return `📋 Progress: [${validated.join(',')}] ➡️ Step ${response.nextSteps}`;
  }
  private async validatorExecutor(
    state: typeof this.GraphState.State
  ): Promise<{
    messages: BaseMessage;
    currentStepIndex: number;
    plan?: ParsedPlan;
    agent: Agent;
    retry: number;
  }> {
    try {
      const retry: number = state.retry;
      const lastMessage = state.messages[state.messages.length - 1];

      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('Model not found in ModelSelector');
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
        logger.info('Last Message is a tool Message');
        content = `VALIDATION_TYPE : TOOL_EXECUTION_MODE, TOOL_CALL TO ANALYZE : {response_content :${lastMessage.content}, name_of_tool_call :${lastMessage.name}, tool_call_id : ${lastMessage.tool_call_id} `;
      } else {
        logger.info('Last Message is a AiMessageChunk');
        content = `VALIDATION_TYPE : AI_RESPONSE_MODE, AI_MESSAGE TO ANALYZE : ${lastMessage.content.toString()}`;
      }
      // Invoquer directement avec un tableau de messages
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

      console.log(
        'Structured result:',
        JSON.stringify(structuredResult, null, 2)
      );

      if (structuredResult.validated === true) {
        const plan = state.plan;
        plan.steps[state.currentStepIndex].status = 'completed';
        if (state.currentStepIndex === state.plan.steps.length - 1) {
          logger.warn('STEPS FINAL REACHED');
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
            agent: Agent.EXECT_VALIDATOR,
            retry: retry,
            plan: plan,
          };
        } else {
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
            agent: Agent.EXECT_VALIDATOR,
            retry: 0,
            plan: plan,
          };
        }
      }
      logger.warn(`NOT VALIDATE ${JSON.stringify(structuredResult)}`);
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
        agent: Agent.EXECT_VALIDATOR,
        retry: retry + 1,
      };
    } catch (error) {
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
        agent: Agent.EXECT_VALIDATOR,
        plan: error_plan,
        retry: -1,
      };
    }
  }

  private async validator(state: typeof this.GraphState.State): Promise<{
    messages: BaseMessage;
    currentStepIndex: number;
    plan?: ParsedPlan;
    agent: Agent;
    retry: number;
  }> {
    if (state.agent === Agent.PLANNER) {
      const result = await this.validatorPlanner(state);
      return result;
    } else {
      const result = await this.validatorExecutor(state);
      return result;
    }
  }

  private async planExecution(
    state: typeof this.GraphState.State,
    config: RunnableConfig<typeof this.ConfigurableAnnotation.State>
  ): Promise<{
    messages: BaseMessage[];

    agent: Agent;
    plan: ParsedPlan;
  }> {
    try {
      console.log(
        'State received in planExecution:',
        JSON.stringify(state, null, 2)
      );
      console.log(
        'Config received in planExecution:',
        JSON.stringify(config, null, 2)
      );
      const lastAiMessage = this.getLatestMessageForMessage(
        state.messages,
        AIMessageChunk
      );

      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('Model not found in ModelSelector');
      }

      // Définir le schéma pour UN step
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

      // Définir le schéma pour le plan complet
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
      if (state.agent === Agent.PLANNER_VALIDATOR && lastAiMessage) {
        systemPrompt = REPLAN_EXECUTOR_SYSTEM_PROMPT(
          lastAiMessage,
          this.formatParsedPlanSimple(state.plan),
          originalUserQuery
        );
      }
      systemPrompt = PLAN_EXECUTOR_SYSTEM_PROMPT(
        this.toolsList,
        originalUserQuery
      );

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', systemPrompt],
        new MessagesPlaceholder('messages'),
      ]);

      const structuredResult = await structuredModel.invoke(
        await prompt.formatMessages({ messages: filteredMessages })
      );

      console.log(
        'Structured result:',
        JSON.stringify(structuredResult, null, 2)
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
        agent: Agent.PLANNER,
        plan: structuredResult as ParsedPlan,
      };
    } catch (error) {
      logger.error(`Error in planExecution: ${error}`);

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
        agent: Agent.PLANNER,
        plan: error_plan,
      };
    }
  }

  private async callModel(
    state: typeof this.GraphState.State,
    config: RunnableConfig<typeof this.ConfigurableAnnotation.State>
  ): Promise<{ messages: BaseMessage[]; agent: Agent }> {
    if (!this.agent_config || !this.modelSelector) {
      throw new Error('Agent configuration and ModelSelector are required.');
    }

    console.log(JSON.stringify(state.plan));
    const maxGraphSteps = config.configurable?.max_graph_steps as number;
    const shortTermMemory = config.configurable?.short_term_memory as number;
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];

    // Determine iteration number
    let iteration_number = this.calculateIterationNumber(
      state.messages,
      lastMessage
    );

    if (maxGraphSteps)
      if (maxGraphSteps <= iteration_number) {
        return this.createMaxIterationsResponse(iteration_number);
      }

    iteration_number++;

    // Determine start iteration
    const startIteration = this.calculateStartIteration(config, state.messages);

    logger.info(
      `startIteration: ${startIteration}, iteration: ${iteration_number}`
    );

    // Build system prompt
    const interactiveSystemPrompt = this.buildSystemPrompt(state);

    try {
      // Filter messages and invoke model
      const filteredMessages = this.filterMessagesByShortTermMemory(
        state.messages,
        iteration_number,
        shortTermMemory
      );

      const result = await this.invokeModelWithMessages(
        filteredMessages,
        interactiveSystemPrompt,
        startIteration,
        iteration_number
      );

      return { messages: [result], agent: Agent.EXECUTOR };
    } catch (error: any) {
      return this.handleModelError(error);
    }
  }

  private calculateIterationNumber(
    messages: BaseMessage[],
    lastMessage: BaseMessage
  ): number {
    let iteration_number = 0;

    if (lastMessage instanceof ToolMessage) {
      logger.debug('ToolMessage Detected');
      const lastMessageAi = this.getLatestMessageForMessage(
        messages,
        AIMessageChunk
      );
      if (!lastMessageAi) {
        throw new Error('Error trying to get latest AI Message Chunk');
      }
      iteration_number =
        (lastMessageAi.additional_kwargs.iteration_number as number) || 0;
    } else if (lastMessage instanceof AIMessageChunk) {
      iteration_number =
        (lastMessage.additional_kwargs.iteration_number as number) || 0;
    }

    return iteration_number;
  }

  private buildSystemPrompt(state: typeof this.GraphState.State): string {
    const rules = PromptPlanInteractive(
      state.plan.steps[state.currentStepIndex]
    );

    return `
      ${this.agent_config.prompt.content}
      ${rules}
      
      Available tools: ${this.toolsList.map((tool) => tool.name).join(', ')}`;
  }

  private shouldContinue(
    state: typeof this.GraphState.State,
    config: RunnableConfig<typeof this.ConfigurableAnnotation.State>
  ): 'tools' | 'validator' | 'end' {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];

    if (lastMessage instanceof AIMessageChunk) {
      if (this.isTerminalMessage(lastMessage)) {
        logger.info(
          `Final message received, routing to end node. Message: ${lastMessage.content}`
        );
        return 'end';
      }
      if (lastMessage.tool_calls?.length) {
        logger.debug(
          `Detected ${lastMessage.tool_calls.length} tool calls, routing to tools node.`
        );
        return 'tools';
      }
    } else if (lastMessage instanceof ToolMessage) {
      return this.handleToolMessageRouting(messages, config);
    }

    logger.info('Routing to AgentMode');
    return 'validator';
  }

  private isTerminalMessage(message: AIMessageChunk): boolean {
    return (
      message.additional_kwargs.final === true ||
      message.content.toString().includes('FINAL ANSWER') ||
      message.content.toString().includes('PLAN_COMPLETED')
    );
  }

  private handleValidatorRouting(
    state: typeof this.GraphState.State
  ): 're_planner' | 'executor' | 'end' {
    try {
      logger.warn(state.agent);
      if (state.agent === Agent.PLANNER_VALIDATOR) {
        console.log(state.retry);
        const lastAiMessage = state.messages[state.messages.length - 1];
        if (lastAiMessage.additional_kwargs.from != 'planner_validator') {
          throw new Error(
            'ValidatorRouting : Last AI message is not from the validator make sure there is not problem with the grash edges.'
          );
        }
        if (lastAiMessage.additional_kwargs.validated) {
          return 'executor';
        } else if (
          lastAiMessage.additional_kwargs.validated === false &&
          state.retry <= 3
        ) {
          return 're_planner';
        }
        return 'end';
      }
      if (state.agent === Agent.EXECT_VALIDATOR) {
        console.log('Hello');
        const lastAiMessage = this.getLatestMessageForMessage(
          state.messages,
          AIMessageChunk
        );
        if (
          !lastAiMessage ||
          lastAiMessage.additional_kwargs.from != 'exec_validator'
        ) {
          throw new Error(
            'ValidatorRouting : Last AI message is not from the validator make sure there is not problem with the grash edges.'
          );
        }
        if (lastAiMessage.additional_kwargs.isFinal === true) {
          return 'end';
        }
        if (state.retry >= 3) {
          return 'end';
        }
        return 'executor';
      }
      return 'end';
    } catch (error) {
      return 'end';
    }
  }

  private handleToolMessageRouting(
    messages: BaseMessage[],
    config: RunnableConfig<typeof this.ConfigurableAnnotation.State>
  ): 'validator' | 'end' {
    const lastAiMessage = this.getLatestMessageForMessage(
      messages,
      AIMessageChunk
    );
    if (!lastAiMessage) {
      throw new Error('Error trying to get last AIMessageChunk');
    }

    const graphMaxSteps = config?.configurable?.max_graph_steps as number;
    const iteration = this.getLatestMessageForMessage(messages, ToolMessage)
      ?.additional_kwargs?.iteration_number as number;

    if (graphMaxSteps <= iteration) {
      logger.info(`Tools: Final message received, routing to end node.`);
      return 'end';
    }

    logger.debug('Received ToolMessage, routing back to agent node.');
    return 'validator';
  }

  // private updateGraph(state: typeof this.GraphState.State): {
  //   currentStep?: StepInfo;
  //   stepHistory?: StepInfo[];
  // } {
  //   const lastAiMessage = this.getLatestMessageForMessage(
  //     state.messages,
  //     AIMessageChunk
  //   );

  //   if (!(lastAiMessage instanceof AIMessageChunk)) {
  //     logger.warn(
  //       'Last message is not an AIMessage, skipping graph update check.'
  //     );
  //     return {
  //       currentStep: state.currentStep,
  //       stepHistory: state.stepHistory,
  //     };
  //   }

  //   const lastMessageContent = lastAiMessage.content.toString();
  //   const currentStep = state.currentStep;

  //   if (lastMessageContent.includes('STEP_COMPLETED')) {
  //     logger.warn(
  //       `Graph State has been updated during the step ${currentStep.stepName}`
  //     );

  //     const next_step_id = Math.min(
  //       currentStep.stepNumber + 1,
  //       state.plan.steps.length - 1
  //     );

  //     const nextStep = state.plan.steps[next_step_id];
  //     console.log(JSON.stringify(next_step_id));

  //     return {
  //       currentStep: nextStep,
  //       stepHistory: [state.currentStep],
  //     };
  //   }

  //   return {
  //     currentStep: state.currentStep,
  //     stepHistory: [],
  //   };
  // }

  // Overloaded method signatures for type safety
  private getLatestMessageForMessage(
    messages: BaseMessage[],
    MessageClass: typeof ToolMessage
  ): ToolMessage | null;
  private getLatestMessageForMessage(
    messages: BaseMessage[],
    MessageClass: typeof AIMessageChunk
  ): AIMessageChunk | null;
  private getLatestMessageForMessage(
    messages: BaseMessage[],
    MessageClass: typeof AIMessage
  ): AIMessage | null;
  private getLatestMessageForMessage(
    messages: BaseMessage[],
    MessageClass: typeof HumanMessage
  ): HumanMessage | null;
  private getLatestMessageForMessage(
    messages: BaseMessage[],
    MessageClass: any
  ): any {
    try {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i] instanceof MessageClass) {
          return messages[i];
        }
      }
      return null;
    } catch (error: any) {
      logger.error(error);
      throw error;
    }
  }

  // Helper methods for better organization
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
      const lastAiMessage = this.getLatestMessageForMessage(
        messages,
        AIMessageChunk
      );
      if (!lastAiMessage) {
        throw new Error('Error trying to get latest AI Message Chunk');
      }
      return lastAiMessage.additional_kwargs.start_iteration as number;
    }
  }

  private filterMessagesByShortTermMemory(
    messages: BaseMessage[],
    iteration_number: number,
    shortTermMemory: number
  ): BaseMessage[] {
    const filteredMessages = [];
    let lastIterationCount = iteration_number - 1;
    let s_temp = shortTermMemory;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];

      // Skip model-selector messages
      if (
        (msg instanceof AIMessageChunk || msg instanceof ToolMessage) &&
        msg.additional_kwargs?.from === 'model-selector'
      ) {
        continue;
      }

      // Handle iteration filtering
      if (lastIterationCount !== msg.additional_kwargs?.iteration_number) {
        lastIterationCount =
          (msg.additional_kwargs?.iteration_number as number) || 0;
        s_temp--;
      }

      if (s_temp === 0) break;

      filteredMessages.unshift(msg);
    }

    return filteredMessages;
  }

  private async invokeModelWithMessages(
    filteredMessages: BaseMessage[],
    interactiveSystemPrompt: string,
    startIteration: number,
    iteration_number: number
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
      `Autonomous agent invoking model (${selectedModelType.model_name}) with ${filteredMessages.length} messages.`
    );

    const result = await boundModel.invoke(formattedPrompt);
    if (!result) {
      throw new Error(
        'Model invocation returned no result. Please check the model configuration.'
      );
    }

    TokenTracker.trackCall(result, selectedModelType.model_name);

    // Add metadata to result
    result.additional_kwargs = {
      ...result.additional_kwargs,
      from: 'executor',
      final: false,
      start_iteration: startIteration,
      iteration_number: iteration_number,
    };

    return result;
  }

  private createMaxIterationsResponse(iteration_number: number): {
    messages: BaseMessage[];
    agent: Agent;
  } {
    return {
      messages: [
        new AIMessageChunk({
          content: `Reaching maximum iterations for autonomous agent. Ending workflow.`,
          additional_kwargs: {
            final: true,
            iteration_number: iteration_number,
          },
        }),
      ],
      agent: Agent.EXECUTOR,
    };
  }

  private handleModelError(error: any): {
    messages: BaseMessage[];
    agent: Agent.EXECUTOR;
  } {
    logger.error(`Error calling model in autonomous agent: ${error}`);

    if (this.isTokenLimitError(error)) {
      logger.error(
        `Token limit error during autonomous callModel: ${error.message}`
      );
      return {
        messages: [
          new AIMessageChunk({
            content:
              'Error: The conversation history has grown too large, exceeding token limits. Cannot proceed.',
            additional_kwargs: {
              error: 'token_limit_exceeded',
              final: true,
            },
          }),
        ],
        agent: Agent.EXECUTOR,
      };
    }

    return {
      messages: [
        new AIMessageChunk({
          content: `Error: An unexpected error occurred while processing the request. Error : ${error}`,
          additional_kwargs: {
            error: 'unexpected_error',
            final: true,
          },
        }),
      ],
      agent: Agent.EXECUTOR,
    };
  }

  private isTokenLimitError(error: any): boolean {
    return (
      error.message?.includes('token limit') ||
      error.message?.includes('tokens exceed') ||
      error.message?.includes('context length')
    );
  }
}

// Factory function for backward compatibility
export const createInteractiveAgent = async (
  snakAgent: SnakAgentInterface,
  modelSelector: ModelSelector | null
): Promise<AgentReturn> => {
  const agent = new InteractiveAgent(snakAgent, modelSelector);
  return agent.initialize();
};
