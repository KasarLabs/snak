import { BaseMessage } from '@langchain/core/messages';
import {
  Annotation,
  START,
  END,
  StateGraph,
  Command,
} from '@langchain/langgraph';
import {
  Agent,
  Memories,
  ParsedPlan,
  EpisodicMemoryContext,
  SemanticMemoryContext,
  ltmSchema,
  ltmSchemaType,
} from '../types/index.js';
import { formatStepForSTM } from '../utils.js';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { AgentConfig, logger } from '@snakagent/core';
import { ModelSelector } from 'agents/operators/modelSelector.js';
import { MemoryAgent } from 'agents/operators/memoryAgent.js';
import { AutonomousConfigurableAnnotation } from '../autonomous.js';
import { RunnableConfig } from '@langchain/core/runnables';
import {
  MemoryNode,
  DEFAULT_AUTONOMOUS_CONFIG,
} from '../config/autonomous-config.js';
import { MemoryStateManager, STMManager } from '../utils/memory-utils.js';
import { MemoryDBManager } from '../utils/memory-db-manager.js';

export type MemoryStateType = typeof MemoryState.State;
const ltm_summarize_prompt = `You are a memory integration agent that processes responses into Long-Term Memory (LTM) with episodic and semantic components. Your task is to analyze the given response and create structured memory entries following this schema:

- Episodic events: Specific occurrences, actions, or experiences
- Semantic facts: General knowledge, learned information, or insights

Guidelines:
1. Extract important episodic events (things that happened, were discussed, or experienced) and include the sources for these events in an array format, including any relevant website URLs.
2. Identify important semantic facts (knowledge, insights, or learnable information) and categorize them appropriately.
3. Use clear, descriptive names for events.
4. Categorize facts as one of: "preference", "fact", "skill", or "relationship".
5. If no specific source is mentioned, default to ["conversation"].

Output format (JSON):
{{
  "episodic": [
    {{
      "name": "event_identifier",
      "content": "detailed description of what happened",
      "source": ["source_reference_1", "source_reference_2"]
    }}
  ],
  "semantic": [
    {{
      "fact": "the learned information or insight",
      "category": "preference|fact|skill|relationship"
    }}
  ]
}}

<example>
Response: "The user explained they're building a TypeScript application with memory management. They want to implement LTM with episodic and semantic storage. The meeting covered schema design and simplification strategies."

Output:
{{
  "episodic": [
    {{
      "name": "project_discussion",
      "content": "User explained building a TypeScript application with memory management features",
      "source": ["meeting_notes"]
    }},
    {{
      "name": "design_review",
      "content": "Meeting covered schema design and simplification strategies for LTM",
      "source": ["meeting_notes"]
    }}
  ],
  "semantic": [
    {{
      "fact": "User is building with TypeScript for type safety",
      "category": "fact"
    }},
    {{
      "fact": "LTM implementation requires both episodic and semantic storage",
      "category": "fact"
    }}
  ]
}}
</example>

<example>
Response: "Yesterday at 3 PM, the user mentioned they prefer Python over Java for data science projects because of its extensive libraries like pandas and scikit-learn. They shared that they've been using Python for 5 years."

Output:
{{
  "episodic": [
    {{
      "name": "language_preference_discussion",
      "content": "User mentioned preferring Python over Java for data science projects yesterday at 3 PM",
      "source": ["conversation"]
    }}
  ],
  "semantic": [
    {{
      "fact": "User prefers Python over Java for data science",
      "category": "preference"
    }},
    {{
      "fact": "User has 5 years of Python experience",
      "category": "skill"
    }},
    {{
      "fact": "User values pandas and scikit-learn libraries for data science",
      "category": "preference"
    }}
  ]
}}
</example>

<example>
Response: "The user's team lead Sarah mentioned in the Slack channel that the deadline for the API integration has been moved to next Friday. The user acknowledged this and started working on the authentication module."

Output:
{{
  "episodic": [
    {{
      "name": "deadline_update",
      "content": "Team lead Sarah announced the API integration deadline was moved to next Friday",
      "source": ["slack_channel"]
    }},
    {{
      "name": "task_started",
      "content": "User acknowledged deadline change and started working on authentication module",
      "source": ["conversation"]
    }}
  ],
  "semantic": [
    {{
      "fact": "Sarah is the user's team lead",
      "category": "relationship"
    }},
    {{
      "fact": "User is responsible for API integration with authentication module",
      "category": "fact"
    }}
  ]
}}
</example>

<example>
Response: "Based on the documentation from https://docs.example.com/api, the user learned that rate limiting is set to 100 requests per minute. They successfully implemented the throttling mechanism using a token bucket algorithm."

Output:
{{
  "episodic": [
    {{
      "name": "api_documentation_review",
      "content": "User reviewed API documentation and learned about rate limiting specifications",
      "source": ["https://docs.example.com/api"]
    }},
    {{
      "name": "throttling_implementation",
      "content": "User successfully implemented throttling mechanism using token bucket algorithm",
      "source": ["conversation"]
    }}
  ],
  "semantic": [
    {{
      "fact": "API rate limit is 100 requests per minute",
      "category": "fact"
    }},
    {{
      "fact": "User can implement token bucket algorithms for rate limiting",
      "category": "skill"
    }}
  ]
}}
</example>`;

export const MemoryState = Annotation.Root({
  last_agent: Annotation<Agent>,
  memories: Annotation<Memories>,
  plan: Annotation<ParsedPlan>,
  currentStepIndex: Annotation<number>,
  currentGraphStep: Annotation<number>,
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

      // Circuit breaker: vérifier les limites du sub-graph
      if (
        state.currentGraphStep >=
        (config.configurable?.max_graph_steps ??
          DEFAULT_AUTONOMOUS_CONFIG.maxGraphSteps)
      ) {
        logger.warn(
          `[MemoryRouter] Memory sub-graph limit reached (${state.currentGraphStep}), routing to END`
        );
        return {
          memories: state.memories,
        };
      }

      const currentStep = state.plan.steps[state.currentStepIndex - 1];

      if (!currentStep) {
        logger.warn(
          '[STMManager] No current step found, returning unchanged memories'
        );
        return {
          memories: state.memories,
        };
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
        `[STMManager] Memory updated. STM size: ${updatedMemories.stm.size}/${updatedMemories.stm.maxSize}`
      );

      return {
        memories: updatedMemories,
      };
    } catch (error) {
      logger.error(`[STMManager] Critical error in STM processing: ${error}`);

      // Return safe fallback state
      const fallbackMemories: Memories = {
        ...state.memories,
        lastError: {
          type: 'STM_PROCESSING_ERROR',
          message: error.message,
          timestamp: Date.now(),
        },
      };

      return {
        memories: fallbackMemories,
      };
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

      if (
        state.currentGraphStep >=
        (config.configurable?.max_graph_steps ??
          DEFAULT_AUTONOMOUS_CONFIG.maxGraphSteps)
      ) {
        logger.warn(
          `[MemoryRouter] Memory sub-graph limit reached (${state.currentGraphStep}), routing to END`
        );
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

      const structuredModel = model.withStructuredOutput(ltmSchema);
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', ltm_summarize_prompt],
        new MessagesPlaceholder('response'),
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

      const summaryResult = (await structuredModel.invoke(
        await prompt.formatMessages({
          response: recentMemories[0].content,
        })
      )) as ltmSchemaType;

      console.log(JSON.stringify(summaryResult));
      const episodic_memories: EpisodicMemoryContext[] = [];
      const semantic_memories: SemanticMemoryContext[] = [];

      summaryResult.episodic.forEach((memory) => {
        const episodic_memory: EpisodicMemoryContext = {
          user_id: 'default_user',
          run_id: config.configurable?.conversation_id as string,
          content: memory.content,
          sources: memory.source,
        };
        episodic_memories.push(episodic_memory);
      });

      summaryResult.semantic.forEach((memory) => {
        const semantic_memory: SemanticMemoryContext = {
          user_id: 'default_user',
          run_id: config.configurable?.conversation_id as string,
          fact: memory.fact,
          category: memory.category,
        };
        semantic_memories.push(semantic_memory);
      });

      logger.debug(
        `[LTMManager] Generated summary: ${JSON.stringify(summaryResult, null, 2)}`
      );

      const userId = config.configurable?.conversation_id as string;
      console.log(`[LTMManager]${userId},\n ${config.configurable})`);
      if (!userId) {
        logger.warn('[LTMManager] No user ID available, skipping LTM upsert');
        return {};
      }

      // Perform safe memory upsert with improved error handling
      const upsertResult = await this.memoryDBManager.upsertMemory(
        semantic_memories,
        episodic_memories
      );

      if (upsertResult.success) {
        logger.debug(
          `[LTMManager] Successfully upserted memory for step ${currentStepIndex + 1}`
        );
      } else {
        logger.warn(
          `[LTMManager] Failed to upsert memory: ${upsertResult.error}`
        );
      }

      return {};
    } catch (error) {
      logger.error(`[LTMManager] Critical error in LTM processing: ${error}`);
      return {};
    }
  }

  private memory_router(
    state: typeof MemoryState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): MemoryNode {
    const lastAgent = state.last_agent;
    logger.debug(`[MemoryRouter] Routing from agent: ${lastAgent}`);

    if (
      state.currentGraphStep >=
      (config.configurable?.max_graph_steps ??
        DEFAULT_AUTONOMOUS_CONFIG.maxGraphSteps)
    ) {
      logger.warn(
        `[MemoryRouter] Memory sub-graph limit reached (${state.currentGraphStep}), routing to END`
      );
      return MemoryNode.END_MEMORY_GRAPH;
    }

    // Validate memory state
    if (!MemoryStateManager.validate(state.memories)) {
      logger.error(
        '[MemoryRouter] Invalid memory state detected, routing to end'
      );
      return MemoryNode.END_MEMORY_GRAPH;
    }

    const maxSteps = config.configurable?.max_graph_steps ?? 100;
    if (maxSteps <= state.currentGraphStep) {
      logger.warn('[Router] Max graph steps reached, routing to END node');
      return MemoryNode.END_MEMORY_GRAPH;
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
  ) {
    logger.info('[EndMemoryGraph] Cleaning up memory graph state');
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

  public getMemoryGraph() {
    return this.graph;
  }

  public createGraphMemory() {
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
      .addNode('end_memory_graph', this.end_memory_graph.bind(this))
      .addConditionalEdges(START, this.memory_router.bind(this))
      .addEdge('stm_manager', 'ltm_manager')
      .addEdge('ltm_manager', 'retrieve_memory')
      .addEdge('retrieve_memory', END);
    this.graph = memory_subgraph.compile();
  }
}
