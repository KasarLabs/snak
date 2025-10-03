import { AgentConfig, logger } from '@snakagent/core';
import {
  StateGraph,
  Annotation,
  END,
  CompiledStateGraph,
  START,
  Command,
} from '@langchain/langgraph';
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { SnakAgent } from '@agents/core/snakAgent.js';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { getSupervisorConfigTools } from '../../operators/supervisor/supervisorTools.js';
import {
  SUPERVISOR_SYSTEM_PROMPT,
  SUPERVISOR_MEMORY_PROMPT,
  SUPERVISOR_HUMAN_PROMPT,
} from '@prompts/agents/supervisor.prompts.js';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { AnyZodObject } from 'zod';
import { TaskExecutorNode } from '@enums/agent.enum.js';
import { Memories } from '@stypes/memory.types.js';
import { MemoryStateManager, STMManager } from '@lib/memory/index.js';

// Node enum for supervisor graph
enum SupervisorNode {
  SUPERVISOR = 'supervisor',
  TOOL_CALLING = 'tool_calling',
  END = '__end__',
}

// State Annotation
export const SupervisorGraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => {
      return y;
    },
    default: () => [],
  }),
  lastNode: Annotation<SupervisorNode>({
    reducer: (x, y) => y,
    default: () => SupervisorNode.SUPERVISOR,
  }),
  currentGraphStep: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 0,
  }),
  memories: Annotation<Memories>({
    reducer: (x, y) => y,
    default: () => MemoryStateManager.createInitialState(20),
  }),
  // Store the original user request for context
  user_request: Annotation<string>({
    reducer: (x, y) => y,
    default: () => '',
  }),
});

export type SupervisorGraphStateType = typeof SupervisorGraphState.State;

// Config Annotation
export const SupervisorGraphConfigurableAnnotation = Annotation.Root({
  thread_id: Annotation<string | undefined>({
    reducer: (x, y) => y,
    default: () => undefined,
  }),
  agent_config: Annotation<AgentConfig.Runtime | null>({
    reducer: (x, y) => y,
    default: () => null,
  }),
});

export type SupervisorGraphConfigurableType =
  typeof SupervisorGraphConfigurableAnnotation.State;

export class SupervisorGraph {
  private checkpointer: PostgresSaver;
  private app: CompiledStateGraph<any, any, any, any, any, any>;
  private config: typeof SupervisorGraphConfigurableAnnotation.State | null =
    null;
  private model: BaseChatModel;
  private toolsList: (
    | StructuredTool
    | Tool
    | DynamicStructuredTool<AnyZodObject>
  )[] = [];

  constructor(snakAgent: SnakAgent) {
    const pg_checkpointer = snakAgent.getPgCheckpointer();
    if (!pg_checkpointer) {
      throw new Error('Checkpointer is required for graph initialization');
    }
    this.checkpointer = pg_checkpointer;
    const agentConfig = snakAgent.getAgentConfig();
    // Initialize supervisor tools
    this.toolsList = getSupervisorConfigTools(agentConfig);
  }

  private async supervisor(
    state: typeof SupervisorGraphState.State,
    config: RunnableConfig<typeof SupervisorGraphConfigurableAnnotation.State>
  ): Promise<{
    messages: BaseMessage[];
    lastNode: SupervisorNode;
    currentGraphStep: number;
  }> {
    try {
      logger.info('[Supervisor] Processing user request');
      if (state.messages instanceof HumanMessage) {
        state.user_request = state.messages.content.toLocaleString();
      }
      if (!config.configurable?.agent_config) {
        throw new Error('Agent configuration is required');
      }

      // Build prompt template
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', SUPERVISOR_SYSTEM_PROMPT],
        ['ai', SUPERVISOR_MEMORY_PROMPT],
        ['human', SUPERVISOR_HUMAN_PROMPT],
      ]);

      // Format prompt with context
      const formattedPrompt = await prompt.formatMessages({
        agent_registry: '', // TODO: Add agent registry context
        tool_results: JSON.stringify(state.memories.stm.items),
        user_request: state.user_request,
      });

      // Bind tools to model
      const modelWithTools = this.model.bindTools!(this.toolsList);

      // Invoke model
      const aiMessage = await modelWithTools.invoke(formattedPrompt);
      logger.debug(
        `[Supervisor] Model returned ${aiMessage.tool_calls?.length || 0} tool calls`
      );
      return {
        messages: [aiMessage],
        lastNode: SupervisorNode.SUPERVISOR,
        currentGraphStep: state.currentGraphStep + 1,
      };
    } catch (error) {
      logger.error(`[Supervisor] Error processing request: ${error}`);
      throw error;
    }
  }

  private supervisorRouter(
    state: typeof SupervisorGraphState.State,
    config: RunnableConfig<typeof SupervisorGraphConfigurableAnnotation.State>
  ): SupervisorNode {
    logger.debug(`[Supervisor Router] Last node: ${state.lastNode}`);
          const lastMessage = state.messages[state.messages.length - 1];

    if (state.currentGraphStep >= 25) { // should create default configurable for supre
      logger.warn('[Supervisor Router] Max graph steps reached, routing to END');
      return SupervisorNode.END;
    }
    if (state.lastNode === SupervisorNode.SUPERVISOR) {

      // Check if we have tool calls
      if (
        (lastMessage instanceof AIMessage ||
          lastMessage instanceof AIMessageChunk) &&
        lastMessage.tool_calls &&
        lastMessage.tool_calls.length > 0
      ) {
        logger.debug('[Supervisor Router] Routing to tool_calling');
        for (const toolCall of lastMessage.tool_calls) {
          if (toolCall.name === 'end_task') {
            logger.debug('[Supervisor Router] Detected end_task tool call, routing to END');
            return SupervisorNode.END;
          }
        }
        return SupervisorNode.TOOL_CALLING;
      }
    }

    if (state.lastNode === SupervisorNode.TOOL_CALLING ) {
      // After tool calling, always return to supervisor for re-evaluation
      logger.debug('[Supervisor Router] Routing back to SUPERVISOR');
      return SupervisorNode.SUPERVISOR;
    }
    // Default: end the graph
    logger.debug('[Supervisor Router] Routing to END');
    return SupervisorNode.END;
  }

  private async toolNodeInvoke(
    state: typeof SupervisorGraphState.State,
    config: RunnableConfig<typeof SupervisorGraphConfigurableAnnotation.State>,
    originalInvoke: ToolNode['invoke']
  ): Promise<
    | {
        messages: BaseMessage[];
        lastNode: SupervisorNode;
        currentGraphStep: number;
        memories?: Memories;
      }
    | Command
    | null
  > {
      const startTime = Date.now();
      try {

        const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Tool execution timed out after 10000 ms`));
        }, 10000);
      });
      const executionPromise = originalInvoke(state, config);
      const tools: { messages: ToolMessage[] } = await Promise.race([
        executionPromise,
        timeoutPromise,
      ]);
      if (!tools || !tools.messages || tools.messages.length === 0) {
        logger.warn('[ToolNode Invoke] No tool messages returned');
        return {
          messages: state.messages,
          lastNode: SupervisorNode.TOOL_CALLING,
          currentGraphStep: state.currentGraphStep + 1,
        };
      }
      logger.info(
        `[ToolNode Invoke] Invoked ${tools.messages.length} tools`
      );
      tools.messages.forEach(async (tool) => {
        tool.additional_kwargs = {
          from: 'tools',
          final: tool.name === 'end_task' ? true : false,
        };
      });

      const newMemories = STMManager.updateMessageRecentMemory(
        state.memories.stm,
        tools.messages
      );
      if (!newMemories.success || !newMemories.data) {
        throw new Error(
          `Failed to update memory with tool results: ${newMemories.error}`
        );
      }
      state.memories.stm = newMemories.data;
      return {
        ...tools,
        lastNode: SupervisorNode.TOOL_CALLING,
        memories: state.memories,
        currentGraphStep: state.currentGraphStep + 1,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      if (error.message.includes('timed out')) {
        logger.error(`[Tools] Tool execution timed out after 10000 ms`);
      } else {
        logger.error(
          `[Tools] Tool execution failed after ${executionTime}ms: ${error}`
        );
      }
      // On error, return to supervisor for re-evaluation
      return {
        messages: state.messages,
        lastNode: SupervisorNode.TOOL_CALLING,
        currentGraphStep: state.currentGraphStep + 1,
      }
    }
  }

  private createToolNode(): ToolNode {
    const toolNode = new ToolNode(this.toolsList);
    const originalInvoke = toolNode.invoke.bind(toolNode);
    // Override invoke method
    toolNode.invoke = async (
      state: typeof SupervisorGraphState.State,
      config: RunnableConfig<typeof SupervisorGraphConfigurableAnnotation.State>
    ): Promise<
      | {
          messages: BaseMessage[];
          lastNode: SupervisorNode;
          currentGraphStep: number; 
          memories?: Memories;
        }
      | Command
      | null
    > => {
      return this.toolNodeInvoke(state, config, originalInvoke);
    };

    return toolNode;
  }

  private buildWorkflow(): StateGraph<
    typeof SupervisorGraphState.State,
    typeof SupervisorGraphConfigurableAnnotation.State
  > {
    logger.debug('[SupervisorGraph] Building workflow');

    // Create tool node
    const toolNode = this.createToolNode();

    const workflow = new StateGraph(
      SupervisorGraphState,
      SupervisorGraphConfigurableAnnotation
    )
      .addNode(SupervisorNode.SUPERVISOR, this.supervisor.bind(this))
      .addNode(SupervisorNode.TOOL_CALLING, toolNode)
      .addEdge(START, SupervisorNode.SUPERVISOR)
      .addConditionalEdges(
        SupervisorNode.SUPERVISOR,
        this.supervisorRouter.bind(this)
      )
      .addConditionalEdges(
        SupervisorNode.TOOL_CALLING,
        this.supervisorRouter.bind(this)
      );

    return workflow as unknown as StateGraph<
      typeof SupervisorGraphState.State,
      typeof SupervisorGraphConfigurableAnnotation.State
    >;
  }

  async initialize(): Promise<CompiledStateGraph<any, any, any, any, any>> {
    try {
      logger.info('[SupervisorGraph] Initializing supervisor graph');

      // Build and compile the workflow
      const workflow = this.buildWorkflow();
      this.app = workflow.compile();

      logger.info(
        '[SupervisorGraph] Successfully initialized supervisor graph'
      );
      return this.app;
    } catch (error) {
      logger.error(
        '[SupervisorGraph] Failed to create supervisor graph:',
        error
      );
      throw error;
    }
  }

  public updateConfig(
    newConfig: typeof SupervisorGraphConfigurableAnnotation.State
  ): void {
    if (!this.app) {
      throw new Error(
        'Supervisor graph not initialized. Call initialize() first.'
      );
    }
    this.config = newConfig;
    logger.debug('[SupervisorGraph] Configuration updated successfully');
  }

  public getApp(): CompiledStateGraph<any, any, any, any, any, any> {
    if (!this.app) {
      throw new Error(
        'Supervisor graph not initialized. Call initialize() first.'
      );
    }
    return this.app;
  }
}

// Factory function
export const createSupervisorGraph = async (
  snakAgent: SnakAgent
): Promise<CompiledStateGraph<any, any, any, any, any>> => {
  const supervisorGraph = new SupervisorGraph(snakAgent);
  return supervisorGraph.initialize();
};
