import { BaseMessage } from '@langchain/core/messages';
import {
  Annotation,
  START,
  END,
  StateGraph,
  CompiledStateGraph,
} from '@langchain/langgraph';
import { Agent, Memories, ParsedPlan } from '../types/index.js';
import { formatStepsForSTM } from '../utils.js';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { AgentConfig, logger } from '@snakagent/core';
import { ModelSelector } from 'agents/operators/modelSelector.js';
import { MemoryAgent } from 'agents/operators/memoryAgent.js';
import { AutonomousConfigurableAnnotation } from '../autonomous.js';
import { RunnableConfig } from '@langchain/core/runnables';
import { v4 as uuidv4 } from 'uuid';
import { PLANNER_ORCHESTRATOR } from '../types/index.js';
import { MemoryNode, DEFAULT_AUTONOMOUS_CONFIG } from '../config/autonomous-config.js';
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
  private graph: any;
  constructor(
    agentConfig: AgentConfig,
    modelSelector: ModelSelector | null,
    memoryAgent: MemoryAgent
  ) {
    this.modelSelector = modelSelector;
    this.agentConfig = agentConfig;
    this.memoryAgent = memoryAgent;
  }

  private async stm_manager(
    state: typeof MemoryState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): Promise<{
    memories: Memories;
  }> {
    try {
      logger.debug('STM Manager processing');
      
      const stmSize = config.configurable?.short_term_memory ?? DEFAULT_AUTONOMOUS_CONFIG.shortTermMemory;
      const stm = state.memories.stm || [];
      const new_message = formatStepsForSTM(
        state.plan.steps[state.currentStepIndex]
      );
      
      // Maintain STM size limit
      if (stm && stm.length >= stmSize) {
        stm.shift();
      }
      
      stm.push({ content: new_message, memories_id: uuidv4() });
      logger.debug(`STM updated with ${stm.length} items (max: ${stmSize})`);
      
      const memories: Memories = {
        stm: stm,
        ltm: state.memories.ltm,
      };
      
      return { memories };
    } catch (error) {
      logger.error(`[STM Manager] Failed to update short-term memory: ${error}`);
      // Return unchanged memories on error
      return { memories: state.memories };
    }
  }

  private async ltm_manager(
    state: typeof MemoryState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): Promise<{}> {
    try {
      logger.debug('LTM Manager processing');
      
      const model = this.modelSelector?.getModels()['fast'];
      if (!model) {
        throw new Error('Model not found in ModelSelector');
      }
      
      if (state.currentStepIndex === 0) {
        logger.debug('Skipping LTM for initial step');
        return {};
      }
      
      const currentStepIndex = state.currentStepIndex - 1;
      const current_step = state.plan.steps[currentStepIndex];
      
      if (!current_step) {
        logger.warn(`No step found at index ${currentStepIndex}`);
        return {};
      }
      
      const structured_output = z.object({
        summarize: z.string().describe('the summarization of the response.'),
      });

      type structured_output_type = z.infer<typeof structured_output>;

      const strucutred_model = model.withStructuredOutput(structured_output);
      const s_prompt = ChatPromptTemplate.fromMessages([
        ['system', summarize_prompt],
      ]);

      const structured_result = (await strucutred_model.invoke(
        await s_prompt.formatMessages({
          response: formatStepsForSTM(current_step),
        })
      )) as structured_output_type;

      logger.debug(`Summarized response for LTM: ${JSON.stringify(structured_result)}`);
      
      // Safely access STM with error handling
      const lastSTMItem = state.memories.stm?.[state.memories.stm.length - 1];
      if (!lastSTMItem) {
        logger.warn('No STM item found for LTM upsert');
        return {};
      }
      
      // Perform memory upsert with error handling
      await this.memoryAgent.upsertMemory(
        structured_result.summarize,
        lastSTMItem.memories_id,
        `${current_step.stepName}: ${current_step.description}`,
        config.metadata?.run_id as string,
        10
      );
      
      logger.debug('LTM upsert completed successfully');
      return {};
    } catch (error) {
      logger.error(`[LTM Manager] Failed to process long-term memory: ${error}`);
      // Don't throw - allow graph to continue
      return {};
    }
  }

  private memory_router(
    state: typeof MemoryState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): MemoryNode {
    logger.debug(`[Memory Router] Last agent: ${state.last_agent}`);
    
    if (state.last_agent === Agent.PLANNER_VALIDATOR) {
      return MemoryNode.RETRIEVE_MEMORY;
    }
    if (state.last_agent === Agent.EXEC_VALIDATOR) {
      return MemoryNode.STM_MANAGER;
    }
    return MemoryNode.END;
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
