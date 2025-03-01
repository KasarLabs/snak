"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgent = void 0;
const anthropic_1 = require("@langchain/anthropic");
const openai_1 = require("@langchain/openai");
const google_genai_1 = require("@langchain/google-genai");
const ollama_1 = require("@langchain/ollama");
const deepseek_1 = require("@langchain/deepseek");
const signatureTools_1 = require("./tools/signatureTools");
const prebuilt_1 = require("@langchain/langgraph/prebuilt");
const external_tools_1 = require("./tools/external_tools");
const tools_1 = require("./tools/tools");
const createAgent = async (starknetAgent, aiConfig) => {
    const isSignature = starknetAgent.getSignature().signature === 'wallet';
    const model = () => {
        switch (aiConfig.aiProvider) {
            case 'anthropic':
                if (!aiConfig.aiProviderApiKey) {
                    throw new Error('Valid Anthropic api key is required https://docs.anthropic.com/en/api/admin-api/apikeys/get-api-key');
                }
                return new anthropic_1.ChatAnthropic({
                    modelName: aiConfig.aiModel,
                    anthropicApiKey: aiConfig.aiProviderApiKey,
                });
            case 'openai':
                if (!aiConfig.aiProviderApiKey) {
                    throw new Error('Valid OpenAI api key is required https://platform.openai.com/api-keys');
                }
                return new openai_1.ChatOpenAI({
                    modelName: aiConfig.aiModel,
                    apiKey: aiConfig.aiProviderApiKey,
                });
            case 'gemini':
                if (!aiConfig.aiProviderApiKey) {
                    throw new Error('Valid Gemini api key is required https://ai.google.dev/gemini-api/docs/api-key');
                }
                return new google_genai_1.ChatGoogleGenerativeAI({
                    modelName: aiConfig.aiModel,
                    apiKey: aiConfig.aiProviderApiKey,
                    convertSystemMessageToHumanContent: true,
                });
            case 'ollama':
                return new ollama_1.ChatOllama({
                    model: aiConfig.aiModel,
                });
            case 'deepseek':
                if (!aiConfig.aiProviderApiKey) {
                    throw new Error('Valid DeepSeek api key is required https://api-docs.deepseek.com/');
                }
                return new deepseek_1.ChatDeepSeek({
                    modelName: aiConfig.aiModel,
                    apiKey: aiConfig.aiProviderApiKey,
                });
            default:
                throw new Error(`Unsupported AI provider: ${aiConfig.aiProvider}`);
        }
    };
    try {
        const modelSelected = model();
        const json_config = starknetAgent.getAgentConfig();
        if (!json_config) {
            throw new Error('Agent configuration is required');
        }
        let tools;
        if (isSignature === true) {
            tools = await (0, signatureTools_1.createSignatureTools)(json_config.internal_plugins);
        }
        else {
            const allowedTools = await (0, tools_1.createAllowedTools)(starknetAgent, json_config.internal_plugins);
            const allowedToolsKits = json_config.external_plugins
                ? (0, external_tools_1.createAllowedToollkits)(json_config.external_plugins)
                : null;
            tools = allowedToolsKits
                ? [...allowedTools, ...allowedToolsKits]
                : allowedTools;
        }
        const agent = (0, prebuilt_1.createReactAgent)({
            llm: modelSelected,
            tools,
            messageModifier: json_config.prompt,
        });
        return agent;
    }
    catch (error) {
        console.error(`⚠️ Ensure your environment variables are set correctly according to your config/agent.json file.`);
        console.error('Failed to load or parse JSON config:', error);
        throw error;
    }
};
exports.createAgent = createAgent;
//# sourceMappingURL=agent.js.map