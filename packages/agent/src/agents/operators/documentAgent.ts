import { BaseAgent, AgentType } from '../core/baseAgent.js';
import { logger } from '@snakagent/core';
import { BaseMessage, HumanMessage } from '@langchain/core/messages';
import { CustomHuggingFaceEmbeddings } from '../../memory/customEmbedding.js';
import { documents } from '@snakagent/database/queries';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { RunnableSequence } from '@langchain/core/runnables';

export interface DocumentAgentConfig {
  topK?: number;
  embeddingModel?: string;
}

export class DocumentAgent extends BaseAgent {
  private embeddings: CustomHuggingFaceEmbeddings;
  private topK: number;
  private initialized = false;

  constructor(config: DocumentAgentConfig = {}) {
    super('document-agent', AgentType.OPERATOR);
    this.topK = config.topK ?? 4;
    this.embeddings = new CustomHuggingFaceEmbeddings({
      model: config.embeddingModel || 'Xenova/all-MiniLM-L6-v2',
      dtype: 'fp32',
    });
  }

  public async init(): Promise<void> {
    await documents.init();
    this.initialized = true;
  }

  public async retrieveRelevantDocuments(
    message: string | BaseMessage,
    k: number = this.topK,
  ): Promise<documents.SearchResult[]> {
    if (!this.initialized) {
      throw new Error('DocumentAgent: Not initialized');
    }
    const query = typeof message === 'string' ? message : String(message.content);
    const embedding = await this.embeddings.embedQuery(query);
    return await documents.search(embedding, k);
  }

  public formatDocumentsForContext(results: documents.SearchResult[]): string {
    if (!results.length) return '';
    const formatted = results
      .map(
        (r) =>
          `Document [id: ${r.document_id}, chunk: ${r.chunk_index}, similarity: ${r.similarity.toFixed(4)}]: ${r.content}`,
      )
      .join('\n\n');
    return `### Document Context (use the following snippets if relevant to the question) \n\
  Format:
    Document [id: <file>, chunk: <index>, similarity: <score>]: <text excerpt>
  Instructions:
    1. Scan all snippets to find those relevant to the query.
    2. When an excerpt adds useful information, quote or integrate it.
    3. Do not skip these snippets for the sake of brevity.
###\n${formatted}\n\n`;
  }

  public async enrichPromptWithDocuments(
    prompt: ChatPromptTemplate,
    message: string | BaseMessage,
    k: number = this.topK,
  ): Promise<ChatPromptTemplate> {
    const docs = await this.retrieveRelevantDocuments(message, k);
    if (!docs.length) return prompt;
    const context = this.formatDocumentsForContext(docs);
    return prompt.partial({ documents: context });
  }

  /**
   * Execute a search against stored document chunks.
   * Returns either formatted context or raw results depending on config.
   */
  public async execute(
    input: string | BaseMessage | any,
    config?: Record<string, any>,
  ): Promise<any> {
    if (!this.initialized) {
      throw new Error('DocumentAgent: Not initialized');
    }

    const query =
      typeof input === 'string'
        ? input
        : input instanceof BaseMessage
          ? String(input.content)
          : JSON.stringify(input);

    logger.debug(`DocumentAgent: Searching documents for query "${query}"`);

    const k = config?.topK ?? this.topK;
    const results = await this.retrieveRelevantDocuments(query, k);

    if (config?.raw) {
      return results;
    }

    return this.formatDocumentsForContext(results);
  }

  public createDocumentChain(): any {
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
      const docs = await this.retrieveRelevantDocuments(query, this.topK);
      return this.formatDocumentsForContext(docs);
    };

    return RunnableSequence.from([
      buildQuery,
      retrieve,
      (context: string) => ({ documents: context }),
    ]).withConfig({ runName: 'DocumentContextChain' });
  }

  public createDocumentNode(): any {
    const chain = this.createDocumentChain();
    return async (state: any, _config: LangGraphRunnableConfig) => {
      try {
        return await chain.invoke(state);
      } catch (error) {
        logger.error('Error retrieving documents:', error);
        return { documents: '' };
      }
    };
  }
}
