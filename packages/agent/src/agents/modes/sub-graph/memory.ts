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
  History,
  StepInfo,
  HistoryItem,
} from '../types/index.js';
import {
  checkAndReturnLastItemFromPlansOrHistories,
  getCurrentPlanStep,
  getCurrentHistoryItem,
  estimateTokens,
  formatSteporHistoryForSTM,
  handleNodeError,
  createErrorCommand,
} from '../utils.js';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { AgentConfig, logger } from '@snakagent/core';
import { ModelSelector } from '../../../agents/operators/modelSelector.js';
import { MemoryAgent } from '../../../agents/operators/memoryAgent.js';
import { GraphConfigurableAnnotation, GraphState, ExecutionMode } from '../graph.js';
import { RunnableConfig } from '@langchain/core/runnables';
import { MemoryNode, DEFAULT_GRAPH_CONFIG } from '../config/default-config.js';
import { MemoryStateManager, STMManager } from '../utils/memory-utils.js';
import { MemoryDBManager } from '../utils/memory-db-manager.js';

export type GraphStateType = typeof GraphState.State;

const summarize_content = `
You are a data summarization expert. Create DETAILED, COMPREHENSIVE summaries that retain maximum information from the source material.
Key Instructions:

Generate extensive summaries (aim for 20-30% of original length, not 1-2%)
Include ALL important facts, figures, examples, and relationships
Preserve nuances, context, and supporting details
Organize information clearly but DO NOT oversimplify
Remove only true redundancies and filler words
Maintain technical accuracy and specific terminology
Structure output with sections, subsections, and bullet points for clarity

Your goal: Produce thorough reference documents that someone could use instead of reading the original, losing minimal information in the process.`;

const ltm_summarize_prompt = `You are a memory integration agent that processes responses into Long-Term Memory (LTM) with episodic and semantic components. Your task is to EXHAUSTIVELY analyze the given response and create structured memory entries.

## Core Principles
1. **Capture ALL quantitative data** - Never omit numbers, percentages, dates, amounts, or rankings
2. **Preserve specificity** - Keep exact values, names, and details rather than generalizing
3. **Extract relationships** - Note comparisons, trends, and connections between data points
4. **Include context** - Preserve temporal, geographical, and conditional information

## Extraction Guidelines

### Episodic Events
Extract specific occurrences, actions, or analyses performed:
- Include what was analyzed/done AND key findings
- Preserve temporal markers (dates, timeframes, sequences)
- Include quantitative outcomes in the content description
- List all data sources, tools, or URLs accessed

### Semantic Facts
Extract ALL factual information, discoveries, and knowledge:
- **Quantitative facts**: All numbers, statistics, percentages, amounts, rankings
- **Comparative observations**: Growth rates, differences, trends, changes over time
- **Regulatory/procedural facts**: Rules, requirements, deadlines, processes
- **Qualitative findings**: Preferences, characteristics, advantages/disadvantages
- **Conditional facts**: "If X then Y" relationships, exceptions, special cases

## Categories (expanded)
- "statistic" - Numerical data, percentages, rankings
- "regulation" - Laws, taxes, requirements, compliance
- "trend" - Changes over time, growth/decline patterns
- "comparison" - Relative differences between entities
- "procedure" - How-to information, processes, steps
- "characteristic" - Properties, features, qualities
- "preference" - User or market preferences
- "fact" - General factual information
- "skill" - Abilities or competencies
- "relationship" - Connections between entities

## Output Format
{{
  "episodic": [
    {{
      "name": "descriptive_identifier",
      "content": "what happened + key quantitative findings",
      "source": ["specific_sources_with_urls"]
    }}
  ],
  "semantic": [
    {{
      "fact": "complete fact with specific numbers/details",
      "category": "appropriate_category",
      "context": "conditions or scope if applicable"
    }}
  ]
}}

## Critical Rules
1. **Never summarize numbers** - Write "€45.2M" not "millions of euros"
2. **Include ALL statistics** - Every percentage, ranking, amount mentioned
3. **Preserve comparisons** - Keep relative information (X is 35% more than Y)
4. **Extract multi-part facts separately** - Split compound facts into individual entries
5. **Include negative findings** - What's NOT happening is also important
6. **Preserve source attribution** - Especially for data from specific years or reports

## Example with Rich Data Extraction

Response: "Analysis of European renewable energy market shows €127.3B invested in 2023, with Germany leading at €31.2B (24.5%) and France at €22.7B (17.8%). Wind power capacity grew +18.2 GW year-over-year, representing 43% growth. Solar installations reached 56.4 GW, up from 41.7 GW in 2022. Feed-in tariff rates vary by country: Germany offers €0.082/kWh for solar under 100kW, €0.071/kWh for 100-750kW, and €0.057/kWh above 750kW. France provides €0.091/kWh flat rate. EU directive requires 42.5% renewable energy by 2030, with penalties of €100,000 per day for non-compliance. Offshore wind shows highest growth at +67% YoY but costs 40% more than onshore. Application processing takes 18-24 months average."

Output:
{{
  "episodic": [
    {{
      "name": "european_renewable_energy_analysis_2023",
      "content": "Analyzed European renewable energy market revealing €127.3B total investment with Germany leading at €31.2B and France at €22.7B, wind capacity grew +18.2 GW YoY",
      "source": ["energy_market_report"]
    }}
  ],
  "semantic": [
    {{
      "fact": "European renewable energy investment totaled €127.3B in 2023",
      "category": "statistic",
      "context": "annual_total"
    }},
    {{
      "fact": "Germany leads European renewable investment at €31.2B (24.5% of total)",
      "category": "statistic",
      "context": "2023"
    }},
    {{
      "fact": "France is second in renewable investment at €22.7B (17.8% of total)",
      "category": "statistic",
      "context": "2023"
    }},
    {{
      "fact": "Wind power capacity increased +18.2 GW year-over-year",
      "category": "trend",
      "context": "2022-2023"
    }},
    {{
      "fact": "Wind power growth rate reached 43% annually",
      "category": "trend",
      "context": "2023"
    }},
    {{
      "fact": "Solar installations reached 56.4 GW in 2023",
      "category": "statistic",
      "context": "2023"
    }},
    {{
      "fact": "Solar installations were 41.7 GW in 2022",
      "category": "statistic",
      "context": "2022"
    }},
    {{
      "fact": "Germany feed-in tariff: €0.082/kWh for solar under 100kW",
      "category": "regulation"
    }},
    {{
      "fact": "Germany feed-in tariff: €0.071/kWh for solar 100-750kW",
      "category": "regulation"
    }},
    {{
      "fact": "Germany feed-in tariff: €0.057/kWh for solar above 750kW",
      "category": "regulation"
    }},
    {{
      "fact": "France offers €0.091/kWh flat rate feed-in tariff",
      "category": "regulation"
    }},
    {{
      "fact": "EU requires 42.5% renewable energy by 2030",
      "category": "regulation"
    }},
    {{
      "fact": "Non-compliance penalty is €100,000 per day",
      "category": "regulation"
    }},
    {{
      "fact": "Offshore wind shows +67% YoY growth",
      "category": "trend",
      "context": "highest_growth_sector"
    }},
    {{
      "fact": "Offshore wind costs 40% more than onshore wind",
      "category": "comparison"
    }},
    {{
      "fact": "Renewable energy application processing takes 18-24 months average",
      "category": "procedure"
    }}
  ]
}}
## Checklist for Completeness
Before finalizing output, verify you've captured:
- [ ] All numerical values and percentages
- [ ] All entity names (countries, companies, organizations)
- [ ] All temporal information (dates, deadlines, timeframes)
- [ ] All comparative statements
- [ ] All conditional rules or exceptions
- [ ] All process steps or requirements
- [ ] Growth/change indicators
- [ ] Rankings or positions;
`;
// export const GraphState = Annotation.Root({
//   last_agent: Annotation<Agent>,
//   memories: Annotation<Memories>,
//   plans_or_histories: Annotation<Array<ParsedPlan | History> | undefined>,
//   currentStepIndex: Annotation<number>,
//   currentGraphStep: Annotation<number>,
// });

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
    const embeddings = memoryAgent.getEmbeddings();
    if (embeddings) {
      this.memoryDBManager = new MemoryDBManager(embeddings, 3, 8000);
    }
  }

  private async summarize_before_inserting(
    content: string
  ): Promise<{ content: string; tokens: number }> {
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
        ['system', summarize_content],
        new MessagesPlaceholder('content'),
      ]);

      const summaryResult = await model.invoke(
        await prompt.formatMessages({
          content: content,
        })
      );
      return {
        content: summaryResult.content as string,
        tokens: estimateTokens(summaryResult.content as string),
      };
    } catch (error: any) {
      throw error;
    }
  }

  private async stm_manager(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<{
    memories: Memories;
    plans_or_histories?: ParsedPlan;
  } | Command> {
    try {
      logger.debug('[STMManager] Processing memory update');
      if (
        state.currentGraphStep >=
        (config.configurable?.max_graph_steps ??
          DEFAULT_GRAPH_CONFIG.maxGraphSteps)
      ) {
        logger.warn(
          `[MemoryRouter] Memory sub-graph limit reached (${state.currentGraphStep}), routing to END`
        );
        return {
          memories: state.memories,
        };
      }
      let item: StepInfo | HistoryItem | null = null;
      
      if (state.executionMode === ExecutionMode.PLANNING) {
        item = getCurrentPlanStep(state.plans_or_histories, state.currentStepIndex - 1);
      } else if (state.executionMode === ExecutionMode.REACTIVE) {
        item = getCurrentHistoryItem(state.plans_or_histories);
      }
      
      if (!item) {
        logger.warn(
          '[STMManager] No current step or history item found, returning unchanged memories'
        );
        return {
          memories: state.memories,
        };
      }
      if (item.type === 'tools') {
        const result = await Promise.all(
          item.tools?.map(async (tool) => {
            if (estimateTokens(tool.result) >= 2000) {
              let result = await this.summarize_before_inserting(tool.result);
              tool.result = result.content;
              return tool;
            }
            return tool;
          }) ?? []
        );
        item.tools = result;
      }
      if (
        item.type === 'message' &&
        item.message &&
        item.message.tokens >= 3000
      ) {
        let result = await this.summarize_before_inserting(
          item.message.content
        );
        item.message = result;
      }
      const date = Date.now();

      const result = MemoryStateManager.addSTMMemory(
        state.memories,
        item,
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
    } catch (error: any) {
      logger.error(`[STMManager] Critical error in STM processing: ${error}`);
      return handleNodeError(error, 'STM_MANAGER', state, 'STM processing failed');
    }
  }

  private async ltm_manager(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<{ memories?: Memories } | Command> {
    try {
      // Skip LTM processing for initial step
      if (state.currentStepIndex === 0) {
        logger.debug('[LTMManager] Skipping LTM for initial step');
        return {};
      }

      if (
        state.currentGraphStep >=
        (config.configurable?.max_graph_steps ??
          DEFAULT_GRAPH_CONFIG.maxGraphSteps)
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

      const model = this.modelSelector.getModels()['cheap'];
      if (!model) {
        throw new Error('Fast model not available for LTM processing');
      }

      let recentMemories = STMManager.getRecentMemories(
        state.memories.stm,
        1
      );

      if (recentMemories.length === 0) {
        logger.warn(
          '[LTMManager] No recent STM items available for LTM upsert'
        );
        return {};
      }

      const structuredModel = model.withStructuredOutput(ltmSchema);
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', ltm_summarize_prompt],
        ['human', `TEXT_TO_ANALYZE : {response}`],
      ]);

      const summaryResult = (await structuredModel.invoke(
        await prompt.formatMessages({
          response: formatSteporHistoryForSTM(
            recentMemories[0].step_or_history
          ),
        })
      )) as ltmSchemaType;

      const episodic_memories: EpisodicMemoryContext[] = [];
      const semantic_memories: SemanticMemoryContext[] = [];

      summaryResult.episodic.forEach((memory) => {
        const episodic_memory: EpisodicMemoryContext = {
          user_id: 'default_user',
          run_id: config.configurable?.conversation_id as string, //TODO add DEFAULT CONFIG
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
          `[LTMManager] Successfully upserted memory for current step`
        );
      } else {
        logger.warn(
          `[LTMManager] Failed to upsert memory: ${upsertResult.error}`
        );
      }

      return {};
    } catch (error: any) {
      logger.error(`[LTMManager] Critical error in LTM processing: ${error}`);
      return handleNodeError(error, 'LTM_MANAGER', state, 'LTM processing failed');
    }
  }

  private memory_router(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): MemoryNode {
    const lastAgent = state.last_agent;
    logger.debug(`[MemoryRouter] Routing from agent: ${lastAgent}`);

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

    const maxSteps =
      config.configurable?.max_graph_steps ??
      DEFAULT_GRAPH_CONFIG.maxGraphSteps;
    if (maxSteps <= state.currentGraphStep) {
      logger.warn('[Router] Max graph steps reached, routing to END node');
      return MemoryNode.END_MEMORY_GRAPH;
    }

    // Route based on previous agent and current state
    switch (lastAgent) {
      case Agent.PLANNER_VALIDATOR:
        // After plan_or_history validation, retrieve relevant context
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
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ) {
    logger.info('[EndMemoryGraph] Cleaning up memory graph state');
    return new Command({
      update: {
        plans_or_histories: undefined,
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
      GraphState,
      GraphConfigurableAnnotation
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
