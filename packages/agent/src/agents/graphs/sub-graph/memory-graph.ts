import { START, END, StateGraph, Command } from '@langchain/langgraph';
import {
  Memories,
  EpisodicMemoryContext,
  SemanticMemoryContext,
  ltmSchema,
  ltmSchemaType,
} from '../../../shared/types/memory.types.js';
import {
  getCurrentPlanStep,
  getCurrentHistoryItem,
  estimateTokens,
  handleNodeError,
} from '../utils/graph-utils.js';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { logger } from '@snakagent/core';
import { ModelSelector } from '../../operators/modelSelector.js';
import { MemoryAgent } from '../../operators/memoryAgent.js';
import { GraphConfigurableAnnotation, GraphState } from '../graph.js';
import { RunnableConfig } from '@langchain/core/runnables';
import { DEFAULT_GRAPH_CONFIG } from '../config/default-config.js';
import {
  MemoryNode,
  PlannerNode,
  ExecutorNode,
  ExecutionMode,
} from '../../../shared/enums/agent-modes.enum.js';
import { MemoryStateManager } from '../manager/memory/memory-utils.js';
import { MemoryDBManager } from '../manager/memory/memory-db-manager.js';
import { STMManager } from '@agents/graphs/manager/memory/memory-manager.js';
import { LTM_SYSTEM_PROMPT_RETRIEVE_MEMORY } from '@prompts/graph/memory/ltm_prompt.js';
import { LTN_SUMMARIZE_SYSTEM_PROMPT } from '@prompts/graph/memory/summary_prompts.js';
import { isInEnum } from '@enums/utils.js';
import { MEMORY_THRESHOLDS } from '@agents/graphs/constants/execution-constants.js';
import {
  HistoryItem,
  ParsedPlan,
  StepInfo,
  StepType,
  TaskType,
} from '../../../shared/types/graph.types.js';
import { formatSteporHistoryForSTM } from '../parser/plan-or-histories/plan-or-histoires.parser.js';
import { BaseMessage } from '@langchain/core/messages';

export type GraphStateType = typeof GraphState.State;

export class MemoryGraph {
  private modelSelector: ModelSelector | null;
  private memoryAgent: MemoryAgent;
  private memoryDBManager: MemoryDBManager | null = null;
  private graph: any;

  constructor(modelSelector: ModelSelector | null, memoryAgent: MemoryAgent) {
    this.modelSelector = modelSelector;
    this.memoryAgent = memoryAgent;
    const embeddings = memoryAgent.getEmbeddings();
    if (embeddings) {
      this.memoryDBManager = new MemoryDBManager(embeddings, 3, 8000);
    }
  }

  private async summarize_before_inserting(
    content: string
  ): Promise<{ message: BaseMessage; tokens: number }> {
    try {
      if (!this.modelSelector || !this.memoryDBManager) {
        logger.warn(
          '[LTMManager] Missing dependencies, skipping LTM processing'
        );
        throw new Error(
          `[LTMManager] Missing dependencies, skipping LTM processing`
        );
      }

      const model = this.modelSelector.getModels()['cheap'];
      if (!model) {
        throw new Error('Smart model not available for LTM processing');
      }

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', LTN_SUMMARIZE_SYSTEM_PROMPT],
        new MessagesPlaceholder('content'),
      ]);

      const aiMessage = await model.invoke(
        await prompt.formatMessages({
          content: content,
        })
      );
      return {
        message: aiMessage,
        tokens: aiMessage.usage_metadata?.total_tokens ?? 0,
      };
    } catch (error: any) {
      throw error;
    }
  }

  private formatAllStepsOfCurrentTask(task: TaskType): string {
    try {
      let formatted = `Task: ${task.thought.text}\n`;
      if (task.steps && task.steps.length > 0) {
        formatted += `-Steps: `;
        task.steps.forEach((step: any, index: number) => {
          const toolResult =
            typeof step.tool.result === 'string'
              ? step.tool.result.slice(0, 150) +
                (step.tool.result.length > 150 ? '...' : '')
              : JSON.stringify(step.tool.result).slice(0, 150);
          const toolArgs =
            JSON.stringify(step.tool.args).slice(0, 100) +
            (JSON.stringify(step.tool.args).length > 100 ? '...' : '');

          formatted += `${index + 1}.[${step.thought.text}|${step.thought.reasoning}] ${step.tool.name}(${toolArgs}) → ${step.tool.status}:${toolResult}; `;
        });
        formatted += `\n`;
      } else {
        formatted += `No steps completed.\n`;
      }

      return formatted;
    } catch (error) {
      logger.error(
        `[LTMManager] Error formatting all steps of current task: ${error}`
      );
      return `Task: ${task.thought.text || 'Unknown task'} - Error formatting steps`;
    }
  }

  private async ltm_manager(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<{ memories?: Memories; last_node: MemoryNode } | Command> {
    try {
      if (
        state.currentGraphStep >=
        (config.configurable?.max_graph_steps ??
          DEFAULT_GRAPH_CONFIG.maxGraphSteps)
      ) {
        logger.warn(
          `[MemoryRouter] Memory sub-graph limit reached (${state.currentGraphStep}), routing to END`
        );
        return {
          last_node: MemoryNode.LTM_MANAGER,
        };
      }

      if (state.tasks[state.currentTaskIndex].status != 'completed') {
        logger.debug(
          `[LTMManager] Current task at index ${state.currentTaskIndex} is not completed, skipping LTM update`
        );
        return {
          last_node: MemoryNode.LTM_MANAGER,
        };
      }

      // Validate prerequisites
      if (!this.modelSelector || !this.memoryDBManager) {
        logger.warn(
          '[LTMManager] Missing dependencies, skipping LTM processing'
        );
        return {
          last_node: MemoryNode.LTM_MANAGER,
        };
      }

      const model = this.modelSelector.getModels()['cheap'];
      if (!model) {
        throw new Error('Fast model not available for LTM processing');
      }

      const recentMemories = STMManager.getRecentMemories(
        state.memories.stm,
        1
      );

      if (recentMemories.length === 0) {
        logger.warn(
          '[LTMManager] No recent STM items available for LTM upsert'
        );
        return {
          last_node: MemoryNode.LTM_MANAGER,
        };
      }

      const structuredModel = model.withStructuredOutput(ltmSchema);
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', LTM_SYSTEM_PROMPT_RETRIEVE_MEMORY],
        ['human', `TEXT_TO_ANALYZE : {response}`],
      ]);

      // Get current task to format all its steps
      const task = state.tasks[state.currentTaskIndex];
      if (!task) {
        logger.warn(
          `[LTMManager] No current task found at index ${state.currentTaskIndex}, skipping LTM processing`
        );
        return {
          last_node: MemoryNode.LTM_MANAGER,
        };
      }

      // Use content of all steps of current task instead of just recent memories
      const allStepsContent = this.formatAllStepsOfCurrentTask(task);
      const summaryResult = (await structuredModel.invoke(
        await prompt.formatMessages({
          response: allStepsContent,
        })
      )) as ltmSchemaType;

      const episodic_memories: EpisodicMemoryContext[] = [];
      const semantic_memories: SemanticMemoryContext[] = [];

      summaryResult.episodic.forEach((memory) => {
        const episodic_memory: EpisodicMemoryContext = {
          user_id: 'default_user',
          run_id: config.configurable?.thread_id as string, //TODO add DEFAULT CONFIG
          content: memory.content,
          sources: memory.source,
        };
        episodic_memories.push(episodic_memory);
      });

      summaryResult.semantic.forEach((memory) => {
        const semantic_memory: SemanticMemoryContext = {
          user_id: 'default_user',
          run_id: config.configurable?.thread_id as string,
          fact: memory.fact,
          category: memory.category,
        };
        semantic_memories.push(semantic_memory);
      });

      logger.debug(
        `[LTMManager] Generated summary: ${JSON.stringify(summaryResult, null, 2)}`
      );

      const userId = config.configurable?.thread_id as string;
      if (!userId) {
        logger.warn('[LTMManager] No user ID available, skipping LTM upsert');
        return {
          last_node: MemoryNode.LTM_MANAGER,
        };
      }

      // Perform safe memory upsert with improved error handling
      const upsertResult = await this.memoryDBManager.upsertMemory(
        semantic_memories,
        episodic_memories
      );

      if (upsertResult.success) {
        logger.debug(
          `[LTMManager] Successfully upserted memory for current step`
        );
      } else {
        logger.warn(
          `[LTMManager] Failed to upsert memory: ${upsertResult.error}`
        );
      }

      return {
        last_node: MemoryNode.LTM_MANAGER,
      };
    } catch (error: any) {
      logger.error(`[LTMManager] Critical error in LTM processing: ${error}`);
      return handleNodeError(
        error,
        'LTM_MANAGER',
        state,
        'LTM processing failed'
      );
    }
  }

  private memory_router(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): MemoryNode {
    const lastNode = state.last_node;
    logger.debug(`[MemoryRouter] Routing from agent: ${lastNode}`);

    if (
      state.currentGraphStep >=
      (config.configurable?.max_graph_steps ??
        DEFAULT_GRAPH_CONFIG.maxGraphSteps)
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

    const maxSteps = config.configurable?.max_graph_steps ?? 0;
    if (maxSteps <= state.currentGraphStep) {
      logger.warn(
        `[Router] Max graph steps reached(${maxSteps}), routing to END node`
      );
      return MemoryNode.END_MEMORY_GRAPH;
    }

    // Route based on previous agent and current state

    if (isInEnum(PlannerNode, lastNode)) {
      logger.debug('[MemoryRouter] Plan validated → retrieving memory context');
      return MemoryNode.RETRIEVE_MEMORY;
    } else if (isInEnum(MemoryNode, lastNode)) {
      if (lastNode === MemoryNode.RETRIEVE_MEMORY) {
        logger.debug(
          '[MemoryRouter] Memory context retrieved → ending memory flow'
        );
        return MemoryNode.END;
      }
    }
    logger.warn(`[MemoryRouter] Unknown agent ${lastNode}, routing to end`);
    return MemoryNode.END_MEMORY_GRAPH;
  }

  private end_memory_graph(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ) {
    logger.info('[EndMemoryGraph] Cleaning up memory graph state');
    return new Command({
      update: {
        plans_or_histories: undefined,
        currentTaskIndex: 0,
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
      GraphState,
      GraphConfigurableAnnotation
    )
      .addNode('ltm_manager', this.ltm_manager.bind(this))
      .addNode(
        'retrieve_memory',
        this.memoryAgent.createMemoryNode().bind(this)
      )
      .addNode('end_memory_graph', this.end_memory_graph.bind(this))
      .addConditionalEdges(START, this.memory_router.bind(this))
      .addEdge('ltm_manager', 'retrieve_memory')
      .addEdge('retrieve_memory', END);
    this.graph = memory_subgraph.compile();
  }
}
