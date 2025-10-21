import { CompiledStateGraph, StateGraph } from '@langchain/langgraph';
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
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { SUPERVISOR_SYSTEM_PROMPT } from '@prompts/agents/supervisor/supervisor.prompt.js';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AGENT_CONFIGURATION_HELPER_SYSTEM_PROMPT } from '@prompts/agents/agentConfigurationHelper.prompt.js';
import { MCP_CONFIGURATION_HELPER_SYSTEM_PROMPT } from '@prompts/agents/mcpConfigurationHelper.prompt.js';
import { Annotation } from '@langchain/langgraph';
import { redisAgents } from '@snakagent/database/queries';
import { v4 as uuidv4 } from 'uuid';
import { ms } from 'zod/v4/locales';
const MAX_SUPERVISOR_MESSAGE = 30;

function mergeMessagesWithoutDuplicates(
  left: BaseMessage[],
  right: BaseMessage[]
): BaseMessage[] {
  if (!left || left.length === 0) {
    return right || [];
  }
  if (!right || right.length === 0) {
    return left || [];
  }

  const messageMap = new Map<string, BaseMessage>();
  const insertionOrder: string[] = []; // Garder l'ordre d'insertion

  left.forEach((msg) => {
    if (msg.id) {
      messageMap.set(msg.id, msg);
      insertionOrder.push(msg.id);
    } else {
      logger.debug(
        `[SupervisorGraph] mergeMessagesWithoutDuplicates: Message without id found: ${JSON.stringify(msg)}`
      );
    }
  });

  right.forEach((msg) => {
    if (!msg.id) {
      msg.id = uuidv4();
    }

    if (messageMap.has(msg.id)) {
      // Override: on garde la position originale mais on update le message
      messageMap.set(msg.id, msg);
    } else {
      // Nouveau message: on l'ajoute à la fin
      messageMap.set(msg.id, msg);
      insertionOrder.push(msg.id);
    }
  });

  // Retourner dans l'ordre d'insertion
  return insertionOrder.map((id) => messageMap.get(id)!);
}

export function messagesStateReducerWithLimit(
  left: BaseMessage[],
  right: BaseMessage[]
): BaseMessage[] {
  const combined = mergeMessagesWithoutDuplicates(left, right);

  if (combined.length <= MAX_SUPERVISOR_MESSAGE) {
    return combined;
  }

  console.log(
    `[SupervisorGraph] messagesStateReducerWithLimit: Limiting messages from ${combined.length} to ${MAX_SUPERVISOR_MESSAGE}`
  );

  let startIndex = combined.length - MAX_SUPERVISOR_MESSAGE;

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

  getcompiledGraph(): CompiledStateGraph<any, any, any, any, any> | null {
    return this.graph;
  }

  getSpecializedAgents(): Array<CompiledStateGraph<any, any, any, any, any>> {
    return this.specializedAgent;
  }

  private end_graph(state: typeof GraphState): {
    retry: number;
    skipValidation: skipValidationType;
    error: null;
  } {
    logger.info('[EndGraph] Cleaning up state for graph termination');
    return {
      retry: 0,
      skipValidation: { skipValidation: false, goto: '' },
      error: null,
    };
  }

  /**
   * Transforms messages to remove the 'name' field from AI messages.
   * This ensures compatibility with Google Generative AI which doesn't support
   * custom author names as message types.
   */
  private transformMessagesHook(state: any): {
    llmInputMessages: BaseMessage[];
  } {
    const messages = state.messages || [];

    const transformedMessages = messages.map((msg: BaseMessage) => {
      // Skip if msg is not a valid BaseMessage instance
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
        });
      }

      // Return the original message if no transformation is needed
      return msg;
    });

    return { llmInputMessages: transformedMessages };
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

    const avaibleAgents = await redisAgents.listAgentsByUser(
      this.supervisorConfig.user_id
    );
    logger.info(
      `[SupervisorGraph] Found ${avaibleAgents.length} avaible agents for user ${this.supervisorConfig.user_id}`
    );
    this.specializedAgent.push(
      createReactAgent({
        llm: this.supervisorConfig.graph.model,
        tools: getAgentSelectorHelperTools(
          this.supervisorConfig,
          avaibleAgents.map((a) => a.profile)
        ),
        name: 'agentSelectorHelper',
        prompt:
          'You are an expert agent selection assistant. Your task is to help users choose the most suitable agent for their needs based on the provided requirements and context. Always consider the capabilities and specialties of each agent before making a recommendation.',
        stateSchema: SupervisorStateAnnotation,
        preModelHook: this.transformMessagesHook.bind(this),
      })
    );
    console.log(avaibleAgents);
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
      // Apply transformation to the supervisor as well
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
