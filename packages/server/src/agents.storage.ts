import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigurationService } from '../config/configuration.js';
import { DatabaseService } from './services/database.service.js';
import { Postgres } from '@snakagent/database';
import {
  AgentConfig,
  ModelsConfig,
  ModelProviders,
  ModelLevelConfig,
  RawAgentConfig,
} from '@snakagent/core';
import { AgentConfigSQL } from './interfaces/sql_interfaces.js';
import DatabaseStorage from '../common/database/database.js';

const logger = new Logger('AgentStorage');

/**
 * Service responsible for managing agent storage, configuration, and lifecycle
 */
@Injectable()
export class AgentStorage implements OnModuleInit {
  private agentConfigs: AgentConfigSQL[] = [];
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(
    private readonly config: ConfigurationService,
    private readonly databaseService: DatabaseService
  ) {}

  async onModuleInit() {
    await this.initialize();
  }


  /**
   * Initialize models configuration with default values if not exists
   * @private
   */
  private async init_models_config() {
    try {
      logger.debug('Initializing models configuration');
      const q = new Postgres.Query(
        `SELECT EXISTS(SELECT * FROM models_config)`
      );
      const result = await Postgres.query<{ exists: boolean }>(q);

      if (!result[0].exists) {
        logger.debug('Models configuration not found, creating default config');

        const fast: ModelLevelConfig = {
          provider: ModelProviders.OpenAI,
          model_name: 'gpt-4o-mini',
          description: 'Optimized for speed and simple tasks.',
        };
        const smart: ModelLevelConfig = {
          provider: ModelProviders.OpenAI,
          model_name: 'gpt-4o-mini',
          description: 'Optimized for complex reasoning.',
        };
        const cheap: ModelLevelConfig = {
          provider: ModelProviders.OpenAI,
          model_name: 'gpt-4o-mini',
          description: 'Good cost-performance balance.',
        };

        const q = new Postgres.Query(
          `INSERT INTO models_config (fast, smart, cheap) VALUES (ROW($1, $2, $3), ROW($4, $5, $6), ROW($7, $8, $9))`,
          [
            fast.provider,
            fast.model_name,
            fast.description,
            smart.provider,
            smart.model_name,
            smart.description,
            cheap.provider,
            cheap.model_name,
            cheap.description,
          ]
        );
        await Postgres.query(q);
      } else {
        logger.debug('Models configuration already exists, skipping creation.');
      }
    } catch (error) {
      logger.error('Error during models configuration initialization:', error);
      throw error;
    }
  }

  /**
   * Initialize the agent storage service
   * @private
   */
  private async initialize() {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Create and store the initialization promise
    this.initializationPromise = this.performInitialize();

    try {
      await this.initializationPromise;
    } catch (error) {
      // Reset promise on failure so we can retry
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Perform the actual initialization logic
   * @private
   */
  private async performInitialize(): Promise<void> {
    try {
      // Wait for database service to be ready instead of polling
      await this.databaseService.onReady();

      await DatabaseStorage.connect();
      await this.init_models_config();
      await this.init_agents_config();
      this.initialized = true;
    } catch (error) {
      logger.error('Error during agent storage initialization:', error);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Parse agent configuration from database format
   * @param config - Raw configuration string from database
   * @returns Parsed ModelLevelConfig
   * @private
   */
  private parseAgentConfig(config: any): ModelLevelConfig {
    try {
      const content = config.trim().slice(1, -1);
      const parts = content.split(',');
      const model: ModelLevelConfig = {
        provider: parts[0],
        model_name: parts[1],
        description: parts[2],
      };
      return model;
    } catch (error) {
      logger.error('Error parsing agent config:', error);
      throw error;
    }
  }

  /**
   * Initialize agents configuration from database
   * @private
   */
  private async init_agents_config() {
    try {
      logger.debug('Initializing agents configuration');
      const q = new Postgres.Query(`SELECT * FROM agents`);
      const q_res = await Postgres.query<AgentConfigSQL>(q);
      this.agentConfigs = [...q_res];

      logger.debug(
        `Agents configuration loaded: ${this.agentConfigs.length} agents`
      );
      return q_res;
    } catch (error) {
      logger.error('Error during agents configuration initialization:', error);
      throw error;
    }
  }

  /**
   * Get models configuration from database
   * @returns Promise<ModelsConfig> - The models configuration
   * @private
   */
  private async get_models_config(): Promise<ModelsConfig> {
    try {
      const q = new Postgres.Query(`SELECT * FROM models_config`);
      logger.debug(`Query to get models config: ${q}`);
      const q_res = await Postgres.query<ModelsConfig>(q);

      if (q_res.length === 0) {
        throw new Error('No models configuration found');
      }

      const fast = this.parseAgentConfig(q_res[0].fast);
      const smart = this.parseAgentConfig(q_res[0].smart);
      const cheap = this.parseAgentConfig(q_res[0].cheap);

      const modelsConfig: ModelsConfig = {
        fast: fast,
        smart: smart,
        cheap: cheap,
      };
      return modelsConfig;
    } catch (error) {
      logger.error('Error getting models configuration:', error);
      throw error;
    }
  }

  /**
   * Build system prompt from configuration components
   * @param promptComponents - Components to build the prompt from
   * @returns string - The built system prompt
   * @private
   */
  private buildSystemPromptFromConfig(promptComponents: {
    name?: string;
    description?: string;
    lore: string[];
    objectives: string[];
    knowledge: string[];
  }): string {
    const contextParts: string[] = [];

    if (promptComponents.name) {
      contextParts.push(`Your name : [${promptComponents.name}]`);
    }
    if (promptComponents.description) {
      contextParts.push(`Your Description : [${promptComponents.description}]`);
    }

    if (
      Array.isArray(promptComponents.lore) &&
      promptComponents.lore.length > 0
    ) {
      contextParts.push(`Your lore : [${promptComponents.lore.join(']\n[')}]`);
    }

    if (
      Array.isArray(promptComponents.objectives) &&
      promptComponents.objectives.length > 0
    ) {
      contextParts.push(
        `Your objectives : [${promptComponents.objectives.join(']\n[')}]`
      );
    }

    if (
      Array.isArray(promptComponents.knowledge) &&
      promptComponents.knowledge.length > 0
    ) {
      contextParts.push(
        `Your knowledge : [${promptComponents.knowledge.join(']\n[')}]`
      );
    }

    return contextParts.join('\n');
  }

  /**
   * Get an agent configuration by ID
   * @param id - Agent ID
   * @returns AgentConfigSQL | undefined - The agent configuration or undefined if not found
   */
  public getAgentConfig(id: string): AgentConfigSQL | undefined {
    if (!this.initialized) {
      return undefined;
    }
    return this.agentConfigs.find((config) => config.id === id);
  }

  /**
   * Get all agent configurations
   * @returns AgentConfigSQL[] - Array of all agent configurations
   */
  public getAllAgentConfigs(): AgentConfigSQL[] {
    if (!this.initialized) {
      return [];
    }
    return [...this.agentConfigs];
  }

  /**
   * Add a new agent to the system
   * @param agent_config - Raw agent configuration
   * @returns Promise<AgentConfigSQL> - The newly created agent configuration
   */
  public async addAgent(agent_config: RawAgentConfig): Promise<AgentConfigSQL> {
    logger.debug(`Adding agent with config: ${JSON.stringify(agent_config)}`);

    if (!this.initialized) {
      await this.initialize();
    }

    const baseName = agent_config.name;
    const group = agent_config.group;

    let finalName = baseName;
    const nameCheckQuery = new Postgres.Query(
      `SELECT name FROM agents WHERE "group" = $1 AND (name = $2 OR name LIKE $2 || '-%') ORDER BY LENGTH(name) DESC, name DESC LIMIT 1`,
      [group, baseName]
    );
    logger.debug(`Name check query: ${nameCheckQuery}`);
    const nameCheckResult = await Postgres.query<{ name: string }>(
      nameCheckQuery
    );

    if (nameCheckResult.length > 0) {
      const existingName = nameCheckResult[0].name;
      if (existingName === baseName) {
        finalName = `${baseName}-1`;
      } else {
        const escapedBaseName = baseName.replace(/[.*+?^${}()|[\\]]/g, '\\$&');
        const suffixMatch = existingName.match(
          new RegExp(`^${escapedBaseName}-(\\d+)$`)
        );
        if (suffixMatch && suffixMatch[1]) {
          const lastIndex = parseInt(suffixMatch[1], 10);
          finalName = `${baseName}-${lastIndex + 1}`;
        } else {
          logger.warn(
            `Unexpected name format found: ${existingName} for baseName: ${baseName} in group: ${group}. Attempting to suffix with -1.`
          );
          finalName = `${baseName}-1`;
        }
      }
    }

    const systemPrompt = this.buildSystemPromptFromConfig({
      name: finalName,
      description: agent_config.description,
      lore: agent_config.lore,
      objectives: agent_config.objectives,
      knowledge: agent_config.knowledge,
    });

    console.log(agent_config);
    const q = new Postgres.Query(
      `INSERT INTO agents (name, "group", description, lore, objectives, knowledge, system_prompt, interval, plugins, memory, mode, max_iterations, "mcpServers")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ROW($10, $11), $12, $13, $14) RETURNING *`,
      [
        finalName,
        group,
        agent_config.description,
        agent_config.lore,
        agent_config.objectives,
        agent_config.knowledge,
        systemPrompt,
        agent_config.interval,
        agent_config.plugins,
        agent_config.memory.enabled || false,
        agent_config.memory.shortTermMemorySize || 5,
        agent_config.mode,
        15,
        agent_config.mcpServers || '{}',
      ]
    );
    const q_res = await Postgres.query<AgentConfigSQL>(q);
    logger.debug(`Agent added to database: ${JSON.stringify(q_res)}`);

    if (q_res.length > 0) {
      const newAgentDbRecord = q_res[0];
      this.agentConfigs.push(newAgentDbRecord);
      logger.debug(`Agent ${newAgentDbRecord.id} added to configuration`);
      return newAgentDbRecord;
    } else {
      logger.error('Failed to add agent to database, no record returned.');
      throw new Error('Failed to add agent to database.');
    }
  }

  /**
   * Delete an agent from the system
   * @param id - Agent ID to delete
   * @returns Promise<void>
   */
  public async deleteAgent(id: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const q = new Postgres.Query(
      `DELETE FROM agents WHERE id = $1 RETURNING *`,
      [id]
    );
    const q_res = await Postgres.query<AgentConfigSQL>(q);
    logger.debug(`Agent deleted from database: ${JSON.stringify(q_res)}`);

    this.agentConfigs = this.agentConfigs.filter((config) => config.id !== id);
    logger.debug(`Agent ${id} removed from local configuration`);
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Returns a promise that resolves when the agent storage is fully initialized
   * @returns Promise<void> that resolves when initialization is complete
   */
  public async onReady(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // If not initialized and no promise exists, trigger initialization
    return this.initialize();
  }
}
