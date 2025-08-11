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
  warn: (..._args: unknown[]): void => {
    void _args;
  },
  error: (..._args: unknown[]): void => {
    void _args;
  },
  debug: (..._args: unknown[]): void => {
    void _args;
  },
  info: (..._args: unknown[]): void => {
    void _args;
  },
};

// Mock CustomHuggingFaceEmbeddings for tests
export class CustomHuggingFaceEmbeddings {
  constructor(fields?: Partial<CustomHuggingFaceEmbeddingsParams>) {
    // Mock constructor
    void fields;
  }

  async embedQuery(query: string): Promise<number[]> {
    const dim = 384;
    const len = query.length;
    if (len === 0) {
      return Array(dim).fill(0);
    }
    return Array.from({ length: dim }, (_v, i) => {
      const ch = query.charCodeAt(i % len);
      return ((ch + i * 31) % 1000) / 1000;
    });
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    // Reuse embedQuery for deterministic per-document embeddings
    return Promise.all(documents.map((d) => this.embedQuery(d)));
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