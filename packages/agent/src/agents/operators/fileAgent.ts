import { BaseAgent, AgentType } from '../core/baseAgent.js';
import { logger } from '@snakagent/core';
import { BaseMessage } from '@langchain/core/messages';
import { CustomHuggingFaceEmbeddings } from '../../memory/customEmbedding.js';
import { documents } from '@snakagent/database/queries';
import { ChatPromptTemplate } from '@langchain/core/prompts';

export interface FileAgentConfig {
  topK?: number;
  embeddingModel?: string;
}

export class FileAgent extends BaseAgent {
  private embeddings: CustomHuggingFaceEmbeddings;
  private topK: number;
  private initialized = false;

  constructor(config: FileAgentConfig = {}) {
    super('file-agent', AgentType.OPERATOR);
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
      throw new Error('FileAgent: Not initialized');
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
    return `### Document Context ###\n${formatted}\n\n`;
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
      throw new Error('FileAgent: Not initialized');
    }

    const query =
      typeof input === 'string'
        ? input
        : input instanceof BaseMessage
          ? String(input.content)
          : JSON.stringify(input);

    logger.debug(`FileAgent: Searching documents for query "${query}"`);

    const k = config?.topK ?? this.topK;
    const results = await this.retrieveRelevantDocuments(query, k);

    if (config?.raw) {
      return results;
    }

    return this.formatDocumentsForContext(results);
  }
}
