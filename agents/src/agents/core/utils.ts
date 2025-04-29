import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { ChatDeepSeek } from '@langchain/deepseek';
import { AiConfig } from '../../common/index.js';
import { StarknetAgentInterface } from '../../tools/tools.js';
import { createAllowedTools } from '../../tools/tools.js';
import { createSignatureTools } from '../../tools/signatureTools.js';
import { MCP_CONTROLLER } from '../../services/mcp/src/mcp.js';
import { logger } from '@snakagent/core';
import { JsonConfig } from '../../config/jsonConfig.js';
import { Postgres } from '@snakagent/database/queries';
import { memory } from '@snakagent/database/queries';
import { DatabaseCredentials } from '@snakagent/database';
import {
  Tool,
  DynamicStructuredTool,
  StructuredTool,
} from '@langchain/core/tools';
import { configureModelWithTracking } from '../../token/tokenTracking.js';

/**
 * Selects and configures an AI model based on the provided configuration
 */
export function selectModel(aiConfig: AiConfig) {
  let model;

  switch (aiConfig.aiProvider) {
    case 'anthropic':
      if (!aiConfig.aiProviderApiKey) {
        throw new Error(
          'Valid Anthropic api key is required https://docs.anthropic.com/en/api/admin-api/apikeys/get-api-key'
        );
      }
      model = new ChatAnthropic({
        modelName: aiConfig.aiModel,
        anthropicApiKey: aiConfig.aiProviderApiKey,
        verbose: aiConfig.langchainVerbose === true,
      });
      break;
    case 'openai':
      if (!aiConfig.aiProviderApiKey) {
        throw new Error(
          'Valid OpenAI api key is required https://platform.openai.com/api-keys'
        );
      }
      model = new ChatOpenAI({
        modelName: aiConfig.aiModel,
        openAIApiKey: aiConfig.aiProviderApiKey,
        verbose: aiConfig.langchainVerbose === true,
      });
      break;
    case 'gemini':
      if (!aiConfig.aiProviderApiKey) {
        throw new Error(
          'Valid Gemini api key is required https://ai.google.dev/gemini-api/docs/api-key'
        );
      }
      model = new ChatGoogleGenerativeAI({
        modelName: aiConfig.aiModel,
        apiKey: aiConfig.aiProviderApiKey,
        verbose: aiConfig.langchainVerbose === true,
      });
      break;
    case 'deepseek':
      if (!aiConfig.aiProviderApiKey) {
        throw new Error('Valid DeepSeek api key is required');
      }
      model = new ChatDeepSeek({
        modelName: aiConfig.aiModel,
        apiKey: aiConfig.aiProviderApiKey,
        verbose: aiConfig.langchainVerbose === true,
      });
      break;
    case 'ollama':
      model = new ChatOllama({
        model: aiConfig.aiModel,
        verbose: aiConfig.langchainVerbose === true,
      });
      break;
    default:
      throw new Error(`Unsupported AI provider: ${aiConfig.aiProvider}`);
  }

  // Add token tracking with configurable limits
  return configureModelWithTracking(model, {
    tokenLogging: aiConfig.langchainVerbose !== false,
    maxInputTokens: aiConfig.maxInputTokens || 50000,
    maxCompletionTokens: aiConfig.maxCompletionTokens || 50000,
    maxTotalTokens: aiConfig.maxTotalTokens || 100000,
  });
}

/**
 * Initializes the list of tools for the agent
 */
export async function initializeToolsList(
  starknetAgent: StarknetAgentInterface,
  jsonConfig: JsonConfig
): Promise<(Tool | DynamicStructuredTool<any> | StructuredTool)[]> {
  let toolsList: (Tool | DynamicStructuredTool<any> | StructuredTool)[] = [];
  const isSignature = starknetAgent.getSignature().signature === 'wallet';

  if (isSignature) {
    toolsList = await createSignatureTools(jsonConfig.plugins);
  } else {
    const allowedTools = await createAllowedTools(
      starknetAgent,
      jsonConfig.plugins
    );
    toolsList = [...allowedTools];
  }

  if (jsonConfig.mcpServers && Object.keys(jsonConfig.mcpServers).length > 0) {
    try {
      const mcp = MCP_CONTROLLER.fromJsonConfig(jsonConfig);
      await mcp.initializeConnections();

      const mcpTools = mcp.getTools();
      logger.info(`Added ${mcpTools.length} MCP tools to the agent`);
      toolsList = [...toolsList, ...mcpTools];
    } catch (error) {
      logger.error(`Failed to initialize MCP tools: ${error}`);
    }
  }

  return toolsList;
}

/**
 * Initializes the database connection for the agent
 */
export const initializeDatabase = async (db: DatabaseCredentials) => {
  try {
    await Postgres.connect(db);
    await memory.init();
    logger.debug('Agent memory table successfully created');
  } catch (error) {
    logger.error('Error creating memories table:', error);
    throw error;
  }
};
