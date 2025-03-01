"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAutonomousAgent = void 0;
const anthropic_1 = require("@langchain/anthropic");
const tools_1 = require("./tools/tools");
const openai_1 = require("@langchain/openai");
const google_genai_1 = require("@langchain/google-genai");
const ollama_1 = require("@langchain/ollama");
const langgraph_1 = require("@langchain/langgraph");
const prebuilt_1 = require("@langchain/langgraph/prebuilt");
const external_tools_1 = require("./tools/external_tools");
const createAutonomousAgent = async (starknetAgent, aiConfig) => {
    const model = (() => {
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
                    openAIApiKey: aiConfig.aiProviderApiKey,
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
            default:
                throw new Error(`Unsupported AI provider: ${aiConfig.aiProvider}`);
        }
    })();
    try {
        const json_config = starknetAgent.getAgentConfig();
        if (!json_config) {
            throw new Error('Agent configuration is required');
        }
        let tools;
        const allowedTools = await (0, tools_1.createAllowedTools)(starknetAgent, json_config.internal_plugins);
        const allowedToolsKits = json_config.external_plugins
            ? (0, external_tools_1.createAllowedToollkits)(json_config.external_plugins)
            : null;
        tools = allowedToolsKits
            ? [...allowedTools, ...allowedToolsKits]
            : allowedTools;
        const memory = new langgraph_1.MemorySaver();
        const agent = (0, prebuilt_1.createReactAgent)({
            llm: model,
            tools: tools,
            checkpointSaver: memory,
            messageModifier: json_config.prompt,
        });
        return {
            agent,
            agentConfig: {
                configurable: { thread_id: json_config.chat_id },
            },
            json_config,
        };
    }
    catch (error) {
        console.error(`⚠️ Ensure your environment variables are set correctly according to your config/agent.json file.`);
        console.error('Failed to load or parse JSON config:', error);
        throw error;
    }
};
exports.createAutonomousAgent = createAutonomousAgent;
//# sourceMappingURL=autonomousAgents.js.map