import inquirer from 'inquirer';
import chalk from 'chalk';
import { createSpinner } from 'nanospinner';
import { StarknetAgent } from './src/starknetAgent';
import { RpcProvider } from 'starknet';
import { config } from 'dotenv';
import { load_json_config } from './src/jsonConfig';
import { createBox } from './src/formatting';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'fs';
import path from 'path';
import { log } from 'console';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

const load_command = async (): Promise<string> => {
  const argv = await yargs(hideBin(process.argv))
    .option('agent', {
      alias: 'a',
      describe: 'Your config agent file name',
      type: 'string',
      default: 'default.agent.json',
    })
    .strict()
    .parse();

  return argv['agent'];
};

const clearScreen = () => {
  process.stdout.write('\x1Bc');
};

const logo = `${chalk.cyan(`
  ____  _             _               _        _                    _     _  ___ _
 / ___|| |_ __ _ _ __| | ___ __   ___| |_     / \\   __ _  ___ _ __ | |_  | |/ (_) |_
 \\___ \\| __/ _\` | '__| |/ / '_ \\ / _ \\ __|   / _ \\ / _\` |/ _ \\ '_ \\| __| | ' /| | __|
  ___) | || (_| | |  |   <| | | |  __/ |_   / ___ \\ (_| |  __/ | | | |_  | . \\| | |_
 |____/ \\__\\__,_|_|  |_|\\_\\_| |_|\\___|\\__| /_/   \\_\\__, |\\___|_| |_|\\__| |_|\\_\\_|\\__|
                                                   |___/
`)}`;

const getTerminalWidth = (): number => {
  return Math.min(process.stdout.columns || 80, 100);
};

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

function reloadEnvVars() {
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

const validateEnvVars = async () => {
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

      await new Promise((resolve, reject) => {
        fs.appendFile('.env', `\n${missing}=${prompt}\n`, (err) => {
          if (err) reject(new Error('Error when trying to write on .env file'));
          resolve(null);
        });
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    reloadEnvVars();
    await validateEnvVars();
  }
};

const LocalRun = async () => {
  clearScreen();
  console.log(logo);
  console.log(
    createBox(
      'Welcome to Starknet-Agent-Kit',
      'For more informations, visit our documentation at https://docs.starkagent.ai'
    )
  );

  const agent_config_name = await load_command();
  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'Select operation mode:',
      choices: [
        {
          name: `${chalk.green('>')} Interactive Mode`,
          value: 'agent',
          short: 'Interactive',
        },
        {
          name: `${chalk.blue('>')} Autonomous Mode`,
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
    spinner.success({ text: 'Agent initialized successfully' });
    const agent_config = load_json_config(agent_config_name);

    if (mode === 'agent') {
      console.log(chalk.dim('\nStarting interactive session...\n'));

      const agent = new StarknetAgent({
        provider: new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }),
        accountPrivateKey: process.env.STARKNET_PRIVATE_KEY as string,
        accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS as string,
        aiModel: process.env.AI_MODEL as string,
        aiProvider: process.env.AI_PROVIDER as string,
        aiProviderApiKey: process.env.AI_PROVIDER_API_KEY as string,
        signature: 'key',
        agentMode: 'agent',
        agentconfig: agent_config,
      });
      await agent.createAgentReactExecutor();
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

        const executionSpinner = createSpinner('Processing request').start();

        try {
          const airesponse = await agent.execute(user);
          executionSpinner.success({ text: 'Response received' });

          const formatAgentResponse = (response: string) => {
            if (typeof response !== 'string') return response;

            return response.split('\n').map((line) => {
              if (line.includes('•')) {
                return `  ${line.trim()}`;
              }
              return line;
            });
          };

          if (typeof airesponse === 'string') {
            console.log(
              createBox('Agent Response', formatAgentResponse(airesponse))
            );
          } else {
            console.error('Invalid response type');
          }
        } catch (error) {
          executionSpinner.error({ text: 'Error processing request' });
          console.log(createBox('Error', error.message, { isError: true }));
        }
      }
    } else if (mode === 'auto') {
      const agent = new StarknetAgent({
        provider: new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }),
        accountPrivateKey: process.env.STARKNET_PRIVATE_KEY as string,
        accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS as string,
        aiModel: process.env.AI_MODEL as string,
        aiProvider: process.env.AI_PROVIDER as string,
        aiProviderApiKey: process.env.AI_PROVIDER_API_KEY as string,
        signature: 'key',
        agentMode: 'auto',
        agentconfig: agent_config,
      });

      await agent.createAgentReactExecutor();
      console.log(chalk.dim('\nStarting interactive session...\n'));
      const autoSpinner = createSpinner('Running autonomous mode\n').start();

      try {
        await agent.execute_autonomous();
        autoSpinner.success({ text: 'Autonomous execution completed' });
      } catch (error) {
        autoSpinner.error({ text: 'Error in autonomous mode' });
        console.error(
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

LocalRun().catch((error) => {
  console.error(
    createBox(error.message, { title: 'Fatal Error', isError: true })
  );
  process.exit(1);
});
