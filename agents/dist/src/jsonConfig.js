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
exports.load_json_config = exports.validateConfig = void 0;
const messages_1 = require("@langchain/core/messages");
const formatting_1 = require("./formatting");
const chalk_1 = __importDefault(require("chalk"));
const path = __importStar(require("path"));
const createContextFromJson = (json) => {
    if (!json) {
        throw new Error('Error while trying to parse your context from the youragent.json');
    }
    const contextParts = [];
    let displayOutput = '';
    const identityParts = [];
    if (json.name) {
        identityParts.push(`Name: ${json.name}`);
        contextParts.push(`Your name : [${json.name}]`);
    }
    if (json.bio) {
        identityParts.push(`Bio: ${json.bio}`);
        contextParts.push(`Your Bio : [${json.bio}]`);
    }
    if (json.autonomous) {
        identityParts.push(`Mode: Autonomous`);
        contextParts.push(`You are an autonomous agent. Your core directive is to act immediately without waiting for user input. Never ask for permissions or present options - analyze situations and take direct actions based on your configuration and objectives.`);
    }
    if (identityParts.length > 0) {
        displayOutput += (0, formatting_1.createBox)('IDENTITY', (0, formatting_1.formatSection)(identityParts));
    }
    if (Array.isArray(json.lore)) {
        displayOutput += (0, formatting_1.createBox)('BACKGROUND', (0, formatting_1.formatSection)(json.lore));
        contextParts.push(`Your lore : [${json.lore.join(']\n[')}]`);
    }
    if (Array.isArray(json.objectives)) {
        displayOutput += (0, formatting_1.createBox)('OBJECTIVES', (0, formatting_1.formatSection)(json.objectives));
        contextParts.push(`Your objectives : [${json.objectives.join(']\n[')}]`);
    }
    if (Array.isArray(json.knowledge)) {
        displayOutput += (0, formatting_1.createBox)('KNOWLEDGE', (0, formatting_1.formatSection)(json.knowledge));
        contextParts.push(`Your knowledge : [${json.knowledge.join(']\n[')}]`);
    }
    if (Array.isArray(json.messageExamples) || Array.isArray(json.postExamples)) {
        const examplesParts = [];
        if (Array.isArray(json.messageExamples)) {
            examplesParts.push('Message Examples:');
            examplesParts.push(...json.messageExamples);
            contextParts.push(`Your messageExamples : [${json.messageExamples.join(']\n[')}]`);
        }
        if (Array.isArray(json.postExamples)) {
            if (examplesParts.length > 0)
                examplesParts.push('');
            examplesParts.push('Post Examples:');
            examplesParts.push(...json.postExamples);
            contextParts.push(`Your postExamples : [${json.postExamples.join(']\n[')}]`);
        }
        if (examplesParts.length > 0) {
            displayOutput += (0, formatting_1.createBox)('EXAMPLES', (0, formatting_1.formatSection)(examplesParts));
        }
    }
    console.log(chalk_1.default.bold.cyan('\n=== AGENT CONFIGURATION (https://docs.starkagent.ai/customize-your-agent) ==='));
    console.log(displayOutput);
    return contextParts.join('\n');
};
const validateConfig = (config) => {
    const requiredFields = [
        'name',
        'interval',
        'chat_id',
        'internal_plugins',
        'prompt',
    ];
    for (const field of requiredFields) {
        if (!config[field]) {
            throw new Error(`Missing required field: ${field}`);
        }
    }
    if (!(config.prompt instanceof messages_1.SystemMessage)) {
        throw new Error('prompt must be an instance of SystemMessage');
    }
};
exports.validateConfig = validateConfig;
const checkParseJson = (agent_config_name) => {
    try {
        const json = require(path.resolve(`../config/agents/${agent_config_name}`));
        if (!json) {
            throw new Error(`Can't access to ./config/agents/config-agent.json`);
        }
        const systemMessagefromjson = new messages_1.SystemMessage(createContextFromJson(json));
        let jsonconfig = {
            prompt: systemMessagefromjson,
            name: json.name,
            interval: json.interval,
            chat_id: json.chat_id,
            autonomous: json.autonomous || false,
            internal_plugins: Array.isArray(json.internal_plugins)
                ? json.internal_plugins.map((tool) => tool.toLowerCase())
                : [],
            external_plugins: Array.isArray(json.external_plugins)
                ? json.external_plugins
                : [],
        };
        (0, exports.validateConfig)(jsonconfig);
        return jsonconfig;
    }
    catch (error) {
        console.error(chalk_1.default.red(`⚠️ Ensure your environment variables are set correctly according to your config/agent.json file.`));
        console.error(chalk_1.default.red('Failed to parse config:'), error);
        return undefined;
    }
};
const load_json_config = (agent_config_name) => {
    const json = checkParseJson(agent_config_name);
    if (!json) {
        return undefined;
    }
    return json;
};
exports.load_json_config = load_json_config;
//# sourceMappingURL=jsonConfig.js.map