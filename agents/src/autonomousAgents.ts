import { ChatAnthropic } from '@langchain/anthropic';
import { createAllowedTools } from './tools/tools.js';
import { AiConfig } from '../common/index.js';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { StarknetAgentInterface } from './tools/tools.js';
import { MemorySaver } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MCP_CONTROLLER } from './mcp/src/mcp.js';
import logger from './logger.js';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { AnyZodObject } from 'zod';

export const createAutonomousAgent = async (
  starknetAgent: StarknetAgentInterface,
  aiConfig: AiConfig
) => {
  const model = (() => {
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
          openAIApiKey: aiConfig.aiProviderApiKey,
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
      default:
        throw new Error(`Unsupported AI provider: ${aiConfig.aiProvider}`);
    }
  })();

  try {
    const json_config = starknetAgent.getAgentConfig();
    if (!json_config) {
      throw new Error('Agent configuration is required');
    }

    let tools: (StructuredTool | Tool | DynamicStructuredTool<AnyZodObject>)[];
    const allowedTools = await createAllowedTools(
      starknetAgent,
      json_config.plugins
    );

    tools = allowedTools;
    const memory = new MemorySaver();

    if (
      json_config.mcpServers &&
      Object.keys(json_config.mcpServers).length > 0
    ) {
      try {
        const mcp = MCP_CONTROLLER.fromJsonConfig(json_config);
        await mcp.initializeConnections();
        logger.info('MCP tools initialized successfully');
        const mcpTools = mcp.getTools();
        logger.info(`Added ${mcpTools.length} MCP tools to the agent`);
        tools = [...tools, ...mcpTools];
      } catch (error) {
        logger.error(`Failed to initialize MCP tools: ${error}`);
      }
    }

    const agent = createReactAgent({
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
  } catch (error) {
    logger.error('Failed to create autonomous agent : ', error);
    throw error;
  }
};
