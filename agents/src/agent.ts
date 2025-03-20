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
  MemorySaver,
  MessagesAnnotation,
  StateGraph,
} from '@langchain/langgraph';
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { DynamicStructuredTool, Tool, tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { LangGraphRunnableConfig } from '@langchain/langgraph';

import { CustomHuggingFaceEmbeddings } from './customEmbedding.js';

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
          temperature: 0,
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
    const json_config = starknetAgent.getAgentConfig();
    json_config.memory = true;
    const embeddings = new CustomHuggingFaceEmbeddings({
      model: 'Xenova/all-MiniLM-L6-v2',
      dtype: 'fp32',
    });

    // const embeddings = new OpenAIEmbeddings({
    //   model: 'text-embedding-3-small',
    //   apiKey: aiConfig.embeddingKey,
    // });
    const embeddingDimensions = 384; //1536 for OpenAI, 512 for TensorFlow, 384 for HugginFace
    if (!json_config) {
      throw new Error('Agent configuration is required');
    }
    let databaseConnection = null;
    if (json_config.memory) {
      const databaseName = json_config.chat_id;
      databaseConnection = await starknetAgent.createDatabase(databaseName);
      if (!databaseConnection) {
        throw new Error(`Failed to create or connect to database: `);
      }
      try {
        const dbCreation = await databaseConnection.createTable({
          table_name: 'agent_memories',
          fields: new Map<string, string>([
            ['id', 'SERIAL PRIMARY KEY'],
            ['user_id', 'VARCHAR(100)'],
            ['content', 'TEXT'],
            ['embedding', `vector(${embeddingDimensions})`],
            ['created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
            ['metadata', 'TEXT'],
          ]),
        });
        if (dbCreation.code == '42P07')
          console.log('Agent memory table already exists');
        else console.log('Agent memory table successfully created');
      } catch (error) {
        console.error('Error creating memories table:', error);
        throw error;
      }
    }

    let toolsList: (Tool | DynamicStructuredTool<any>)[];

    if (isSignature === true) {
      toolsList = await createSignatureTools(json_config.internal_plugins);
    } else {
      const allowedTools = await createAllowedTools(
        starknetAgent,
        json_config.internal_plugins
      );

      const allowedToolsKits = await createAllowedToollkits(
        json_config.external_plugins
      );

      toolsList = allowedToolsKits
        ? [...allowedTools, ...allowedToolsKits]
        : allowedTools;
    }

    const GraphState = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
      }),
      memories: Annotation<string>,
    });

    const upsertMemoryToolDB = tool(
      async ({ content }, config: LangGraphRunnableConfig): Promise<string> => {
        try {
          const userId = config.configurable?.userId || 'default_user';
          const embeddingResult = await embeddings.embedQuery(content);
          const embeddingString = `[${embeddingResult.join(',')}]`;
          const metadata = JSON.stringify({
            timestamp: new Date().toISOString(),
          });

          //console.log('\nInserting inside the table : ', content);
          if (databaseConnection) {
            await databaseConnection.insert({
              table_name: 'agent_memories',
              fields: new Map<string, string | string[]>([
                ['id', 'DEFAULT'],
                ['user_id', userId],
                ['content', content],
                ['embedding', embeddingString],
                ['metadata', metadata],
              ]),
            });
          }

          return 'Memory stored successfully.';
        } catch (error) {
          console.error('Error storing memory:', error);
          return 'Failed to store memory.';
        }
      },
      {
        name: 'upsert_memory',
        schema: z.object({
          content: z.string().describe('The content of the memory to store.'),
        }),
        description:
          "CREATE, UPDATE or DELETE persistent MEMORIES to persist across conversations. In your system prompt, you have access to the MEMORIES relevant to the user's query, each having their own MEMORY ID. Include the MEMORY ID when updating or deleting a MEMORY. Omit when creating a new MEMORY - it will be created for you. Proactively call this tool when you: 1.Identify a new USER preference. 2.Receive an explicit USER request to remember something or otherwise alter your behavior. 3. Are working and want to record important context. 4. Identify that an existing MEMORY is incorrect or outdated.",
      }
    );

    const addMemoriesFromDB = async (
      state: typeof MessagesAnnotation.State,
      config: LangGraphRunnableConfig
    ) => {
      try {
        if (!databaseConnection)
          return {
            memories: '',
          };
        const userId = config.configurable?.userId || 'default_user';
        const lastMessage = state.messages[state.messages.length - 1]
          .content as string;

        const queryEmbedding = await embeddings.embedQuery(lastMessage);
        const queryEmbeddingStr = `[${queryEmbedding.join(',')}]`;
        const similarMemoriesQuery = `
          SELECT id, content, 1 - (embedding <=> '${queryEmbeddingStr}'::vector) as similarity
          FROM agent_memories
          WHERE user_id = '${userId}'
          ORDER BY similarity DESC
          LIMIT 4
        `;

        const results = await databaseConnection.query(similarMemoriesQuery);
        // if (results.query) {
        //   console.log('\n\nDATABASE CONTENT :\n-------');
        //   for (const row of results.query.rows) {
        //     console.log('Raw data : ', JSON.stringify(row));
        //   }
        //   console.log('-------\n');
        // }
        let memories = '\n';
        if (results.query) {
          memories = results.query.rows
            .map((row) => {
              // Format each memory with its content and similarity score
              return `Memory [id: ${row.id}, similarity: ${row.similarity.toFixed(4)}]: ${row.content}`;
            })
            .join('\n');
        }
        //console.log('Memories :\n-------\n', memories, '\n-------\n');

        return {
          memories: memories,
        };
      } catch (error) {
        console.error('Error retrieving memories:', error);
        return {
          memories: '',
        };
      }
    };

    if (json_config.memory) toolsList.push(upsertMemoryToolDB);
    const toolNode = new ToolNode<typeof GraphState.State>(toolsList);
    const modelSelected = model().bindTools(toolsList);

    const configPrompt = json_config.prompt.content;

    const baseSystemtPrompt = `${configPrompt}`;
    const memoryPrompt = `Use your upsert_memory tool in order to save the conversation as it goes on.\nThe most 4 relevant memories concerning the query are :\n<memories>\n{memories}\n<memories/>\n;`;
    const finalPrompt = json_config.memory
      ? `${baseSystemtPrompt}\n${memoryPrompt}`
      : `${baseSystemtPrompt}`;

    async function callModel(
      state: typeof GraphState.State
    ): Promise<{ messages: BaseMessage[] }> {
      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `${finalPrompt}

          {system_message}`,
        ],
        new MessagesPlaceholder('messages'),
      ]);

      const formattedPrompt = await prompt.formatMessages({
        system_message: '',
        tool_names: toolsList.map((tool) => tool.name).join(', '),
        messages: state.messages,
        memories: state.memories || '',
      });

      const result = await modelSelected.invoke(formattedPrompt);

      return {
        messages: [result],
      };
    }

    function shouldContinue(state: typeof GraphState.State) {
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1] as AIMessage;

      if (lastMessage.additional_kwargs?.tool_responses) {
        const toolResponses = lastMessage.additional_kwargs.tool_responses;
        if (Array.isArray(toolResponses) && toolResponses.length > 0) {
          const wasMemoryTool = toolResponses.some(
            (resp) =>
              resp.tool_call_id && resp.tool_call_id.includes('upsert_memory')
          );
          if (wasMemoryTool) {
            return 'agent';
          }
        }
      }

      if (lastMessage.tool_calls?.length) {
        return 'tools';
      }
      return '__end__';
    }

    const workflow = new StateGraph(GraphState)
      .addNode('agent', callModel)
      .addNode('tools', toolNode);
    if (json_config.memory) {
      workflow
        .addNode('memory', addMemoriesFromDB)
        .addEdge('__start__', 'memory')
        .addEdge('memory', 'agent');
    } else {
      workflow.addEdge('__start__', 'agent');
    }
    workflow
      .addConditionalEdges('agent', shouldContinue)
      .addEdge('tools', 'agent');

    const checkpointer = new MemorySaver();
    const app = workflow.compile({
      ...(json_config.memory ? { checkpointer: checkpointer } : {}),
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
