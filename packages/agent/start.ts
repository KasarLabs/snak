import inquirer from 'inquirer';
import chalk from 'chalk';
import { createSpinner } from 'nanospinner';
import { RpcProvider } from 'starknet';
import { config } from 'dotenv';
import { Postgres } from '@snakagent/database';
import {
  load_json_config,
  AgentMode,
  AGENT_MODES,
} from './src/config/agentConfig.js';
import { createBox } from './src/prompt/formatting.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger, AgentConfig, ModelsConfig } from '@snakagent/core';
import { DatabaseCredentials } from './src/tools/types/database.js';
import { formatAgentResponse } from './src/agents/core/utils.js';
import { AgentSystem, AgentSystemConfig } from './src/agents/index.js';
import { hybridInitialPrompt } from './src/prompt/prompts.js';
import {
  launchMultiAgent,
  agentEventBus,
  getInitializedAgents,
  registerAgentsWithSupervisor,
} from './src/multi-agent/multiAgentLauncher.js';
import { TokenTracker } from './src/token/tokenTracking.js';

const DEBUG = process.env.DEBUG === 'true';
logger.debug(`Environment variables: DEBUG=${DEBUG}`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Flag to track if cleanup has been initiated
let isShuttingDown = false;

// Reference to the agent system for cleanup
let globalAgentSystem: AgentSystem | null = null;

/**
 * Handles graceful shutdown by cleaning up resources
 */
async function gracefulShutdown(signal: string): Promise<void> {
  // Prevent multiple cleanup attempts
  if (isShuttingDown) {
    logger.debug(`Already shutting down, ignoring ${signal}`);
    return;
  }

  isShuttingDown = true;
  logger.info(`Gracefully shutting down from ${signal}`);

  try {
    // Display token usage summary before shutdown
    displayTokenUsageSummary();

    // Clean up agent system
    if (globalAgentSystem) {
      try {
        logger.info('Disposing agent system...');
        await globalAgentSystem.dispose();
        logger.info('Agent system disposed.');
        globalAgentSystem = null;
      } catch (error) {
        logger.error('Error during agent system disposal:', error);
      }
    }

    // Shutdown database pool
    try {
      logger.info('Shutting down database connection pool...');
      await Postgres.shutdown();
      logger.info('Database connection pool shut down.');
    } catch (dbShutdownError) {
      logger.error('Error shutting down database pool:', dbShutdownError);
    }

    logger.info('Graceful shutdown completed');

    // Exit with appropriate code
    // Use 0 for normal shutdowns, different code for errors
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

/**
 * Displays a summary of token usage for the session
 */
function displayTokenUsageSummary(): void {
  try {
    const usage = TokenTracker.getSessionTokenUsage();

    if (usage.totalTokens > 0) {
      console.log(chalk.dim('\nSession token usage:\n'));
      console.log(
        chalk.dim(
          `- Total Input tokens: ${usage.promptTokens.toLocaleString()}`
        )
      );
      console.log(
        chalk.dim(
          `- Total Output tokens: ${usage.responseTokens.toLocaleString()}`
        )
      );
      console.log(
        chalk.dim(`- Total Tokens: ${usage.totalTokens.toLocaleString()}`)
      );
      console.log(chalk.dim(`- Total cost: n/a USD\n`));
      logger.info(
        `Session token usage: Input=${usage.promptTokens}, Output=${usage.responseTokens}, Total=${usage.totalTokens}`
      );
    }
  } catch (error) {
    logger.error('Error displaying token usage summary:', error);
  }
}

// Set up robust signal handlers
process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  gracefulShutdown('SIGINT');
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

// Handle uncaught exceptions and promise rejections more robustly
process.on('uncaughtException', (error) => {
  console.error('\nUncaught exception, shutting down gracefully...');
  logger.error('Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('\nUnhandled promise rejection, shutting down gracefully...');
  logger.error('Unhandled promise rejection:', reason);
  gracefulShutdown('unhandledRejection');
});

async function loadMulti(
  multiAgentConfigPath: string,
  modelsConfigPath: string,
  modelsConfig: ModelsConfig
) {
  console.log(
    chalk.dim(
      '\nStarting multi-agent session with built-in Snak Supervisor...\n'
    )
  );
  console.log(
    chalk.dim(
      `- Multi-Agent Group Config: ${chalk.bold(path.basename(multiAgentConfigPath))}`
    )
  );
  console.log(
    chalk.dim(
      `- Models Config: ${chalk.bold(path.basename(modelsConfigPath))}\n`
    )
  );

  const spinner = createSpinner('Initializing Multi-Agent System').start();

  try {
    // Track a mapping of initialized agents for later registration with the supervisor
    const initializedAgents = {};

    // Launch worker agents that will listen for events
    const terminateAgents = await launchMultiAgent(
      multiAgentConfigPath,
      modelsConfig
    );
    spinner.success({
      text: 'All worker agents launched and listening for events',
    });

    // Ajouter un petit délai pour s'assurer que tous les agents ont bien démarré
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Vérifier que des agents ont bien été initialisés
    const workerAgentsRegistry = getInitializedAgents();
    logger.info(
      `Detected ${workerAgentsRegistry.size} initialized worker agents`
    );

    if (workerAgentsRegistry.size === 0) {
      spinner.error({ text: 'No worker agents were initialized successfully' });
      throw new Error('Failed to initialize any worker agents');
    }

    // Now set up a single, standard AgentSystem that will use the built-in
    // agent selection and supervisor infrastructure
    spinner.update({
      text: 'Initializing main AgentSystem with supervisor...',
    });

    // Utiliser les fonctions existantes pour trouver les fichiers de configuration
    // On récupère le chemin du config supervisor qui est mandatory pour l'infrastructure
    const supervisorAgentConfigName = 'supervisor.agent.json';

    // Cette fonction recherche la config dans tous les emplacements standards
    const supervisorAgentPath = (() => {
      const possibleBasePaths = [
        process.cwd(),
        path.resolve(process.cwd(), '..'),
        path.resolve(__dirname, '..', '..'),
        path.resolve(__dirname, '..', '..', '..'),
      ];

      for (const basePath of possibleBasePaths) {
        const tryPath = path.resolve(
          basePath,
          'config',
          'agents',
          supervisorAgentConfigName
        );
        if (fs.existsSync(tryPath)) {
          logger.debug(`Found supervisor agent config at: ${tryPath}`);
          return tryPath;
        }
      }

      throw new Error(
        `Configuration file ${supervisorAgentConfigName} not found in standard locations. The supervisor agent configuration is mandatory for the system to function.`
      );
    })();

    const agent_config: AgentConfig =
      await load_json_config(supervisorAgentPath);
    if (!agent_config) {
      throw new Error(
        `Failed to load agent configuration from ${supervisorAgentPath}`
      );
    }

    // Setup database credentials from environment variables
    const database: DatabaseCredentials = {
      database: process.env.POSTGRES_DB as string,
      host: process.env.POSTGRES_HOST as string,
      user: process.env.POSTGRES_USER as string,
      password: process.env.POSTGRES_PASSWORD as string,
      port: parseInt(process.env.POSTGRES_PORT as string),
    };

    // Initialize Database Connection Pool if not already done
    try {
      await Postgres.connect(database);
      spinner.update({ text: 'Database connection pool initialized' });
      logger.info('Database connection pool initialized successfully.');
    } catch (dbError) {
      spinner.error({
        text: 'Failed to initialize database connection pool',
      });
      logger.error('Database initialization failed:', dbError);
      throw new Error(`Failed to initialize database: ${dbError.message}`);
    }

    const nodeUrl = process.env.STARKNET_RPC_URL;
    if (!nodeUrl) {
      throw new Error(
        'STARKNET_RPC_URL is not defined in environment variables'
      );
    }

    // Prepare RPC Provider
    const provider = new RpcProvider({ nodeUrl: `${nodeUrl}` });

    // Setup an AgentSystem with the default agent config
    // This will include the supervisor and agent selection components
    const agentSystemConfig: AgentSystemConfig = {
      starknetProvider: provider,
      accountPrivateKey: process.env.STARKNET_PRIVATE_KEY!,
      accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS!,
      modelsConfig: modelsConfig,
      agentMode: agent_config.mode,
      databaseCredentials: database,
      agentConfigPath: agent_config,
      debug: DEBUG,
    };

    // Create and initialize the agent system with the built-in supervisor
    const agentSystem = new AgentSystem(agentSystemConfig);
    globalAgentSystem = agentSystem; // Store reference for shutdown

    await agentSystem.init();

    // Récupérer le supervisor pour enregistrer les agents
    const supervisor = agentSystem.getSupervisor();
    if (!supervisor) {
      throw new Error('SupervisorAgent not initialized properly');
    }

    // Enregistrer les agents workers auprès du superviseur directement
    // plutôt que via un événement
    logger.info('Registering worker agents with supervisor...');
    registerAgentsWithSupervisor(supervisor);

    // Vérifier que le supervisor a bien des agents maintenant
    const agentSelectionAgent = supervisor.getAgentSelectionAgent();
    if (agentSelectionAgent) {
      logger.debug('Agent selection agent is properly initialized');
    } else {
      logger.warn('Agent selection agent is not available in the supervisor');
    }

    // Rafraîchir le WorkflowController pour prendre en compte les nouveaux agents
    logger.info('Refreshing WorkflowController with newly registered agents');
    await supervisor.refreshWorkflowController();
    logger.info('WorkflowController refreshed with the new agents');

    spinner.success({
      text: chalk.black(
        `Multi-Agent System with Supervisor initialized successfully`
      ),
    });

    // Setup SIGINT handler for graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nGracefully shutting down from SIGINT (Ctrl+C)');
      if (globalAgentSystem) {
        await globalAgentSystem.dispose();
      }
      await terminateAgents();
      process.exit(0);
    });

    // Interactive loop - the supervisor will manage routing to worker agents
    console.log(
      chalk.green(
        '\nEntering interactive mode with Snak Supervisor. Type "exit" to quit.\n'
      )
    );

    while (true) {
      const { user } = await inquirer.prompt([
        {
          type: 'input',
          name: 'user',
          message: chalk.green('User'),
          validate: (value: string) => {
            const trimmed = value.trim();
            if (!trimmed) return 'Please enter a valid message';
            if (trimmed.toLowerCase() === 'exit') return true;
            return true;
          },
        },
      ]);

      if (user.toLowerCase() === 'exit') {
        console.log(chalk.blue('Exiting interactive mode...'));
        await terminateAgents();
        break;
      }

      console.log(chalk.yellow('Processing request through Supervisor...'));

      try {
        // The AgentSystem.execute method will:
        // 1. Route through the supervisor agent
        // 2. Use agent selection to determine which worker to use
        // 3. Forward the request to the appropriate worker via the event bus
        await agentSystem.execute(user);
      } catch (error: any) {
        console.error(chalk.red('Error processing request'));
        logger.error('Error during agent execution:', error);
        console.log(
          createBox(
            error.message || 'An unknown error occurred during processing.',
            { title: 'Error', isError: true }
          )
        );
      }
    }
  } catch (error) {
    spinner.error({ text: 'Failed to initialize multi-agent system' });
    logger.error('Error during multi-agent launch:', error);
    throw error;
  }
}

// Modified localRun to use our askQuestion wrapper
const localRun = async (): Promise<void> => {
  clearScreen();
  console.log(logo);
  console.log(
    createBox(
      'Welcome to Snak, an advanced Agent engine powered by Starknet.',
      'For more information, visit our documentation at https://docs.snakagent.com'
    )
  );

  try {
    // Reset token usage counters at the start of a session
    TokenTracker.resetSessionCounters();

    // Load command line args
    const { agentPath, modelsConfigPath, multi } = await loadCommand();

    // Load environment variables
    loadEnvVars();

    // Verify required environment variables
    const required = [
      'STARKNET_RPC_URL',
      'STARKNET_PRIVATE_KEY',
      'STARKNET_PUBLIC_ADDRESS',
    ];

    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}`
      );
    }
    // Load models configuration
    const modelData = await fs.promises.readFile(modelsConfigPath, 'utf8');
    const modelsConfig: ModelsConfig = JSON.parse(modelData) as ModelsConfig;
    if (!modelsConfig) {
      throw new Error(
        `Failed to load models configuration from ${modelsConfigPath}`
      );
    }

    if (multi) {
      loadMulti(agentPath, modelsConfigPath, modelsConfig);
    } else {
      // Load agent configuration
      let agent_config: AgentConfig = await load_json_config(agentPath);
      if (!agent_config) {
        throw new Error(`Failed to load agent configuration from ${agentPath}`);
      }
      const agentMode = agent_config.mode;
      clearScreen();
      console.log(logo);
      const spinner = createSpinner('Initializing Agent System').start();

      // Setup database credentials from environment variables
      const database: DatabaseCredentials = {
        database: process.env.POSTGRES_DB as string,
        host: process.env.POSTGRES_HOST as string,
        user: process.env.POSTGRES_USER as string,
        password: process.env.POSTGRES_PASSWORD as string,
        port: parseInt(process.env.POSTGRES_PORT as string),
      };

      // Initialize Database Connection Pool FIRST
      try {
        await Postgres.connect(database);
        spinner.update({ text: 'Database connection pool initialized' });
        logger.info('Database connection pool initialized successfully.');
      } catch (dbError) {
        spinner.error({
          text: 'Failed to initialize database connection pool',
        });
        logger.error('Database initialization failed:', dbError);
        throw new Error(`Failed to initialize database: ${dbError.message}`);
      }

      const nodeUrl = process.env.STARKNET_RPC_URL;
      if (!nodeUrl) {
        throw new Error(
          'STARKNET_RPC_URL is not defined in environment variables'
        );
      }

      // Prepare RPC Provider
      const provider = new RpcProvider({ nodeUrl: `${nodeUrl}` });

      // Prepare Agent System configuration ACCORDING TO THE DEFINITION IN agents/src/agents/index.ts
      const agentSystemConfig: AgentSystemConfig = {
        starknetProvider: provider,
        accountPrivateKey: process.env.STARKNET_PRIVATE_KEY!,
        accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS!,
        modelsConfig: modelsConfig, // Already loaded object
        agentMode: agentMode,
        databaseCredentials: database,
        agentConfigPath: agent_config, // Pass the actual config object
        debug: DEBUG,
      };

      // Create and initialize the agent system
      const agentSystem = new AgentSystem(agentSystemConfig);
      // Store reference for shutdown handling
      globalAgentSystem = agentSystem;

      await agentSystem.init();

      spinner.success({
        text: chalk.black(
          `Agent System "${chalk.cyan(agent_config?.name || 'Unknown')}" initialized successfully`
        ),
      });

      // Conserver le mode de l'agent tel que configuré, mais utiliser toujours l'interface interactive
      console.log(
        chalk.dim('\nStarting interactive session with Snak Supervisor...\n')
      );
      console.log(
        chalk.dim(`- Config: ${chalk.bold(path.basename(agentPath))}`)
      );
      console.log(
        chalk.dim(`- Agent Mode: ${chalk.bold(AGENT_MODES[agentMode])}`)
      );
      console.log(
        chalk.dim(`- Models: ${chalk.bold(path.basename(modelsConfigPath))}\n`)
      );

      // Boucle interactive pour tous les modes d'agent
      while (true) {
        const { user } = await inquirer.prompt([
          {
            type: 'input',
            name: 'user',
            message: chalk.green('User'),
            validate: (value: string) => {
              const trimmed = value.trim();
              if (!trimmed) return 'Please enter a valid message';
              if (trimmed.toLowerCase() === 'exit') return true;
              return true;
            },
          },
        ]);

        if (user.toLowerCase() === 'exit') {
          console.log(chalk.blue('Exiting interactive mode...'));
          break;
        }

        console.log(chalk.yellow('Processing request...'));

        try {
          // Exécuter via le supervisor qui routera vers le bon mode d'agent
          await agentSystem.execute(user);
        } catch (error: any) {
          console.error(chalk.red('Error processing request'));
          logger.error('Error during agent execution:', error);
          console.log(
            createBox(
              error.message || 'An unknown error occurred during processing.',
              { title: 'Error', isError: true }
            )
          );
        }
      }
    }
  } catch (error: any) {
    console.error(
      createBox(error.message || 'An unknown error occurred', {
        title: 'Fatal Error',
        isError: true,
      })
    );
    if (!isShuttingDown) {
      process.exit(1);
    }
  } finally {
    // If we're not already shutting down, clean up here
    if (!isShuttingDown) {
      // Clean up resources
      if (globalAgentSystem) {
        try {
          await globalAgentSystem.dispose();
          logger.info('Agent system disposed.');
          globalAgentSystem = null;
        } catch (error) {
          logger.error('Error during agent system disposal:', error);
        }
      }
      // Shutdown database pool
      try {
        await Postgres.shutdown();
        logger.info('Database connection pool shut down.');
      } catch (dbShutdownError) {
        logger.error('Error shutting down database pool:', dbShutdownError);
      }
    }
  }
};

interface CommandOptions {
  agentPath: string;
  modelsConfigPath: string;
  silentLlm: boolean;
  multi: boolean; // Add the multi flag
}

/**
 * Loads command line arguments and resolves configuration paths
 */
const loadCommand = async (): Promise<CommandOptions> => {
  const argv = await yargs(hideBin(process.argv))
    .option('agent', {
      alias: 'a',
      describe:
        'Agent config file name (e.g., default.agent.json or default.multi-agent.json)',
      type: 'string',
      default: 'default.agent.json',
    })
    .option('models', {
      alias: 'm',
      describe: 'Models config file name (e.g., default.models.json)',
      type: 'string',
      default: 'default.models.json',
    })
    .option('silent-llm', {
      alias: 's',
      describe: 'Disable LLM logs',
      type: 'boolean',
      default: true,
    })
    .option('multi', {
      describe: 'Run in multi-agent mode',
      type: 'boolean',
      default: false,
    })
    .strict()
    .parse();

  const agentFileName = argv['agent'] as string;
  const modelsFileName = argv['models'] as string;
  const silentLlm = argv['silent-llm'] as boolean;
  const multi = argv['multi'] as boolean;

  // Now update all environment variables now that we have processed the command line args
  console.log(`Environment variables after parsing: DEBUG=${DEBUG}`);
  process.env.LOG_LEVEL = DEBUG ? 'debug' : 'info';
  process.env.DEBUG_LOGGING = DEBUG ? 'true' : 'false';
  process.env.LANGCHAIN_VERBOSE = DEBUG ? 'true' : 'false';
  console.log(
    `Final environment variables: LOG_LEVEL=${process.env.LOG_LEVEL}`
  );
  // Always disable langchain tracing regardless of debug mode
  process.env.LANGCHAIN_TRACING = 'false';

  const findConfigPath = (
    fileName: string,
    configType: 'agents' | 'models' | 'multi-agents'
  ): string => {
    const possibleBasePaths = [
      process.cwd(),
      path.resolve(process.cwd(), '..'),
      path.resolve(__dirname, '..', '..'),
      path.resolve(__dirname, '..', '..', '..'),
    ];

    for (const basePath of possibleBasePaths) {
      const tryPath = path.resolve(basePath, 'config', configType, fileName);
      if (fs.existsSync(tryPath)) {
        logger.debug(`Found ${configType} config at: ${tryPath}`);
        return tryPath;
      }
    }

    logger.warn(
      `Could not find ${fileName} in standard config locations. Trying absolute/relative path.`
    );
    const directPath = path.resolve(process.cwd(), fileName);
    if (fs.existsSync(directPath)) {
      logger.debug(`Found ${configType} config at direct path: ${directPath}`);
      return directPath;
    }

    logger.error(`Configuration file ${fileName} not found.`);
    throw new Error(`Configuration file ${fileName} not found.`);
  };

  // Determine which config directory to use based on multi flag
  let agentPath;
  if (multi) {
    agentPath = findConfigPath(agentFileName, 'multi-agents');
  } else {
    agentPath = findConfigPath(agentFileName, 'agents');
  }

  const modelsConfigPath = findConfigPath(modelsFileName, 'models');

  return { agentPath, modelsConfigPath, silentLlm, multi };
};

/**
 * Clears the terminal screen
 */
const clearScreen = (): void => {
  process.stdout.write('\x1Bc');
};

/**
 * Creates a terminal hyperlink
 */
const createLink = (text: string, url: string): string =>
  `\u001B]8;;${url}\u0007${text}\u001B]8;;\u0007`;

// Application logo with styling
const logo = `${chalk.cyan(`
   _____             __
  / ___/____  ____ _/ /__
  \\__ \\/ __ \\/ __ \`/ //_/
 ___/ / / / / /_/ / ,<
/____/_/ /_/\\__,_/_/|_|

${chalk.dim('v0.0.11 by ')}${createLink('Kasar', 'https://kasar.io')}`)}`;

/**
 * Loads environment variables from the .env file
 * Command line variables take precedence
 */
function loadEnvVars(): Record<string, string> | undefined {
  // Correctly determine the project root relative to the script
  const projectRoot = path.resolve(__dirname, '..');
  const envPath = path.resolve(projectRoot, '.env');

  if (process.env.DEBUG === 'true')
    console.log(`Loading .env file from: ${envPath}`);

  const result = config({
    path: envPath,
    override: false, // Do not overwrite variables defined on the command line
  });

  if (result.error && !fs.existsSync(envPath)) {
    console.warn(
      `No .env file found at ${envPath}, using environment variables only`
    );
    return undefined;
  } else if (result.error) {
    console.error(`Failed to load .env file from ${envPath}`, result.error);
    throw new Error('Failed to load .env file');
  }

  if (process.env.DEBUG === 'true')
    console.log('.env file loaded successfully');
  return result.parsed;
}

// Run the application
localRun().catch((error) => {
  console.error(
    createBox(error.message, { title: 'Fatal Error', isError: true })
  );
  if (!isShuttingDown) {
    process.exit(1);
  }
});
