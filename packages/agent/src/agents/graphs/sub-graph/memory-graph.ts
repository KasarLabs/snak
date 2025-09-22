import { START, END, StateGraph, Command } from '@langchain/langgraph';
import {
  Memories,
  EpisodicMemoryContext,
  SemanticMemoryContext,
  ltmSchemaType,
  createLtmSchemaMemorySchema,
} from '../../../shared/types/memory.types.js';
import { handleNodeError } from '../utils/graph-utils.js';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import {
  logger,
  MemoryConfig,
  MemorySizeLimits,
  MemoryTimeouts,
} from '@snakagent/core';
import { GraphConfigurableAnnotation, GraphState } from '../graph.js';
import { RunnableConfig } from '@langchain/core/runnables';
import { DEFAULT_GRAPH_CONFIG } from '../config/default-config.js';
import {
  MemoryNode,
  PlannerNode,
  ExecutorNode,
  VerifierNode,
} from '../../../shared/enums/agent-modes.enum.js';
import { MemoryStateManager } from '../manager/memory/memory-utils.js';
import { MemoryDBManager } from '../manager/memory/memory-db-manager.js';
import { STMManager } from '@agents/graphs/manager/memory/memory-manager.js';
import { isInEnum } from '@enums/utils.js';
import {
  StepType,
  TaskType,
  ToolCallType,
} from '../../../shared/types/graph.types.js';
import {
  createRetrieveMemoryNode,
  embeddingModel,
} from '../chain/memory/memory-chain.js';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { TASK_MEMEMORY_MANAGER_HUMAN_PROMPT } from '@prompts/graph/memory/task-memory-manager.prompt.js';

export class MemoryGraph {
  private memoryDBManager: MemoryDBManager;
  private model: BaseChatModel;
  private memorySizeLimit: MemorySizeLimits;
  private graph: any;

  constructor(model: BaseChatModel, memoryConfig: MemoryConfig) {
    this.model = model;
    this.memoryDBManager = new MemoryDBManager(embeddingModel, memoryConfig);
    if (!this.memoryDBManager) {
      throw new Error('MemoryDBManager initialization failed');
    }
  }

  private formatAllStepsOfCurrentTask(task: TaskType): string {
    try {
      let formatted = `Task: ${task.thought.text}\n`;
      if (task.steps && task.steps.length > 0) {
        formatted += `-Steps: `;
        task.steps.forEach((step: StepType, index: number) => {
          const toolResult: string = step.tool
            .map((t: ToolCallType) => {
              const toolArgs = JSON.stringify(t.result);
              if (t.name === 'response_task') {
                return null;
              }
              return `-${t.name}(${toolArgs}) → ${t.status}:${JSON.stringify(t.result) || 'No result'}\n`;
            })
            .join('');

          formatted += `${index + 1}.[${step.thought.text}|${step.thought.reasoning}];${toolResult}\n`;
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
      if (!config.configurable?.agent_config) {
        throw new Error('Agent configuration is required for LTM processing.');
      }
      if (
        state.currentGraphStep >=
        (config.configurable?.agent_config?.graph.maxSteps ??
          DEFAULT_GRAPH_CONFIG.maxGraphSteps)
      ) {
        logger.warn(
          `[MemoryRouter] Memory sub-graph limit reached (${state.currentGraphStep}), routing to END`
        );
        return {
          last_node: MemoryNode.LTM_MANAGER,
        };
      }
      1;
      if (
        state.tasks[state.tasks.length - 1].status != 'completed' &&
        state.tasks[state.tasks.length - 1].status != 'failed'
      ) {
        // Maybe change it to completed but it can be interssing to know why there is the problem
        logger.debug(
          `[LTMManager] Current task at index ${state.currentTaskIndex} is not completed, skipping LTM update`
        );
        return {
          last_node: MemoryNode.LTM_MANAGER,
        };
      }

      if (!this.model) {
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

      const structuredModel = this.model.withStructuredOutput(
        createLtmSchemaMemorySchema(4, 8)
      );
      const prompt = ChatPromptTemplate.fromMessages([
        config.configurable?.agent_config?.prompts.taskMemoryManagerPrompt,
        ['human', TASK_MEMEMORY_MANAGER_HUMAN_PROMPT],
      ]);

      // Get current task to format all its steps
      const task = state.tasks[state.tasks.length - 1];
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
          run_id: config.configurable!.thread_id as string,
          task_id: task.id,
          step_id: task.steps[task.steps.length - 1].id,
          content: memory.content,
          sources: memory.source,
        };
        episodic_memories.push(episodic_memory);
      });

      summaryResult.semantic.forEach((memory) => {
        const semantic_memory: SemanticMemoryContext = {
          user_id: 'default_user',
          run_id: config.configurable!.thread_id as string,
          task_id: task.id,
          step_id: task.steps[task.steps.length - 1].id,
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
      (config.configurable?.agent_config?.graph.maxSteps ??
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

    const maxSteps = config.configurable?.agent_config?.graph.maxSteps ?? 0;
    if (maxSteps <= state.currentGraphStep) {
      logger.warn(
        `[Router] Max graph steps reached(${maxSteps}), routing to END node`
      );
      return MemoryNode.END_MEMORY_GRAPH;
    }

    // Route based on previous agent and current state
    // External sub-graphs handle
    if (isInEnum(ExecutorNode, lastNode)) {
      return MemoryNode.RETRIEVE_MEMORY;
    }
    if (isInEnum(PlannerNode, lastNode)) {
      logger.debug('[MemoryRouter] Plan validated → retrieving memory context');
      return MemoryNode.RETRIEVE_MEMORY;
    }
    if (isInEnum(VerifierNode, lastNode)) {
      logger.debug(
        '[MemoryRouter] Task verification complete → retrieving memory context'
      );
      return MemoryNode.LTM_MANAGER;
    }
    // Internal memory nodes handling
    else if (isInEnum(MemoryNode, lastNode)) {
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
      .addNode('retrieve_memory', createRetrieveMemoryNode().bind(this))
      .addNode('end_memory_graph', this.end_memory_graph.bind(this))
      .addConditionalEdges(START, this.memory_router.bind(this))
      .addEdge('ltm_manager', 'retrieve_memory')
      .addEdge('retrieve_memory', END);
    this.graph = memory_subgraph.compile();
  }
}
