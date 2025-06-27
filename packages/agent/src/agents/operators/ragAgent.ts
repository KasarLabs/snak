import { BaseAgent, AgentType } from '../core/baseAgent.js';
import { logger } from '@snakagent/core';
import { BaseMessage, HumanMessage } from '@langchain/core/messages';
import { CustomHuggingFaceEmbeddings } from '@snakagent/core';
import { rag } from '@snakagent/database/queries';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { RunnableSequence } from '@langchain/core/runnables';

const SIMILARITY_THRESHOLD = (() => {
  const value = parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || '0.5');
  if (isNaN(value) || value < 0 || value > 1) {
    logger.warn(
      `Invalid RAG_SIMILARITY_THRESHOLD: ${process.env.RAG_SIMILARITY_THRESHOLD}, using default 0.5`
    );
    return 0.5;
  }
  return value;
})();

export interface RagConfig {
  enabled?: boolean;
  topK?: number;
  embeddingModel?: string;
}

export class RagAgent extends BaseAgent {
  private embeddings: CustomHuggingFaceEmbeddings;
  private topK: number;
  private initialized = false;

  constructor(config: RagConfig = {}) {
    super('rag-agent', AgentType.OPERATOR);
    this.topK = config.topK ?? 4;
    this.embeddings = new CustomHuggingFaceEmbeddings({
      model: config.embeddingModel || 'Xenova/all-MiniLM-L6-v2',
      dtype: 'fp32',
    });
  }

  public async init(): Promise<void> {
    await rag.init();
    this.initialized = true;
  }

  public async retrieveRelevantRag(
    message: string | BaseMessage,
    k: number = this.topK,
    agentId: string = ''
  ): Promise<rag.SearchResult[]> {
    if (!this.initialized) {
      throw new Error('RagAgent: Not initialized');
    }
    const query =
      typeof message === 'string' ? message : String(message.content);
    const embedding = await this.embeddings.embedQuery(query);
    const results = await rag.search(embedding, agentId, k);
    return results.filter((r) => r.similarity >= SIMILARITY_THRESHOLD);
  }

  public formatRagForContext(results: rag.SearchResult[]): string {
    if (!results.length) return '';
    const formatted = results
      .map(
        (r) =>
          `Rag [id: ${r.document_id}, chunk: ${r.chunk_index}, similarity: ${r.similarity.toFixed(4)}]: ${r.content}`
      )
      .join('\n\n');
    return `### Rag Context (use the following snippets if relevant to the question) \n\
  Format:
    Rag [id: <file>, chunk: <index>, similarity: <score>]: <text excerpt>
  Instructions:
    1. Scan all snippets to find those relevant to the query.
    2. When an excerpt adds useful information, quote or integrate it.
    3. Do not skip these snippets for the sake of brevity.
###\n${formatted}\n\n`;
  }

  public async enrichPromptWithRag(
    prompt: ChatPromptTemplate,
    message: string | BaseMessage,
    k: number = this.topK,
    agentId: string
  ): Promise<ChatPromptTemplate> {
    const docs = await this.retrieveRelevantRag(message, k, agentId);
    if (!docs.length) return prompt;
    const context = this.formatRagForContext(docs);
    return prompt.partial({ rag: context });
  }

  /**
   * Execute a search against stored document chunks.
   * Returns either formatted context or raw results depending on config.
   */
  public async execute(
    input: string | BaseMessage | any,
    _isInterrupted?: boolean,
    config?: Record<string, any>
  ): Promise<any> {
    if (!this.initialized) {
      throw new Error('RagAgent: Not initialized');
    }
    const query =
      typeof input === 'string'
        ? input
        : input instanceof BaseMessage
          ? String(input.content)
          : JSON.stringify(input);

    logger.debug(`RagAgent: Searching rag for query "${query}"`);

    const k = config?.topK ?? this.topK;
    const agentId = config?.agentId;
    const results = await this.retrieveRelevantRag(query, k, agentId);

    if (config?.raw) {
      return results;
    }

    return this.formatRagForContext(results);
  }

  public createRagChain(agentId: string): any {
    const buildQuery = (state: any) => {
      const lastUser = [...state.messages]
        .reverse()
        .find((msg: BaseMessage) => msg instanceof HumanMessage);
      return lastUser
        ? typeof lastUser.content === 'string'
          ? lastUser.content
          : JSON.stringify(lastUser.content)
        : (state.messages[0]?.content as string);
    };

    const retrieve = async (query: string) => {
      const docs = await this.retrieveRelevantRag(query, this.topK, agentId);
      return this.formatRagForContext(docs);
    };

    return RunnableSequence.from([
      buildQuery,
      retrieve,
      (context: string) => ({ rag: context }),
    ]).withConfig({ runName: 'RagContextChain' });
  }

  public createRagNode(agentId: string): any {
    const chain = this.createRagChain(agentId);
    return async (state: any, _config: LangGraphRunnableConfig) => {
      try {
        return await chain.invoke(state);
      } catch (error) {
        logger.error('Error retrieving rag:', error);
        return { rag: '' };
      }
    };
  }
}