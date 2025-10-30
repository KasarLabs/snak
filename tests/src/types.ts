export interface SnakConfig {
  baseUrl: string;
  userId?: string;
  apiKey?: string;
}

export interface AgentRequest {
  request: {
    content: string;
    agent_id: string;
  };
}

export interface FileUploadResponse {
  jobId: string;
}

export interface JobStatus {
  id: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  error?: string;
  createdAt?: Date;
  processedOn?: Date;
  finishedOn?: Date;
}

export interface QueueMetrics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface StoredFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: string;
  uploadDate: string;
}

export type FileListResponse = StoredFile[];

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

export interface TestResult<T = unknown> {
  testName: string;
  success: boolean;
  durationMs: number;
  error?: string;
  response?: T;
}
