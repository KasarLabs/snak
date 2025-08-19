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
import { TokenTracker } from '../../token/tokenTracking.js';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { MemoryAgent } from 'agents/operators/memoryAgent.js';
import { RagAgent } from 'agents/operators/ragAgent.js';
import {
  Agent,
  AgentReturn,
  Memories,
  ParsedPlan,
  StepInfo,
} from './types/index.js';
import {
  calculateTotalTokenFromSteps,
  createMaxIterationsResponse,
  estimateTokens,
  filterMessagesByShortTermMemory,
  formatExecutionMessage,
  formatParsedPlanSimple,
  formatShortMemoryMessage,
  formatStepsForContext,
  formatToolResponse,
  formatValidatorToolsExecutor,
  getLatestMessageForMessage,
  handleModelError,
  isTerminalMessage,
  PlanSchema,
  ValidatorResponseSchema,
} from './utils.js';
import {
  ADAPTIVE_PLANNER_CONTEXT_PROMPT,
  ADAPTIVE_PLANNER_SYSTEM_PROMPT,
  AUTONOMOUS_PLAN_EXECUTOR_SYSTEM_PROMPT,
  AUTONOMOUS_PLANNER_CONTEXT_PROMPT,
  HYBRID_PLAN_EXECUTOR_SYSTEM_PROMPT,
  REPLAN_EXECUTOR_SYSTEM_PROMPT,
  REPLANNER_CONTEXT_PROMPT,
} from '../../prompt/planner_prompt.js';
import {
  MESSAGE_STEP_EXECUTOR_SYSTEM_PROMPT,
  RETRY_MESSAGE_STEP_EXECUTOR_SYSTEM_PROMPT,
  RETRY_STEP_EXECUTOR_CONTEXT_PROMPT,
  RETRY_TOOLS_STEP_EXECUTOR_SYSTEM_PROMPT,
  STEP_EXECUTOR_CONTEXT,
  STEP_EXECUTOR_CONTEXT_PROMPT,
  TOOLS_STEP_EXECUTOR_SYSTEM_PROMPT,
} from '../../prompt/executor_prompts.js';
import {
  AUTONOMOUS_PLAN_VALIDATOR_SYSTEM_PROMPT,
  TOOLS_STEP_VALIDATOR_SYSTEM_PROMPT,
  VALIDATOR_EXECUTOR_CONTEXT,
} from '../../prompt/validator_prompt.js';
import { SUMMARIZE_AGENT } from '../../prompt/summary_prompts.js';
import {
  BaseChatModel,
  BaseChatModelCallOptions,
} from '@langchain/core/language_models/chat_models';
import { MemoryGraph } from './sub-graph/memory.js';
const objectives = `Perform efficient and reliable RPC calls to the Starknet network.,
            Retrieve and analyze on-chain data such as transactions, blocks, and smart contract states.`;

export const AutonomousGraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  last_message: Annotation<BaseMessage | BaseMessage[]>({
    reducer: (x, y) => y,
  }),
  last_agent: Annotation<Agent>({
    reducer: (x, y) => y,
    default: () => Agent.PLANNER,
  }),
  memories: Annotation<Memories>({
    reducer: (x, y) => y,
    default: () => ({ ltm: '', stm: [''] }),
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

export const AutonomousConfigurableAnnotation = Annotation.Root({
  max_graph_steps: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 100,
  }),
  short_term_memory: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 3,
  }),
  memory_size: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 20,
  }),
  human_in_the_loop: Annotation<boolean>({
    reducer: (x, y) => y,
    default: () => false,
  }),
  agent_config: Annotation<AgentConfig | undefined>({
    reducer: (x, y) => y,
    default: () => undefined,
  }),
});
export class AutonomousAgent {
  private modelSelector: ModelSelector | null;
  private toolsList: (
    | StructuredTool
    | Tool
    | DynamicStructuredTool<AnyZodObject>
  )[] = [];
  private memoryAgent: MemoryAgent | null = null;
  private agentConfig: AgentConfig;
  private ragAgent: RagAgent | null = null;
  private checkpointer: MemorySaver;
  private app: any;

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
        logger.debug(
          '[AutonomousAgent] ✅ Memory agent retrieved successfully'
        );
        const memoryTools = this.memoryAgent.prepareMemoryTools();
        this.toolsList.push(...memoryTools);
      } else {
        logger.warn(
          '[AutonomousAgent] ⚠️ Memory agent not available - memory features will be limited'
        );
      }
    } catch (error) {
      logger.error(
        `[AutonomousAgent] ❌ Failed to retrieve memory agent: ${error}`
      );
    }
  }

  private async initializeRagAgent(): Promise<void> {
    try {
      this.ragAgent = this.snakAgent.getRagAgent();
      if (!this.ragAgent) {
        logger.warn(
          '[AutonomousAgent] ⚠️ RAG agent not available - RAG context will be skipped'
        );
      }
    } catch (error) {
      logger.error(
        `[AutonomousAgent] ❌ Failed to retrieve RAG agent: ${error}`
      );
    }
  }

  // ============================================
  // GRAPH NODES
  // ============================================

  // --- PLANNER NODE ---

  private async adaptivePlanner(
    state: typeof AutonomousGraphState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): Promise<{
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
      const availableTools = this.toolsList.map((tool) => tool.name).join(', ');

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', systemPrompt],
        ['ai', context],
      ]);

      const structuredResult = await structuredModel.invoke(
        await prompt.formatMessages({
          stepLength: state.currentStepIndex + 1,
          objectives: objectives,
          toolsAvailable: availableTools,
          previousSteps: formatStepsForContext(state.plan.steps),
        })
      );

      logger.info(
        `[AdaptivePlanner] 📋 Created plan with ${structuredResult.steps.length} steps`
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
        last_message: aiMessage,
        last_agent: Agent.PLANNER,
        plan: updatedPlan,
        currentGraphStep: state.currentGraphStep + 1,
      };
    } catch (error) {
      logger.error(`[AdaptivePlanner] ❌ Plan creation failed: ${error}`);

      const errorMessage = new AIMessageChunk({
        content: `Failed to create plan: ${error.message}`,
        additional_kwargs: {
          error: true,
          from: Agent.ADAPTIVE_PLANNER,
        },
      });

      return {
        last_message: errorMessage,
        last_agent: Agent.PLANNER,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  private async replanExecution(
    model: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>,
    plan: ParsedPlan,
    lastAiMessage: BaseMessage
  ): Promise<ParsedPlan> {
    try {
      const systemPrompt = REPLAN_EXECUTOR_SYSTEM_PROMPT;
      const contextPrompt = REPLANNER_CONTEXT_PROMPT;

      const structuredModel = model.withStructuredOutput(PlanSchema);

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', systemPrompt],
        ['ai', contextPrompt],
      ]);

      const structuredResult = await structuredModel.invoke(
        await prompt.formatMessages({
          objectives: objectives,
          toolsAvailable: this.toolsList.map((tool) => tool.name).join(', '),
          rejectedReason: lastAiMessage.content.toLocaleString(),
          formatPlan: formatParsedPlanSimple(plan),
        })
      );

      return structuredResult as ParsedPlan;
    } catch (error) {
      throw error;
    }
  }

  private async planExecution(
    state: typeof AutonomousGraphState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): Promise<{
    last_message: BaseMessage;
    last_agent: Agent;
    plan?: ParsedPlan;
    currentStepIndex: number;
    currentGraphStep: number;
  }> {
    try {
      console.log(config.configurable?.max_graph_steps);

      logger.info('[Planner] 🚀 Starting plan execution');
      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('Model not found in ModelSelector');
      }
      let structuredResult: ParsedPlan;
      if (state.retry != 0) {
        structuredResult = await this.replanExecution(
          model,
          state.plan,
          state.last_message as BaseMessage
        );
      } else {
        const structuredModel = model.withStructuredOutput(PlanSchema);

        //
        let systemPrompt;
        let contextPrompt;
        if (config.configurable?.agent_config?.mode === AgentMode.HYBRID) {
          logger.debug('[Planner] 📝 Creating initial hybrid plan');
          systemPrompt = HYBRID_PLAN_EXECUTOR_SYSTEM_PROMPT;
          contextPrompt = AUTONOMOUS_PLAN_EXECUTOR_SYSTEM_PROMPT;
        } else {
          logger.debug('[Planner] 📝 Creating initial autonomous plan');
          systemPrompt = AUTONOMOUS_PLAN_EXECUTOR_SYSTEM_PROMPT;
          contextPrompt = AUTONOMOUS_PLANNER_CONTEXT_PROMPT;
        }
        const prompt = ChatPromptTemplate.fromMessages([
          ['system', systemPrompt],
          ['ai', contextPrompt],
        ]);

        structuredResult = (await structuredModel.invoke(
          await prompt.formatMessages({
            objectives: objectives,
            toolsAvailable: this.toolsList.map((tool) => tool.name).join(', '),
          })
        )) as ParsedPlan;
      }
      logger.info(
        `[Planner] ✅ Successfully created plan with ${structuredResult.steps.length} steps`
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
        last_message: aiMessage,
        last_agent: Agent.PLANNER,
        plan: structuredResult as ParsedPlan,
        currentGraphStep: state.currentGraphStep + 1,
        currentStepIndex: 0,
      };
    } catch (error) {
      logger.error(`[Planner] ❌ Plan execution failed: ${error}`);

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

  // --- VALIDATOR NODE ---
  private async validator(
    state: typeof AutonomousGraphState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): Promise<{
    last_message: BaseMessage;
    currentStepIndex: number;
    plan?: ParsedPlan;
    last_agent: Agent;
    retry: number;
    currentGraphStep: number;
  }> {
    logger.debug(
      `[Validator] 🔍 Processing validation for agent: ${state.last_agent}`
    );

    if (state.last_agent === Agent.PLANNER) {
      return await this.validatorPlanner(state, config);
    } else if (state.last_agent === Agent.EXECUTOR) {
      return await this.validatorExecutor(state);
    } else {
      return await this.validatorExecutor(state);
    }
  }

  private async validatorPlanner(
    state: typeof AutonomousGraphState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): Promise<{
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

      console.log(planDescription);
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
        logger.info(`[PlannerValidator] ✅ Plan success successfully`);
        return {
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
          `[PlannerValidator] ⚠️ Plan validation failed: ${structuredResult.result}`
        );
        return {
          last_message: errorMessage,
          currentStepIndex: state.currentStepIndex,
          last_agent: Agent.PLANNER_VALIDATOR,
          retry: 0,
          currentGraphStep: state.currentGraphStep + 1,
        };
      }
    } catch (error) {
      logger.error(
        `[PlannerValidator] ❌ Failed to validate plan: ${error.message}`
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
        last_message: errorMessage,
        currentStepIndex: state.currentStepIndex,
        last_agent: Agent.PLANNER_VALIDATOR,
        retry: state.retry + 1,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  private async validatorExecutor(
    state: typeof AutonomousGraphState.State
  ): Promise<{
    last_message: BaseMessage;
    currentStepIndex: number;
    plan?: ParsedPlan;
    last_agent: Agent;
    retry: number;
    currentGraphStep: number;
  }> {
    try {
      const retry: number = state.retry;
      const currentStep = state.plan.steps[state.currentStepIndex];

      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('Model not found in ModelSelector');
      }

      const structuredModel = model.withStructuredOutput(
        ValidatorResponseSchema
      );

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', TOOLS_STEP_VALIDATOR_SYSTEM_PROMPT],
        ['ai', VALIDATOR_EXECUTOR_CONTEXT],
      ]);

      const structuredResult = await structuredModel.invoke(
        await prompt.formatMessages({
          formatValidatorInput: formatValidatorToolsExecutor(currentStep),
        })
      );
      if (structuredResult.success === true) {
        const updatedPlan = state.plan;
        updatedPlan.steps[state.currentStepIndex].status = 'completed';

        if (state.currentStepIndex === state.plan.steps.length - 1) {
          logger.info(
            '[ExecutorValidator] 🎯 Final step reached - Plan completed'
          );
          const successMessage = new AIMessageChunk({
            content: `Final step reached`,
            additional_kwargs: {
              error: false,
              final: true,
              from: Agent.EXEC_VALIDATOR,
            },
          });
          return {
            last_message: successMessage,
            currentStepIndex: state.currentStepIndex + 1,
            last_agent: Agent.EXEC_VALIDATOR,
            retry: retry,
            plan: updatedPlan,
            currentGraphStep: state.currentGraphStep + 1,
          };
        } else {
          logger.info(
            `[ExecutorValidator] ✅ Step ${state.currentStepIndex + 1} success successfully`
          );
          const message = new AIMessageChunk({
            content: `Step ${state.currentStepIndex + 1} has been success`,
            additional_kwargs: {
              error: false,
              final: false,
              from: Agent.EXEC_VALIDATOR,
            },
          });
          return {
            last_message: message,
            currentStepIndex: state.currentStepIndex + 1,
            last_agent: Agent.EXEC_VALIDATOR,
            retry: 0,
            plan: updatedPlan,
            currentGraphStep: state.currentGraphStep + 1,
          };
        }
      }

      logger.warn(
        `[ExecutorValidator] ⚠️ Step ${state.currentStepIndex + 1} validation failed - Reason: ${structuredResult.results.join('Reason :')}`
      );
      const notValidateMessage = new AIMessageChunk({
        content: `Step ${state.currentStepIndex + 1} not success - Reason: ${structuredResult.results.join('Reason :')}`,
        additional_kwargs: {
          error: false,
          final: false,
          from: Agent.EXEC_VALIDATOR,
        },
      });
      return {
        last_message: notValidateMessage,
        currentStepIndex: state.currentStepIndex,
        last_agent: Agent.EXEC_VALIDATOR,
        retry: retry + 1,
        currentGraphStep: state.currentGraphStep + 1,
      };
    } catch (error) {
      logger.error(
        `[ExecutorValidator] ❌ Failed to validate step: ${error.message}`
      );
      const errorPlan = state.plan;
      errorPlan.steps[state.currentStepIndex].status = 'failed';

      const errorMessage = new AIMessageChunk({
        content: `Failed to validate plan: ${error.message}`,
        additional_kwargs: {
          error: true,
          final: false,
          success: false,
          from: Agent.EXEC_VALIDATOR,
        },
      });
      return {
        last_message: errorMessage,
        currentStepIndex: state.currentStepIndex,
        last_agent: Agent.EXEC_VALIDATOR,
        plan: errorPlan,
        retry: -1,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  // --- EXECUTOR NODE ---
  private async callModel(
    state: typeof AutonomousGraphState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): Promise<{
    last_message: BaseMessage;
    messages: BaseMessage;
    last_agent: Agent;
    plan?: ParsedPlan;
    currentGraphStep?: number;
  }> {
    if (!config.configurable?.agent_config || !this.modelSelector) {
      throw new Error('Agent configuration and ModelSelector are required.');
    }

    const currentStep = state.plan.steps[state.currentStepIndex];
    logger.info(
      `[Executor] 🔄 Processing step ${state.currentStepIndex + 1} - ${currentStep?.stepName}`
    );

    const maxGraphSteps = config.configurable?.max_graph_steps ?? 100;
    const shortTermMemory = config.configurable?.short_term_memory ?? 10;
    const graphStep = state.currentGraphStep;

    if (maxGraphSteps && maxGraphSteps <= graphStep) {
      logger.warn(
        `[Executor] ⚠️ Maximum iterations (${maxGraphSteps}) reached`
      );
      return createMaxIterationsResponse(graphStep);
    }

    logger.debug(`[Executor] 📊 Current graph step: ${state.currentGraphStep}`);

    const autonomousSystemPrompt = this.buildSystemPrompt(state, config);

    try {
      const filteredMessages = filterMessagesByShortTermMemory(
        state.messages,
        shortTermMemory
      );
      const result = await this.invokeModelWithMessages(
        state,
        config,
        filteredMessages,
        autonomousSystemPrompt
      );

      if (result.tool_calls?.length) {
        return {
          messages: result,
          last_message: result,
          last_agent: Agent.EXECUTOR,
          currentGraphStep: state.currentGraphStep + 1,
        };
      }

      const content = result.content.toLocaleString();
      const updatedPlan = state.plan;
      const tokens =
        currentStep.type === 'tools'
          ? result.response_metadata?.usage?.completion_tokens
          : estimateTokens(content);
      updatedPlan.steps[state.currentStepIndex].result = {
        content: content,
        tokens: tokens,
      };

      return {
        messages: result,
        last_message: result,
        last_agent: Agent.EXECUTOR,
        plan: updatedPlan,
        currentGraphStep: state.currentGraphStep + 1,
      };
    } catch (error: any) {
      logger.error(`[Executor] ❌ Model invocation failed: ${error.message}`);
      const result = handleModelError(error);
      return {
        ...result,
        last_message: result.messages,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  // --- TOOLS NODE ---
  private async toolNodeInvoke(
    state: typeof AutonomousGraphState.State,
    config: LangGraphRunnableConfig | undefined,
    originalInvoke: Function
  ): Promise<{
    messages: BaseMessage[];
    last_message: BaseMessage[];
    last_agent: Agent;
    plan: ParsedPlan;
  } | null> {
    const lastMessage = state.last_message;

    const toolCalls =
      lastMessage instanceof AIMessageChunk && lastMessage.tool_calls
        ? lastMessage.tool_calls
        : [];

    if (toolCalls.length > 0) {
      toolCalls.forEach((call) => {
        const argsPreview = JSON.stringify(call.args).substring(0, 150);
        const hasMore = JSON.stringify(call.args).length > 150;
        logger.info(
          `[Tools] 🔧 Executing tool: ${call.name} with args: ${argsPreview}${hasMore ? '...' : ''}`
        );
      });
    }

    const startTime = Date.now();
    try {
      const result = await originalInvoke(state, config);
      const executionTime = Date.now() - startTime;
      const truncatedResult: { messages: ToolMessage[] } = truncateToolResults(
        result,
        5000,
        state.plan.steps[state.currentStepIndex]
      );

      logger.debug(`[Tools] ✅ Tool execution completed in ${executionTime}ms`);

      truncatedResult.messages.forEach((res) => {
        res.additional_kwargs = {
          from: 'tools',
          final: false,
        };
      });

      const updatedPlan = { ...state.plan };
      const currentStep = { ...updatedPlan.steps[state.currentStepIndex] };
      currentStep.result = {
        content: truncatedResult.messages[0].content.toLocaleString(),
        tokens: 0,
      };
      updatedPlan.steps[state.currentStepIndex] = formatToolResponse(
        truncatedResult.messages,
        currentStep
      );
      return {
        ...truncatedResult,
        last_message: truncatedResult.messages,
        last_agent: Agent.TOOLS,
        plan: state.plan,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(
        `[Tools] ❌ Tool execution failed after ${executionTime}ms: ${error}`
      );
      throw error;
    }
  }

  public async humanNode(state: typeof AutonomousGraphState.State): Promise<{
    last_message: BaseMessage;
    messages: BaseMessage;
    last_agent: Agent;
    currentGraphStep?: number;
  }> {
    const currentStep = state.plan.steps[state.currentStepIndex];
    const input = interrupt(currentStep.description);
    const message = new AIMessageChunk({
      content: input,
      additional_kwargs: {
        from: Agent.HUMAN,
        final: false,
      },
    });

    return {
      messages: message,
      last_agent: Agent.HUMAN,
      last_message: message,
      currentGraphStep: state.currentGraphStep + 1,
    };
  }

  // --- END GRAPH NODE ---
  private end_graph(state: typeof AutonomousGraphState): {
    plan: ParsedPlan;
    currentStepIndex: number;
    retry: number;
  } {
    logger.info('[EndGraph] 🏁 Cleaning up state for graph termination');
    const emptyPlan: ParsedPlan = {
      steps: [],
      summary: '',
    };
    return {
      plan: emptyPlan,
      currentStepIndex: 0,
      retry: 0,
    };
  }

  // --- Prompt Building ---
  private buildSystemPrompt(
    state: typeof AutonomousGraphState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): ChatPromptTemplate {
    const currentStep = state.plan.steps[state.currentStepIndex];
    let systemPrompt;
    let contextPrompt;
    if (state.retry === 0) {
      if (currentStep.type === 'tools') {
        systemPrompt = TOOLS_STEP_EXECUTOR_SYSTEM_PROMPT;
      } else {
        systemPrompt = MESSAGE_STEP_EXECUTOR_SYSTEM_PROMPT;
      }
      contextPrompt = STEP_EXECUTOR_CONTEXT_PROMPT;
    } else {
      if (currentStep.type === 'tools') {
        systemPrompt = RETRY_TOOLS_STEP_EXECUTOR_SYSTEM_PROMPT;
      } else {
        systemPrompt = RETRY_MESSAGE_STEP_EXECUTOR_SYSTEM_PROMPT;
      }
      contextPrompt = RETRY_STEP_EXECUTOR_CONTEXT_PROMPT;
    }
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      ['ai', contextPrompt],
    ]);
    return prompt;
  }

  // --- Model Invocation ---
  private async invokeModelWithMessages(
    state: typeof AutonomousGraphState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>,
    filteredMessages: BaseMessage[],
    prompt: ChatPromptTemplate
  ): Promise<AIMessageChunk> {
    const currentStep = state.plan.steps[state.currentStepIndex];
    const execution_context = formatExecutionMessage(currentStep);
    const format_short_term_memory = formatShortMemoryMessage(state.plan);
    const formattedPrompt = await prompt.formatMessages({
      rejected_reason: Array.isArray(state.last_message)
        ? state.last_message[0].content
        : (state.last_message as BaseMessage).content,
      short_term_memory: format_short_term_memory,
      long_term_memory: '',
      execution_context: execution_context,
    });

    const selectedModelType =
      await this.modelSelector!.selectModelForMessages(filteredMessages);
    let model;
    if (currentStep.type === 'tools') {
      model =
        typeof selectedModelType.model.bindTools === 'function'
          ? selectedModelType.model.bindTools(this.toolsList)
          : undefined;

      if (model === undefined) {
        throw new Error('Failed to bind tools to model');
      }
    } else {
      model = selectedModelType.model;
    }
    logger.debug(
      `[Executor] 🤖 Invoking model (${selectedModelType.model_name}) with ${currentStep.type} execution`
    );
    const result = await model.invoke(formattedPrompt);
    if (!result) {
      throw new Error(
        'Model invocation returned no result. Please check the model configuration.'
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
      state: typeof AutonomousGraphState.State,
      config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
    ): Promise<{
      messages: BaseMessage[];
      last_agent: Agent;
      last_message: BaseMessage | BaseMessage[];
      plan: ParsedPlan;
    } | null> => {
      return this.toolNodeInvoke(state, config, originalInvoke);
    };

    return toolNode;
  }

  private handleValidatorRouting(
    state: typeof AutonomousGraphState.State
  ): 're_planner' | 'executor' | 'end' | 'adaptive_planner' {
    try {
      logger.debug(
        `[ValidatorRouter] 🚦 Processing routing for ${state.last_agent}`
      );

      if (state.last_agent === Agent.PLANNER_VALIDATOR) {
        const lastAiMessage = state.last_message as BaseMessage;
        if (lastAiMessage.additional_kwargs.error === true) {
          logger.error(
            '[ValidatorRouter] ❌ Error found in validator messages'
          );
          return 'end';
        }
        if (lastAiMessage.additional_kwargs.from != 'planner_validator') {
          throw new Error(
            'Last AI message is not from planner_validator - check graph edges configuration'
          );
        }
        if (lastAiMessage.additional_kwargs.success) {
          logger.info('[ValidatorRouter] ✅ Plan success, routing to executor');
          return 'executor';
        } else if (
          lastAiMessage.additional_kwargs.success === false &&
          state.retry <= 3
        ) {
          logger.info(
            `[ValidatorRouter] 🔄 Plan validation failed (retry ${state.retry}/3), routing to re-planner`
          );
          return 're_planner';
        }
        logger.warn(
          '[ValidatorRouter] ⚠️ Max retries exceeded, routing to end'
        );
        return 'end';
      }

      if (state.last_agent === Agent.EXEC_VALIDATOR) {
        const lastAiMessage = state.last_message as BaseMessage;
        if (
          !lastAiMessage ||
          lastAiMessage.additional_kwargs.from != 'exec_validator'
        ) {
          throw new Error(
            'Last AI message is not from exec_validator - check graph edges configuration'
          );
        }
        if (lastAiMessage.additional_kwargs.final === true) {
          logger.info(
            '[ValidatorRouter] 🎯 Last step of plan reached, routing to ADAPTIVE_PLANNER'
          );
          return 'adaptive_planner';
        }
        if (state.retry >= 3) {
          logger.warn(
            `[ValidatorRouter] ⚠️ Max retries (${state.retry}) exceeded for step execution, routing to end`
          );
          return 'end';
        }
        logger.info(
          '[ValidatorRouter] 🔄 Step requires execution/retry, routing to executor'
        );
        return 'executor';
      }

      logger.warn(
        '[ValidatorRouter] ⚠️ Unknown agent state, defaulting to end'
      );
      return 'end';
    } catch (error) {
      logger.error(
        `[ValidatorRouter] ❌ Routing logic error: ${error.message}`
      );
      return 'end';
    }
  }

  private shouldContinue(
    state: typeof AutonomousGraphState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): 'tools' | 'validator' | 'human' | 'end' | 're_planner' {
    if (config.configurable?.agent_config?.mode === AgentMode.HYBRID) {
      return this.shouldContinueHybrid(state, config);
    } else {
      return this.shouldContinueAutonomous(state, config);
    }
  }

  private shouldContinueAutonomous(
    state: typeof AutonomousGraphState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): 'tools' | 'validator' | 'end' | 're_planner' {
    if (state.last_agent === Agent.EXECUTOR) {
      const lastAiMessage = state.last_message as AIMessageChunk;
      if (isTerminalMessage(lastAiMessage)) {
        logger.info(`[Router] 🏁 Final message received, routing to end node`);
        return 'end';
      }
      if (lastAiMessage.content.toLocaleString().includes('REQUEST_REPLAN')) {
        logger.debug(
          '[Router] 🔄 REQUEST_REPLAN detected, routing to re_planner'
        );
        return 're_planner';
      }
      if (lastAiMessage.tool_calls?.length) {
        logger.debug(
          `[Router] 🔧 Detected ${lastAiMessage.tool_calls.length} tool calls, routing to tools node`
        );
        return 'tools';
      }
    } else if (state.last_agent === Agent.TOOLS) {
      const maxSteps = config.configurable?.max_graph_steps ?? 100;
      if (maxSteps <= state.currentGraphStep) {
        logger.warn('[Router] ⚠️ Max graph steps reached, routing to END node');
        return 'end';
      } else {
        return 'validator';
      }
    }
    logger.debug('[Router] 🔍 Routing to validator');
    return 'validator';
  }

  private shouldContinueHybrid(
    state: typeof AutonomousGraphState.State,
    config?: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): 'tools' | 'validator' | 'end' | 'human' {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];

    if (lastMessage instanceof AIMessageChunk) {
      if (
        lastMessage.additional_kwargs.final === true ||
        lastMessage.content.toString().includes('FINAL ANSWER')
      ) {
        logger.info(`[Router] 🏁 Final message received, routing to end node`);
        return 'end';
      }
      if (
        state.plan.steps[state.currentStepIndex].type === 'human_in_the_loop'
      ) {
        return 'human';
      }
      if (lastMessage.tool_calls?.length) {
        logger.debug(
          `[Router] 🔧 Detected ${lastMessage.tool_calls.length} tool calls, routing to tools node`
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
        logger.info(`[Tools] 🏁 Max steps reached, routing to end node`);
        return 'end';
      }

      logger.debug(
        `[Router] 🔍 Received ToolMessage, routing back to validator node`
      );
      return 'validator';
    }
    logger.info('[Router] 🔍 Routing to validator');
    return 'validator';
  }

  private async summarizeMessages(
    state: typeof AutonomousGraphState.State,
    config?: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): Promise<{ messages?: BaseMessage[] }> {
    if (state.messages.length < 10) {
      logger.debug('[Summarizer] 📊 Not enough data to summarize');
      return {};
    }

    logger.debug(
      `[Summarizer] 📋 Summarizing ${state.messages.length} messages`
    );

    const model = this.modelSelector?.getModels()['fast'];
    if (!model) {
      throw new Error('Model not found in ModelSelector');
    }

    let totalTokens = 0;
    const messages = state.messages;
    let filteredContent: Array<string> = [];
    let iterationContent: Array<string> = [];
    let iterationCount = 0;

    for (let i = 0; i < state.messages.length; i++) {
      if (messages[i]?.response_metadata?.usage?.completion_tokens) {
        totalTokens += messages[i].response_metadata.usage.completion_tokens;
      } else {
        totalTokens += 0;
      }

      if (messages[i].additional_kwargs.from === Agent.EXECUTOR) {
        if (iterationCount != 0) {
          if (totalTokens <= 11000) {
            filteredContent = filteredContent.concat(iterationContent);
            iterationContent = [];
          } else {
            break;
          }
        }
        iterationContent.push(
          `AI Message Result: ${messages[i].content.toLocaleString()}`
        );
        iterationCount++;
      } else if (messages[i].additional_kwargs.from === Agent.TOOLS) {
        iterationContent.push(
          `Tool Message Result: ${messages[i].content.toLocaleString()}`
        );
      }
    }
    filteredContent = filteredContent.concat(iterationContent);

    const systemPrompt = SUMMARIZE_AGENT;
    const prompt = ChatPromptTemplate.fromMessages([['system', systemPrompt]]);

    const result = await model.invoke(
      await prompt.formatMessages({
        messagesContent: filteredContent.join('\n'),
      })
    );

    result.additional_kwargs = {
      from: Agent.SUMMARIZE,
      final: false,
    };

    const newMessages: BaseMessage[] = [];
    for (let i = 0; i < state.messages.length; i++) {
      if (
        messages[i].additional_kwargs.from === Agent.EXECUTOR ||
        messages[i].additional_kwargs.from === Agent.TOOLS ||
        messages[i].additional_kwargs.from === Agent.SUMMARIZE
      ) {
        continue;
      } else {
        newMessages.push(messages[i]);
      }
    }
    newMessages.push(result);
    return { messages: newMessages };
  }

  private getCompileOptions(): {
    checkpointer?: MemorySaver;
    configurable?: Record<string, any>;
  } {
    const baseOptions = this.agentConfig.memory
      ? {
          checkpointer: this.checkpointer,
        }
      : {};

    // Ajouter les configurables depuis votre annotation
    return {
      ...baseOptions,
      configurable: {
        max_graph_steps: 100,
        short_term_memory: 7,
        memory_size: 20,
        human_in_the_loop: false,
        agent_config: this.agentConfig,
      },
    };
  }

  private buildWorkflow(): StateGraph<
    typeof AutonomousGraphState.State,
    typeof AutonomousConfigurableAnnotation.State
  > {
    const toolNode = this.createToolNode();
    if (!this.memoryAgent) {
      throw new Error('MemoryAgent is not setup');
    }
    console.log('hELLO');
    const memory = new MemoryGraph(
      this.agentConfig,
      this.modelSelector,
      this.memoryAgent
    );

    memory.createGraphMemory();
    const memory_graph = memory.getMemoryGraph();
    const workflow = new StateGraph(
      AutonomousGraphState,
      AutonomousConfigurableAnnotation
    )
      .addNode('memory', memory_graph)
      .addNode('plan_node', this.planExecution.bind(this))
      .addNode('validator', this.validator.bind(this))
      .addNode('executor', this.callModel.bind(this))
      .addNode('summarize', this.summarizeMessages.bind(this))
      .addNode('human', this.humanNode.bind(this))
      .addNode('adaptive_planner', this.adaptivePlanner.bind(this))
      .addNode('end_graph', this.end_graph.bind(this))
      .addNode('tools', toolNode)
      .addEdge('__start__', 'plan_node')
      .addEdge('plan_node', 'validator')
      .addEdge('end_graph', END)
      .addEdge('adaptive_planner', 'executor');

    workflow.addConditionalEdges(
      'validator',
      this.handleValidatorRouting.bind(this),
      {
        re_planner: 'plan_node',
        executor: 'memory',
        adaptive_planner: 'adaptive_planner',
        end: 'end_graph',
      }
    );

    workflow.addConditionalEdges('executor', this.shouldContinue.bind(this), {
      validator: 'validator',
      human: 'human',
      tools: 'tools',
      re_planner: 'plan_node',
      adaptive_planner: 'adaptive_planner',
      end: 'end_graph',
    });

    workflow.addConditionalEdges('tools', this.shouldContinue.bind(this), {
      validator: 'validator',
      end: 'end_graph',
    });

    workflow.addEdge('human', 'validator');

    workflow.addConditionalEdges(
      'memory',
      (state: typeof AutonomousGraphState.State) => {
        const total_tokens = calculateTotalTokenFromSteps(state.plan.steps);
        logger.debug(`[SummarizeAgent] : TotalTokens : ${total_tokens}`);
        if (total_tokens >= 100000) {
          return 'summarize';
        }
        return 'executor';
      },
      {
        summarize: 'summarize',
        executor: 'executor',
      }
    );

    workflow.addEdge('summarize', 'executor');

    return workflow as unknown as StateGraph<
      typeof AutonomousGraphState.State,
      typeof AutonomousConfigurableAnnotation.State
    >;
  }

  async initialize(): Promise<AgentReturn> {
    try {
      // Get agent configuration
      this.agentConfig = this.snakAgent.getAgentConfig();
      if (!this.agentConfig) {
        throw new Error('Agent configuration is required');
      }

      // Initialize database
      await initializeDatabase(this.snakAgent.getDatabaseCredentials());

      // Initialize tools
      this.toolsList = await initializeToolsList(
        this.snakAgent,
        this.agentConfig
      );

      // Initialize memory agent if enabled
      await this.initializeMemoryAgent();

      // Initialize RAG agent if enabled
      if (this.agentConfig.rag?.enabled !== false) {
        await this.initializeRagAgent();
      }

      // Build and compile the workflow
      const workflow = this.buildWorkflow();
      this.app = workflow.compile(this.getCompileOptions());

      logger.info(
        '[AutonomousAgent] ✅ Successfully initialized autonomous agent'
      );

      return {
        app: this.app,
        agent_config: this.agentConfig,
      };
    } catch (error) {
      logger.error(
        '[AutonomousAgent] ❌ Failed to create autonomous agent:',
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
