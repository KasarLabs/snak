import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigurationService } from '../config/configuration.js';
import {
  StarknetAgent,
  JsonConfig,
  load_json_config,
  createContextFromJson,
  logger,
} from '@starknet-agent-kit/agents';
const { SystemMessage } = await import('@langchain/core/messages');
import pkg from 'pg';
const { Pool } = pkg;

@Injectable()
export class AgentFactory implements OnModuleInit {
  private agentInstances: Map<string, StarknetAgent> = new Map();
  private initialized: boolean = false;
  private initPromise: Promise<void>;
  private agentConfigList: JsonConfig[] = [];
  private database: pkg.Pool;

  constructor(private readonly config: ConfigurationService) {}

  async onModuleInit() {
    // try {
    //   this.database = new Pool({
    //     host: process.env.POSTGRES_HOST,
    //     user: process.env.POSTGRES_USER,
    //     password: process.env.POSTGRES_PASSWORD,
    //     database: process.env.POSTGRES_ROOT_DB,
    //     port: Number(process.env.POSTGRES_PORT),
    //   });
    //   // Initialiser tout de suite et attendre
    //   await this.initialize();
    // } catch (error) {
    //   logger.error(`Module initialization failed: ${error}`);
    //   throw error; // Propager l'erreur pour que NestJS sache que l'initialisation a échoué
    // }
  }

  public async initialize() {
    try {
      this.database = new Pool({
        host: process.env.POSTGRES_HOST,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_ROOT_DB,
        port: Number(process.env.POSTGRES_PORT),
      });

      // logger.debug('Starting initialization...');
      const database = this.database;
      if (!database) {
        throw new Error(
          `Database connection is not established. Please check your .env configuration.`
        );
      }

      const select_response = await database.query('SELECT * FROM agents;');
      // logger.debug(`Found ${select_response.rowCount} agents in database`);

      if (
        select_response.rowCount === 0 ||
        select_response.rows === undefined
      ) {
        throw new Error('Error trying to load agent configuration');
      }

      // Vider la liste avant de la remplir
      this.agentConfigList = [];

      for (const row of select_response.rows) {
        // Vérifier si cet agent existe déjà dans notre liste
        const existingConfig = this.agentConfigList.find(
          (cfg) => cfg.name === row.name
        );
        if (existingConfig) {
          // logger.debug(`Agent ${row.name} already in list, skipping`);
          continue;
        }

        // logger.debug(`Processing agent configuration: ${row.name}`);
        const context = createContextFromJson(row, false);

        const systemMessage = new SystemMessage(context);
        const config: JsonConfig = {
          name: row.name,
          chat_id: row.chat_id,
          autonomous: row.autonomous,
          prompt: systemMessage,
          interval: row.interval,
          internal_plugins: row.internal_plugins,
          external_plugins: row.external_plugins,
          memory: row.memory,
        };
        this.agentConfigList.push(config);
        // logger.debug(`Added agent configuration: ${config.name}`);
      }

      // logger.debug(`Total agent configurations loaded: ${this.agentConfigList.length}`);
      for (const config of this.agentConfigList) {
        // logger.debug(`Loaded config: ${config.internal_plugins}`);
      }

      this.initialized = true;
      // logger.debug('Initialization completed successfully');
    } catch (error) {
      this.initialized = false;
      logger.error(
        `Failed to load agent configuration from database: ${error}`
      );
      throw error; // Propager l'erreur pour une meilleure gestion
    }
  }

  async createAgent(
    signature: string,
    agentMode: string = 'agent'
  ): Promise<Map<string, StarknetAgent>> {
    try {
      // S'assurer que l'initialisation est terminée
      if (!this.initialized) {
        logger.debug('Not initialized yet, waiting for initialization...');
        await this.initialize(); // Réessayer l'initialisation explicitement

        // Vérifier à nouveau après avoir essayé d'initialiser
        if (!this.initialized || this.agentConfigList.length === 0) {
          throw new Error('Failed to initialize agent configurations');
        }
      }

      logger.debug(
        `Creating agents with ${this.agentConfigList.length} configurations`
      );

      // Nettoyer les instances existantes
      this.agentInstances.clear();

      for (const config of this.agentConfigList) {
        const agent = new StarknetAgent({
          provider: this.config.starknet.provider,
          accountPrivateKey: this.config.starknet.privateKey,
          accountPublicKey: this.config.starknet.publicKey,
          aiModel: this.config.ai.model,
          aiProvider: this.config.ai.provider,
          aiProviderApiKey: this.config.ai.apiKey,
          agentconfig: config,
          signature: signature,
          agentMode: agentMode,
        });

        // Store for later reuse
        logger.debug(config.name);
        this.agentInstances.set(config.name, agent);
      }

      logger.debug(
        `Total agent instances created: ${this.agentInstances.size}`
      );
      return this.agentInstances;
    } catch (error) {
      console.error('Error creating agent:', error);
      throw error;
    }
  }

  // Méthode pour vérifier si un agent existe
  hasAgent(name: string): boolean {
    return this.agentInstances.has(name);
  }

  // Méthode pour récupérer les noms de tous les agents configurés
  getAgentNames(): string[] {
    return this.agentConfigList.map((config) => config.name);
  }
}
