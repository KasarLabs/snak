import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { load_json_config } from '../index.js';
import { DatabaseCredentials, logger, ModelsConfig } from '@snakagent/core';
import { EventEmitter } from 'events';
import { SnakAgent } from '../index.js';
import { RpcProvider } from 'starknet';
import { ModelSelector } from '../agents/operators/modelSelector.js';
import { deepCopyAgentConfig } from 'config/agentConfig.js';

/**
 * Configuration for multiple agents
 */
interface MultiAgentConfig {
  description?: string;
  agents: AgentConfig[];
}

/**
 * Configuration for a single agent type
 */
interface AgentConfig {
  type: string;
  count: number;
}

/**
 * Event bus for agent communication
 */
export const agentEventBus = new EventEmitter();
agentEventBus.setMaxListeners(100);

/**
 * Registry to store initialized agent references
 */
const initializedAgentRegistry = new Map<string, any>();

/**
 * Gets the map of initialized agents
 * @returns Map containing all initialized agents
 */
export function getInitializedAgents(): Map<string, any> {
  return initializedAgentRegistry;
}

/**
 * Registers all initialized agents with the supervisor
 * @param supervisor - The supervisor instance to register agents with
 */
export function registerAgentsWithSupervisor(supervisor: any): void {
  if (!supervisor || typeof supervisor.registerSnakAgent !== 'function') {
    logger.error('Invalid supervisor provided for agent registration');
    return;
  }

  logger.info(
    `Registering ${initializedAgentRegistry.size} agents with supervisor`
  );

  initializedAgentRegistry.forEach((agentData, chatId) => {
    try {
      if (!agentData.agent) {
        logger.warn(
          `Agent data for ${chatId} does not contain a valid agent instance`
        );
        return;
      }

      const agentId = chatId;

      supervisor.registerSnakAgent(agentId, agentData.agent, {
        name:
          agentData.config.name ||
          `${agentData.type.charAt(0).toUpperCase() + agentData.type.slice(1)} Agent ${agentData.id}`,
        description:
          agentData.config.description || `A ${agentData.type} agent instance`,
        group: agentData.config.group || agentData.type,
      });

      logger.debug(`Successfully registered agent ${chatId} with supervisor`);
    } catch (error) {
      logger.error(
        `Failed to register agent ${chatId} with supervisor: ${error.message}`
      );
    }
  });

  if (typeof supervisor.updateAgentSelectorRegistry === 'function') {
    supervisor.updateAgentSelectorRegistry();
    logger.info('Updated agent selection registry');
  } else {
    logger.warn('Supervisor does not have updateAgentSelectorRegistry method');
  }
}

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
 * Launches a single agent instance as an asynchronous process
 * @param agentPath - Path to the agent configuration file
 * @param agentId - Unique identifier for this agent instance
 * @param agentType - Type of agent being launched
 * @param abortController - AbortController to signal termination
 * @param modelsConfig - Configuration for models
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
  const agentConfig = await load_json_config(agentPath);
  if (!agentConfig) {
    throw new Error(`Invalid configuration for agent type: ${agentType}`);
  }

  const agentConfigCopy = deepCopyAgentConfig(agentConfig);
  agentConfigCopy.chatId = `${agentConfigCopy.chatId || agentType}_${agentId}`;
  const agentSpecificEventName = `execute-agent-${agentConfigCopy.chatId}`;

  const modelSelector = new ModelSelector({
    useModelSelector: true,
    modelsConfig: modelsConfig,
  });
  await modelSelector.init();

  const database: DatabaseCredentials = {
    database: process.env.POSTGRES_DB as string,
    host: process.env.POSTGRES_HOST as string,
    user: process.env.POSTGRES_USER as string,
    password: process.env.POSTGRES_PASSWORD as string,
    port: parseInt(process.env.POSTGRES_PORT as string),
  };

  const agent = new SnakAgent({
    provider: new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }),
    accountPrivateKey: process.env.STARKNET_PRIVATE_KEY as string,
    accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS as string,
    db_credentials: database,
    agentConfig: agentConfigCopy,
    modelSelectorConfig: {
      useModelSelector: true,
      modelsConfig,
    },
  });
  await agent.init();

  initializedAgentRegistry.set(agentConfigCopy.chatId, {
    agent: agent,
    type: agentType,
    config: agentConfigCopy,
    id: agentId,
  });

  const agentLog = (message: string) => {
    console.log(chalk.blue(`[${agentConfigCopy.chatId}] `) + message);
  };
  agentLog(
    `Agent initialized. Mode: ${agentConfigCopy.mode}. Listening for events on "${agentSpecificEventName}"`
  );

  const userInputListener = async (userInput: string) => {
    if (abortController.signal.aborted) return;
    agentLog(
      `Received broadcast message: "${userInput}". Forwarding to AgentSystem.`
    );
    try {
      // Need to update this for async generators
      const threadId = `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      await agent.execute(userInput, false, {
        configurable: { thread_id: threadId },
      });
    } catch (error) {
      logger.error(
        `Error in agent ${agentConfigCopy.chatId} during broadcast execution: ${error.message}`
      );
    }
  };

  const targetedExecutionListener = async (payload: {
    input: string;
    config: any;
    agentId?: string;
  }) => {
    if (abortController.signal.aborted) {
      agentLog('Execution requested, but agent is stopping.');
      return;
    }

    if (payload.agentId && payload.agentId !== agentConfigCopy.chatId) {
      return;
    }

    const input = payload.input;
    const config = payload.config || {};

    agentLog(
      `Received targeted execution request. Input: "${input.substring(0, 50)}..."`
    );
    try {
      const result = await agent.execute(input, config);
      agentLog('Execution complete.');

      agentEventBus.emit('agent-response', {
        agentId: agentConfigCopy.chatId,
        result,
        originalInput: input,
        config,
      });
    } catch (error) {
      logger.error(
        `Error in agent ${agentConfigCopy.chatId} during targeted execution: ${error.message}`
      );
      agentLog(`Error during execution: ${error.message}`);

      agentEventBus.emit('agent-error', {
        agentId: agentConfigCopy.chatId,
        error: error.message,
        originalInput: input,
        config,
      });
    }
  };

  agentEventBus.on('user-input', userInputListener);
  agentEventBus.on(agentSpecificEventName, targetedExecutionListener);

  const signalListener = () => {
    agentLog('Stop signal received. Cleaning up...');
    agentEventBus.off('user-input', userInputListener);
    agentEventBus.off(agentSpecificEventName, targetedExecutionListener);
  };
  abortController.signal.addEventListener('abort', signalListener);

  return {
    stop: async () => {
      agentLog('Executing stop function...');
      if (!abortController.signal.aborted) {
        abortController.abort();
      }
      agentEventBus.off('user-input', userInputListener);
      agentEventBus.off(agentSpecificEventName, targetedExecutionListener);
      initializedAgentRegistry.delete(agentConfigCopy.chatId);
      agentLog(
        `Successfully stopped listening for inputs for ${agentConfigCopy.chatId}.`
      );
    },
  };
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
 * @param agentPath - Path to the multi-agent configuration file
 * @param modelsConfig - Configuration for models
 * @returns A function that can be called to stop all launched agents
 * @throws Error if the configuration is invalid or agents cannot be launched
 */
export async function launchMultiAgent(
  agentPath: string,
  modelsConfig: ModelsConfig
): Promise<() => Promise<void>> {
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
}

/**
 * Event listener for registering agents with supervisor
 */
agentEventBus.on('register-with-supervisor', (supervisor) => {
  registerAgentsWithSupervisor(supervisor);
});
