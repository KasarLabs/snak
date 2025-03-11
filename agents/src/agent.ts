
import { ChatAnthropic } from '@langchain/anthropic';
import { AiConfig } from '../common/index.js';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { ChatDeepSeek } from '@langchain/deepseek';
import { StarknetAgentInterface } from './tools/tools.js';
import { createSignatureTools } from './tools/signatureTools.js';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { createAllowedToollkits } from './tools/external_tools.js';
import { createAllowedTools } from './tools/tools.js';
import {
  Annotation,
  InMemoryStore,
  MessagesAnnotation,
  StateGraph,
} from '@langchain/langgraph';
import {
  AIMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { DynamicStructuredTool, Tool, tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { v4 as uuidv4 } from "uuid";

export const createAgent = async (
  starknetAgent: StarknetAgentInterface,
  aiConfig: AiConfig,
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
          temperature: 0
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
    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-small",
      apiKey: aiConfig.aiProviderApiKey,
    });

    const store = new InMemoryStore({
      index: {
        embeddings,
        dims: 1536,
      }
    });

    const json_config = starknetAgent.getAgentConfig();
    if (!json_config) {
      throw new Error('Agent configuration is required');
    }
    let toolsList : (Tool | DynamicStructuredTool<any>)[];

    if (isSignature === true) {
      toolsList = await createSignatureTools(json_config.internal_plugins);
    } else {
      const allowedTools = await createAllowedTools(
        starknetAgent,
        json_config.internal_plugins
      );

      const allowedToolsKits = await createAllowedToollkits(json_config.external_plugins)

      toolsList = allowedToolsKits
        ? [...allowedTools, ...allowedToolsKits]
        : allowedTools;
    }

    const GraphState = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
      }),
      memories: Annotation<string>
    });

    const upsertMemoryTool = tool(async (
      { content },
      config: LangGraphRunnableConfig
    ): Promise<string> => {
      const store = config.store as InMemoryStore;
      if (!store) {
        throw new Error("No store provided to tool.");
      }
      await store.put(
        ["user", "memories"],
        uuidv4(),
        { text: content }
      );
      return "Stored memory.";
    }, {
      name: "upsert_memory",
      schema: z.object({
        content: z.string().describe("The content of the memory to store."),
      }),
      description: "Upsert long-term memories.",
    });

    const addMemories = async (
      state: typeof MessagesAnnotation.State,
      config: LangGraphRunnableConfig
    ) => {
      const store = config.store as InMemoryStore;

      if (!store) {
        throw new Error("No store provided to state modifier.");
      }

      const items = await store.search(
        ["user", "memories"],
        {
          // Assume it's not a complex message
          query: state.messages[state.messages.length - 1].content as string,
          limit: 4
        }
      );

      const memories = items.length
        ? `## Memories of user\n${
          items.map(item => `${item.value.text} (similarity: ${item.score})`).join("\n")
        }`
        : "";

      return {
        memories: memories
      };
    };

    toolsList.push(upsertMemoryTool)
    const toolNode = new ToolNode<typeof GraphState.State>(toolsList);
    const modelSelected = model().bindTools(toolsList);

    const systemPromptContent = json_config.prompt.content;

    async function callModel(
      state: typeof GraphState.State
    ): Promise<{messages: BaseMessage[]}> {
      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `${systemPromptContent}

          During conversation, use upsert_memory tool to save relevant user information.
          The most 4 relevant memories concerning the query : <memories>{memories}<memories/>

          {system_message}`,
        ],
        new MessagesPlaceholder('messages'),
      ]);

      const formattedPrompt = await prompt.formatMessages({
        system_message: 'You are a helpful Chatbot Agent. ',
        tool_names: toolsList.map((tool) => tool.name).join(', '),
        messages: state.messages,
        memories: state.memories || ''
      });

      const result = await modelSelected.invoke(formattedPrompt);

      return {
        messages: [result],
      };
    }

    function shouldContinue(state: typeof GraphState.State) {
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1] as AIMessage;

      if (lastMessage.tool_calls?.length) {
        return 'tools';
      }
      return '__end__';
    }

    const workflow = new StateGraph(GraphState)
      .addNode('agent', callModel)
      .addNode('tools', toolNode)
      .addNode('memory', addMemories)
      .addEdge('__start__', 'memory')
      .addEdge('memory', 'agent')
      .addConditionalEdges('agent', shouldContinue)
      .addEdge('tools', 'agent')

    const app = workflow.compile({
      store: store
    });

    return app;
  } catch (error) {
    console.error(
      `⚠️ Ensure your environment variables are set correctly according to your config/agent.json file.`
    );
    console.error('Failed to load or parse JSON config:', error);
    throw error;
  }
};
