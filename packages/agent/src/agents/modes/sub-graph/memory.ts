import { BaseMessage } from '@langchain/core/messages';
import {
  Annotation,
  START,
  END,
  StateGraph,
  CompiledStateGraph,
} from '@langchain/langgraph';
import {
  Agent,
  Memories,
  ParsedPlan,
  MemoryOperationResult,
} from '../types/index.js';
import { formatStepForSTM } from '../utils.js';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { AgentConfig, logger } from '@snakagent/core';
import { ModelSelector } from 'agents/operators/modelSelector.js';
import { MemoryAgent } from 'agents/operators/memoryAgent.js';
import { AutonomousConfigurableAnnotation } from '../autonomous.js';
import { RunnableConfig } from '@langchain/core/runnables';
import { v4 as uuidv4 } from 'uuid';
import { PLANNER_ORCHESTRATOR } from '../types/index.js';
import {
  MemoryNode,
  DEFAULT_AUTONOMOUS_CONFIG,
} from '../config/autonomous-config.js';
import {
  MemoryStateManager,
  STMManager,
  LTMManager,
  formatSTMForContext,
} from '../utils/memory-utils.js';
import { MemoryDBManager } from '../utils/memory-db-manager.js';
export type MemoryStateType = typeof MemoryState.State;

let summarize_prompt = `
You are a summarization agent. Your objective is to create the best summary of a given response before embedding it.

Please follow these guidelines:

1. Read the response carefully and identify the main points and key details.
2. Focus on clarity and conciseness while retaining the essential information.
3. Aim for a summary length of 1-3 sentences, depending on the complexity of the response.
4. Use clear and straightforward language to ensure the summary is easily understandable.
5. Include the original response value as part of the summary process.

<example>
Response: "The meeting will cover the quarterly financial results, upcoming projects, and team performance metrics."
Summary: "The meeting will discuss quarterly financial results, upcoming projects, and team performance."
</example

Response : {response}
Summary :
`;

export const MemoryState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  last_message: Annotation<BaseMessage | BaseMessage[]>,
  last_agent: Annotation<Agent>,
  memories: Annotation<Memories>,
  plan: Annotation<ParsedPlan>,
  currentStepIndex: Annotation<number>,
});

export class MemoryGraph {
  private agentConfig: AgentConfig;
  private modelSelector: ModelSelector | null;
  private memoryAgent: MemoryAgent;
  private memoryDBManager: MemoryDBManager | null = null;
  private graph: any;

  constructor(
    agentConfig: AgentConfig,
    modelSelector: ModelSelector | null,
    memoryAgent: MemoryAgent
  ) {
    this.modelSelector = modelSelector;
    this.agentConfig = agentConfig;
    this.memoryAgent = memoryAgent;

    // Initialize DB manager if embeddings are available
    const embeddings = memoryAgent.getEmbeddings();
    if (embeddings) {
      this.memoryDBManager = new MemoryDBManager(embeddings, 3, 8000);
    }
  }

  private async stm_manager(
    state: typeof MemoryState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): Promise<{
    memories: Memories;
  }> {
    try {
      logger.debug('[STMManager] Processing memory update');
      const currentStep = state.plan.steps[state.currentStepIndex - 1];

      if (!currentStep) {
        logger.warn(
          '[STMManager] No current step found, returning unchanged memories'
        );
        return { memories: state.memories };
      }
      const date = Date.now();
      const newMessage = formatStepForSTM(
        currentStep,
        new Date(date).toISOString()
      );

      // Use safe STM operations with O(1) complexity
      const result = MemoryStateManager.addSTMMemory(
        state.memories,
        newMessage,
        date
      );

      if (!result.success) {
        logger.error(`[STMManager] Failed to add memory: ${result.error}`);
        return { memories: result.data || state.memories };
      }

      const updatedMemories = result.data!;
      logger.debug(
        `[STMManager] ✅ Memory updated. STM size: ${updatedMemories.stm.size}/${updatedMemories.stm.maxSize}`
      );

      return { memories: updatedMemories };
    } catch (error) {
      logger.error(
        `[STMManager] ❌ Critical error in STM processing: ${error}`
      );

      // Return safe fallback state
      const fallbackMemories: Memories = {
        ...state.memories,
        lastError: {
          type: 'STM_PROCESSING_ERROR',
          message: error.message,
          timestamp: Date.now(),
        },
      };

      return { memories: fallbackMemories };
    }
  }

  private async ltm_manager(
    state: typeof MemoryState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): Promise<{ memories?: Memories }> {
    try {
      logger.debug('[LTMManager] Processing long-term memory update');

      // Skip LTM processing for initial step
      if (state.currentStepIndex === 0) {
        logger.debug('[LTMManager] Skipping LTM for initial step');
        return {};
      }

      // Validate prerequisites
      if (!this.modelSelector || !this.memoryDBManager) {
        logger.warn(
          '[LTMManager] Missing dependencies, skipping LTM processing'
        );
        return {};
      }

      const model = this.modelSelector.getModels()['fast'];
      if (!model) {
        throw new Error('Fast model not available for LTM processing');
      }

      const currentStepIndex = state.currentStepIndex - 1;
      const currentStep = state.plan.steps[currentStepIndex];

      if (!currentStep) {
        logger.warn(`[LTMManager] No step found at index ${currentStepIndex}`);
        return {};
      }

      // Generate summary using structured output
      const summarySchema = z.object({
        summarize: z
          .string()
          .min(10)
          .describe('Concise summary of the step execution and result'),
        relevance: z
          .number()
          .min(0)
          .max(1)
          .describe('Relevance score for this memory (0-1)'),
      });

      const structuredModel = model.withStructuredOutput(summarySchema);
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', summarize_prompt],
      ]);
      const recentMemories = STMManager.getRecentMemories(
        state.memories.stm,
        1
      );

      if (recentMemories.length === 0) {
        logger.warn(
          '[LTMManager] No recent STM items available for LTM upsert'
        );
        return {};
      }

      const summaryResult = await structuredModel.invoke(
        await prompt.formatMessages({
          response: recentMemories[0].content,
        })
      );

      logger.debug(
        `[LTMManager] Generated summary: ${JSON.stringify(summaryResult)}`
      );

      const lastSTMItem = recentMemories[0];
      const userId = config.configurable?.conversation_id as string;
      console.log(`[LTMManager]${userId},\n ${config.configurable})`);
      if (!userId) {
        logger.warn('[LTMManager] No user ID available, skipping LTM upsert');
        return {};
      }

      // Perform safe memory upsert with improved error handling
      const upsertResult = await this.memoryDBManager.upsertMemory(
        summaryResult.summarize,
        lastSTMItem.memories_id,
        `${currentStep.stepName}: ${currentStep.description}`,
        userId,
        config.configurable?.memory_size || 20
      );

      if (upsertResult.success) {
        logger.debug(
          `[LTMManager] ✅ Successfully upserted memory for step ${currentStepIndex + 1}`
        );
      } else {
        logger.warn(
          `[LTMManager] ⚠️ Failed to upsert memory: ${upsertResult.error}`
        );
      }

      return {};
    } catch (error) {
      logger.error(
        `[LTMManager] ❌ Critical error in LTM processing: ${error}`
      );
      return {};
    }
  }

  private memory_router(
    state: typeof MemoryState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): MemoryNode {
    const lastAgent = state.last_agent;
    logger.debug(`[MemoryRouter] Routing from agent: ${lastAgent}`);

    // Validate memory state
    if (!MemoryStateManager.validate(state.memories)) {
      logger.error(
        '[MemoryRouter] Invalid memory state detected, routing to end'
      );
      return MemoryNode.END;
    }

    // Route based on previous agent and current state
    switch (lastAgent) {
      case Agent.PLANNER_VALIDATOR:
        // After plan validation, retrieve relevant context
        logger.debug(
          '[MemoryRouter] Plan validated → retrieving memory context'
        );
        return MemoryNode.RETRIEVE_MEMORY;

      case Agent.EXEC_VALIDATOR:
        // After execution validation, update STM
        logger.debug('[MemoryRouter] Execution validated → updating STM');
        return MemoryNode.STM_MANAGER;

      case Agent.MEMORY_MANAGER:
        // Memory context retrieved, end memory processing
        logger.debug(
          '[MemoryRouter] Memory context retrieved → ending memory flow'
        );
        return MemoryNode.END;

      default:
        // Fallback to end for unknown agents
        logger.warn(
          `[MemoryRouter] Unknown agent ${lastAgent}, routing to end`
        );
        return MemoryNode.END;
    }
  }
  private end_memory_graph(
    state: typeof MemoryState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ) {}
  public getMemoryGraph() {
    return this.graph;
  }

  public createGraphMemory() {
    const retrieve_memory = this.memoryAgent.createMemoryNode();
    const memory_subgraph = new StateGraph(
      MemoryState,
      AutonomousConfigurableAnnotation
    )
      .addNode('stm_manager', this.stm_manager.bind(this))
      .addNode('ltm_manager', this.ltm_manager.bind(this))
      .addNode(
        'retrieve_memory',
        this.memoryAgent.createMemoryNode().bind(this)
      )
      .addConditionalEdges(START, this.memory_router.bind(this))
      .addEdge('stm_manager', 'ltm_manager')
      .addEdge('ltm_manager', 'retrieve_memory')
      .addEdge('retrieve_memory', END);

    this.graph = memory_subgraph.compile();
  }
}
