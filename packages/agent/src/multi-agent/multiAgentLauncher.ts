import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { createBox } from '../prompt/formatting.js';
import { load_json_config } from '../index.js';
import { DatabaseCredentials, logger, ModelsConfig } from '@snakagent/core';
import { EventEmitter } from 'events';
import { StarknetAgent } from '../index.js';
import { RpcProvider } from 'starknet';
import { ModelSelectionAgent } from '../agents/operators/modelSelectionAgent.js';
import { deepCopyAgentConfig } from 'config/agentConfig.js';

interface MultiAgentConfig {
  description?: string;
  agents: AgentConfig[];
}

interface AgentConfig {
  type: string;
  count: number;
}
export const agentEventBus = new EventEmitter();
agentEventBus.setMaxListeners(100); // MAX NB OF AGENTS

/**
 * Locates the agent configuration file based on agent name
 * @param agentName - The name of the agent to find configuration for
 * @returns The full path to the agent config file, or null if not found
 */
function findAgentConfig(agentName: string): string | null {
  const configFileName = `${agentName}.agent.json`;
  const configPath = path.resolve(
    process.cwd(),
    '..',
    '..',
    'config',
    'agents',
    configFileName
  );
  if (fs.existsSync(configPath)) {
    return configPath;
  }
  logger.warn(`Agent configuration not found: ${configFileName}`);
  return null;
}

/**
 * Launches an single agent instance as an asynchronous process
 * @param agentPath - Path to the agent configuration file
 * @param agentId - Unique identifier for this agent instance
 * @param agentType - Type of agent being launched
 * @param abortController - AbortController to signal termination
 * @returns An object containing the stop function for this agent
 * @throws Error if agent initialization fails
 */
async function launchAgentAsync(
  agentPath: string,
  agentId: number,
  agentType: string,
  abortController: AbortController,
  modelsConfig: ModelsConfig
): Promise<{ stop: () => Promise<void> }> {
  try {
    const agentConfig = await load_json_config(agentPath);
    if (!agentConfig) {
      throw new Error(`Invalid configuration for agent type: ${agentType}`);
    }

    if (!agentConfig) {
      throw new Error(`Failed to load agent configuration from ${agentPath}`);
    }
    const agentConfigCopy = deepCopyAgentConfig(agentConfig);
    agentConfigCopy.chatId = `${agentConfigCopy.chatId || agentType}_${agentId}`;
    const modelSelectionAgent = new ModelSelectionAgent({
      useModelSelector: true,
      modelsConfig: modelsConfig,
    });
    await modelSelectionAgent.init();

    const database: DatabaseCredentials = {
      database: process.env.POSTGRES_DB as string,
      host: process.env.POSTGRES_HOST as string,
      user: process.env.POSTGRES_USER as string,
      password: process.env.POSTGRES_PASSWORD as string,
      port: parseInt(process.env.POSTGRES_PORT as string),
    };

    const agent = new StarknetAgent({
      provider: new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }),
      accountPrivateKey: process.env.STARKNET_PRIVATE_KEY as string,
      accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS as string,
      db_credentials: database,
      agentConfig: agentConfigCopy,
      modelSelector: modelSelectionAgent,
    });
    await agent.init();

    // Custom logging function
    const agentLog = (message: string) => {
      console.log(chalk.blue(`[${agentType}-${agentId}] `) + message);
    };
    agentLog(`Agent initialized. Starting autonomous execution...`);
    const signalListener = () => {
      agentLog(`Stopping agent execution...`);
    };
    abortController.signal.addEventListener('abort', signalListener);

    // Start agent in non-blocking async mode
    const executePromise = agent.execute_autonomous().catch((error) => {
      logger.error(`Error in agent ${agentType}-${agentId}: ${error.message}`);
    });

    // Return a stop function that can be called to terminate this agent
    return {
      stop: async () => {
        abortController.abort();
        try {
          // Wait for execution with a timeout
          await Promise.race([
            executePromise,
            new Promise((resolve) => setTimeout(resolve, 5000)), // 5s timeout
          ]);
          agentLog(`Successfully stopped.`);
        } catch (e) {
          agentLog(`Error during shutdown: ${e.message}`);
        }
      },
    };
  } catch (error) {
    logger.error(
      `Failed to launch agent ${agentType}-${agentId}: ${error.message}`
    );
    throw error;
  }
}

/**
 * Loads and validates the multi-agent configuration from a JSON file
 * @param configPath - Path to the multi-agent configuration file
 * @returns The parsed and validated configuration, or null if invalid
 */
async function loadMultiAgentConfig(
  configPath: string
): Promise<MultiAgentConfig | null> {
  try {
    await fs.promises.access(configPath);
    const jsonData = await fs.promises.readFile(configPath, 'utf8');
    const config = JSON.parse(jsonData);

    if (!config || typeof config !== 'object') {
      throw new Error('Configuration is not a valid object');
    }
    if (!Array.isArray(config.agents)) {
      throw new Error('Configuration must contain an "agents" array');
    }

    for (const agent of config.agents) {
      if (!agent.type || typeof agent.type !== 'string') {
        throw new Error('Each agent must have a valid "type" property');
      }

      if (!Number.isInteger(agent.count) || agent.count <= 0) {
        throw new Error(
          `Agent "${agent.type}" must have a valid positive "count" property`
        );
      }
    }

    return config as MultiAgentConfig;
  } catch (error) {
    logger.error(`Failed to load multi-agent configuration: ${error.message}`);
    return null;
  }
}

/**
 * Launches multiple agent instances based on the provided configuration
 * @param configPath - Path to the multi-agent configuration file
 * @returns A function that can be called to stop all launched agents
 * @throws Error if the configuration is invalid or agents cannot be launched
 */

export async function launchMultiAgent(
  agentPath: string,
  modelsConfig: ModelsConfig
): Promise<() => Promise<void>> {
  try {
    const multiAgentConfig = await loadMultiAgentConfig(agentPath);
    if (!multiAgentConfig) {
      throw new Error('Invalid or missing multi-agent configuration');
    }

    const agentStopFunctions: Array<() => Promise<void>> = [];
    let totalAgentsLaunched = 0;
    const masterAbortController = new AbortController();

    for (const agentConfig of multiAgentConfig.agents) {
      const { type, count } = agentConfig;

      if (
        !type ||
        typeof type !== 'string' ||
        !count ||
        typeof count !== 'number' ||
        count <= 0
      ) {
        logger.warn(`Invalid agent configuration for type: ${type}`);
        continue;
      }
      const agentConfigPath = findAgentConfig(type);
      if (!agentConfigPath) {
        logger.error(`Agent configuration not found for type: ${type}`);
        continue;
      }

      try {
        logger.info(`Launching ${count} instances of agent type: ${type}`);
        const agentPromises = [];

        for (let i = 0; i < count; i++) {
          const agentId = totalAgentsLaunched + i;
          const agentAbortController = new AbortController();

          masterAbortController.signal.addEventListener('abort', () => {
            agentAbortController.abort();
          });

          const agentPromise = launchAgentAsync(
            agentConfigPath,
            agentId,
            type,
            agentAbortController,
            modelsConfig
          )
            .then(({ stop }) => {
              agentStopFunctions.push(stop);
              return agentId;
            })
            .catch((error) => {
              logger.error(
                `Failed to launch agent ${agentId} of type ${type}: ${error.message}`
              );
              return agentId;
            });
          agentPromises.push(agentPromise);
          if (i < count - 1) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
        await Promise.all(agentPromises);

        totalAgentsLaunched += count;
      } catch (configError) {
        logger.error(
          `Error with agent configuration for ${type}: ${configError.message}`
        );
        continue;
      }
    }

    const successMessage = `Successfully launched ${totalAgentsLaunched} agent instances across ${multiAgentConfig.agents.length} agent types`;
    console.log(createBox('Multi-Agent Launcher', successMessage));

    return async () => {
      console.log('\nShutting down all agents...');
      masterAbortController.abort();
      const results = await Promise.allSettled(
        agentStopFunctions.map((stopFn) => {
          try {
            return stopFn();
          } catch (e) {
            logger.error(`Error stopping agent: ${e.message}`);
            return Promise.resolve();
          }
        })
      );
      const failedShutdowns = results.filter(
        (r) => r.status === 'rejected'
      ).length;
      if (failedShutdowns > 0) {
        logger.warn(`${failedShutdowns} agents failed to shut down cleanly`);
      }

      console.log('All agents terminated.');
    };
  } catch (error) {
    logger.error(
      `Failed to launch multi-agent configuration: ${error.message}`
    );
    throw error;
  }
}
