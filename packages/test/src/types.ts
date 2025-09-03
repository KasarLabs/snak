export interface SnakConfig {
  baseUrl: string;
  userId?: string;
  apiKey?: string;
}

export interface AgentRequest {
  request: {
    content: string;
    agent_id?: string;
  };
}

export interface AgentResponse {
  status: 'success' | 'failure' | 'waiting_for_human_input';
  data?: unknown;
}

export interface FileUploadResponse {
  chunks: Array<{
    content: string;
    metadata: {
      source: string;
      chunk_index: number;
      [key: string]: any;
    };
  }>;
  totalChunks: number;
}

export interface FileListResponse {
  files: Array<{
    id: string;
    filename: string;
    uploadedAt: string;
    size: number;
  }>;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  tools: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentPrompt {
  lore: string[];
  objectives: string[];
  knowledge: string[];
}

export interface AgentMemory {
  enabled: boolean;
  shortTermMemorySize: number;
  memorySize: number;
}

export interface AgentRag {
  enabled: boolean;
  embeddingModel: string | null;
}

export interface AgentInitializationDTO {
  name: string;
  group: string;
  description: string;
  lore: string[];
  objectives: string[];
  knowledge: string[];
  interval: number;
  plugins: string[];
  memory: AgentMemory;
  rag: AgentRag;
  mode: string;
}

export interface CreateAgentRequest {
  agent: AgentInitializationDTO;
}

export interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  error?: string;
  response?: any;
}
