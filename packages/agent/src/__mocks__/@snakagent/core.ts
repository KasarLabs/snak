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
