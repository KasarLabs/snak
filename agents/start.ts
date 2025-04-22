import inquirer from 'inquirer';
import chalk from 'chalk';
import { createSpinner } from 'nanospinner';
import { StarknetAgent, StarknetAgentConfig } from './src/agents/core/starknetAgent.js';
import { RpcProvider } from 'starknet';
import { config } from 'dotenv';
import { load_json_config, updateModeConfig, JsonConfig } from './src/config/jsonConfig.js';
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

  const findConfigPath = (fileName: string, configType: 'agents' | 'models'): string => {
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

    logger.warn(`Could not find ${fileName} in standard config locations. Trying absolute/relative path.`);
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
 * Reloads environment variables from .env file
 */
function reloadEnvVars(): Record<string, string> | undefined {
  Object.keys(process.env).forEach((key) => {
    delete process.env[key];
  });

  const result = config({
    path: path.resolve(process.cwd(), '.env'),
    override: true,
  });

  if (result.error) {
    logger.error('Failed to reload .env file', result.error);
    throw new Error('Failed to reload .env file');
  }

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

    // Update config file on disk if needed
    const modeToUpdate = agentMode === 'auto' ? 'autonomous' : 'interactive';
    const updateSpinner = createSpinner(
        `Checking/Updating configuration for ${modeToUpdate} mode...`
      ).start();
    try {
        const updateSuccess = await updateModeConfig(agentPath, modeToUpdate);
        if (updateSuccess) {
            updateSpinner.success({ text: `Configuration file updated for ${modeToUpdate} mode` });
            // Reload config from disk
            json_config = await load_json_config(agentPath);
             if (!json_config) {
                throw new Error(`Failed to reload agent configuration after update from ${agentPath}`);
            }
        } else {
            updateSpinner.warn({ text: `Configuration file already set for ${modeToUpdate} mode or update failed.` });
        }
    } catch(updateError) {
        updateSpinner.error({ text: `Failed to update configuration: ${updateError}` });
        logger.warn("Continuing with potentially outdated mode configuration.");
    }

    // Prepare Agent Configuration
    const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL! });

    const agentConfig: StarknetAgentConfig = {
      provider: provider,
      accountPrivateKey: process.env.STARKNET_PRIVATE_KEY!,
      accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS!,
      signature: 'default-signature', // Using a default value
      agentMode: agentMode,
      agentconfig: json_config,
      modelsConfigPath: modelsConfigPath,
      memory: {
        recursionLimit: json_config?.mode?.recursionLimit, // This exists in ModeConfig
      },
    };

    // Instantiate & Initialize Agent
    const initSpinner = createSpinner('Initializing agent...').start();
    agent = new StarknetAgent(agentConfig);
    agent.setLoggingOptions({
        langchainVerbose: !silentLlm,
        tokenLogging: !silentLlm,
        disabled: process.env.DISABLE_LOGGING === 'true' || false,
    });
    await agent.init();
    initSpinner.success({ text: 'Agent initialized successfully' });

    // Create executor
    await agent.createAgentReactExecutor();

    // --- Execution Logic --- 
    if (agentMode === 'auto') {
      // Autonomous mode
      console.log(chalk.yellow('Running in Autonomous Mode...'));
      await agent.execute_autonomous();
      console.log(chalk.green('Autonomous execution finished or stopped.'));
    } else {
      // Interactive mode
      console.log(chalk.green('Running in Interactive Mode. Type ' + 'exit' + ' to quit.'));
      while (true) {
        const { prompt } = await inquirer.prompt([
            {
                type: 'input',
                name: 'prompt',
                message: chalk.green('User') + ':',
                validate: (value: string) => value.trim().length > 0 || 'Please enter a message.',
            },
        ]);

        if (prompt.toLowerCase() === 'exit') {
            break;
        }

        const interactiveSpinner = createSpinner('Processing...').start();
        try {
          const result = await agent.execute(prompt);
          interactiveSpinner.success({ text: 'Agent Response:' });
          const formattedResult = formatAgentResponse(result as string);
          const boxContent = createBox('Agent Response', formattedResult);
          const boxWithTokens = addTokenInfoToBox(boxContent);
          console.log(boxWithTokens);
        } catch (error: any) {
          interactiveSpinner.error({ text: 'Error during execution' });
          logger.error('Error during interactive execution:', error);
          console.error(createBox(error.message || 'Unknown error', {
            title: 'Execution Error',
            isError: true,
          }));
        }
      }
      console.log(chalk.blue('Exiting Interactive Mode.'));
    }

  } catch (error: any) {
    logger.error('An error occurred during agent setup or execution:', error);
    console.error(createBox(error.message || 'An unknown error occurred', {
      title: 'Fatal Error',
      isError: true,
    }));
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nGracefully shutting down from SIGINT (Ctrl+C)');
  process.exit(0);
});

// Start the application
localRun();
