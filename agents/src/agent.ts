import { ChatAnthropic } from '@langchain/anthropic';
import { AiConfig } from '../common/index.js';
import { ChatOpenAI } from '@langchain/openai';
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
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
  tool,
} from '@langchain/core/tools';
import { z } from 'zod';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { LangGraphRunnableConfig } from '@langchain/langgraph';

import { CustomHuggingFaceEmbeddings } from './customEmbedding.js';
import { MCP_CONTROLLER } from './mcp/src/mcp.js';
import { JsonConfig } from './jsonConfig.js';

export function selectModel(aiConfig: AiConfig) {
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
        temperature: 0,
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
}

export async function initializeToolsList(
  starknetAgent: StarknetAgentInterface,
  jsonConfig: JsonConfig
): Promise<(Tool | DynamicStructuredTool<any> | StructuredTool)[]> {
  let toolsList: (Tool | DynamicStructuredTool<any> | StructuredTool)[] = [];
  const isSignature = starknetAgent.getSignature().signature === 'wallet';

  if (isSignature) {
    toolsList = await createSignatureTools(jsonConfig.internal_plugins);
  } else {
    const allowedTools = await createAllowedTools(
      starknetAgent,
      jsonConfig.internal_plugins
    );

    const allowedToolsKits = await createAllowedToollkits(
      jsonConfig.external_plugins
    );

    toolsList = allowedToolsKits
      ? [...allowedTools, ...allowedToolsKits]
      : [...allowedTools];
  }

  if (jsonConfig.mcp === true) {
    const mcp = new MCP_CONTROLLER();
    await mcp.initializeConnections();
    console.log(mcp.getTools());
    toolsList = [...toolsList, ...mcp.getTools()];
  }

  return toolsList;
}

export const createAgent = async (
  starknetAgent: StarknetAgentInterface,
  aiConfig: AiConfig
) => {
  const embeddings = new CustomHuggingFaceEmbeddings({
    model: 'Xenova/all-MiniLM-L6-v2',
    dtype: 'fp32',
  });
  const embeddingDimensions = 384; //1536 for OpenAI, 512 for TensorFlow, 384 for HuggingFace

  try {
    const json_config = starknetAgent.getAgentConfig();
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
            ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
            ['metadata', 'TEXT'],
            ['history', "JSONB DEFAULT '[]'"],
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

    let toolsList = await initializeToolsList(starknetAgent, json_config);

    const GraphState = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
      }),
      memories: Annotation<string>,
    });

    const upsertMemoryToolDB = tool(
      async (
        { content, memoryId },
        config: LangGraphRunnableConfig
      ): Promise<string> => {
        try {
          const userId = config.configurable?.userId || 'default_user';
          const embeddingResult = await embeddings.embedQuery(content);
          const embeddingString = `[${embeddingResult.join(',')}]`;
          const metadata = JSON.stringify({
            timestamp: new Date().toISOString(),
          });
          console.log('\nCalling memory tool');
          if (memoryId) {
            console.log('\nmemoryId detected : ', memoryId);
            const response = await databaseConnection?.select({
              FROM: ['agent_memories'],
              SELECT: ['content', 'history', 'created_at'],
              WHERE: [`id = ${memoryId}`],
            });
            if (
              response?.status === 'success' &&
              response.query &&
              response.query.rows.length > 0
            ) {
              const existingMemory = response.query.rows[0];
              const oldContent = existingMemory.content;
              let history = existingMemory.history;
              if (!history) {
                history = [];
              } else if (typeof history === 'string') {
                try {
                  history = JSON.parse(history);
                } catch (e) {
                  console.error('Error parsing history : ', e);
                  history = [];
                }
              }
              const timestamp = new Date().toISOString();
              history.push({
                value: oldContent,
                timestamp: timestamp,
                action: 'UPDATE',
              });

              const historyString = JSON.stringify(history);
              const updateResponse = await databaseConnection?.update({
                table_name: 'agent_memories',
                ONLY: true,
                SET: [
                  `content = '${content.replace(/'/g, "''")}'`,
                  `embedding = '${embeddingString.replace(/'/g, "''")}'`,
                  `updated_at = CURRENT_TIMESTAMP`,
                  `history = '${historyString.replace(/'/g, "''")}'`,
                ],
                WHERE: [`id = ${memoryId}`],
              });

              if (updateResponse?.status === 'success') {
                return 'Memory updated successfully.';
              } else {
                throw new Error(
                  `Failed to update memory : ${updateResponse?.error_message}`
                );
              }
            }
          }
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
                ['history', '[]'],
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
          memoryId: z
            .number()
            .optional()
            .nullable()
            .describe('Memory ID when wanting to update an existing memory.'),
        }),
        description: `
		  CREATE, UPDATE or DELETE persistent MEMORIES to persist across conversations.
		  In your system prompt, you have access to the MEMORIES relevant to the user's
		   query, each having their own MEMORY ID. Include the MEMORY ID when updating
		   or deleting a MEMORY. Omit when creating a new MEMORY - it will be created for
		   you. Proactively call this tool when you:
		   1.Identify a new USER preference.
		   2.Receive an explicit USER request to remember something or otherwise alter your behavior.
		   3. Are working and want to record important context.
		   4. Identify that an existing MEMORY is incorrect or outdated.
		  `,
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
          SELECT id, content, history, 1 - (embedding <=> '${queryEmbeddingStr}'::vector) as similarity
          FROM agent_memories
          WHERE user_id = '${userId}'
          ORDER BY similarity DESC
          LIMIT 4
        `;

        const results = await databaseConnection.query(similarMemoriesQuery);

        // const results = await databaseConnection.select({
        //   FROM: ['agent_memories'],
        //   SELECT: [
        //     'id',
        //     'content',
        //     'history',
        //     `1 - (embedding <=> '${queryEmbeddingStr}'::vector) as similarity`
        //   ],
        //   WHERE: [`user_id = '${userId}'`]
        // });

        let memories = '\n';
        if (
          results.status === 'success' &&
          results.query &&
          results.query.rows.length > 0
        ) {
          memories = results.query.rows
            .map((row) => {
              let historyStr = '[]';
              try {
                if (row.history) {
                  if (typeof row.history === 'string') {
                    historyStr = row.history;
                  } else {
                    historyStr = JSON.stringify(row.history);
                  }
                }
              } catch (e) {
                console.error('Error stringifying history : ', e);
              }
              return `Memory [id: ${row.id}, similarity: ${row.similarity.toFixed(4)},history : ${historyStr}]: ${row.content}`;
            })
            .join('\n');
        }
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

    //if (json_config.memory) toolsList.push(upsertMemoryToolDB);
    const toolNode = new ToolNode<typeof GraphState.State>(toolsList);
    const modelSelected = selectModel(aiConfig).bindTools(toolsList);

    const configPrompt = json_config.prompt?.content;
    const basicPrompt = `
		Use your upsert_memory tool whenever there is information that is relevant, this includes but is not limited to : contract/wallet addresses, public/private keys, names, preferences etc. When you want to update an information already stored in the database, make sure to specify that it is an update. The most 4 relevant memories concerning the query are :\n<memories>\n{memories}\n<memories/>\n;
		`;
    const refinedPrompt1 = `When conversing with users, PROACTIVELY use the upsert_memory tool to store and retrieve important information:

1. AUTOMATICALLY STORE without being asked:
   - NEW user names, preferences, and personal information (not confirmations of existing data)
   - ALL wallet details when created or mentioned (addresses, public/private keys)
   - Contract addresses and blockchain identifiers
   - Important dates, amounts, and transaction details

2. When storing memory, ALWAYS include:
   - Descriptive memory_content with complete details
   - Relevant tags for easy retrieval (e.g., "wallet", "preference", "contact")
   - Context about where/how the information was obtained

3. UPDATE existing memories when:
   - New information contradicts stored data
   - More complete information becomes available
   - User corrects previously stored information
   - Include original memory ID when updating

4. The 4 most relevant memories for the current query are:
<memories>
{memories}
</memories>

5. RETRIEVE additional memories when:
   - Any financial or blockchain action is requested
   - User references past conversations or saved information
   - Making recommendations based on user history

6. AFTER MEMORY OPERATIONS:
   - ALWAYS ANSWER THE USER'S ORIGINAL QUESTION after storing or retrieving memory
   - When the user asks "what's my name?", directly answer with "Your name is [Name]" based on memory
   - Never skip answering the user's question just because you've stored or updated memory
   - For memory verification questions (like name confirmations), answer definitively rather than asking for additional confirmation
   - Remember that memory operations are invisible infrastructure - the user still expects their question to be answered

7. MEMORY EFFICIENCY GUIDELINES:
   - Do NOT store memory for simple confirmations of existing information
   - Only update memory when there's a meaningful change or correction

   - Avoid redundant memory storage for information that's already well-documented in memory`;
    const memoryPrompt = ``;
    const finalPrompt = json_config.memory
      ? `${configPrompt}\n${memoryPrompt}`
      : `${configPrompt}`;

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

      if (lastMessage.tool_calls?.length) {
        return 'tools';
      }
      return 'end';
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
      ...(json_config.memory
        ? {
            checkpointer: checkpointer,
            configurable: {},
          }
        : {}),
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
