"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const nanospinner_1 = require("nanospinner");
const starknetAgent_1 = require("./src/starknetAgent");
const starknet_1 = require("starknet");
const dotenv_1 = require("dotenv");
const jsonConfig_1 = require("./src/jsonConfig");
const formatting_1 = require("./src/formatting");
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: path_1.default.join(__dirname, '../.env') });
const load_command = async () => {
    const argv = await (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
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
const logo = `${chalk_1.default.cyan(`
  ____  _             _               _        _                    _     _  ___ _
 / ___|| |_ __ _ _ __| | ___ __   ___| |_     / \\   __ _  ___ _ __ | |_  | |/ (_) |_
 \\___ \\| __/ _\` | '__| |/ / '_ \\ / _ \\ __|   / _ \\ / _\` |/ _ \\ '_ \\| __| | ' /| | __|
  ___) | || (_| | |  |   <| | | |  __/ |_   / ___ \\ (_| |  __/ | | | |_  | . \\| | |_
 |____/ \\__\\__,_|_|  |_|\\_\\_| |_|\\___|\\__| /_/   \\_\\__, |\\___|_| |_|\\__| |_|\\_\\_|\\__|
                                                   |___/
`)}`;
const getTerminalWidth = () => {
    return Math.min(process.stdout.columns || 80, 100);
};
const wrapText = (text, maxWidth) => {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    words.forEach((word) => {
        if ((currentLine + ' ' + word).length <= maxWidth) {
            currentLine += (currentLine ? ' ' : '') + word;
        }
        else {
            if (currentLine)
                lines.push(currentLine);
            currentLine = word;
        }
    });
    if (currentLine)
        lines.push(currentLine);
    return lines;
};
function reloadEnvVars() {
    Object.keys(process.env).forEach((key) => {
        delete process.env[key];
    });
    const result = (0, dotenv_1.config)({
        path: path_1.default.resolve(process.cwd(), '.env'),
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
        console.error((0, formatting_1.createBox)(missings.join('\n'), {
            title: 'Missing Environment Variables',
            isError: true,
        }));
        for (const missing of missings) {
            const { prompt } = await inquirer_1.default.prompt([
                {
                    type: 'input',
                    name: 'prompt',
                    message: chalk_1.default.redBright(`Enter the value of ${missing}:`),
                    validate: (value) => {
                        const trimmed = value.trim();
                        if (!trimmed)
                            return 'Please enter a valid message';
                        return true;
                    },
                },
            ]);
            await new Promise((resolve, reject) => {
                fs.appendFile('.env', `\n${missing}=${prompt}\n`, (err) => {
                    if (err)
                        reject(new Error('Error when trying to write on .env file'));
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
    console.log((0, formatting_1.createBox)('Welcome to Starknet-Agent-Kit', 'For more informations, visit our documentation at https://docs.starkagent.ai'));
    const agent_config_name = await load_command();
    const { mode } = await inquirer_1.default.prompt([
        {
            type: 'list',
            name: 'mode',
            message: 'Select operation mode:',
            choices: [
                {
                    name: `${chalk_1.default.green('>')} Interactive Mode`,
                    value: 'agent',
                    short: 'Interactive',
                },
                {
                    name: `${chalk_1.default.blue('>')} Autonomous Mode`,
                    value: 'auto',
                    short: 'Autonomous',
                },
            ],
        },
    ]);
    clearScreen();
    console.log(logo);
    const spinner = (0, nanospinner_1.createSpinner)('Initializing Starknet Agent').start();
    try {
        spinner.stop();
        await validateEnvVars();
        spinner.success({ text: 'Agent initialized successfully' });
        const agent_config = (0, jsonConfig_1.load_json_config)(agent_config_name);
        if (mode === 'agent') {
            console.log(chalk_1.default.dim('\nStarting interactive session...\n'));
            const agent = new starknetAgent_1.StarknetAgent({
                provider: new starknet_1.RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }),
                accountPrivateKey: process.env.STARKNET_PRIVATE_KEY,
                accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS,
                aiModel: process.env.AI_MODEL,
                aiProvider: process.env.AI_PROVIDER,
                aiProviderApiKey: process.env.AI_PROVIDER_API_KEY,
                signature: 'key',
                agentMode: 'agent',
                agentconfig: agent_config,
            });
            await agent.createAgentReactExecutor();
            while (true) {
                const { user } = await inquirer_1.default.prompt([
                    {
                        type: 'input',
                        name: 'user',
                        message: chalk_1.default.green('User'),
                        validate: (value) => {
                            const trimmed = value.trim();
                            if (!trimmed)
                                return 'Please enter a valid message';
                            return true;
                        },
                    },
                ]);
                const executionSpinner = (0, nanospinner_1.createSpinner)('Processing request').start();
                try {
                    const airesponse = await agent.execute(user);
                    executionSpinner.success({ text: 'Response received' });
                    const formatAgentResponse = (response) => {
                        if (typeof response !== 'string')
                            return response;
                        return response.split('\n').map((line) => {
                            if (line.includes('•')) {
                                return `  ${line.trim()}`;
                            }
                            return line;
                        });
                    };
                    if (typeof airesponse === 'string') {
                        console.log((0, formatting_1.createBox)('Agent Response', formatAgentResponse(airesponse)));
                    }
                    else {
                        console.error('Invalid response type');
                    }
                }
                catch (error) {
                    executionSpinner.error({ text: 'Error processing request' });
                    console.log((0, formatting_1.createBox)('Error', error.message, { isError: true }));
                }
            }
        }
        else if (mode === 'auto') {
            const agent = new starknetAgent_1.StarknetAgent({
                provider: new starknet_1.RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }),
                accountPrivateKey: process.env.STARKNET_PRIVATE_KEY,
                accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS,
                aiModel: process.env.AI_MODEL,
                aiProvider: process.env.AI_PROVIDER,
                aiProviderApiKey: process.env.AI_PROVIDER_API_KEY,
                signature: 'key',
                agentMode: 'auto',
                agentconfig: agent_config,
            });
            await agent.createAgentReactExecutor();
            console.log(chalk_1.default.dim('\nStarting interactive session...\n'));
            const autoSpinner = (0, nanospinner_1.createSpinner)('Running autonomous mode\n').start();
            try {
                await agent.execute_autonomous();
                autoSpinner.success({ text: 'Autonomous execution completed' });
            }
            catch (error) {
                autoSpinner.error({ text: 'Error in autonomous mode' });
                console.error((0, formatting_1.createBox)(error.message, { title: 'Error', isError: true }));
            }
        }
    }
    catch (error) {
        spinner.error({ text: 'Failed to initialize agent' });
        console.error((0, formatting_1.createBox)(error.message, { title: 'Fatal Error', isError: true }));
    }
};
LocalRun().catch((error) => {
    console.error((0, formatting_1.createBox)(error.message, { title: 'Fatal Error', isError: true }));
    process.exit(1);
});
//# sourceMappingURL=start.js.map