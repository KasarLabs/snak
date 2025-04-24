import { ChatAnthropic } from '@langchain/anthropic';
import { createAllowedTools } from '../../tools/tools.js';
import { AiConfig } from '../../common/index.js';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { StarknetAgentInterface } from '../../tools/tools.js';
import { MemorySaver, StateGraph, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { MCP_CONTROLLER } from '../../services/mcp/src/mcp.js';
import { logger } from '@snakagent/core';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { AnyZodObject } from 'zod';
import { configureModelWithTracking } from '../../token/tokenTracking.js';
import {
  BaseMessage,
  SystemMessage,
  AIMessage,
  HumanMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';

// Define the state for the graph
interface AgentState {
  messages: BaseMessage[];
  isRetryAttempt?: boolean; // Flag for retry logic
  // Potentially add 'sender' or other fields if needed for more complex routing
}

export const createAutonomousAgent = async (
  starknetAgent: StarknetAgentInterface,
  aiConfig: AiConfig
) => {
  // Use model selector if available, otherwise initialize model based on provider
  const initializeModel = () => {
    // Check if we should use the modelSelector
    if (aiConfig.modelSelector) {
      logger.debug('Using ModelSelectionAgent for autonomous agent');
      // No need for the proxy model anymore, we'll call modelSelector directly
      return aiConfig.modelSelector; // Return the selector itself
    }

    // Default initialization if no modelSelector
    const verbose = aiConfig.langchainVerbose === true;

    switch (aiConfig.aiProvider) {
      case 'anthropic':
        if (!aiConfig.aiProviderApiKey) {
          throw new Error(
            'Valid Anthropic API key is required: https://docs.anthropic.com/en/api/admin-api/apikeys/get-api-key'
          );
        }
        return new ChatAnthropic({
          modelName: aiConfig.aiModel,
          anthropicApiKey: aiConfig.aiProviderApiKey,
          verbose,
        });

      case 'openai':
        if (!aiConfig.aiProviderApiKey) {
          throw new Error(
            'Valid OpenAI API key is required: https://platform.openai.com/api-keys'
          );
        }
        return new ChatOpenAI({
          modelName: aiConfig.aiModel,
          openAIApiKey: aiConfig.aiProviderApiKey,
          verbose,
        });

      case 'gemini':
        if (!aiConfig.aiProviderApiKey) {
          throw new Error(
            'Valid Gemini API key is required: https://ai.google.dev/gemini-api/docs/api-key'
          );
        }
        return new ChatGoogleGenerativeAI({
          modelName: aiConfig.aiModel,
          apiKey: aiConfig.aiProviderApiKey,
          convertSystemMessageToHumanContent: true,
          verbose,
        });

      case 'ollama':
        return new ChatOllama({
          model: aiConfig.aiModel,
          verbose,
        });

      default:
        throw new Error(`Unsupported AI provider: ${aiConfig.aiProvider}`);
    }
  };

  const modelOrSelector = initializeModel(); // This can be a ModelSelectionAgent or a specific model

  try {
    const json_config = starknetAgent.getAgentConfig();
    if (!json_config) {
      throw new Error('Agent configuration is required');
    }

    // Check if autonomous mode is explicitly disabled in new mode config
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
        logger.info(`Added ${mcpTools.length} MCP tools to the agent`);
        tools = [...tools, ...mcpTools];
      } catch (error) {
        logger.error(`Failed to initialize MCP tools: ${error}`);
      }
    }

    const toolNode = new ToolNode(tools); // Create ToolNode

    // Modify the original prompt or create a new one with next steps instruction
    let originalPrompt = json_config.prompt;
    let modifiedPrompt: SystemMessage;
    // Updated instructions to explicitly mention considering tools
    const toolInstruction =
      '\\n\\nImportant instructions for task management and tool use:\\n' +
      '1. Analyze the request and your objectives. Determine if any of your available tools can help achieve the goal.\\n' +
      '2. If a tool is appropriate, plan to use it. If not, proceed with a text-based response or action.\\n' +
      '3. Focus on ONE SIMPLE TASK per iteration, whether it involves using a tool or generating text.\\n' +
      '4. Break complex operations into multiple simple steps across separate iterations.\\n' +
      '5. Keep each action focused, specific, and achievable in a single step.\\n' +
      "6. Always end your response with a section titled 'NEXT STEPS:' where you clearly state what single action you plan to take next (using a tool or generating text). Be specific but keep it simple and focused.";

    if (originalPrompt) {
      // Add next steps instruction to the existing prompt
      modifiedPrompt = new SystemMessage(
        originalPrompt.content + toolInstruction
      );
    } else {
      // Create a new prompt with next steps instruction
      modifiedPrompt = new SystemMessage(
        'You are an autonomous agent with access to various tools. Respond to queries and take actions as needed.' +
          toolInstruction
      );
    }

    // Add logging for the tools being passed
    logger.debug(
      `Passing ${tools.length} tools to custom graph: ${tools.map((t) => t.name).join(', ')}`
    );

    // --- Define Graph Nodes ---
    const AGENT = 'agent';
    const ACTION = 'action';

    // Agent Node: Calls the model and handles retries
    const agentNode = async (
      state: AgentState,
      config?: RunnableConfig
    ): Promise<Partial<AgentState>> => {
      const { messages, isRetryAttempt } = state;

      // Filter out any existing SystemMessage from the history and prepend the correct one.
      const historyWithoutSystem = messages.filter(
        (msg) => !(msg instanceof SystemMessage)
      );
      const messagesForModel = [modifiedPrompt, ...historyWithoutSystem];

      let modelTypeToUse: string | undefined = undefined;
      let response: AIMessage;

      // Bind tools to the model/selector - REMOVED FROM HERE
      // const modelWithTools = modelOrSelector.bind_tools(tools);

      try {
        if (isRetryAttempt) {
          logger.debug("Executing retry attempt with forced 'smart' model.");
          modelTypeToUse = 'smart'; // Force smart model on retry
        }

        // Use modelSelector if available, otherwise use the single model instance
        if ('invokeModel' in modelOrSelector) {
          // Check if it's ModelSelectionAgent
          // Assuming invokeModel handles tools internally or doesn't support them directly here.
          // We are NOT binding tools explicitly to the ModelSelectionAgent itself.
          logger.debug(
            'Invoking ModelSelectionAgent (tools not bound at this level).'
          );
          response = await modelOrSelector.invokeModel(
            messagesForModel,
            modelTypeToUse
          );
          // If tools still aren't called, the issue might be within ModelSelectionAgent's invokeModel
          // or how ModelSelectionAgent itself is initialized/configured with tools.
        } else {
          // It's a single BaseChatModel
          // Bind tools ONLY for standard models
          logger.debug(`Binding ${tools.length} tools to the standard model.`);
          const modelWithTools = modelOrSelector.bind_tools(tools);
          // Invoke the model *with tools bound*
          response = await modelWithTools.invoke(messagesForModel, config);
        }

        // Apply token tracking to the response (if not done within invokeModel)
        // Note: configureModelWithTracking logic might need adjustment for this structure
        // For now, assume token tracking happens within invokeModel or the base model

        // Successful invocation, reset retry flag if it was set
        return { messages: [response], isRetryAttempt: false };
      } catch (error) {
        const isRetryableError =
          error instanceof Error &&
          (error.message.includes('token limit') ||
            error.message.includes('tokens exceed') ||
            error.message.includes('context length'));

        if (isRetryableError && !isRetryAttempt) {
          logger.warn(
            `Agent action failed: ${(error as Error).message}. Retrying with 'smart' model.`
          );
          // Mark for retry on the next invocation of this node
          return { messages: [], isRetryAttempt: true }; // Return empty messages to trigger retry? Or keep existing? Needs thought. Let's keep existing and set flag.
          // Returning existing messages + retry flag. The router should handle looping back.
          // return { messages: [], isRetryAttempt: true }; // Or perhaps signal retry differently? Let's try just setting the flag
          return { isRetryAttempt: true }; // Signal retry - state merge will keep messages
        } else if (isRetryableError && isRetryAttempt) {
          logger.error(
            `Retry attempt failed: ${(error as Error).message}. Aborting this path.`
          );
          const fallbackMessage = new AIMessage({
            content:
              'I encountered an issue performing the action, and retrying with a more powerful model also failed. I will abandon this complex step and try a simpler approach.\\n\\nNEXT STEPS: I will simplify the next action to avoid the previous error. I will focus on a single, small step.',
          });
          // Return fallback message and clear retry flag
          return { messages: [fallbackMessage], isRetryAttempt: false };
        } else {
          logger.error(`Unhandled agent error during execution: ${error}`);
          throw error; // Re-throw non-retryable errors
        }
      }
    };

    // Router Node: Decides the next step
    const router = (state: AgentState): string => {
      const { messages, isRetryAttempt } = state;

      // If retry attempt is flagged, loop back to agent immediately
      if (isRetryAttempt) {
        logger.debug('Router: Retry flag is set, looping back to agent node.');
        return 'agent';
      }

      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) {
        throw new Error('Router: No messages found in state.');
      }

      // Check for tool calls
      if (
        lastMessage instanceof AIMessage &&
        lastMessage.tool_calls &&
        lastMessage.tool_calls.length > 0
      ) {
        logger.debug('Router: Detected tool calls, routing to action node.');
        return 'action'; // Route to ToolNode
      }

      // Check for a "final answer" indicator (customize as needed)
      if (
        lastMessage instanceof AIMessage &&
        typeof lastMessage.content === 'string' &&
        lastMessage.content.toUpperCase().includes('FINAL ANSWER')
      ) {
        logger.debug("Router: Detected 'FINAL ANSWER', routing to end.");
        return END;
      }

      // Otherwise, continue the loop by calling the agent again
      logger.debug(
        'Router: AIMessage received, routing to END to return state.'
      );
      return END;
    };

    // --- Define the Graph ---
    const workflow = new StateGraph<AgentState>({
      channels: {
        messages: {
          value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y), // Append messages
          default: () => [], // Default to empty array
        },
        isRetryAttempt: {
          value: (x?: boolean, y?: boolean) => y ?? x, // Take the newest value
          default: () => false,
        },
        // Add other channels if needed
      },
    });

    // Add nodes
    workflow.addNode(AGENT, agentNode);
    workflow.addNode(ACTION, toolNode);

    // Define edges
    // Cast to any to bypass strict type checking issues
    workflow.setEntryPoint(AGENT as any); // Start with the agent

    // Conditional edge from agent node based on router logic
    // Cast to any to bypass strict type checking issues
    workflow.addConditionalEdges(AGENT as any, router, {
      // Cast target node names to any as well
      [ACTION]: ACTION as any,
      [AGENT]: AGENT as any,
      [END]: END,
    });

    // Edge from action node (tool execution) back to agent node
    // Cast to any to bypass strict type checking issues
    workflow.addEdge(ACTION as any, AGENT as any);

    // --- Compile the Graph ---
    const memory = new MemorySaver();
    const graph = workflow.compile({ checkpointer: memory });

    logger.info('Autonomous agent graph created successfully.');

    // Return the compiled graph and config
    return {
      agent: graph, // The compiled graph is the new 'agent'
      agentConfig: {
        configurable: { thread_id: json_config.chat_id }, // Config for invoking the graph
      },
      json_config,
    };
  } catch (error) {
    logger.error('Failed to create autonomous agent graph:', error);
    throw error;
  }
};
