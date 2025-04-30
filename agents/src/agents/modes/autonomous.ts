import { logger } from '@snakagent/core';
import { StarknetAgentInterface } from '../../tools/tools.js';
import { AiConfig } from '../../common/index.js';
import { createAllowedTools } from '../../tools/tools.js';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MemorySaver } from '@langchain/langgraph';
import { MCP_CONTROLLER } from '../../services/mcp/src/mcp.js';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { AnyZodObject } from 'zod';
import { selectModel } from '../core/utils.js';
import { BaseMessage, SystemMessage } from '@langchain/core/messages';
import { ModelSelectionAgent } from '../operators/modelSelectionAgent.js';

/**
 * Creates an agent in autonomous mode
 * @param starknetAgent The Starknet agent instance
 * @param aiConfig AI configuration
 * @param modelSelector Optional model selector
 */
export const createAutonomousAgent = async (
  starknetAgent: StarknetAgentInterface,
  aiConfig: AiConfig,
  modelSelector?: ModelSelectionAgent | null
) => {
  try {
    const json_config = starknetAgent.getAgentConfig();
    if (!json_config) {
      throw new Error('Agent configuration is required');
    }

    // Check if autonomous mode is explicitly disabled in config
    if (json_config.mode && json_config.mode.autonomous === false) {
      throw new Error('Autonomous mode is disabled in agent configuration');
    }

    // Get allowed tools
    let tools: (StructuredTool | Tool | DynamicStructuredTool<AnyZodObject>)[] =
      await createAllowedTools(starknetAgent, json_config.plugins);

    // Initialize MCP tools if configured
    if (
      json_config.mcpServers &&
      Object.keys(json_config.mcpServers).length > 0
    ) {
      try {
        const mcp = MCP_CONTROLLER.fromJsonConfig(json_config);
        await mcp.initializeConnections();

        const mcpTools = mcp.getTools();
        logger.info(
          `Added ${mcpTools.length} MCP tools to the autonomous agent`
        );
        tools = [...tools, ...mcpTools];
      } catch (error) {
        logger.error(`Failed to initialize MCP tools: ${error}`);
      }
    }

    // Select the model
    const model = selectModel(aiConfig);

    // Create autonomous agent system prompt
    let systemPrompt = '';
    if (json_config.prompt && json_config.prompt.content) {
      // Ensure systemPrompt is a string, handle potential complex types simply for now
      if (typeof json_config.prompt.content === 'string') {
        systemPrompt = json_config.prompt.content;
      } else if (
        Array.isArray(json_config.prompt.content) &&
        json_config.prompt.content.length > 0 &&
        typeof json_config.prompt.content[0] === 'string'
      ) {
        // Basic handling for array type, assuming the first element is the main text
        systemPrompt = json_config.prompt.content[0];
        logger.warn(
          'System prompt content was an array; using the first element.'
        );
      } else {
        // Default or more complex handling might be needed here
        logger.warn(
          'System prompt content has an unexpected type, defaulting to empty string.'
        );
      }
    }

    // Enhance the system prompt for autonomous operation
    const autonomousSystemPrompt = `${systemPrompt}

You are now operating in AUTONOMOUS MODE. This means:

1. You should complete tasks step-by-step without requiring user input.
2. Work towards the GOAL using the tools available to you.
3. Break down complex tasks into manageable steps.
4. For each response, include a "NEXT STEPS" section indicating what you plan to do next.
5. When your task is complete, include "FINAL ANSWER: <your conclusion>" at the end.

Remember to be methodical, efficient, and provide clear reasoning for your actions.
`;

    // Create the SystemMessage for the agent
    const systemMessage = new SystemMessage(autonomousSystemPrompt);

    // Create memory management for the agent
    const memory = new MemorySaver();

    // Create the agent with ReAct framework
    const agent = createReactAgent({
      llm: model,
      tools,
      checkpointSaver: memory,
    });

    // Patch the agent to handle token limits in autonomous mode
    const originalAgentInvoke = agent.invoke.bind(agent);

    // @ts-ignore - Ignore type errors for this method
    agent.invoke = async function (input: any, config?: any) {
      try {
        return await originalAgentInvoke(input, config);
      } catch (error) {
        // Handle token limit errors
        if (
          error instanceof Error &&
          (error.message.includes('token limit') ||
            error.message.includes('tokens exceed') ||
            error.message.includes('context length'))
        ) {
          logger.warn(
            `Token limit error in autonomous agent: ${error.message}`
          );

          // Use a shorter message to continue
          const continueInput = {
            messages: [
              systemMessage,
              new SystemMessage(
                'The previous action was too complex and exceeded token limits. Take a simpler action while keeping your main objectives in mind.'
              ),
            ],
          };

          try {
            return await originalAgentInvoke(continueInput, config);
          } catch (secondError) {
            logger.error(`Failed simplified action attempt: ${secondError}`);

            // Return a format compatible with the expected interface
            return {
              messages: [
                {
                  content:
                    "I had to abandon the current action due to token limits. I'll try a different approach in the next turn.",
                  type: 'ai',
                },
              ],
            };
          }
        }

        // For other types of errors, propagate them
        throw error;
      }
    };

    // Configure the agent config
    const agentConfig = {
      configurable: {
        thread_id: json_config.chat_id || 'autonomous_session',
        streaming: false,
      },
      recursionLimit: json_config.mode?.recursionLimit || 10,
    };

    return {
      agent,
      agentConfig,
      json_config,
    };
  } catch (error) {
    logger.error('Failed to create autonomous agent:', error);
    throw error;
  }
};
