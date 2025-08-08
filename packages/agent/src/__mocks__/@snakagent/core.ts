export interface AgentConfig {
  id?: number;
  name: string;
  description?: string;
  group?: string;
  lore?: string[];
  objectives?: string[];
  knowledge?: string[];
  system_prompt?: string;
  interval?: number;
  plugins?: string[];
  memory?: {
    enabled?: boolean;
    shortTermMemorySize?: number;
    memorySize?: number;
  };
  rag?: {
    enabled?: boolean;
    embeddingModel?: string;
  };
  mode?: string;
  max_iterations?: number;
}

export interface RagConfig {
  enabled?: boolean;
  topK?: number;
  embeddingModel?: string;
}

export interface ModelLevelConfig {
  provider: string;
  model_name: string;
  description?: string;
  max_input_tokens?: number;
  max_output_tokens?: number;
}

export interface ModelsConfig {
  fast: ModelLevelConfig;
  smart: ModelLevelConfig;
  cheap: ModelLevelConfig;
  [levelName: string]: ModelLevelConfig;
}

export interface ApiKeys {
  openai?: string;
  anthropic?: string;
  gemini?: string;
  deepseek?: string;
  [providerName: string]: string | undefined;
}

export const logger = {
  warn: (..._args: any[]) => {},
  error: (..._args: any[]) => {},
  debug: (..._args: any[]) => {},
  info: (..._args: any[]) => {},
};

// Mock CustomHuggingFaceEmbeddings for tests
export class CustomHuggingFaceEmbeddings {
  constructor(fields?: any) {
    // Mock constructor
  }

  async embedQuery(query: string): Promise<number[]> {
    // Return a mock embedding vector with 384 dimensions (default for MiniLM)
    return Array.from({ length: 384 }, () => Math.random());
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    // Return mock embeddings for multiple documents
    return documents.map(() => Array.from({ length: 384 }, () => Math.random()));
  }
}

export interface CustomHuggingFaceEmbeddingsParams {
  model?: string;
  dtype?: string;
  device?: string | Record<string, string>;
  subfolder?: string;
  model_file_name?: string;
  use_external_data_format?: boolean | Record<string, boolean>;
  session_options?: Record<string, unknown>;
}