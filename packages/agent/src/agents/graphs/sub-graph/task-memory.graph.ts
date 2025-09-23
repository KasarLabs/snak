import { START, END, StateGraph, Command } from '@langchain/langgraph';
import {
  Memories,
  EpisodicMemoryContext,
  SemanticMemoryContext,
  ltmSchemaType,
  createLtmSchemaMemorySchema,
} from '../../../shared/types/memory.types.js';
import {
  getCurrentTask,
  getRetrieveMemoryRequestFromGraph,
  handleNodeError,
  hasReachedMaxSteps,
  isValidConfiguration,
  isValidConfigurationType,
} from '../utils/graph-utils.js';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { logger, MemoryConfig } from '@snakagent/core';
import { GraphConfigurableAnnotation, GraphState } from '../graph.js';
import { RunnableConfig } from '@langchain/core/runnables';
import {
  TaskMemoryNode,
  TaskManagerNode,
  TaskExecutorNode,
  TaskVerifierNode,
} from '../../../shared/enums/agent.enum.js';
import { MemoryStateManager } from '../manager/memory/memory-utils.js';
import { MemoryDBManager } from '../manager/memory/memory-db-manager.js';
import { STMManager } from '@agents/graphs/manager/memory/memory-manager.js';
import { isInEnum } from '@enums/utils.js';
import {
  StepType,
  TaskType,
  ToolCallType,
} from '../../../shared/types/graph.types.js';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { TASK_MEMEMORY_MANAGER_HUMAN_PROMPT } from '@prompts/graph/memory/task-memory-manager.prompt.js';

const DEFAULT_USER_ID = 'default_user';
const RECENT_MEMORIES_LIMIT = 1;
export class MemoryGraph {
  private readonly memoryDBManager: MemoryDBManager;
  private readonly model: BaseChatModel;
  private graph: any;

  constructor(model: BaseChatModel, memoryConfig: MemoryConfig) {
    this.model = model;
    this.memoryDBManager = new MemoryDBManager(memoryConfig);
    if (!this.memoryDBManager) {
      throw new Error('MemoryDBManager initialization failed');
    }
  }

  private createEpisodicMemories(
    memories: Array<{ content: string; source: string[]; name: string }>,
    task: TaskType,
    threadId: string
  ): EpisodicMemoryContext[] {
    return memories.map((memory) => ({
      user_id: DEFAULT_USER_ID,
      run_id: threadId,
      task_id: task.id,
      step_id: task.steps[task.steps.length - 1].id,
      content: memory.content,
      sources: memory.source,
    }));
  }

  private createSemanticMemories(
    memories: Array<{ fact: string; category: string }>,
    task: TaskType,
    threadId: string
  ): SemanticMemoryContext[] {
    return memories.map((memory) => ({
      user_id: DEFAULT_USER_ID,
      run_id: threadId,
      task_id: task.id,
      step_id: task.steps[task.steps.length - 1].id,
      fact: memory.fact,
      category: memory.category,
    }));
  }

  private formatToolResults(tools: ToolCallType[]): string {
    return tools
      .map((tool) => {
        if (tool.name === 'response_task') return null;
        const toolArgs = JSON.stringify(tool.result);
        const result = JSON.stringify(tool.result) || 'No result';
        return `-${tool.name}(${toolArgs}) → ${tool.status}:${result}\n`;
      })
      .filter(Boolean)
      .join('');
  }

  private formatStep(step: StepType, index: number): string {
    const toolResult = this.formatToolResults(step.tool);
    return `${index + 1}.[${step.thought.text}|${step.thought.reasoning}];${toolResult}\n`;
  }

  private formatAllStepsOfCurrentTask(task: TaskType): string {
    try {
      let formatted = `Task: ${task.thought.text}\n`;

      if (task.steps?.length > 0) {
        formatted += '-Steps: ';
        task.steps.forEach((step, index) => {
          formatted += this.formatStep(step, index);
        });
        formatted += '\n';
      } else {
        formatted += 'No steps completed.\n';
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
  ): Promise<{ memories?: Memories; last_node: TaskMemoryNode } | Command> {
    try {
      const _isValidConfiguration: isValidConfigurationType =
        isValidConfiguration(config);
      if (_isValidConfiguration.isValid === false) {
        throw new Error(_isValidConfiguration.error);
      }
      if (
        hasReachedMaxSteps(
          state.currentGraphStep,
          config.configurable!.agent_config!
        )
      ) {
        logger.warn(
          `[MemoryRouter] Memory sub-graph limit reached (${state.currentGraphStep}), routing to END`
        );
        throw new Error('Max memory graph steps reached');
      }
      const agentConfig = config.configurable!.agent_config!;
      const currentTask = getCurrentTask(state.tasks);
      if (!['completed', 'failed'].includes(currentTask.status)) {
        logger.debug(
          `[LTMManager] Current task at index ${state.currentTaskIndex} is not completed or failed, skipping LTM update`
        );
        return { last_node: TaskMemoryNode.LTM_MANAGER };
      }

      const recentMemories = STMManager.getRecentMemories(
        state.memories.stm,
        RECENT_MEMORIES_LIMIT
      );
      if (recentMemories.length === 0) {
        logger.warn(
          '[LTMManager] No recent STM items available for LTM upsert'
        );
        return { last_node: TaskMemoryNode.LTM_MANAGER };
      }

      const structuredModel = this.model.withStructuredOutput(
        createLtmSchemaMemorySchema(
          agentConfig.memory.size_limits.max_insert_episodic_size,
          agentConfig.memory.size_limits.max_insert_semantic_size
        )
      );
      const prompt = ChatPromptTemplate.fromMessages([
        agentConfig.prompts.task_memory_manager_prompt,
        ['human', TASK_MEMEMORY_MANAGER_HUMAN_PROMPT],
      ]);
      // Use content of all steps of current task instead of just recent memories
      const allStepsContent = this.formatAllStepsOfCurrentTask(currentTask);
      const summaryResult = (await structuredModel.invoke(
        await prompt.formatMessages({
          response: allStepsContent,
        })
      )) as ltmSchemaType;

      const episodic_memories: EpisodicMemoryContext[] = [];
      const semantic_memories: SemanticMemoryContext[] = [];

      episodic_memories.push(
        ...this.createEpisodicMemories(
          summaryResult.episodic,
          currentTask,
          config.configurable!.thread_id!
        )
      );

      semantic_memories.push(
        ...this.createSemanticMemories(
          summaryResult.semantic,
          currentTask,
          config.configurable!.thread_id!
        )
      );

      logger.debug(
        `[LTMManager] Generated summary: ${JSON.stringify(summaryResult, null, 2)}`
      );
      // Perform safe memory upsert with improved error handling
      const upsertResult = await this.memoryDBManager.upsertMemory(
        semantic_memories,
        episodic_memories
      );

      if (upsertResult.success) {
        logger.debug(
          '[LTMManager] Successfully upserted memory for current step'
        );
      } else {
        logger.warn(
          `[LTMManager] Failed to upsert memory: ${upsertResult.error}`
        );
      }

      return { last_node: TaskMemoryNode.LTM_MANAGER };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `[LTMManager] Critical error in LTM processing: ${errorMessage}`
      );
      const errorObject =
        error instanceof Error ? error : new Error(errorMessage);
      return handleNodeError(
        errorObject,
        'LTM_MANAGER',
        state,
        'LTM processing failed'
      );
    }
  }

  private async retrieve_memory(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<{ memories?: Memories; last_node: TaskMemoryNode } | Command> {
    try {
      const _isValidConfiguration: isValidConfigurationType =
        isValidConfiguration(config);
      if (_isValidConfiguration.isValid === false) {
        throw new Error(_isValidConfiguration.error);
      }
      if (
        hasReachedMaxSteps(
          state.currentGraphStep,
          config.configurable!.agent_config!
        )
      ) {
        logger.warn(
          `[MemoryRouter] Memory sub-graph limit reached (${state.currentGraphStep}), routing to END`
        );
        throw new Error('Max memory graph steps reached');
      }
      const agentConfig = config.configurable!.agent_config!;
      // Fetch relevant memories from DB based on recent STM context
      const recentSTM = STMManager.getRecentMemories(
        state.memories.stm,
        RECENT_MEMORIES_LIMIT
      );
      if (recentSTM.length === 0) {
        logger.warn(
          '[RetrieveMemory] No recent STM items available for memory retrieval'
        );
        return {
          memories: state.memories,
          last_node: TaskMemoryNode.RETRIEVE_MEMORY,
        };
      }
      const request = getRetrieveMemoryRequestFromGraph(state, config);
      console.log('memory retrieve request', request);
      const retrievedMemories =
        await this.memoryDBManager.retrieveSimilarMemories(
          request,
          DEFAULT_USER_ID,
          config.configurable!.thread_id!
        );

      if (retrievedMemories.success && retrievedMemories.data) {
        const stmCurrentStepIds = state.memories.stm.items
          .filter(Boolean)
          .map((item) => item!.task_id);
        logger.debug('STM current step ids: ', stmCurrentStepIds);
        const filteredResults = retrievedMemories.data.filter(
          (mem) => !stmCurrentStepIds.includes(mem.step_id)
        );
        logger.debug(
          `[TaskMemoryNode] Filtered to ${filteredResults.length} memories after STM check`
        );
        const updatedMemories = MemoryStateManager.updateLTM(
          state.memories,
          filteredResults
        );
        return {
          memories: updatedMemories,
          last_node: TaskMemoryNode.RETRIEVE_MEMORY,
        };
      } else {
        logger.warn(
          `[RetrieveMemory] Memory retrieval failed: ${retrievedMemories.error}`
        );
        return {
          memories: state.memories,
          last_node: TaskMemoryNode.RETRIEVE_MEMORY,
        };
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `[RetrieveMemory] Critical error during memory retrieval: ${errorMessage}`
      );
      const errorObject =
        error instanceof Error ? error : new Error(errorMessage);
      return handleNodeError(
        errorObject,
        'RETRIEVE_MEMORY',
        state,
        'Memory retrieval failed'
      );
    }
  }

  private memory_router(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): TaskMemoryNode {
    try {
      const lastNode = state.last_node;
      logger.debug(`[MemoryRouter] Routing from agent: ${lastNode}`);
      // Validate memory state
      if (!MemoryStateManager.validate(state.memories)) {
        logger.error(
          '[MemoryRouter] Invalid memory state detected, routing to end'
        );
        return TaskMemoryNode.END_MEMORY_GRAPH;
      }
      // Route based on previous agent and current state
      switch (true) {
        case isInEnum(TaskExecutorNode, lastNode):
          return TaskMemoryNode.RETRIEVE_MEMORY;

        case isInEnum(TaskManagerNode, lastNode):
          logger.debug(
            '[MemoryRouter] Plan validated → retrieving memory context'
          );
          return TaskMemoryNode.RETRIEVE_MEMORY;

        case isInEnum(TaskVerifierNode, lastNode):
          logger.debug(
            '[MemoryRouter] Task verification complete → retrieving memory context'
          );
          return TaskMemoryNode.LTM_MANAGER;

        case isInEnum(TaskMemoryNode, lastNode):
          if (lastNode === TaskMemoryNode.RETRIEVE_MEMORY) {
            logger.debug(
              '[MemoryRouter] Memory context retrieved → ending memory flow'
            );
            return TaskMemoryNode.END;
          }
          return TaskMemoryNode.END_MEMORY_GRAPH;
        default:
          logger.warn(
            `[MemoryRouter] Unknown agent ${lastNode}, routing to end`
          );
          return TaskMemoryNode.END_MEMORY_GRAPH;
      }
    } catch (error: any) {
      logger.error(`[MemoryRouter] Error in routing logic: ${error.message}`);
      return TaskMemoryNode.END_MEMORY_GRAPH;
    }
  }

  private end_memory_graph(
    _state: typeof GraphState.State,
    _config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
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
      .addNode('retrieve_memory', this.retrieve_memory.bind(this))
      .addNode('end_memory_graph', this.end_memory_graph.bind(this))
      .addConditionalEdges(START, this.memory_router.bind(this))
      .addEdge('ltm_manager', 'retrieve_memory')
      .addEdge('retrieve_memory', END);
    this.graph = memory_subgraph.compile();
  }
}
