import { START, END, StateGraph, Command } from '@langchain/langgraph';
import {
  Memories,
  EpisodicMemoryContext,
  SemanticMemoryContext,
  ltmSchemaType,
  createLtmSchemaMemorySchema,
  MemoryOperationResult,
  HolisticMemoryContext,
} from '../../../shared/types/memory.types.js';
import {
  getCurrentTask,
  getRetrieveMemoryRequestFromGraph,
  handleNodeError,
  hasReachedMaxSteps,
  isValidConfiguration,
  isValidConfigurationType,
  routingFromSubGraphToParentGraphEndNode,
} from '../utils/graph.utils.js';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import {
  AgentConfig,
  logger,
  MemoryConfig,
  MemoryStrategy,
} from '@snakagent/core';
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
  GraphErrorTypeEnum,
  StepType,
  TaskType,
  ToolCallType,
} from '../../../shared/types/graph.types.js';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  TASK_MEMORY_MANAGER_HUMAN_PROMPT,
  TASK_MEMORY_MANAGER_SYSTEM_PROMPT,
} from '@prompts/agents/task-memory-manager.prompt.js';
import { memory } from '@snakagent/database/queries';
import { EXECUTOR_CORE_TOOLS } from './task-executor.graph.js';

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
    user_id: string,
    memories: Array<{ content: string; source: string[]; name: string }>,
    task: TaskType,
    threadId: string
  ): EpisodicMemoryContext[] {
    const lastStep = task.steps[task.steps.length - 1];
    if (!lastStep) {
      throw new Error('Last step is not accessible.');
    }
    return memories.map((memory) => ({
      user_id: user_id,
      run_id: threadId,
      task_id: task.id,
      step_id: lastStep.id,
      content: memory.content,
      sources: memory.source,
    }));
  }

  private createSemanticMemories(
    user_id: string,
    memories: Array<{ fact: string; category: string }>,
    task: TaskType,
    threadId: string
  ): SemanticMemoryContext[] {
    const lastStep = task.steps[task.steps.length - 1];
    if (!lastStep) {
      throw new Error('Last step is not accessible.');
    }
    return memories.map((memory) => ({
      user_id: user_id,
      run_id: threadId,
      task_id: task.id,
      step_id: lastStep.id,
      fact: memory.fact,
      category: memory.category,
    }));
  }

  private formatToolResults(tools: ToolCallType[]): string {
    return tools
      .map((tool) => {
        if (tool.name === 'response_task') return null;
        const toolArgs = JSON.stringify(tool.args ?? {});
        const result = JSON.stringify(tool.result ?? 'No result');
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

  private filterMemoriesNotInSTM(
    retrievedMemories: memory.Similarity[],
    stmItems: (typeof GraphState.State)['memories']['stm']['items']
  ): memory.Similarity[] {
    const stepIdInMemory: string[] = [];
    stmItems.forEach((item) => {
      if (item) {
        stepIdInMemory.push(item.stepId);
      }
    });
    return retrievedMemories.filter(
      (mem) => mem.step_id && !stepIdInMemory.includes(mem.step_id)
    );
  }

  private async holistic_memory_manager(
    agentConfig: AgentConfig.Runtime,
    currentTask: TaskType
  ): Promise<{ updatedTask: TaskType }> {
    try {
      const stepsToSave = currentTask.steps.filter(
        (step) => !step.isSavedInMemory
      );
      if (stepsToSave.length === 0) {
        logger.info(
          '[HolisticMemoryManager] No new steps to save in memory, skipping.'
        );
        return { updatedTask: currentTask };
      }
      logger.info(
        `[HolisticMemoryManager] Saving ${stepsToSave.length} new steps to memory.`
      );
      await Promise.all(
        stepsToSave.map(async (step) => {
          const toolsToSave = step.tool.filter(
            (tool) => !EXECUTOR_CORE_TOOLS.has(tool.name)
          );

          logger.debug(
            `[HolisticMemoryManager] Processing step ${step.id}: ${toolsToSave.length} tools to save`
          );

          await Promise.all(
            toolsToSave.map(async (tool) => {
              const h_memory: HolisticMemoryContext = {
                user_id: agentConfig.user_id,
                task_id: currentTask.id,
                step_id: step.id,
                type: memory.HolisticMemoryEnumType.TOOL,
                content: `Tool: ${tool.name}\nArgs: ${JSON.stringify(tool.args)}\nResult: ${tool.result}`,
                request: currentTask.task?.directive ?? 'No request provided',
              };
              await this.memoryDBManager.upersertHolisticMemory(h_memory);
            })
          );
          const h_memory: HolisticMemoryContext = {
            user_id: agentConfig.user_id,
            task_id: currentTask.id,
            step_id: step.id,
            type: memory.HolisticMemoryEnumType.AI_RESPONSE,
            content: step.thought.text,
            request: currentTask.task?.directive ?? 'No request provided',
          };
          await this.memoryDBManager.upersertHolisticMemory(h_memory);
          step.isSavedInMemory = true;
        })
      );

      currentTask.steps = currentTask.steps.map((step) => {
        const updatedStep = stepsToSave.find((s) => s.id === step.id);
        return updatedStep ? updatedStep : step;
      });
      return { updatedTask: currentTask };
    } catch (error) {
      throw error;
    }
  }

  private async categorized_memory_manager(
    agentConfig: AgentConfig.Runtime,
    currentTask: TaskType,
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<void> {
    try {
      if (!['completed', 'failed'].includes(currentTask.status)) {
        logger.debug(
          `[LTMManager] Current task at index ${currentTask.id} is not completed or failed, skipping LTM update`
        );
        return;
      }
      const structuredModel = this.model.withStructuredOutput(
        createLtmSchemaMemorySchema(
          agentConfig.memory.size_limits.max_insert_episodic_size,
          agentConfig.memory.size_limits.max_insert_semantic_size
        )
      );
      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          process.env.DEV_PROMPT === 'true'
            ? TASK_MEMORY_MANAGER_SYSTEM_PROMPT
            : agentConfig.prompts.task_memory_manager_prompt,
        ],
        ['human', TASK_MEMORY_MANAGER_HUMAN_PROMPT],
      ]);
      // Use content of all steps of current task instead of just recent memories
      const allStepsContent = this.formatAllStepsOfCurrentTask(currentTask);
      const summaryResult: ltmSchemaType = (await structuredModel.invoke(
        await prompt.formatMessages({
          response: allStepsContent,
        })
      )) as ltmSchemaType;
      if (
        !summaryResult ||
        !summaryResult.episodic ||
        !summaryResult.semantic
      ) {
        throw new Error('LTM summary result is empty');
      }
      const episodic_memories: EpisodicMemoryContext[] = [];
      const semantic_memories: SemanticMemoryContext[] = [];

      episodic_memories.push(
        ...this.createEpisodicMemories(
          agentConfig.user_id,
          summaryResult.episodic,
          currentTask,
          config.configurable!.thread_id!
        )
      );

      semantic_memories.push(
        ...this.createSemanticMemories(
          agentConfig.user_id,
          summaryResult.semantic,
          currentTask,
          config.configurable!.thread_id!
        )
      );

      logger.debug(
        `[LTMManager] Generated summary: ${JSON.stringify(summaryResult, null, 2)}`
      );
      // Perform safe memory upsert with improved error handling
      const upsertResult = await this.memoryDBManager.upsertCategorizedMemory(
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
      return;
    } catch (error) {
      throw error;
    }
  }

  private async ltm_manager(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<{ lastNode: TaskMemoryNode; tasks?: TaskType[] } | Command> {
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
          `[Memory] Max steps reached (${state.currentGraphStep})`
        );
        throw new Error('Max memory graph steps reached');
      }
      if (config.configurable?.agent_config?.memory.ltm_enabled === false) {
        return { lastNode: TaskMemoryNode.END_GRAPH };
      }
      const agentConfig = config.configurable!.agent_config!;
      const currentTask = getCurrentTask(state.tasks);
      const recentMemories = STMManager.getRecentMemories(
        state.memories.stm,
        1
      );
      if (recentMemories.length === 0) {
        return { lastNode: TaskMemoryNode.END_GRAPH };
      }
      if (
        config.configurable?.agent_config?.memory.strategy ===
        MemoryStrategy.CATEGORIZED
      ) {
        await this.categorized_memory_manager(
          agentConfig,
          currentTask,
          state,
          config
        );
        state.tasks[state.tasks.length - 1].steps.forEach((step) => {
          step.isSavedInMemory = true;
        });
        return { lastNode: TaskMemoryNode.LTM_MANAGER, tasks: state.tasks };
      }

      if (
        config.configurable?.agent_config?.memory.strategy ===
        MemoryStrategy.HOLISTIC
      ) {
        const result = await this.holistic_memory_manager(
          agentConfig,
          currentTask
        );
        state.tasks[state.tasks.length - 1] = result.updatedTask;
        return { lastNode: TaskMemoryNode.LTM_MANAGER, tasks: state.tasks };
      }
      return {
        lastNode: TaskMemoryNode.LTM_MANAGER,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `[LTMManager] Critical error in LTM processing: ${errorMessage}`
      );
      const errorObject =
        error instanceof Error ? error : new Error(errorMessage);
      return handleNodeError(
        GraphErrorTypeEnum.MEMORY_ERROR,
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
  ): Promise<{ memories?: Memories; lastNode: TaskMemoryNode } | Command> {
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
          `[Memory] Max steps reached (${state.currentGraphStep})`
        );
        throw new Error('Max memory graph steps reached');
      }
      const agentConfig = config.configurable!.agent_config!;
      const recentSTM = STMManager.getRecentMemories(state.memories.stm, 1);
      if (recentSTM.length === 0) {
        return {
          memories: state.memories,
          lastNode: TaskMemoryNode.RETRIEVE_MEMORY,
        };
      }
      if (agentConfig.memory.ltm_enabled === false) {
        return { lastNode: TaskMemoryNode.END_GRAPH };
      }
      const request = getRetrieveMemoryRequestFromGraph(state, config);
      if (!request) {
        throw new Error('Failed to construct memory retrieval request');
      }
      const retrievedMemories =
        await this.memoryDBManager.retrieveSimilarMemories(
          request,
          agentConfig.user_id
        );

      if (!retrievedMemories.success || !retrievedMemories.data) {
        logger.warn(
          `[RetrieveMemory] Memory retrieval failed: ${retrievedMemories.error}`
        );
        return {
          memories: state.memories,
          lastNode: TaskMemoryNode.RETRIEVE_MEMORY,
        };
      }

      const filteredResults = this.filterMemoriesNotInSTM(
        retrievedMemories.data,
        state.memories.stm.items
      );
      logger.debug(
        `[RetrieveMemory] Filtered to ${filteredResults.length} memories after STM check`
      );
      const updatedMemories = MemoryStateManager.updateLTM(
        state.memories,
        filteredResults
      );
      return {
        memories: updatedMemories,
        lastNode: TaskMemoryNode.RETRIEVE_MEMORY,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `[RetrieveMemory] Critical error during memory retrieval: ${errorMessage}`
      );
      const errorObject =
        error instanceof Error ? error : new Error(errorMessage);
      return handleNodeError(
        GraphErrorTypeEnum.MEMORY_ERROR,
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
      const lastNode = state.lastNode;
      if (!MemoryStateManager.validate(state.memories)) {
        logger.error('[Memory] Invalid memory state');
        return TaskMemoryNode.END_GRAPH;
      }
      switch (true) {
        case isInEnum(TaskExecutorNode, lastNode):
          return TaskMemoryNode.LTM_MANAGER;

        case isInEnum(TaskManagerNode, lastNode):
          return TaskMemoryNode.RETRIEVE_MEMORY;

        case isInEnum(TaskVerifierNode, lastNode):
          return TaskMemoryNode.LTM_MANAGER;

        case isInEnum(TaskMemoryNode, lastNode):
          if (lastNode === TaskMemoryNode.RETRIEVE_MEMORY) {
            return TaskMemoryNode.END;
          }
          return TaskMemoryNode.END_GRAPH;
        default:
          logger.warn(`[Memory] Unknown node: ${lastNode}`);
          return TaskMemoryNode.END_GRAPH;
      }
    } catch (error: any) {
      logger.error(`[Memory] Routing error: ${error.message}`);
      return TaskMemoryNode.END_GRAPH;
    }
  }

  public getMemoryGraph() {
    return this.graph;
  }

  public createGraphMemory() {
    const memory_subgraph = new StateGraph(
      GraphState,
      GraphConfigurableAnnotation
    )
      .addNode(TaskMemoryNode.LTM_MANAGER, this.ltm_manager.bind(this))
      .addNode(TaskMemoryNode.RETRIEVE_MEMORY, this.retrieve_memory.bind(this))
      .addNode(
        TaskMemoryNode.END_GRAPH,
        routingFromSubGraphToParentGraphEndNode.bind(this)
      )
      .addConditionalEdges(START, this.memory_router.bind(this))
      .addEdge(TaskMemoryNode.LTM_MANAGER, TaskMemoryNode.RETRIEVE_MEMORY)
      .addEdge(TaskMemoryNode.RETRIEVE_MEMORY, END);
    this.graph = memory_subgraph.compile();
  }
}
