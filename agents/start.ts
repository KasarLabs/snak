import inquirer from 'inquirer';
import chalk from 'chalk';
import { createSpinner } from 'nanospinner';
import { StarknetAgent } from './src/starknetAgent.js';
import { RpcProvider } from 'starknet';
import { config } from 'dotenv';
import {
  load_json_config,
  loadModelsConfig,
  ModelsConfig,
} from './src/jsonConfig.js';
import { createBox } from './src/formatting.js';
import { addTokenInfoToBox } from './src/tokenTracking.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import logger from './src/logger.js';

// Global deactivation of LangChain logs
process.env.LANGCHAIN_TRACING = 'false';
process.env.LANGCHAIN_VERBOSE = 'false';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CommandOptions {
  agentPath: string;
  modelsPath: string;
  silentLlm: boolean;
}

/**
 * Resolves the full path for a configuration file (agent or models)
 */
const resolveConfigPath = (
  fileName: string,
  configType: 'agents' | 'models'
): string => {
  // Try multiple possible locations for the config file
  const possiblePaths = [
    path.resolve(process.cwd(), 'config', configType, fileName),
    path.resolve(process.cwd(), '..', 'config', configType, fileName),
    path.resolve(__dirname, '..', '..', '..', 'config', configType, fileName),
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'config',
      configType,
      fileName
    ),
  ];

  // Try each path until we find one that works
  for (const tryPath of possiblePaths) {
    if (fs.existsSync(tryPath)) {
      return tryPath;
    }
  }

  // If not found in any of the expected locations, try the absolute path or relative to cwd
  return path.isAbsolute(fileName)
    ? fileName
    : path.resolve(process.cwd(), fileName);
};

/**
 * Loads command line arguments and resolves configuration paths
 */
const loadCommand = async (): Promise<CommandOptions> => {
  const argv = await yargs(hideBin(process.argv))
    .option('agent', {
      alias: 'a',
      describe: 'Your config agent file name (e.g., default.agent.json)',
      type: 'string',
      default: 'default.agent.json',
    })
    .option('models', {
      alias: 'm',
      describe: 'Your config models file name (e.g., default.models.json)',
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

  const agentPath = resolveConfigPath(agentFileName, 'agents');
  const modelsPath = resolveConfigPath(modelsFileName, 'models');

  return { agentPath, modelsPath, silentLlm };
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
      createBox(`Missing Environment Variables:\n- ${missings.join('\n- ')}`, {
        title: 'Missing Environment Variables',
        isError: true,
      })
    );

    const answers = await inquirer.prompt(
      missings.map((missing) => ({
        type: 'input',
        name: missing,
        message: chalk.redBright(`Enter the value for ${missing}:`),
        validate: (value: string) =>
          value.trim() ? true : 'Please enter a valid value',
      }))
    );

    let envUpdates = '';
    for (const [key, value] of Object.entries(answers)) {
      envUpdates += `\n${key}=${value}`;
    }

    if (envUpdates) {
      try {
        fs.appendFileSync('.env', envUpdates + '\n');
        logger.info(`Appended missing variables to .env file.`);
        reloadEnvVars();
      } catch (err) {
        logger.error(`Error writing to .env file: ${err.message}`);
        throw new Error('Failed to update .env file with missing variables.');
      }
    } else {
      throw new Error('Could not get missing environment variable values.');
    }
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

  const { agentPath, modelsPath, silentLlm } = await loadCommand();
  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'Select operation mode:',
      choices: [
        {
          name: `Interactive Mode`,
          value: 'agent',
          short: 'Interactive',
        },
        {
          name: `Autonomous Mode`,
          value: 'auto',
          short: 'Autonomous',
        },
      ],
    },
  ]);

  clearScreen();
  console.log(logo);
  const spinner = createSpinner('Initializing Starknet Agent').start();

  try {
    spinner.stop();
    await validateEnvVars();
    const agentConfig = await load_json_config(agentPath);
    if (agentConfig === undefined) {
      throw new Error(`Failed to load agent configuration from: ${agentPath}`);
    }

    const modelsConfig = await loadModelsConfig(modelsPath);
    if (modelsConfig === undefined) {
      throw new Error(
        `Failed to load models configuration from: ${modelsPath}`
      );
    }

    spinner.success({
      text: chalk.black(
        `Agent "${chalk.cyan(agentConfig.name || 'Unknown')}" initialized successfully`
      ),
    });

    const agentName = agentConfig.name || 'Unknown';
    const agentConfigFileName = path.basename(agentPath);
    const modelsConfigFileName = path.basename(modelsPath);

    // Log model information for each level defined in the models config
    console.log('\nModel configuration loaded:');
    if (modelsConfig.models) {
      for (const [level, modelInfo] of Object.entries(modelsConfig.models)) {
        console.log(
          chalk.dim(
            `- Level '${chalk.bold(level)}': ${chalk.bold(modelInfo.provider)}/${chalk.bold(modelInfo.model_name)}`
          )
        );
      }
      console.log(''); // Empty line after model info
    }

    const agent = new StarknetAgent({
      provider: new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }),
      accountPrivateKey: process.env.STARKNET_PRIVATE_KEY as string,
      accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS as string,
      aiProviderApiKey: process.env.AI_PROVIDER_API_KEY as string,
      signature: 'key',
      agentMode: mode,
      agentconfig: agentConfig,
      modelsConfig: modelsConfig,
    });

    await agent.createAgentReactExecutor();

    // Set logging options immediately without setTimeout
    agent.setLoggingOptions({
      langchainVerbose: !silentLlm,
      tokenLogging: !silentLlm,
    });

    // Log model information immediately to verify logging is working
    logger.debug(`Agent initialized with logging - silentLlm: ${silentLlm}`);

    if (mode === 'agent') {
      console.log(chalk.dim('\nStarting interactive session...\n'));
      console.log(
        chalk.dim(`- Agent Config: ${chalk.bold(agentConfigFileName)}\n`) +
          chalk.dim(`- Models Config: ${chalk.bold(modelsConfigFileName)}\n`)
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
              return true;
            },
          },
        ]);

        console.log(chalk.yellow('Processing request...'));

        try {
          const aiResponse = await agent.execute(user);

          if (typeof aiResponse === 'string') {
            const boxContent = createBox(
              'Agent Response',
              formatAgentResponse(aiResponse)
            );
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
    } else if (mode === 'auto') {
      console.log(chalk.dim('\nStarting autonomous session...\n'));
      console.log(
        chalk.dim(`- Agent Config: ${chalk.bold(agentConfigFileName)}\n`) +
          chalk.dim(`- Models Config: ${chalk.bold(modelsConfigFileName)}\n`)
      );
      console.log(chalk.yellow('Running autonomous mode...'));

      try {
        await agent.execute_autonomous();
        console.log(chalk.green('Autonomous execution completed'));
      } catch (error) {
        console.error(chalk.red('Error in autonomous mode'));
        logger.error(
          createBox(error.message, { title: 'Error', isError: true })
        );
      }
    }
  } catch (error) {
    spinner.error({ text: 'Failed to initialize agent' });
    console.error(
      createBox(error.message, { title: 'Fatal Error', isError: true })
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
