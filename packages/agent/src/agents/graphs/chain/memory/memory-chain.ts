import {
  GraphConfigurableAnnotation,
  GraphState,
} from '@agents/graphs/graph.js';
import { MemoryNode } from '@enums/agent-modes.enum.js';
import {
  Runnable,
  RunnableConfig,
  RunnableSequence,
} from '@langchain/core/runnables';
import { MemoryStateManager } from '@lib/memory/index.js';
import { CustomHuggingFaceEmbeddings, logger } from '@snakagent/core';
import { memory } from '@snakagent/database/queries';
import { Memories } from '@stypes/memory.types.js';

export const embeddingModel = new CustomHuggingFaceEmbeddings({
  model: 'Xenova/all-MiniLM-L6-v2',
  dtype: 'fp32',
});

// Node to retrieve relevant memories from the database
export function createRetrieveMemoryNode(): (
  state: typeof GraphState.State,
  config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
) => Promise<{ memories?: Memories; last_node: MemoryNode }> {
  const chain = createRetrieveMemoryChain();
  return async (
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<{ memories?: Memories; last_node: MemoryNode }> => {
    try {
      logger.debug('[MemoryNode] Starting memory context retrieval');
      if (!MemoryStateManager.validate(state.memories)) {
        logger.error('[MemoryNode] Invalid memory state detected.');
        return {
          last_node: MemoryNode.RETRIEVE_MEMORY,
        };
      }
      const result = await chain.invoke(state, config);
      logger.debug(`[MemoryNode] Retrieved  ${result.length} memory context`);

      logger.debug(
        '[MemoryNode] Starting filtering the retrieve memories prevent doubles'
      );
      const stm_current_step_ids = state.memories.stm.items
        .filter((item) => item !== null && item !== undefined)
        .map((item) => item!.task_id);
      console.log('STM current step ids: ', stm_current_step_ids);
      const filtered_results = result.filter(
        (mem) => !stm_current_step_ids.includes(mem.step_id)
      );
      logger.debug(
        `[MemoryNode] Filtered to ${filtered_results.length} memories after STM check`
      );
      // Update LTM context safely
      const updatedMemories = MemoryStateManager.updateLTM(
        state.memories,
        filtered_results
      );
      return {
        memories: updatedMemories,
        last_node: MemoryNode.RETRIEVE_MEMORY,
      };
    } catch (error) {
      logger.error(`[MemoryNode] Error retrieving memories: ${error}`);

      // Return safe fallback with error information
      const fallbackMemories: Memories = {
        ...state.memories,
        lastError: {
          type: 'MEMORY_RETRIEVAL_ERROR',
          message: error.message,
          timestamp: Date.now(),
        },
      };

      return {
        memories: fallbackMemories,
        last_node: MemoryNode.RETRIEVE_MEMORY,
      };
    }
  };
}

/**
 * Creates a LangGraph chain to fetch relevant memories using the last
 * user message. This mirrors the chain used for documents so LangSmith
 * can trace memory retrieval.
 */
export function createRetrieveMemoryChain(): Runnable<
  typeof GraphState.State,
  memory.Similarity[]
> {
  const buildQuery = (
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): string => {
    const agentConfig = config.configurable?.agent_config;
    if (!agentConfig) {
      throw new Error(`[MemoryAgent] AgentConfig is undefined.`);
    }
    if (state.tasks.length === 0) {
      // Start of the run use the query or objectives
      return config.configurable!.objectives;
    } else {
      // Maybe check with the reasoning part instead of the directive partq
      return state.tasks[state.tasks.length - 1].task.directive;
    }
  };

  const fetchMemories = async (
    query: string,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<memory.Similarity[]> => {
    const runId = config?.configurable?.thread_id as string;
    const userId = 'default_user'; // Change it to a config value later
    const limit = config!.configurable!.memory_config!.max_retrieve_memory_size;
    const insert_threshold =
      config!.configurable!.memory_config!.retrieve_memory_threshold;
    const embedding = await embeddingModel.embedQuery(query);
    const memResults = await memory.retrieve_memory(
      userId,
      runId,
      embedding,
      limit,
      insert_threshold
    );
    return memResults;
  };
  return RunnableSequence.from<typeof GraphState.State, memory.Similarity[]>([
    buildQuery,
    fetchMemories,
  ]).withConfig({
    runName: 'Memory Retrieval Chain',
  });
}
