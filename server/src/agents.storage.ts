import { Injectable } from '@nestjs/common';
import { ConfigurationService } from '../config/configuration.js';
import {
  StarknetAgent,
  AgentConfig,
  createContextFromJson,
} from '@snakagent/agents';
import { Postgres } from '@snakagent/database';
import { SystemMessage } from '@langchain/core/messages';

export interface AgentPrompt {
  bio: string;
  lore: string[];
  objectives: string[];
  knowledge: string[];
}
@Injectable()
export class AgentStorage {
  private agentConfigs: AgentConfig[] = [];
  private agentInstances: Map<string, StarknetAgent> = new Map();
  private initialized: boolean = false;
  private initPromise: Promise<void>;
  constructor(private readonly config: ConfigurationService) {
    this.initPromise = this.initialize();
  }

  private async initalize_database() {
    try {
      const q = [
        new Postgres.Query(`
          CREATE TYPE agent_prompt AS (
            bio TEXT,
            lore TEXT[] ,
            objectives TEXT[],
            knowledge TEXT[]
          );`),
        new Postgres.Query(`
          CREATE TYPE memory AS (
              memory BOOLEAN,
              shortTermMemorySize INTEGER
          );`),
        new Postgres.Query(`
            CREATE TABLE IF NOT EXISTS agents (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            prompt agent_prompt NOT NULL,
            interval INTEGER NOT NULL DEFAULT 5,
            plugins TEXT[] NOT NULL DEFAULT '{}',
            memory memory NOT NULL DEFAULT (false, 5),
            UNIQUE (name)
            );`),
        new Postgres.Query(`
            CREATE TABLE IF NOT EXISTS conversation (
            conversation_id SERIAL PRIMARY KEY,
            conversation_name TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT NOT NULL DEFAULT 'success'
        );`),
        new Postgres.Query(`
        CREATE TABLE IF NOT EXISTS message (
            message_id SERIAL PRIMARY KEY,
            conversation_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            sender_type TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversation(conversation_id) ON DELETE CASCADE
        );`),
        new Postgres.Query(`
            CREATE TABLE IF NOT EXISTS chat (
            id SERIAL PRIMARY KEY,
            agent_id INTEGER NOT NULL,
            conversation_name TEXT,
            messages message NOT NULL
        );`),
      ];
      for (const query of q) {
        await Postgres.query(query).catch((error) => {
          if (error.code === '42710') {
            console.log('Table already exists, skipping creation.');
            return;
          }
          console.error('Error creating table:', error);
        });
      }
      console.log('Database tables created successfully');
    } catch (error) {
      console.error('Error during agents_controller initialisation:', error);
      throw error;
    }
  }

  private async initialize() {
    try {
      if (this.initialized) {
        return;
      }
      console.log('Initializing AgentFactory...');
      console.log('Connecting to database...');
      console.log(process.env.POSTGRES_DB);
      console.log(process.env.POSTGRES_HOST);
      console.log(process.env.POSTGRES_USER);
      console.log(process.env.POSTGRES_PASSWORD);
      console.log(process.env.POSTGRES_PORT);
      await Postgres.connect({
        database: process.env.POSTGRES_DB as string,
        host: process.env.POSTGRES_HOST as string,
        user: process.env.POSTGRES_USER as string,
        password: process.env.POSTGRES_PASSWORD as string,
        port: parseInt(process.env.POSTGRES_PORT as string),
      });

      await this.initalize_database();
      await this.init_agents_config();
      this.initialized = true;
    } catch (error) {
      console.error('Error during agents_controller initialisation:', error);
      throw error;
    }
  }

  private async init_agents_config() {
    try {
      const q = new Postgres.Query(`SELECT * FROM agents`);
      const q_res = await Postgres.query<AgentConfig>(q);
      this.agentConfigs = [...q_res];
      console.log('Agent configurations loaded:', this.agentConfigs);
      for (const agentConfig of this.agentConfigs) {
        await this.createAgent(agentConfig);
        console.log('Agent created:', agentConfig.name);
      }
      return q_res;
    } catch (error) {
      console.error('Error during agents_controller initialisation:', error);
      throw error;
    }
  }

  private async createAgent(agent_config: AgentConfig): Promise<StarknetAgent> {
    try {
      const database = {
        database: process.env.POSTGRES_DB as string,
        host: process.env.POSTGRES_HOST as string,
        user: process.env.POSTGRES_USER as string,
        password: process.env.POSTGRES_PASSWORD as string,
        port: parseInt(process.env.POSTGRES_PORT as string),
      };

      const systemMessagefromjson = new SystemMessage(
        createContextFromJson(agent_config.prompt)
      );
      const json_config: JsonConfig = {
        name: agent_config.name,
        prompt: systemMessagefromjson,
        plugins: agent_config.plugins,
        chat_id: 'chat_id', // Need to be removed
        interval: agent_config.interval,
        memory: {
          enabled: agent_config.memory.enabled,
          shortTermMemorySize: agent_config.memory.short_term_memory_size,
        },
        mode: {
          interactive: true,
          autonomous: false,
          maxIteration: 15,
        },
      };

      const agent = new StarknetAgent({
        provider: this.config.starknet.provider,
        accountPrivateKey: this.config.starknet.privateKey,
        accountPublicKey: this.config.starknet.publicKey,
        agentConfig: json_config,
        db_credentials: database,
      });

      // Store for later reuse
      await agent.init();
      if (this.agentInstances.has(agent_config.name)) {
        console.log('Agent already exists, skipping creation.');
        const existingAgent = this.agentInstances.get(agent_config.name);
        if (existingAgent) {
          return existingAgent;
        }
        throw new Error('AgentExecutor not found in instances map');
      }
      this.agentInstances.set(agent_config.name, agent);
      return agent;
    } catch (error) {
      console.error('Error creating agent:', error);
      throw error;
    }
  }

  public async addAgent(agent_config: AgentConfig): Promise<void> {
    console.log('Adding agent:', agent_config);
    if (!this.initialized) {
      await this.initPromise;
    }
    const q = new Postgres.Query(
      `INSERT INTO agents (name, prompt, interval, plugins, memory) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        agent_config.name,
        agent_config.prompt,
        agent_config.interval,
        agent_config.plugins,
        agent_config.memory,
      ]
    );
    const q_res = await Postgres.query<AgentConfig>(q);
    console.log('Agent added:', q_res);
    await this.createAgent(agent_config);
  }

  public getAgent(name: string): StarknetAgent | undefined {
    if (!this.initialized) {
      return undefined;
    }
    return this.agentInstances.get(name);
  }

  public getAllAgents(): StarknetAgent[] | undefined {
    if (!this.initialized) {
      return undefined;
    }

    return Array.from(this.agentInstances.values());
  }

  // Add ResponseDTO for Error Handling in any public function
  public async deleteAgent(name: string): Promise<void> {
    if (!this.initialized) {
      await this.initPromise;
    }
    const q = new Postgres.Query(
      `DELETE FROM agents WHERE name = $1 RETURNING *`,
      [name]
    );
    const q_res = await Postgres.query<AgentConfig>(q);
    console.log('Agent deleted:', q_res);
    if (this.agentInstances.has(name)) {
      this.agentInstances.delete(name);
    }
  }
}
