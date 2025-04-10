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
import {
  tokenTracker,
  configureModelWithTracking,
  truncateToTokenLimit,
  estimateTokens,
} from './tokenTracking.js';

export const createAutonomousAgent = async (
  starknetAgent: StarknetAgentInterface,
  aiConfig: AiConfig
) => {
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
        convertSystemMessageToHumanContent: true,
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

  // Ajouter le tracking des tokens avec des limites plus souples pour le mode autonome
  model = configureModelWithTracking(model, {
    tokenLogging: aiConfig.langchainVerbose !== false,
    maxInputTokens: aiConfig.maxInputTokens || 50000,
    maxCompletionTokens: aiConfig.maxCompletionTokens || 50000,
    maxTotalTokens: aiConfig.maxTotalTokens || 100000,
  });

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

    // Patcher l'agent pour gérer les limites de tokens en mode autonome
    const originalAgentInvoke = agent.invoke.bind(agent);
    // @ts-ignore - Ignorer les erreurs de typage pour cette méthode
    agent.invoke = async function (input: any, config?: any) {
      try {
        // Essayer l'appel normal
        return await originalAgentInvoke(input, config);
      } catch (error) {
        // Vérifier si l'erreur est liée aux limites de tokens
        if (
          error instanceof Error &&
          (error.message.includes('token limit') ||
            error.message.includes('tokens exceed') ||
            error.message.includes('context length'))
        ) {
          logger.warn(
            `Erreur de limite de tokens dans l'agent autonome: ${error.message}`
          );

          // Au lieu de recréer un contexte entièrement nouveau,
          // nous allons juste utiliser un message plus court pour continuer
          const continueInput = {
            messages:
              "L'action précédente était trop complexe et a dépassé les limites de tokens. Prends une action plus simple tout en gardant en tête tes objectifs principaux.",
          };

          try {
            // Réessayer avec un message simplifié mais qui préserve l'intention
            return await originalAgentInvoke(continueInput, config);
          } catch (secondError) {
            // Si même cette approche échoue, logger l'erreur
            logger.error(
              `Échec de la tentative d'action simplifiée: ${secondError}`
            );

            // Retourner un format compatible avec l'interface attendue
            // @ts-ignore - Ignorer les erreurs de typage pour ce retour d'erreur
            return {
              messages: [
                {
                  content:
                    "J'ai dû abandonner l'action en cours en raison des limites de tokens. Je vais essayer une approche différente au prochain tour.",
                  type: 'ai',
                },
              ],
            };
          }
        }

        // Pour les autres types d'erreurs, les propager
        throw error;
      }
    };

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
