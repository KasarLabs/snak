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
  planPrompt,
  PromptPlanInteractive,
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
import { AnyZodObject } from 'zod';

export interface StepInfo {
  stepNumber: number;
  stepName: string;
  checkpoint?: string;
  status: 'pending' | 'completed' | 'failed';
  metadata?: any;
}

export interface ParsedPlan {
  steps: StepInfo[];
  checkpoints: string[];
  rawResponse: string;
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

  // Define GraphState as a class property for better type safety
  private GraphState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
      reducer: (x, y) => x.concat(y),
    }),
    memories: Annotation<string>,
    rag: Annotation<string>,
    plan: Annotation<ParsedPlan>,
    stepHistory: Annotation<StepInfo[]>({
      reducer: (x, y) => x.concat(y),
      default: () => [],
    }),
    currentStep: Annotation<StepInfo>({
      reducer: (x: StepInfo, y: StepInfo): StepInfo => y,
      default: () => ({
        stepNumber: 0,
        stepName: 'initialization',
        status: 'pending',
      }),
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
    let workflow = new StateGraph(this.GraphState)
      .addNode('agent', this.callModel.bind(this))
      .addNode('tools', toolNode)
      .addNode('plan_node', this.planExecution.bind(this))
      .addNode('update_graph', this.updateGraph.bind(this))
      .addEdge('__start__', 'plan_node');

    // Add memory and RAG nodes based on configuration
    if (this.agent_config.memory && this.memoryAgent) {
      console.log('Memory on');
      workflow
        .addNode('memory', this.memoryAgent.createMemoryNode())
        .addEdge('plan_node', 'memory')
        .addEdge('tools', 'memory');

      if (this.ragAgent) {
        console.log('rag agent on');
        workflow = (workflow as any)
          .addNode('ragNode', this.ragAgent.createRagNode(this.agent_config.id))
          .addEdge('memory', 'ragNode')
          .addEdge('ragNode', 'agent');
      } else {
        workflow = (workflow as any).addEdge('memory', 'agent');
      }
    } else if (this.ragAgent) {
      console.log('rag agent on without memory');
      workflow
        .addNode('ragNode', this.ragAgent.createRagNode(this.agent_config.id))
        .addEdge('plan_node', 'ragNode')
        .addEdge('ragNode', 'agent');
    } else {
      console.warn(
        'No memory or rag agent available, starting directly with the agent node.'
      );
      workflow.addEdge('plan_node', 'agent');
      workflow.addEdge('tools', 'agent');
    }

    // Add final edges
    workflow.addEdge('agent', 'update_graph');
    workflow.addConditionalEdges(
      'update_graph',
      this.shouldContinue.bind(this),
      {
        tools: 'tools',
        agent: 'agent',
        end: END,
      }
    );

    return workflow;
  }

  private createToolNode(): ToolNode {
    const toolNode = new ToolNode(this.toolsList);
    const originalInvoke = toolNode.invoke.bind(toolNode);

    // Override invoke method
    toolNode.invoke = async (
      state: typeof this.GraphState.State,
      config?: LangGraphRunnableConfig
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

  private async planExecution(state: typeof this.GraphState.State): Promise<{
    messages: BaseMessage[];
    plan: ParsedPlan;
  }> {
    try {
      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('Model not found in ModelSelector');
      }

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

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', planPrompt(originalUserQuery)],
        new MessagesPlaceholder('messages'),
      ]);

      const result = await model.invoke(
        await prompt.formatMessages({ messages: filteredMessages })
      );

      return {
        messages: [result],
        plan: this.parsePlanResponse(result.content.toString()),
      };
    } catch (error) {
      logger.error(`Error in planExecution: ${error}`);
      throw error;
    }
  }

  private parsePlanResponse(response: string): ParsedPlan {
    const steps: StepInfo[] = [];
    const checkpoints: string[] = [];
    const cleanedResponse = response.trim();

    // Extract steps section
    const stepsMatch = cleanedResponse.match(
      /SOLUTION PLAN:([\s\S]*?)(?=Checkpoints:|$)/i
    );
    const checkpointsMatch = cleanedResponse.match(/Checkpoints:([\s\S]*?)$/i);

    if (stepsMatch) {
      const stepsSection = stepsMatch[1].trim();
      const stepRegex =
        /Step\s+(\d+):\s*([^-]+)\s*-\s*(.+?)(?=Step\s+\d+:|$)/gis;
      let match;

      while ((match = stepRegex.exec(stepsSection)) !== null) {
        const stepNumber = parseInt(match[1]);
        const action = match[2].trim();
        const description = match[3].trim();

        steps.push({
          stepNumber,
          stepName: `${action} - ${description}`,
          status: 'pending',
          metadata: {
            action,
            description,
            originalText: match[0],
          },
        });
      }
    }

    // Parse checkpoints
    if (checkpointsMatch) {
      const checkpointsSection = checkpointsMatch[1].trim();
      const checkpointLines = checkpointsSection
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('-'))
        .map((line) => line.substring(1).trim());

      checkpoints.push(...checkpointLines);

      // Associate checkpoints with steps
      checkpointLines.forEach((checkpoint) => {
        const stepMatch = checkpoint.match(/(?:After\s+)?step\s+(\d+):/i);
        if (stepMatch) {
          const stepNum = parseInt(stepMatch[1]);
          const step = steps.find((s) => s.stepNumber === stepNum);
          if (step) {
            step.checkpoint = checkpoint;
          }
        }
      });
    }

    return {
      steps,
      checkpoints,
      rawResponse: cleanedResponse,
    };
  }

  private async callModel(
    state: typeof this.GraphState.State,
    config?: RunnableConfig
  ): Promise<{ messages: BaseMessage[] }> {
    if (!this.agent_config || !this.modelSelector) {
      throw new Error('Agent configuration and ModelSelector are required.');
    }

    const maxGraphSteps = config?.configurable?.config.max_graph_steps;
    const shortTermMemory = config?.configurable?.config.short_term_memory;
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];

    // Determine iteration number
    let iteration_number = this.calculateIterationNumber(
      state.messages,
      lastMessage
    );

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
    const autonomousSystemPrompt = this.buildSystemPrompt(state);

    try {
      // Filter messages and invoke model
      const filteredMessages = this.filterMessagesByShortTermMemory(
        state.messages,
        iteration_number,
        shortTermMemory
      );

      const result = await this.invokeModelWithMessages(
        filteredMessages,
        autonomousSystemPrompt,
        startIteration,
        iteration_number
      );

      return { messages: [result] };
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
      state.currentStep,
      state.stepHistory,
      state.plan.rawResponse
    );

    return `
      ${this.agent_config.prompt.content}
      ${rules}
      
      Available tools: ${this.toolsList.map((tool) => tool.name).join(', ')}`;
  }

  private shouldContinue(
    state: typeof this.GraphState.State,
    config?: RunnableConfig
  ): 'tools' | 'agent' | 'end' {
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
    return 'agent';
  }

  private isTerminalMessage(message: AIMessageChunk): boolean {
    return (
      message.additional_kwargs.final === true ||
      message.content.toString().includes('FINAL ANSWER') ||
      message.content.toString().includes('PLAN_COMPLETED')
    );
  }

  private handleToolMessageRouting(
    messages: BaseMessage[],
    config?: RunnableConfig
  ): 'agent' | 'end' {
    const lastAiMessage = this.getLatestMessageForMessage(
      messages,
      AIMessageChunk
    );
    if (!lastAiMessage) {
      throw new Error('Error trying to get last AIMessageChunk');
    }

    const graphMaxSteps = config?.configurable?.config
      .max_graph_steps as number;
    const iteration = this.getLatestMessageForMessage(messages, ToolMessage)
      ?.additional_kwargs?.iteration_number as number;

    if (graphMaxSteps <= iteration) {
      logger.info(`Tools: Final message received, routing to end node.`);
      return 'end';
    }

    logger.debug('Received ToolMessage, routing back to agent node.');
    return 'agent';
  }

  private updateGraph(state: typeof this.GraphState.State): {
    currentStep?: StepInfo;
    stepHistory?: StepInfo[];
  } {
    const lastAiMessage = this.getLatestMessageForMessage(
      state.messages,
      AIMessageChunk
    );

    if (!(lastAiMessage instanceof AIMessageChunk)) {
      logger.warn(
        'Last message is not an AIMessage, skipping graph update check.'
      );
      return {
        currentStep: state.currentStep,
        stepHistory: state.stepHistory,
      };
    }

    const lastMessageContent = lastAiMessage.content.toString();
    const currentStep = state.currentStep;

    if (lastMessageContent.includes('STEP_COMPLETED')) {
      logger.warn(
        `Graph State has been updated during the step ${currentStep.stepName}`
      );

      const next_step_id = Math.min(
        currentStep.stepNumber + 1,
        state.plan.steps.length - 1
      );

      const nextStep = state.plan.steps[next_step_id];
      console.log(JSON.stringify(next_step_id));

      return {
        currentStep: nextStep,
        stepHistory: [state.currentStep],
      };
    }

    return {
      currentStep: state.currentStep,
      stepHistory: [],
    };
  }

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
    config: RunnableConfig | undefined,
    messages: BaseMessage[]
  ): number {
    if ((config?.metadata?.langgraph_step as number) === 1) {
      return 1;
    } else if (
      Array.isArray(config?.metadata?.langgraph_triggers) &&
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
    autonomousSystemPrompt: string,
    startIteration: number,
    iteration_number: number
  ): Promise<AIMessageChunk> {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', autonomousSystemPrompt],
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
      from: 'autonomous-agent',
      final: false,
      start_iteration: startIteration,
      iteration_number: iteration_number,
    };

    return result;
  }

  private createMaxIterationsResponse(iteration_number: number): {
    messages: BaseMessage[];
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
    };
  }

  private handleModelError(error: any): { messages: BaseMessage[] } {
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
