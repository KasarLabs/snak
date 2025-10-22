import {
  CompiledStateGraph,
  END,
  messagesStateReducer,
  StateGraph,
} from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { GraphError } from '../utils/error.utils.js';
import { SupervisorAgent } from '@agents/core/supervisorAgent.js';
import { skipValidationType } from '@stypes/graph.types.js';
import { AgentConfig, logger } from '@snakagent/core';
import { GraphState } from './agent.graph.js';
import { initializeDatabase } from '@agents/utils/database.utils.js';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import {
  getAgentConfigurationHelperTools,
  getAgentSelectorHelperTools,
  getCommunicationHelperTools,
  getMcpServerHelperTools,
} from '@agents/operators/supervisor/supervisorTools.js';
import { createSupervisor } from '@langchain/langgraph-supervisor';
import {
  AIMessage,
  BaseMessage,
  RemoveMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { SUPERVISOR_SYSTEM_PROMPT } from '@prompts/agents/supervisor/supervisor.prompt.js';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AGENT_CONFIGURATION_HELPER_SYSTEM_PROMPT } from '@prompts/agents/agentConfigurationHelper.prompt.js';
import { MCP_CONFIGURATION_HELPER_SYSTEM_PROMPT } from '@prompts/agents/mcpConfigurationHelper.prompt.js';
import { Annotation } from '@langchain/langgraph';
import { redisAgents } from '@snakagent/database/queries';
import { AGENT_SELECTOR_SYSTEM_PROMPT } from '@prompts/agents/agentSelector.prompt.js';
import { REMOVE_ALL_MESSAGES } from '@langchain/langgraph';
const MAX_SUPERVISOR_MESSAGE = 30;

export function messagesStateReducerWithLimit(
  left: BaseMessage[],
  right: BaseMessage[]
): BaseMessage[] {
  // Simple append - deduplication will be handled in preModelHook

  const combined = messagesStateReducer(left, right);
  if (combined.length <= MAX_SUPERVISOR_MESSAGE) {
    return combined;
  }

  // Calculate start index to keep last MAX_SUPERVISOR_MESSAGE messages
  let startIndex = combined.length - MAX_SUPERVISOR_MESSAGE;

  // Adjust startIndex if we're starting with a tool message (need its AI parent)
  while (startIndex > 0 && combined[startIndex].getType() === 'tool') {
    startIndex--;
  }

  return combined.slice(startIndex);
}

const SupervisorStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducerWithLimit,
    default: () => [],
  }),
  transfer_to: Annotation<
    Array<{ agent_name: string; agent_id: string; query: string }>
  >({
    reducer: (
      left: Array<{ agent_name: string; agent_id: string; query: string }>,
      right: Array<{ agent_name: string; agent_id: string; query: string }>
    ) => right,
    default: () => [],
  }),
});

export class SupervisorGraph {
  private graph: CompiledStateGraph<any, any, any, any, any> | null = null;
  private specializedAgent: Array<CompiledStateGraph<any, any, any, any, any>> =
    [];
  private checkpointer: PostgresSaver;
  private supervisorConfig: AgentConfig.Runtime;

  constructor(private supervisorAgent: SupervisorAgent) {
    const pg_checkpointer = supervisorAgent.getPgCheckpointer();
    if (!pg_checkpointer) {
      throw new GraphError('E08GI110', 'Graph.constructor');
    }
    this.checkpointer = pg_checkpointer;
    this.supervisorConfig = supervisorAgent.getAgentConfig();
  }

  async initialize(): Promise<CompiledStateGraph<any, any, any, any, any>> {
    try {
      // Initialize database
      await initializeDatabase(this.supervisorAgent.getDatabaseCredentials());
      // Build and compile the workflow
      const workflow = await this.buildWorkflow();
      this.graph = workflow.compile({ checkpointer: this.checkpointer });
      logger.info('[SupervisorAgent] Successfully initialized agent');
      return this.graph;
    } catch (error) {
      logger.error('[SupervisorAgent] Failed to create agent:', error);
      throw error;
    }
  }

  getCompiledGraph(): CompiledStateGraph<any, any, any, any, any> | null {
    return this.graph;
  }

  getSpecializedAgents(): Array<CompiledStateGraph<any, any, any, any, any>> {
    return this.specializedAgent;
  }
  /**
   * Transforms messages to remove duplicates and transform AI messages.
   * Uses RemoveMessage pattern to overwrite messages and ensure deduplication.
   * This ensures compatibility with Google Generative AI which doesn't support
   * custom author names as message types.
   */
  private transformMessagesHook(state: any): {
    messages: BaseMessage[];
  } {
    const messages = state.messages || [];

    const transformedMessages: BaseMessage[] = messages.map(
      (msg: BaseMessage) => {
        // Check if message has a 'name' property that's not standard
        const messageName = msg.name;
        const msgType = msg.getType();

        // If it's an AI message with a custom name, we need to handle it
        if (messageName && msgType === 'ai') {
          logger.debug(
            `[SupervisorGraph] Processing AI message with name '${messageName}'`
          );

          // The name is already preserved in the message history for routing
          return new AIMessage({
            content: msg.content,
            name: msg.name === 'supervisor' ? 'supervisor' : 'ai',
            tool_calls: (msg as any).tool_calls || [],
            invalid_tool_calls: (msg as any).invalid_tool_calls || [],
            additional_kwargs: {
              ...msg.additional_kwargs,
              from: messageName, // Preserve in metadata
            },
            response_metadata: msg.response_metadata,
            id: msg.id,
          });
        }

        // Return the original message if no transformation is needed
        return msg;
      }
    );

    // Use RemoveMessage pattern to overwrite all messages
    return {
      messages: [
        new RemoveMessage({ id: REMOVE_ALL_MESSAGES }),
        ...transformedMessages,
      ],
    };
  }

  private addAditionalKwargsToMessage(
    state: typeof SupervisorStateAnnotation.State
  ): {
    messages: BaseMessage[];
  } {
    const messages = state.messages || [];
    if (!messages || messages.length === 0) {
      return { messages: [] };
    }
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.getType() !== 'ai') {
      return { messages };
    }
    const agentName = lastMessage.name;
    lastMessage.additional_kwargs = {
      ...lastMessage.additional_kwargs,
      agent_name: agentName,
    };
    const updatedMessages = [...messages.slice(0, -1), lastMessage];

    return { messages: updatedMessages };
  }

  private async buildWorkflow(): Promise<StateGraph<any, any, any, any, any>> {
    // Create the sub-agent with the same message transformer

    const formattedDate = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());

    const agentConfigurationHelperSystemPrompt =
      ChatPromptTemplate.fromMessages([
        ['ai', AGENT_CONFIGURATION_HELPER_SYSTEM_PROMPT],
      ]);
    const formattedAgentConfigurationHelperPrompt =
      await agentConfigurationHelperSystemPrompt.format({});
    this.specializedAgent.push(
      createReactAgent({
        llm: this.supervisorConfig.graph.model,
        tools: [
          ...getAgentConfigurationHelperTools(this.supervisorConfig),
          ...getCommunicationHelperTools(),
        ],
        name: 'agentConfigurationHelper',
        prompt: formattedAgentConfigurationHelperPrompt,
        stateSchema: SupervisorStateAnnotation,
        preModelHook: this.transformMessagesHook.bind(this),
      })
    );

    const mcpConfigurationHelperSystemPrompt = ChatPromptTemplate.fromMessages([
      ['ai', MCP_CONFIGURATION_HELPER_SYSTEM_PROMPT],
    ]);
    const formattedMcpConfigurationHelperPrompt =
      await mcpConfigurationHelperSystemPrompt.format({});
    this.specializedAgent.push(
      createReactAgent({
        llm: this.supervisorConfig.graph.model,
        tools: getMcpServerHelperTools(this.supervisorConfig),
        name: 'mcpConfigurationHelper',
        prompt: formattedMcpConfigurationHelperPrompt,
        stateSchema: SupervisorStateAnnotation,
        preModelHook: this.transformMessagesHook.bind(this),
      })
    );

    this.specializedAgent.push(
      createReactAgent({
        llm: this.supervisorConfig.graph.model,
        tools: [],
        name: 'snakRagAgentHelper',
        prompt:
          'You are an expert RAG agent configuration assistant. Your task is to help users create and modify RAG agent configurations based on their requirements. Always ensure that the configurations adhere to best practices and are optimized for performance.',
        stateSchema: SupervisorStateAnnotation,
        preModelHook: this.transformMessagesHook.bind(this),
      })
    );

    const agentsAvailable = await redisAgents.listAgentsByUser(
      this.supervisorConfig.user_id
    );
    logger.info(
      `[SupervisorGraph] Found ${agentsAvailable.length} avaible agents for user ${this.supervisorConfig.user_id}`
    );
    this.specializedAgent.push(
      createReactAgent({
        llm: this.supervisorConfig.graph.model,
        tools: getAgentSelectorHelperTools(
          this.supervisorConfig,
          agentsAvailable
        ),
        name: 'agentSelectorHelper',
        prompt: AGENT_SELECTOR_SYSTEM_PROMPT,
        stateSchema: SupervisorStateAnnotation,
        preModelHook: this.transformMessagesHook.bind(this),
      })
    );
    const supervisorPrompt = ChatPromptTemplate.fromMessages([
      ['ai', SUPERVISOR_SYSTEM_PROMPT],
    ]);
    const formattedSupervisorPrompt = await supervisorPrompt.format({
      current_date: formattedDate,
    });
    const workflow = createSupervisor({
      supervisorName: 'supervisor',
      agents: [...this.specializedAgent],
      tools: getCommunicationHelperTools(),
      llm: this.supervisorConfig.graph.model,
      prompt: formattedSupervisorPrompt,
      stateSchema: SupervisorStateAnnotation,
      addHandoffBackMessages: false,
      preModelHook: this.transformMessagesHook.bind(this),
      postModelHook: this.addAditionalKwargsToMessage.bind(this),
    });
    return workflow;
  }
}

export const createSupervisorGraph = async (
  supervisorAgent: SupervisorAgent
): Promise<SupervisorGraph> => {
  const agent = new SupervisorGraph(supervisorAgent);
  await agent.initialize();
  return agent;
};
