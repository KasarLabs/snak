import inquirer from 'inquirer';
import chalk from 'chalk';
import { createSpinner } from 'nanospinner';
import { StarknetAgent } from './src/starknetAgent.js';
import { RpcProvider } from 'starknet';
import { config } from 'dotenv';
import { load_json_config } from './src/jsonConfig.js';
import { createBox } from './src/formatting.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Fonction pour placer le curseur à une position spécifique
const moveCursor = (x: number, y: number) => {
  readline.cursorTo(process.stdout, x, y);
};

// Fonction pour effacer la ligne courante
const clearLine = () => {
  readline.clearLine(process.stdout, 0);
};

const createLink = (text: string, url: string): string =>
  `\u001B]8;;${url}\u0007${text}\u001B]8;;\u0007`;

const logo = `${chalk.cyan(`
   _____             __  
  / ___/____  ____ _/ /__
  \\__ \\/ __ \\/ __ \`/ //_/
 ___/ / / / / /_/ / ,<   
/____/_/ /_/\\__,_/_/|_|  

${chalk.dim('v0.0.11 by ')}${createLink('Kasar', 'https://kasar.io')}`)}`;

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
      'Welcome to Snak, an advanced Agent engine powered by Starknet.',
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
    const agent_config = await load_json_config(agent_config_name);

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
      
      // On désactive le spinner par défaut de nanospinner et on implémente notre propre version fixe
      const spinnerText = 'Running autonomous mode';
      const autoSpinner = createSpinner(spinnerText);
      
      // Empêcher le spinner de s'afficher lui-même
      autoSpinner.write = () => autoSpinner;
      
      // Définir les frames du spinner
      const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
      let currentFrameIndex = 0;
      
      // Sauvegarde de l'original console.log
      const originalConsoleLog = console.log;
      
      // Déplacer le curseur à la dernière ligne du terminal
      const moveToBotom = () => {
        const rows = process.stdout.rows || 30;
        readline.cursorTo(process.stdout, 0, rows - 1);
        readline.clearLine(process.stdout, 0);
      };
      
      // Position actuelle pour permettre de revenir après réaffichage du spinner
      let lastLogPosition = 0;
      
      // Variable pour stocker tous les logs
      const logHistory: string[] = [];
      
      // Remplacer console.log
      console.log = function(...args: any[]) {
        // Capturer le log dans l'historique
        const logMessage = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        logHistory.push(logMessage);
        
        // Effacer la ligne du spinner
        moveToBotom();
        readline.clearLine(process.stdout, 0);
        
        // Afficher le contenu normal
        originalConsoleLog.apply(console, args);
        
        // Mémoriser la position après le log
        lastLogPosition = process.stdout.rows ? process.stdout.rows - 2 : 0;
        
        // Réafficher le spinner à la dernière ligne
        moveToBotom();
        process.stdout.write(`${chalk.yellow(spinnerFrames[currentFrameIndex])} ${spinnerText}`);
        
        // Reposition curseur après le texte pour le prochain log
        if (lastLogPosition > 0) {
          readline.cursorTo(process.stdout, 0, lastLogPosition);
        }
      };
      
      // Timer pour animer le spinner
      const spinnerInterval = setInterval(() => {
        currentFrameIndex = (currentFrameIndex + 1) % spinnerFrames.length;
        
        // Sauvegarder la position courante
        const rows = process.stdout.rows || 30;
        const currentRow = lastLogPosition;
        
        // Dessiner le spinner
        moveToBotom();
        readline.clearLine(process.stdout, 0);
        process.stdout.write(`${chalk.yellow(spinnerFrames[currentFrameIndex])} ${spinnerText}`);
        
        // Revenir à la position avant l'update
        if (currentRow > 0) {
          readline.cursorTo(process.stdout, 0, currentRow);
        }
      }, 80);
      
      // Fonction pour gérer Ctrl+C et assurer qu'on restaure correctement le terminal
      const handleExit = () => {
        clearInterval(spinnerInterval);
        console.log = originalConsoleLog;
        moveToBotom();
        readline.clearLine(process.stdout, 0);
        process.exit(0);
      };
      
      // Capturer Ctrl+C
      process.on('SIGINT', handleExit);
      
      // Démarrer le spinner (pour la compatibilité avec le code existant)
      autoSpinner.start();
      
      try {
        await agent.execute_autonomous();
        
        // Nettoyage
        clearInterval(spinnerInterval);
        process.removeListener('SIGINT', handleExit);
        console.log = originalConsoleLog;
        
        // Effacer la dernière ligne de spinner
        moveToBotom();
        readline.clearLine(process.stdout, 0);
        
        // Si des logs semblent manquer, les réafficher
        if (logHistory.length > 0) {
          console.log("\nExecution log summary:");
          logHistory.forEach(log => console.log(log));
        }
        
        autoSpinner.success({ text: 'Autonomous execution completed' });
      } catch (error) {
        // Nettoyage
        clearInterval(spinnerInterval);
        process.removeListener('SIGINT', handleExit);
        console.log = originalConsoleLog;
        
        // Effacer la dernière ligne de spinner
        moveToBotom();
        readline.clearLine(process.stdout, 0);
        
        // Si des logs semblent manquer, les réafficher
        if (logHistory.length > 0) {
          console.log("\nExecution log summary:");
          logHistory.forEach(log => console.log(log));
        }
        
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
