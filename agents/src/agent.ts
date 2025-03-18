import { ChatAnthropic } from '@langchain/anthropic';
import { AiConfig } from '../common/index.js';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { ChatDeepSeek } from '@langchain/deepseek';
import { StarknetAgentInterface } from './tools/tools.js';
import { createSignatureTools } from './tools/signatureTools.js';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { createAllowedToollkits } from './tools/external_tools.js';
import { createAllowedTools } from './tools/tools.js';
import { MCP_CONTROLLER } from './mcp/src/mcp.js';

export const createAgent = async (
  starknetAgent: StarknetAgentInterface,
  aiConfig: AiConfig
) => {
  const isSignature = starknetAgent.getSignature().signature === 'wallet';
  const model = () => {
    switch (aiConfig.aiProvider) {
      case 'anthropic':
        if (!aiConfig.aiProviderApiKey) {
          throw new Error(
            'Valid Anthropic api key is required https://docs.anthropic.com/en/api/admin-api/apikeys/get-api-key'
          );
        }
        return new ChatAnthropic({
          modelName: aiConfig.aiModel,
          anthropicApiKey: aiConfig.aiProviderApiKey,
        });
      case 'openai':
        if (!aiConfig.aiProviderApiKey) {
          throw new Error(
            'Valid OpenAI api key is required https://platform.openai.com/api-keys'
          );
        }
        return new ChatOpenAI({
          modelName: aiConfig.aiModel,
          apiKey: aiConfig.aiProviderApiKey,
        });
      case 'gemini':
        if (!aiConfig.aiProviderApiKey) {
          throw new Error(
            'Valid Gemini api key is required https://ai.google.dev/gemini-api/docs/api-key'
          );
        }
        return new ChatGoogleGenerativeAI({
          modelName: aiConfig.aiModel,
          apiKey: aiConfig.aiProviderApiKey,
          convertSystemMessageToHumanContent: true,
        });
      case 'ollama':
        return new ChatOllama({
          model: aiConfig.aiModel,
        });
      case 'deepseek':
        if (!aiConfig.aiProviderApiKey) {
          throw new Error(
            'Valid DeepSeek api key is required https://api-docs.deepseek.com/'
          );
        }
        return new ChatDeepSeek({
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
      tools = await createSignatureTools(json_config.internal_plugins);
    } else {
      const allowedTools = await createAllowedTools(
        starknetAgent,
        json_config.internal_plugins
      );

      const allowedToolsKits = json_config.external_plugins
        ? createAllowedToollkits(json_config.external_plugins)
        : null;

      tools = allowedToolsKits
        ? [...allowedTools, ...allowedToolsKits]
        : [...allowedTools];
    }
    if (json_config.mcp === true) {
      const mcp = new MCP_CONTROLLER();
      await mcp.initializeConnections();
      console.log(mcp.getTools());
      tools = [...tools, ...mcp.getTools()];
    }

    const agent = createReactAgent({
      llm: modelSelected,
      tools,
      messageModifier: json_config.prompt,
    });

    return agent;
  } catch (error) {
    console.error(
      `⚠️ Ensure your environment variables are set correctly according to your config/agent.json file.`
    );
    console.error('Failed to load or parse JSON config:', error);
    throw error;
  }
};
