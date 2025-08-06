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
  ADAPTIVE_PLANNER_CONTEXT,
  ADAPTIVE_PLANNER_SYSTEM_PROMPT,
  AUTONOMOUS_PLAN_EXECUTOR_SYSTEM_PROMPT,
  STEP_EXECUTOR_SYSTEM_PROMPT,
  REPLAN_EXECUTOR_SYSTEM_PROMPT,
  STEPS_VALIDATOR_SYSTEM_PROMPT,
  RETRY_EXECUTOR_SYSTEM_PROMPT,
  STEP_EXECUTOR_CONTEXT,
  RETRY_CONTENT,
  AUTONOMOUS_PLAN_VALIDATOR_SYSTEM_PROMPT,
  SummarizeAgent,
  HYBRID_PLAN_EXECUTOR_SYSTEM_PROMPT,
} from '../../prompt/prompts.js';
import { TokenTracker } from '../../token/tokenTracking.js';
import { RunnableConfig } from '@langchain/core/runnables';
import { MemoryAgent } from 'agents/operators/memoryAgent.js';
import { RagAgent } from 'agents/operators/ragAgent.js';
import { Agent, AgentReturn, ParsedPlan, StepInfo } from './types/index.js';
import {
  createMaxIterationsResponse,
  filterMessagesByShortTermMemory,
  formatParsedPlanSimple,
  getLatestMessageForMessage,
  handleModelError,
  isTerminalMessage,
} from './utils.js';

export class AutonomousAgent {
  private agentConfig: AgentConfig;
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
  });

  private GraphState = Annotation.Root({
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
    state: typeof this.GraphState.State,
    config: RunnableConfig<typeof this.ConfigurableAnnotation.State>
  ): Promise<{
    last_message: BaseMessage;
    last_agent: Agent;
    plan: ParsedPlan;
    currentGraphStep: number;
  }> {
    try {
      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('Model not found in ModelSelector');
      }

      const StepInfoSchema = z.object({
        stepNumber: z.number().int().min(1).max(100).describe('Step number'),
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
          .describe('Result of the tools need to be empty'),
      });

      const PlanSchema = z.object({
        steps: z
          .array(StepInfoSchema)
          .min(1)
          .max(20)
          .describe('Array of steps to complete the task'),
        summary: z
          .string()
          .describe('Brief summary of the overall plan')
          .default(''),
      });

      const structuredModel = model.withStructuredOutput(PlanSchema);

      const filteredMessages = filterMessagesByShortTermMemory(
        state.messages,
        config.configurable?.short_term_memory ?? 10
      );

      const systemPrompt = ADAPTIVE_PLANNER_SYSTEM_PROMPT;
      const context: string = ADAPTIVE_PLANNER_CONTEXT;
      const promptAgentConfig = this.agentConfig.prompt;
      const availableTools = this.toolsList
        .map((tool: any) => tool.name)
        .join(', ');
      const lastStepResult = state.plan.steps
        .map(
          (step: StepInfo) =>
            `Step ${step.stepNumber}: ${step.stepName} | Result: ${step.result} | Status: ${step.status}`
        )
        .join('\n');

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', systemPrompt],
        ['ai', context],
        new MessagesPlaceholder('messages'),
      ]);

      const structuredResult = await structuredModel.invoke(
        await prompt.formatMessages({
          stepLength: state.currentStepIndex + 1,
          agent_config: promptAgentConfig,
          toolsList: availableTools,
          lastStepResult: lastStepResult,
          messages: filteredMessages,
        })
      );

      logger.info(
        `[AdaptivePlanner] 📋 Created plan with ${structuredResult.steps.length} steps`
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

      const errorPlan: ParsedPlan = {
        steps: [
          {
            stepNumber: 0,
            result: '',
            stepName: 'Error',
            description: 'Error trying to create the plan',
            status: 'failed',
            type: 'message',
          },
        ],
        summary: 'Error',
      };

      return {
        last_message: errorMessage,
        last_agent: Agent.PLANNER,
        plan: errorPlan,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  private async planExecution(
    state: typeof this.GraphState.State,
    config: RunnableConfig<typeof this.ConfigurableAnnotation.State>
  ): Promise<{
    last_message: BaseMessage;
    last_agent: Agent;
    plan: ParsedPlan;
    currentStepIndex: number;
    currentGraphStep: number;
  }> {
    try {
      logger.info('[Planner] 🚀 Starting plan execution');
      const lastAiMessage = state.last_message as BaseMessage;

      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('Model not found in ModelSelector');
      }

      const StepInfoSchema = z.object({
        stepNumber: z.number().int().min(1).max(100).describe('Step number'),
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
        type: z
          .enum(['tools', 'message', 'human_in_the_loop'])
          .describe('What type of steps is this'),
        result: z
          .string()
          .default('')
          .describe('Result of the tools need to be empty'),
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

      const filteredMessages = filterMessagesByShortTermMemory(
        state.messages,
        config.configurable?.short_term_memory ?? 10
      );

      let systemPrompt;
      let lastContent;

      if (
        lastAiMessage &&
        state.last_agent === (Agent.PLANNER_VALIDATOR || Agent.EXECUTOR) &&
        lastAiMessage
      ) {
        logger.debug(
          '[Planner] 🔄 Creating re-plan based on validator feedback'
        );
        systemPrompt = REPLAN_EXECUTOR_SYSTEM_PROMPT;
        lastContent = lastAiMessage.content;
      } else if (config.configurable?.human_in_the_loop === true) {
        systemPrompt = HYBRID_PLAN_EXECUTOR_SYSTEM_PROMPT;
        lastContent = '';
      } else {
        logger.debug('[Planner] 📝 Creating initial plan');
        systemPrompt = AUTONOMOUS_PLAN_EXECUTOR_SYSTEM_PROMPT;
        lastContent = '';
      }

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', systemPrompt],
        new MessagesPlaceholder('messages'),
      ]);

      const structuredResult = await structuredModel.invoke(
        await prompt.formatMessages({
          messages: filteredMessages,
          agentConfig: this.agentConfig.prompt,
          toolsAvailable: this.toolsList.map((tool) => tool.name).join(', '),
          formatPlan: formatParsedPlanSimple(state.plan),
          lastAiMessage: lastContent,
        })
      );

      logger.info(
        `[Planner] ✅ Successfully created plan with ${structuredResult.steps.length} steps`
      );

      const aiMessage = new AIMessageChunk({
        content: `Plan created with ${structuredResult.steps.length} steps:\n${structuredResult.steps
          .map((s) => `${s.stepNumber}. ${s.stepName}: ${s.description}`)
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

      const errorPlan: ParsedPlan = {
        steps: [
          {
            stepNumber: 0,
            stepName: 'Error',
            description: 'Error trying to create the plan',
            status: 'failed',
            result: '',
            type: 'message',
          },
        ],
        summary: 'Error',
      };

      return {
        last_message: errorMessage,
        last_agent: Agent.PLANNER,
        plan: errorPlan,
        currentStepIndex: 0,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
  }

  // --- VALIDATOR NODE ---
  private async validator(state: typeof this.GraphState.State): Promise<{
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
      return await this.validatorPlanner(state);
    } else if (state.last_agent === Agent.EXECUTOR) {
      return await this.validatorExecutor(state);
    } else {
      return await this.validatorExecutor(state);
    }
  }

  private async validatorPlanner(state: typeof this.GraphState.State): Promise<{
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
      const systemPrompt = AUTONOMOUS_PLAN_VALIDATOR_SYSTEM_PROMPT;

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', systemPrompt],
      ]);

      const structuredResult = await structuredModel.invoke(
        await prompt.formatMessages({
          agentConfig: this.agentConfig.prompt,
          currentPlan: planDescription,
        })
      );

      if (structuredResult.isValidated) {
        const successMessage = new AIMessageChunk({
          content: `Plan validated: ${structuredResult.description}`,
          additional_kwargs: {
            error: false,
            validated: true,
            from: Agent.PLANNER_VALIDATOR,
          },
        });
        logger.info(`[PlannerValidator] ✅ Plan validated successfully`);
        return {
          last_message: successMessage,
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
          `[PlannerValidator] ⚠️ Plan validation failed: ${structuredResult.description}`
        );
        return {
          last_message: errorMessage,
          currentStepIndex: state.currentStepIndex,
          last_agent: Agent.PLANNER_VALIDATOR,
          retry: state.retry + 1,
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
          validated: false,
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
    state: typeof this.GraphState.State
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
      const lastMessage = state.last_message;

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
        final: z
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

      let validationContent: String;
      if (
        lastMessage instanceof ToolMessage ||
        (Array.isArray(lastMessage) &&
          lastMessage.every((msg) => msg instanceof ToolMessage))
      ) {
        const lastMessageContent = Array.isArray(lastMessage)
          ? lastMessage.map((msg) => msg.content).join('\n')
          : lastMessage.content;

        logger.debug('[ExecutorValidator] 🔧 Validating tool execution');

        validationContent = `VALIDATION_TYPE: TOOL_EXECUTION_MODE
TOOL_CALL EXECUTED: ${
          Array.isArray(lastMessage)
            ? lastMessage.map((msg) => msg.name).join(', ')
            : lastMessage.name
        }
TOOL_CALL RESPONSE TO ANALYZE: ${
          Array.isArray(lastMessage)
            ? JSON.stringify(
                lastMessage.map((msg) => ({
                  tool_call: {
                    response: lastMessageContent,
                    name: msg.name,
                    tool_call_id: msg.tool_call_id,
                  },
                }))
              )
            : JSON.stringify({
                tool_call: {
                  response: lastMessageContent,
                  name: lastMessage.name,
                  tool_call_id: lastMessage.tool_call_id,
                },
              })
        }`;
      } else {
        logger.debug('[ExecutorValidator] 💬 Validating AI response');
        validationContent = `VALIDATION_TYPE: AI_RESPONSE_MODE
AI_MESSAGE TO ANALYZE: ${(lastMessage as BaseMessage).content.toString()}`;
      }

      const structuredResult = await structuredModel.invoke([
        {
          role: 'system',
          content: STEPS_VALIDATOR_SYSTEM_PROMPT,
        },
        {
          role: 'assistant',
          content: `USER REQUEST:
"${originalUserQuery}"

STEP TO VALIDATE:
Name: ${state.plan.steps[state.currentStepIndex].stepName}
Description: ${state.plan.steps[state.currentStepIndex].description}

${validationContent}`,
        },
      ]);

      if (structuredResult.validated === true) {
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
            `[ExecutorValidator] ✅ Step ${state.currentStepIndex + 1} validated successfully`
          );
          const message = new AIMessageChunk({
            content: `Step ${state.currentStepIndex + 1} has been validated`,
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
        `[ExecutorValidator] ⚠️ Step ${state.currentStepIndex + 1} validation failed - Reason: ${structuredResult.reason}`
      );
      const notValidateMessage = new AIMessageChunk({
        content: `Step ${state.currentStepIndex + 1} not validated - Reason: ${structuredResult.reason}`,
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
          validated: false,
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
    state: typeof this.GraphState.State,
    config: RunnableConfig<typeof this.ConfigurableAnnotation.State>
  ): Promise<{
    last_message: BaseMessage;
    messages: BaseMessage;
    last_agent: Agent;
    plan?: ParsedPlan;
    currentGraphStep?: number;
  }> {
    if (!this.agentConfig || !this.modelSelector) {
      throw new Error('Agent configuration and ModelSelector are required.');
    }

    const currentStep = state.plan.steps[state.currentStepIndex];
    logger.info(
      `[Executor] 🔄 Processing step ${state.currentStepIndex + 1} - ${currentStep?.stepName}`
    );

    const maxGraphSteps = config.configurable?.max_graph_steps ?? 100;
    const shortTermMemory = config.configurable?.short_term_memory ?? 10;
    const humanInTheLoop = config.configurable?.human_in_the_loop;
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];

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

      const updatedPlan = state.plan;
      updatedPlan.steps[state.currentStepIndex].result =
        result.content.toLocaleString();

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
    state: typeof this.GraphState.State,
    config: LangGraphRunnableConfig | undefined,
    originalInvoke: Function
  ): Promise<{
    messages: BaseMessage[];
    last_message: BaseMessage[];
    last_agent: Agent;
  } | null> {
    const lastMessage = state.last_message;
    const lastgraphStep = state.currentGraphStep;

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
      const truncatedResult: { messages: [ToolMessage] } = truncateToolResults(
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

      return {
        ...truncatedResult,
        last_message: truncatedResult.messages,
        last_agent: Agent.TOOLS,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(
        `[Tools] ❌ Tool execution failed after ${executionTime}ms: ${error}`
      );
      throw error;
    }
  }

  public async humanNode(state: typeof this.GraphState.State): Promise<{
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
  private end_graph(state: typeof this.GraphState): {
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
    state: typeof this.GraphState.State,
    config: RunnableConfig<typeof this.ConfigurableAnnotation.State>
  ): string {
    const rules = STEP_EXECUTOR_SYSTEM_PROMPT;
    const availableTools = this.toolsList.map((tool) => tool.name).join(', ');

    return `
          ${this.agentConfig.prompt.content}
          ${rules}
          
          Available tools: ${availableTools}`;
  }

  // --- Model Invocation ---
  private async invokeModelWithMessages(
    state: typeof this.GraphState.State,
    config: RunnableConfig<typeof this.ConfigurableAnnotation.State>,
    filteredMessages: BaseMessage[],
    autonomousSystemPrompt: string
  ): Promise<AIMessageChunk> {
    const currentRetry = state.retry;
    const currentStep = state.plan.steps[state.currentStepIndex];
    const contextPrompt: string =
      currentRetry != 0 ? RETRY_CONTENT : STEP_EXECUTOR_CONTEXT;

    const systemPrompt = ChatPromptTemplate.fromMessages([
      ['system', autonomousSystemPrompt],
      ['ai', contextPrompt],
      new MessagesPlaceholder('messages'),
    ]);

    const availableTools = this.toolsList
      .map((tool: any) => tool.name)
      .join(', ');

    const retryPrompt: string =
      currentRetry != 0 ? RETRY_EXECUTOR_SYSTEM_PROMPT : '';

    const formattedPrompt = await systemPrompt.formatMessages({
      messages: filteredMessages,
      stepNumber: currentStep.stepNumber,
      stepName: currentStep.stepName,
      stepDescription: currentStep.description,
      retryPrompt: retryPrompt,
      toolsList: availableTools,
      retry: currentRetry,
      reason: Array.isArray(state.last_message)
        ? state.last_message[0].content
        : (state.last_message as BaseMessage).content,
      maxRetry: 3,
    });

    const selectedModelType =
      await this.modelSelector!.selectModelForMessages(filteredMessages);

    const boundModel =
      typeof selectedModelType.model.bindTools === 'function'
        ? selectedModelType.model.bindTools(this.toolsList)
        : undefined;

    if (boundModel === undefined) {
      throw new Error('Failed to bind tools to model');
    }

    logger.debug(
      `[Executor] 🤖 Invoking model (${selectedModelType.model_name}) with ${filteredMessages.length} messages`
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
    ): Promise<{
      messages: BaseMessage[];
      last_agent: Agent;
      last_message: BaseMessage | BaseMessage[];
    } | null> => {
      return this.toolNodeInvoke(state, config, originalInvoke);
    };

    return toolNode;
  }

  private handleValidatorRouting(
    state: typeof this.GraphState.State
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
        if (lastAiMessage.additional_kwargs.validated) {
          logger.info(
            '[ValidatorRouter] ✅ Plan validated, routing to executor'
          );
          return 'executor';
        } else if (
          lastAiMessage.additional_kwargs.validated === false &&
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
    state: typeof this.GraphState.State,
    config: RunnableConfig<typeof this.ConfigurableAnnotation.State>
  ): 'tools' | 'validator' | 'human' | 'end' | 're_planner' {
    if (config.configurable?.human_in_the_loop === true) {
      return this.shouldContinueHybrid(state, config);
    } else {
      return this.shouldContinueAutonomous(state, config);
    }
  }

  private shouldContinueAutonomous(
    state: typeof this.GraphState.State,
    config: RunnableConfig<typeof this.ConfigurableAnnotation.State>
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
    state: typeof this.GraphState.State,
    config?: RunnableConfig<typeof this.ConfigurableAnnotation.State>
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

    const systemPrompt = SummarizeAgent;
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

  private getCompileOptions(): any {
    return this.agentConfig.memory
      ? {
          checkpointer: this.checkpointer,
          configurable: {},
        }
      : {};
  }

  private buildWorkflow(): any {
    const toolNode = this.createToolNode();
    if (!this.memoryAgent) {
      throw new Error('MemoryAgent is not setup');
    }

    let workflow = new StateGraph(this.GraphState, this.ConfigurableAnnotation)
      .addNode('memory', this.memoryAgent.createMemoryNode())
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
      (state: typeof this.GraphState.State) => {
        if (state.messages.length < 10) {
          return 'executor';
        }
        return 'summarize';
      },
      {
        summarize: 'summarize',
        executor: 'executor',
      }
    );

    workflow.addEdge('summarize', 'executor');

    return workflow;
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
