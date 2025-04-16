import inquirer from 'inquirer';
import chalk from 'chalk';
import { createSpinner } from 'nanospinner';
import { StarknetAgent } from './src/starknetAgent.js';
import { RpcProvider } from 'starknet';
import { config } from 'dotenv';
import { load_json_config, updateModeConfig } from './src/jsonConfig.js';
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
  silentLlm: boolean;
}

/**
 * Loads command line arguments and resolves the agent configuration path
 */
const loadCommand = async (): Promise<CommandOptions> => {
  const argv = await yargs(hideBin(process.argv))
    .option('agent', {
      alias: 'a',
      describe: 'Your config agent file name',
      type: 'string',
      default: 'default.agent.json',
    })
    .option('silent-llm', {
      alias: 's',
      describe: 'Disable LLM logs',
      type: 'boolean',
      default: true,
    })
    .strict()
    .parse();

  const agentPath = argv['agent'] as string;
  const silentLlm = argv['silent-llm'] as boolean;

  // Try multiple possible locations for the config file
  const possiblePaths = [
    path.resolve(process.cwd(), 'config', 'agents', agentPath),
    path.resolve(process.cwd(), '..', 'config', 'agents', agentPath),
    path.resolve(__dirname, '..', '..', '..', 'config', 'agents', agentPath),
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'config',
      'agents',
      agentPath
    ),
  ];

  // Try each path until we find one that works
  for (const tryPath of possiblePaths) {
    if (fs.existsSync(tryPath)) {
      return { agentPath: tryPath, silentLlm };
    }
  }

  // If not found in any of the expected locations, try the absolute path
  return {
    agentPath: path.isAbsolute(agentPath)
      ? agentPath
      : path.resolve(process.cwd(), agentPath),
    silentLlm,
  };
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
    'AI_MODEL',
    'AI_PROVIDER',
    'AI_PROVIDER_API_KEY',
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

  const { agentPath, silentLlm } = await loadCommand();
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
      throw new Error('Failed to load agent configuration');
    }

    // Update the configuration file with the selected mode
    if (mode === 'agent' || mode === 'auto') {
      const modeToUpdate = mode === 'agent' ? 'interactive' : 'autonomous';
      const updateSpinner = createSpinner(
        `Updating configuration to ${modeToUpdate} mode`
      ).start();

      const updateSuccess = await updateModeConfig(agentPath, modeToUpdate);
      if (updateSuccess) {
        updateSpinner.success({
          text: `Configuration updated to ${modeToUpdate} mode`,
        });
      } else {
        updateSpinner.error({
          text: `Failed to update configuration, continuing with current settings`,
        });
      }
    }

    // Determine agent mode based on mode configuration
    let agentMode = mode;
    if (agentConfig.mode) {
      if (mode === 'auto' && agentConfig.mode.autonomous === false) {
        agentMode = 'agent';
        logger.warn(
          'Autonomous mode is disabled in config - switching to agent mode'
        );
      } else if (mode === 'agent' && agentConfig.mode.interactive === false) {
        agentMode = 'auto';
        logger.warn(
          'Interactive mode is disabled in config - switching to autonomous mode'
        );
      }
    }

    // Make sure we correctly map mode values
    if (agentMode === 'auto' && agentConfig.mode?.autonomous) {
      logger.info('Setting mode to "auto" for autonomous execution');
      agentMode = 'auto';
    }

    // Log the configuration and mode for debugging
    logger.info(`Selected mode: ${mode}, Agent mode: ${agentMode}`);
    logger.info(
      `Config mode settings: interactive=${agentConfig.mode?.interactive}, autonomous=${agentConfig.mode?.autonomous}`
    );

    // Display more information about the agent
    const agentName = agentConfig.name || 'Unknown';
    const configPath = path.basename(agentPath);
    const aiModel = process.env.AI_MODEL;
    const aiProvider = process.env.AI_PROVIDER;

    spinner.success({
      text: chalk.black(
        `Agent "${chalk.cyan(agentName)}" initialized successfully`
      ),
    });

    // Create agent instance with proper configuration
    const agent = new StarknetAgent({
      provider: new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }),
      accountPrivateKey: process.env.STARKNET_PRIVATE_KEY as string,
      accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS as string,
      aiModel: process.env.AI_MODEL as string,
      aiProvider: process.env.AI_PROVIDER as string,
      aiProviderApiKey: process.env.AI_PROVIDER_API_KEY as string,
      signature: 'key',
      agentMode: agentMode,
      agentconfig: agentConfig,
    });

    logger.info(`Created StarknetAgent with agentMode: ${agentMode}`);

    await agent.createAgentReactExecutor();

    // Configure logging options with a small delay to ensure initialization
    setTimeout(() => {
      agent.setLoggingOptions({
        langchainVerbose: !silentLlm,
        tokenLogging: !silentLlm,
      });
    }, 100);

    if (agentMode === 'agent') {
      console.log(chalk.dim('\nStarting interactive session...\n'));
      console.log(
        chalk.dim(`- Config: ${chalk.bold(configPath)}\n`) +
          chalk.dim(`- Model: ${chalk.bold(aiModel)}\n`) +
          chalk.dim(`- Provider: ${chalk.bold(aiProvider)}\n`)
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
      console.log(
        chalk.dim(`- Config: ${chalk.bold(configPath)}\n`) +
          chalk.dim(`- Model: ${chalk.bold(aiModel)}\n`) +
          chalk.dim(`- Provider: ${chalk.bold(aiProvider)}\n`)
      );
      console.log(chalk.yellow('Running autonomous mode...'));

      try {
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
  } catch (error) {
    spinner.error({ text: 'Failed to initialize agent' });
    console.error(
      createBox(error.message, { title: 'Fatal Error', isError: true })
    );
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
