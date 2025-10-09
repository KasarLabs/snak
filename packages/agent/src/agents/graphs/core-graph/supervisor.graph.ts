import { DynamicStructuredTool } from '@langchain/core/tools';
import { CompiledStateGraph, StateGraph } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { Postgres } from '@snakagent/database';
import { AnyZodObject } from 'zod';
import { GraphError } from '../utils/error.utils.js';
import { SupervisorAgent } from '@agents/core/supervisorAgent.js';
import { logger } from 'starknet';
import { skipValidationType } from '@stypes/graph.types.js';
import { AgentConfig } from '@snakagent/core';
import { GraphConfigurableAnnotation, GraphState } from './agent.graph.js';
import { initializeDatabase } from '@agents/utils/database.utils.js';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { getSupervisorConfigTools } from '@agents/operators/supervisor/supervisorTools.js';
import { agent } from 'supertest';
import { createSupervisor } from '@langchain/langgraph-supervisor';
import { AIMessage, BaseMessage } from '@langchain/core/messages';

export class SupervisorGraph {
  private graph: CompiledStateGraph<any, any, any, any, any> | null = null;
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
      const workflow = this.buildWorkflow();
      const graph = workflow.compile({ checkpointer: this.checkpointer });
      logger.info('[SupervisorAgent] Successfully initialized agent');
      return graph;
    } catch (error) {
      logger.error('[SupervisorAgent] Failed to create agent:', error);
      throw error;
    }
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
   * Transforms messages to convert messages with 'name' field to standard AI messages.
   * This ensures compatibility with Google Generative AI which doesn't support 
   * custom author names as message types.
   */
  private transformMessagesHook(state: any): { llmInputMessages: BaseMessage[] } {
    const messages = state.messages || [];
    
    const transformedMessages = messages.map((msg: BaseMessage) => {
      // Check if message has a 'name' property that's not standard
      const messageName = msg.name;
      const msgType = msg._getType();
      
      // If it's an AI message with a custom name, we need to handle it
      if (messageName && (msgType === 'ai')) {
        logger.debug(
          `[SupervisorGraph] Processing AI message with name '${messageName}'`
        );
        
        // Remove the 'name' field to avoid Google API issues
        // The name is already preserved in the message history for routing
        return new AIMessage({
          content: msg.content,
          tool_calls: (msg as any).tool_calls || [],
          invalid_tool_calls: (msg as any).invalid_tool_calls || [],
          additional_kwargs: {
            ...msg.additional_kwargs,
            agent_name: messageName, // Preserve in metadata
          },
          response_metadata: msg.response_metadata,
        });
      }
      
      return msg;
    });

    return { llmInputMessages: transformedMessages };
  }

  private buildWorkflow(): StateGraph<any, any, any, any, any> {
    // Create the sub-agent with the same message transformer
    const agentConfigurationHelper = createReactAgent({
      llm: this.supervisorConfig.graph.model,
      tools: getSupervisorConfigTools(this.supervisorConfig),
      name: 'agentConfigurationHelper',
      prompt:
        'You are an expert agent configuration assistant. Your task is to help users create and modify agent configurations based on their requirements. Use the provided tools to fetch existing configurations, validate new configurations, and suggest improvements. Always ensure that the configurations adhere to best practices and are optimized for performance.',
      // Apply the same transformation to the sub-agent
      preModelHook: this.transformMessagesHook.bind(this),
    });
    
    const workflow = createSupervisor({
      agents: [agentConfigurationHelper],
      llm: this.supervisorConfig.graph.model,
      prompt:
        'You are a team supervisor managing a research expert and a math expert. ' +
        'For configuration modification, use agentConfigurationHelper',
      // Apply transformation to the supervisor as well
      preModelHook: this.transformMessagesHook.bind(this),
    });
    
    return workflow;
  }
}

export const createSupervisorGraph = async (
  supervisorAgent: SupervisorAgent
): Promise<CompiledStateGraph<any, any, any, any, any>> => {
  const agent = new SupervisorGraph(supervisorAgent);
  return agent.initialize();
};