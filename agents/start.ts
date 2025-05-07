// Simple log configuration - set DEBUG=true to enable debug logs
const DEBUG = process.env.DEBUG === 'true';
console.log(`Environment variables: DEBUG=${DEBUG}`);

import inquirer from 'inquirer';
import chalk from 'chalk';
import { createSpinner } from 'nanospinner';
import { RpcProvider } from 'starknet';
import { config } from 'dotenv';
import { Postgres } from '@snakagent/database';
import {
  load_json_config,
  AgentMode,
  AgentConfig,
  AGENT_MODES,
} from './src/config/jsonConfig.js';
import { createBox } from './src/prompt/formatting.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from '@snakagent/core';
import { DatabaseCredentials } from './src/tools/types/database.js';
import { formatAgentResponse } from './src/agents/core/utils.js';

import { AgentSystem, AgentSystemConfig } from './src/agents/index.js';
import { hybridInitialPrompt } from 'prompt/prompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CommandOptions {
  agentPath: string;
  modelsConfigPath: string;
  silentLlm: boolean;
}

/**
 * Loads command line arguments and resolves configuration paths
 */
const loadCommand = async (): Promise<CommandOptions> => {
  const argv = await yargs(hideBin(process.argv))
    .option('agent', {
      alias: 'a',
      describe: 'Your agent config file name (e.g., default.agent.json)',
      type: 'string',
      default: 'default.agent.json',
    })
    .option('models', {
      alias: 'm',
      describe: 'Your models config file name (e.g., default.models.json)',
      type: 'string',
      default: 'default.models.json',
    })
    .option('silent-llm', {
      alias: 's',
      describe: 'Disable LLM logs',
      type: 'boolean',
      default: true,
    })
    .strict()
    .parse();

  const agentFileName = argv['agent'] as string;
  const modelsFileName = argv['models'] as string;
  const silentLlm = argv['silent-llm'] as boolean;

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
    configType: 'agents' | 'models'
  ): string => {
    const possibleBasePaths = [
      process.cwd(),
      path.resolve(process.cwd(), '..'),
      path.resolve(__dirname, '..', '..', '..'),
      path.resolve(__dirname, '..', '..', '..', '..'),
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

  const agentPath = findConfigPath(agentFileName, 'agents');
  const modelsConfigPath = findConfigPath(modelsFileName, 'models');

  return { agentPath, modelsConfigPath, silentLlm };
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
 * Charge les variables d'environnement depuis le fichier .env
 * Les variables définies en ligne de commande ont priorité
 */
function loadEnvVars(): Record<string, string> | undefined {
  // Correctly determine the project root relative to the script
  const projectRoot = path.resolve(__dirname, '..');
  const envPath = path.resolve(projectRoot, '.env');

  if (process.env.DEBUG === 'true')
    console.log(`Loading .env file from: ${envPath}`);

  const result = config({
    path: envPath,
    override: false, // Ne pas écraser les variables définies en ligne de commande
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

/**
 * Main function to run the application
 */
const localRun = async (): Promise<void> => {
  clearScreen();
  console.log(logo);
  console.log(
    createBox(
      'Welcome to Snak, an advanced Agent engine powered by Starknet.',
      'For more information, visit our documentation at https://docs.snakagent.com'
    )
  );

  let agentSystem: AgentSystem | null = null;

  try {
    // Load command line args
    const { agentPath, modelsConfigPath } = await loadCommand();

    // Load initial agent config
    let json_config: AgentConfig | undefined =
      await load_json_config(agentPath);
    if (!json_config) {
      throw new Error(`Failed to load agent configuration from ${agentPath}`);
    }

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

    // Use the mode from agent configuration
    const agentMode = json_config.mode;

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
      spinner.error({ text: 'Failed to initialize database connection pool' });
      logger.error('Database initialization failed:', dbError);
      throw new Error(`Failed to initialize database: ${dbError.message}`);
    }

    const nodeUrl = process.env.STARKNET_RPC_URL;
    if (!nodeUrl) {
      throw new Error(
        "STARKNET_RPC_URL n'est pas défini dans les variables d'environnement"
      );
    }

    // Prepare RPC Provider
    const provider = new RpcProvider({ nodeUrl: `${nodeUrl}` });

    // Prepare Agent System configuration ACCORDING TO THE DEFINITION IN agents/src/agents/index.ts
    const agentSystemConfig: AgentSystemConfig = {
      starknetProvider: provider,
      accountPrivateKey: process.env.STARKNET_PRIVATE_KEY!,
      accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS!,
      modelsConfigPath, // Already loaded
      agentMode: agentMode,
      signature: '', // TODO: Implement signature handling
      databaseCredentials: database,
      agentConfigPath: agentPath, // Pass the PATH to the agent config file
      debug: DEBUG,
    };

    // Create and initialize the agent system
    agentSystem = new AgentSystem(agentSystemConfig);
    await agentSystem.init();

    spinner.success({
      text: chalk.black(
        `Agent System "${chalk.cyan(json_config?.name || 'Unknown')}" initialized successfully`
      ),
    });

    // --- Execution Logic based on mode ---
    if (agentMode === AGENT_MODES[AgentMode.INTERACTIVE]) {
      console.log(chalk.dim('\nStarting interactive session...\n'));
      console.log(
        chalk.dim(`- Config: ${chalk.bold(path.basename(agentPath))}`)
      );
      console.log(
        chalk.dim(`- Models: ${chalk.bold(path.basename(modelsConfigPath))}\n`)
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
          break;
        }

        // Start with a message instead of a spinner to allow log display
        console.log(chalk.yellow('Processing request...'));

        try {
          // Execute through the supervisor agent which will route appropriately
          await agentSystem.execute(user);

          // Removing duplicate response formatting and logging since it's now handled
          // consistently in all mode files (interactive.ts, autonomous.ts, hybrid.ts)
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
    } else if (agentMode === AGENT_MODES[AgentMode.AUTONOMOUS]) {
      console.log(chalk.dim('\nStarting autonomous session...\n'));
      console.log(
        chalk.dim(`- Config: ${chalk.bold(path.basename(agentPath))}`)
      );
      console.log(chalk.yellow('Running autonomous mode...'));

      try {
        // Verify autonomous mode is enabled in the configuration
        if (json_config?.mode !== AgentMode.AUTONOMOUS) {
          throw new Error('Autonomous mode is disabled in agent configuration');
        }

        // Get the Starknet Agent and execute in autonomous mode
        const starknetAgent = agentSystem.getStarknetAgent();
        if (!starknetAgent) {
          throw new Error('Failed to get StarknetAgent from the agent system');
        }

        // For backwards compatibility, still accessing execute_autonomous directly
        // In future versions, this should be handled by the SupervisorAgent
        await starknetAgent.execute_autonomous();
        console.log(chalk.green('Autonomous execution completed'));
      } catch (error) {
        console.error(chalk.red('Error in autonomous mode'));
        logger.error(
          createBox(error.message, { title: 'Error', isError: true })
        );
      }
    } else if (agentMode === AGENT_MODES[AgentMode.HYBRID]) {
      console.log(chalk.dim('\nStarting hybrid session...\n'));
      console.log(
        chalk.dim(`- Config: ${chalk.bold(path.basename(agentPath))}`)
      );
      console.log(chalk.yellow('Running hybrid mode...\n'));

      try {
        if (!agentSystem) {
          throw new Error('Agent system not initialized');
        }

        // Use a predefined prompt instead of asking the user
        const initialPrompt = hybridInitialPrompt;

        console.log(
          chalk.yellow('\nStarting hybrid execution automatically...\n')
        );

        // Démarrer l'exécution hybride
        const { state, threadId } =
          await agentSystem.startHybridExecution(initialPrompt);
        console.log(
          chalk.green(`Hybrid execution started with thread ID: ${threadId}`)
        );

        // État de l'exécution
        let currentState = state;
        let isRunning = true;

        // Fonction pour afficher le dernier message
        const displayLastMessage = () => {
          if (currentState.messages && currentState.messages.length > 0) {
            const lastMessage =
              currentState.messages[currentState.messages.length - 1];

            // Skip logging if message has already been logged by the hybrid agent
            if (lastMessage.additional_kwargs?.logged === true) {
              return;
            }

            const content =
              typeof lastMessage.content === 'string'
                ? lastMessage.content
                : JSON.stringify(lastMessage.content);

            // Replace box display with simple log
            logger.info(`Agent Response:\n\n${formatAgentResponse(content)}`);

            // Mark message as logged to prevent duplicate logging
            if (!lastMessage.additional_kwargs) {
              lastMessage.additional_kwargs = {};
            }
            lastMessage.additional_kwargs.logged = true;
          }
        };

        // Boucle principale d'interaction
        while (isRunning) {
          // Afficher le dernier message
          displayLastMessage();

          // Vérifier si l'agent attend une entrée
          if (agentSystem.isWaitingForInput(currentState)) {
            console.log(chalk.yellow('\nAgent is waiting for input.\n'));

            // Demander l'entrée utilisateur
            const { userInput } = await inquirer.prompt([
              {
                type: 'input',
                name: 'userInput',
                message: chalk.green('User:'),
                validate: (value) => {
                  if (!value.trim()) return 'Please enter a valid response';
                  if (value.toLowerCase() === 'exit') return true;
                  return true;
                },
              },
            ]);

            // Sortir si l'utilisateur tape "exit"
            if (userInput.toLowerCase() === 'exit') {
              console.log(chalk.blue('\nExiting hybrid mode...\n'));
              isRunning = false;
              break;
            }

            console.log(chalk.yellow('\nProcessing your input...\n'));

            // Fournir l'entrée à l'agent et continuer l'exécution
            try {
              const result = await agentSystem.provideHybridInput(
                userInput,
                threadId
              );
              currentState = result.state;
            } catch (inputError) {
              console.error(chalk.red('Error processing your input:'));
              console.error(
                createBox(inputError.message, { title: 'Error', isError: true })
              );
            }
          }
          // Vérifier si l'exécution est terminée
          else if (agentSystem.isExecutionComplete(currentState)) {
            console.log(chalk.green('\nHybrid execution completed.\n'));
            isRunning = false;
          }
          // Si l'agent est encore en train de travailler, attendre un peu
          else {
            console.log(
              chalk.dim(
                '\nAgent is working autonomously. Press Ctrl+C to exit.\n'
              )
            );

            // Option pour continuer ou interrompre
            const { action } = await inquirer.prompt([
              {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: [
                  { name: 'Wait for next update', value: 'wait' },
                  { name: 'Force provide input', value: 'input' },
                  { name: 'Exit hybrid mode', value: 'exit' },
                ],
              },
            ]);

            if (action === 'exit') {
              console.log(chalk.blue('\nExiting hybrid mode...\n'));
              isRunning = false;
            } else if (action === 'input') {
              // Permettre à l'utilisateur de fournir une entrée même si l'agent n'en a pas demandé
              const { userInput } = await inquirer.prompt([
                {
                  type: 'input',
                  name: 'userInput',
                  message: chalk.green('Your input (forced interruption):'),
                  validate: (value) =>
                    value.trim() ? true : 'Please enter a valid input',
                },
              ]);

              console.log(
                chalk.yellow('\nInterrupting agent with your input...\n')
              );

              try {
                const result = await agentSystem.provideHybridInput(
                  userInput,
                  threadId
                );
                currentState = result.state;
              } catch (inputError) {
                console.error(chalk.red('Error processing your interrupt:'));
                console.error(
                  createBox(inputError.message, {
                    title: 'Error',
                    isError: true,
                  })
                );
              }
            } else {
              // Attendre et vérifier l'état à nouveau
              console.log(chalk.dim('Waiting for update...'));
              // Vous pourriez implémenter une attente plus sophistiquée ici
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }
        }
      } catch (error) {
        console.error(chalk.red('Error in hybrid mode'));
        logger.error('Hybrid mode error:', error);
        console.error(
          createBox(error.message, { title: 'Error', isError: true })
        );
      }
    }
  } catch (error: any) {
    console.error(
      createBox(error.message || 'An unknown error occurred', {
        title: 'Fatal Error',
        isError: true,
      })
    );
    process.exit(1);
  } finally {
    // Clean up resources
    if (agentSystem) {
      try {
        await agentSystem.dispose();
        logger.info('Agent system disposed.');
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
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nGracefully shutting down from SIGINT (Ctrl+C)');
  process.exit(0);
});

// Run the application
localRun().catch((error) => {
  console.error(
    createBox(error.message, { title: 'Fatal Error', isError: true })
  );
  process.exit(1);
});
