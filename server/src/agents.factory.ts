import { Injectable } from '@nestjs/common';
import { ConfigurationService } from '../config/configuration.js';
import { StarknetAgent, AgentConfig, AgentMode } from '@snakagent/agents';

@Injectable()
export class AgentFactory {
  private json_config: AgentConfig;
  private agentInstances: Map<string, StarknetAgent> = new Map();
  private initialized: boolean = false;
  private initPromise: Promise<void>;

  constructor(private readonly config: ConfigurationService) {
    this.initPromise = this.initialize();
  }

  private async initialize() {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const projectRoot = path.resolve(process.cwd(), '..');
      const configPath = path.join(
        projectRoot,
        'config',
        'agents',
        'default.agent.json'
      );

      try {
        await fs.access(configPath);
      } catch (error) {
        console.error('Config file not found:', configPath);
        throw new Error(`Config file not found: ${configPath}`);
      }

      const jsonData = await fs.readFile(configPath, 'utf8');

      const json = JSON.parse(jsonData);

      if (!json) {
        throw new Error('Empty JSON configuration');
      }

      const { SystemMessage } = await import('@langchain/core/messages');

      const systemMessage = new SystemMessage(json.name);
      this.json_config = {
        prompt: systemMessage,
        name: json.name,
        interval: json.interval || 30000,
        chat_id: json.chat_id || 'default',
        mode: json.mode as AgentMode,
        plugins: Array.isArray(json.plugins)
          ? json.plugins.map((tool: string) => tool.toLowerCase())
          : [],
        memory: json.memory || false,
        maxIteration: json.maxIteration || 10,
      };

      this.initialized = true;
    } catch (error) {
      console.error('Error in initialize:', error);
      throw error;
    }
  }

  async createAgent(signature: string): Promise<StarknetAgent> {
    if (!this.initialized) {
      await this.initPromise;
    }

    if (!this.json_config) {
      throw new Error(
        'Agent configuration is still undefined after initialization'
      );
    }

    try {
      if (this.agentInstances.has(signature)) {
        const agentSignature = this.agentInstances.get(signature);
        if (!agentSignature) {
          throw new Error(
            `Agent with signature ${signature} exists in map but returned undefined`
          );
        }
        return agentSignature;
      }

      const database = {
        database: process.env.POSTGRES_DB as string,
        host: process.env.POSTGRES_HOST as string,
        user: process.env.POSTGRES_USER as string,
        password: process.env.POSTGRES_PASSWORD as string,
        port: parseInt(process.env.POSTGRES_PORT as string),
      };

      const agent = new StarknetAgent({
        provider: this.config.starknet.provider,
        accountPrivateKey: this.config.starknet.privateKey,
        accountPublicKey: this.config.starknet.publicKey,
        agentConfig: this.json_config,
        db_credentials: database,
        signature: signature,
      });

      // Store for later reuse
      this.agentInstances.set(signature, agent);

      return agent;
    } catch (error) {
      console.error('Error creating agent:', error);
      throw error;
    }
  }
}
