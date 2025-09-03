import axios, { AxiosInstance, AxiosResponse } from 'axios';
import FormData from 'form-data';
import { 
  SnakConfig, 
  AgentRequest, 
  AgentResponse, 
  FileUploadResponse, 
  FileListResponse,
  AgentConfig,
  CreateAgentRequest
} from './types.js';

export class SnakClient {
  private client: AxiosInstance;
  private config: SnakConfig;

  constructor(config: SnakConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 1800000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.userId && { 'x-user-id': config.userId }),
        ...(config.apiKey && { 'x-api-key': config.apiKey }),
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ Request error:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error(`❌ ${error.response?.status || 'Network Error'} ${error.config?.url}:`, error.message);
        return Promise.reject(error);
      }
    );
  }

  async sendAgentRequest(request: AgentRequest): Promise<AgentResponse> {
    const response: AxiosResponse<AgentResponse> = await this.client.post('/api/agents/request', request);
    return response.data;
  }

  async stopAgent(agentId: string): Promise<AgentResponse> {
    const response: AxiosResponse<AgentResponse> = await this.client.post('/api/agents/stop_agent', {
      agent_id: agentId
    });
    return response.data;
  }

  async getAgents(): Promise<AgentConfig[]> {
    const response: AxiosResponse<AgentConfig[]> = await this.client.get('/api/agents/get_agents');
    return response.data;
  }

  async getAgent(agentId: string): Promise<AgentConfig> {
    const response: AxiosResponse<AgentConfig> = await this.client.get(`/api/agents/${agentId}`);
    return response.data;
  }

  async createAgent(agentData: CreateAgentRequest): Promise<AgentConfig> {
    const response: AxiosResponse<AgentConfig> = await this.client.post('/api/agents/init_agent', agentData);
    return response.data;
  }

  async updateAgent(agentId: string, agentData: Partial<CreateAgentRequest>): Promise<AgentConfig> {
    const response: AxiosResponse<AgentConfig> = await this.client.put(`/api/agents/${agentId}`, agentData);
    return response.data;
  }

  async deleteAgent(agentId: string): Promise<void> {
    await this.client.post('/api/agents/delete_agent', { agent_id: agentId });
  }

  async uploadFile(agentId: string, fileBuffer: Buffer, filename: string): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append('agentId', agentId);
    formData.append('file', fileBuffer, filename);

    const response: AxiosResponse<FileUploadResponse> = await this.client.post('/api/files/upload', formData, {
      headers: {
        ...formData.getHeaders(),
        ...(this.config.userId && { 'x-user-id': this.config.userId }),
        ...(this.config.apiKey && { 'x-api-key': this.config.apiKey }),
      },
    });
    return response.data;
  }

  async listFiles(agentId: string): Promise<FileListResponse> {
    const response: AxiosResponse<FileListResponse> = await this.client.post('/api/files/list', {
      agentId
    });
    return response.data;
  }

  async getMetrics(): Promise<string> {
    const response: AxiosResponse<string> = await this.client.get('/metrics');
    return response.data;
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      const response = await this.client.get('/api/agents/health');
      return response.data;
    } catch (error) {
      try {
        await this.client.get('/api/agents');
        return { status: 'healthy', timestamp: new Date().toISOString() };
      } catch {
        throw new Error('Service is not responding');
      }
    }
  }
}
