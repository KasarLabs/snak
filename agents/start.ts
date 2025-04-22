import inquirer from 'inquirer';
import chalk from 'chalk';
import { createSpinner } from 'nanospinner';
import {
  StarknetAgent,
  StarknetAgentConfig,
} from './src/agents/core/starknetAgent.js';
import { RpcProvider } from 'starknet';
import { config } from 'dotenv';
import {
  load_json_config,
  updateModeConfig,
  JsonConfig,
} from './src/config/jsonConfig.js';
import { createBox } from './src/prompt/formatting.js';
import { addTokenInfoToBox } from './src/token/tokenTracking.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from '@snakagent/core';

// Global deactivation of LangChain logs
process.env.LANGCHAIN_TRACING = 'false';
process.env.LANGCHAIN_VERBOSE = 'false';

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
 * Gets the available terminal width
 */
const getTerminalWidth = (): number => {
  return Math.min(process.stdout.columns || 80, 100);
};

/**
 * Wraps text to fit within a maximum width
 */
const wrapText = (text: string, maxWidth: number): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    if ((currentLine + ' ' + word).length <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
};

/**
 * Reloads environment variables from .env file while preserving command-line environment variables
 */
function reloadEnvVars(): Record<string, string> | undefined {
  // Save debug-related environment variables
  const debugVars = {
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
    DEBUG_LOGGING: process.env.DEBUG_LOGGING,
    DISABLE_LOGGING: process.env.DISABLE_LOGGING,
  };

  // Clear non-essential variables
  Object.keys(process.env).forEach((key) => {
    if (
      !['NODE_ENV', 'LOG_LEVEL', 'DEBUG_LOGGING', 'DISABLE_LOGGING'].includes(
        key
      )
    ) {
      delete process.env[key];
    }
  });

  // Correctly determine the project root relative to the script
  const projectRoot = path.resolve(__dirname, '..');
  const envPath = path.resolve(projectRoot, '.env');

  logger.debug(`Attempting to load .env file from: ${envPath}`);

  const result = config({
    path: envPath,
    override: false, // Don't override existing environment variables
  });

  if (result.error) {
    logger.error(`Failed to reload .env file from ${envPath}`, result.error);
    throw new Error('Failed to reload .env file');
  }

  // Re-apply debug variables (command-line takes precedence)
  Object.entries(debugVars).forEach(([key, value]) => {
    if (value !== undefined) {
      process.env[key] = value;
      logger.debug(`Preserved environment variable: ${key}=${value}`);
    }
  });

  logger.debug('.env file reloaded successfully.');
  return result.parsed;
}

/**
 * Validates required environment variables and prompts for missing ones
 */
const validateEnvVars = async (): Promise<void> => {
  const required = [
    'STARKNET_RPC_URL',
    'STARKNET_PRIVATE_KEY',
    'STARKNET_PUBLIC_ADDRESS',
  ];

  const missings = required.filter((key) => !process.env[key]);

  if (missings.length > 0) {
    console.error(
      createBox(missings.join('\n'), {
        title: 'Missing Environment Variables',
        isError: true,
      })
    );

    for (const missing of missings) {
      const { prompt } = await inquirer.prompt([
        {
          type: 'input',
          name: 'prompt',
          message: chalk.redBright(`Enter the value of ${missing}:`),
          validate: (value: string) => {
            const trimmed = value.trim();
            if (!trimmed) return 'Please enter a valid message';
            return true;
          },
        },
      ]);

      await new Promise<void>((resolve, reject) => {
        fs.appendFile('.env', `\n${missing}=${prompt}\n`, (err) => {
          if (err) reject(new Error('Error when trying to write on .env file'));
          resolve();
        });
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    reloadEnvVars();
    await validateEnvVars();
  }
};

/**
 * Formats agent response for display
 */
const formatAgentResponse = (response: string): string => {
  if (typeof response !== 'string') return response;

  return response
    .split('\n')
    .map((line) => {
      if (line.includes('•')) {
        return `  ${line.trim()}`;
      }
      return line;
    })
    .join('\n');
};

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

  let agent: StarknetAgent | null = null;

  try {
    // Load command line args
    const { agentPath, modelsConfigPath, silentLlm } = await loadCommand();

    // Load initial agent config
    let json_config: JsonConfig | undefined = await load_json_config(agentPath);
    if (!json_config) {
      throw new Error(`Failed to load agent configuration from ${agentPath}`);
    }

    // Load env vars
    reloadEnvVars();
    await validateEnvVars();

    // Ask for mode
    const { mode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: 'Select operation mode:',
        choices: [
          { name: `Interactive Mode`, value: 'agent', short: 'Interactive' },
          { name: `Autonomous Mode`, value: 'autonomous', short: 'Autonomous' },
        ],
      },
    ]);
    const agentMode = mode === 'autonomous' ? 'auto' : 'agent';

    clearScreen();
    console.log(logo);
    const spinner = createSpinner('Initializing Starknet Agent').start();

    // Update config file on disk if needed
    try {
      spinner.stop();

      const modeToUpdate = agentMode === 'auto' ? 'autonomous' : 'interactive';
      const updateSpinner = createSpinner(
        `Updating configuration to ${modeToUpdate} mode`
      ).start();

      const updateSuccess = await updateModeConfig(agentPath, modeToUpdate);
      if (updateSuccess) {
        updateSpinner.success({
          text: `Configuration updated to ${modeToUpdate} mode`,
        });

        // Reload config from disk
        json_config = await load_json_config(agentPath);
        if (!json_config) {
          throw new Error(
            `Failed to reload agent configuration after update from ${agentPath}`
          );
        }
      } else {
        updateSpinner.warn({
          text: `Failed to update configuration, continuing with current settings`,
        });
      }
    } catch (updateError) {
      spinner.error({ text: `Failed to update configuration: ${updateError}` });
      logger.warn('Continuing with potentially outdated mode configuration.');
    }

    // Prepare Agent Configuration
    const provider = new RpcProvider({
      nodeUrl: process.env.STARKNET_RPC_URL!,
    });

    const agentConfig: StarknetAgentConfig = {
      provider: provider,
      accountPrivateKey: process.env.STARKNET_PRIVATE_KEY!,
      accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS!,
      signature: 'default-signature',
      agentMode: agentMode,
      agentconfig: json_config,
      modelsConfigPath: modelsConfigPath,
      memory: {
        recursionLimit: json_config?.mode?.recursionLimit,
      },
    };

    // Display agent information
    const agentName = json_config?.name || 'Unknown';
    const configPath = path.basename(agentPath);

    spinner.success({
      text: chalk.black(
        `Agent "${chalk.cyan(agentName)}" initialized successfully`
      ),
    });

    // Instantiate & Initialize Agent
    agent = new StarknetAgent(agentConfig);

    // Determine logging configuration from environment
    const enableDebugLogging =
      process.env.DEBUG_LOGGING === 'true' ||
      process.env.LOG_LEVEL === 'debug' ||
      process.env.NODE_ENV === 'development';
    const disableLogging = process.env.DISABLE_LOGGING === 'true';

    agent.setLoggingOptions({
      langchainVerbose: !silentLlm,
      tokenLogging: !silentLlm,
      disabled: disableLogging,
      modelSelectionDebug: enableDebugLogging,
    });
    await agent.init();
    await agent.createAgentReactExecutor();

    // --- Execution Logic based on mode ---
    if (agentMode === 'agent') {
      console.log(chalk.dim('\nStarting interactive session...\n'));
      console.log(chalk.dim(`- Config: ${chalk.bold(configPath)}`));

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
          const aiResponse = await agent.execute(user);

          if (typeof aiResponse === 'string') {
            const boxContent = createBox(
              'Agent Response',
              formatAgentResponse(aiResponse)
            );
            // Add token information to the box
            const boxWithTokens = addTokenInfoToBox(boxContent);
            process.stdout.write(boxWithTokens);
          } else {
            logger.error('Invalid response type');
          }
        } catch (error) {
          console.error(chalk.red('Error processing request'));
          console.log(
            createBox(error.message, { title: 'Error', isError: true })
          );
        }
      }
    } else if (agentMode === 'auto') {
      console.log(chalk.dim('\nStarting autonomous session...\n'));
      console.log(chalk.dim(`- Config: ${chalk.bold(configPath)}`));
      console.log(chalk.yellow('Running autonomous mode...'));

      try {
        // Verify autonomous mode is enabled in the configuration
        if (!json_config?.mode?.autonomous) {
          throw new Error('Autonomous mode is disabled in agent configuration');
        }

        // Autonomous execution without spinner to allow log display
        await agent.execute_autonomous();
        console.log(chalk.green('Autonomous execution completed'));
      } catch (error) {
        console.error(chalk.red('Error in autonomous mode'));
        logger.error(
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
