import { StateGraph, MemorySaver, Annotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
} from '@langchain/core/messages';
import { logger, AgentConfig } from '@snakagent/core';
import { SnakAgentInterface } from 'tools/tools.js';
import {
  initializeToolsList,
  initializeDatabase,
  wrapToolNodeInvoke,
} from 'agents/core/utils.js';
import { ModelSelector } from 'agents/operators/modelSelector.js';
import { AgentReturn } from './autonomous.js';
import { MemoryAgent } from 'agents/operators/memoryAgent.js';
import { RagAgent } from 'agents/operators/ragAgent.js';
import {
  getMemoryAgent,
  getRagAgent,
  callModel as callModelHelper,
} from './helpers/interactive.js';


/**
 * Creates and configures an interactive agent.
 * @param snakAgent - The SnakAgentInterface instance.
 * @param modelSelector - An optional ModelSelector instance for dynamic model selection.
 * @returns A promise that resolves to the compiled agent application.
 * @throws Will throw an error if agent configuration is missing or invalid.
 */
export const createInteractiveAgent = async (
  snakAgent: SnakAgentInterface,
  modelSelector: ModelSelector | null
): Promise<AgentReturn> => {
  try {
    const agent_config: AgentConfig = snakAgent.getAgentConfig();
    if (!agent_config) {
      throw new Error('Agent configuration is required');
    }

    await initializeDatabase(snakAgent.getDatabaseCredentials());

    const toolsList = await initializeToolsList(snakAgent, agent_config);

    let memoryAgent: MemoryAgent | null = null;
    if (agent_config.memory) {
      memoryAgent = await getMemoryAgent();
      if (memoryAgent) {
        logger.debug('Successfully retrieved memory agent');
        toolsList.push(...memoryAgent.prepareMemoryTools());
      } else {
        logger.warn('Memory agent not available, memory features will be limited');
      }
    }

    let ragAgent: RagAgent | null = null;
    if (agent_config.rag?.enabled !== false) {
      ragAgent = await getRagAgent();
      if (!ragAgent) {
        logger.warn('Rag agent not available, rag context will be skipped');
      }
    }

    const GraphState = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
      }),
      memories: Annotation<string>,
      rag: Annotation<string>,
    });

    const toolNode = new ToolNode(toolsList);
    wrapToolNodeInvoke(toolNode);

    const configPrompt = agent_config.prompt?.content || '';
    const finalPrompt = `${configPrompt}`;

    const callModel = (state: typeof GraphState.State) =>
      callModelHelper(state, {
        agent_config,
        toolsList,
        modelSelector,
        memoryAgent,
        ragAgent,
        finalPrompt,
      });

    /**
     * Determines the next step in the workflow based on the last message.
     * If the last message contains tool calls, it routes to the 'tools' node.
     * Otherwise, it ends the execution.
     * @param state - The current state of the graph.
     * @returns 'tools' if tool calls are present, otherwise 'end'.
     */
    function shouldContinue(state: typeof GraphState.State) {
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1] as AIMessage;
      if (lastMessage.tool_calls?.length) {
        logger.debug(
          `Detected ${lastMessage.tool_calls.length} tool calls, routing to tools node.`
        );
        return 'tools';
      }
      return 'end';
    }

    let workflow = new StateGraph(GraphState)
      .addNode('agent', callModel)
      .addNode('tools', toolNode);

    if (agent_config.memory && memoryAgent) {
      workflow = (workflow as any)
        .addNode('memory', memoryAgent.createMemoryNode())
        .addEdge('__start__', 'memory');
      if (ragAgent) {
        workflow = (workflow as any)
          .addNode('ragNode', ragAgent.createRagNode(agent_config.id))
          .addEdge('memory', 'ragNode')
          .addEdge('ragNode', 'agent');
      } else {
        workflow = (workflow as any).addEdge('memory', 'agent');
      }
    } else if (ragAgent) {
      workflow = (workflow as any)
        .addNode('ragNode', ragAgent.createRagNode(agent_config.id))
        .addEdge('__start__', 'ragNode')
        .addEdge('ragNode', 'agent');
    } else {
      workflow = (workflow as any).addEdge('__start__', 'agent');
    }

    workflow
      .addConditionalEdges('agent', shouldContinue)
      .addEdge('tools', 'agent');

    const checkpointer = new MemorySaver();
    const app = workflow.compile({
      ...(agent_config.memory
        ? {
            checkpointer: checkpointer,
            configurable: {},
          }
        : {}),
    });
    return {
      app,
      agent_config,
    };
  } catch (error) {
    logger.error('Failed to create an interactive agent:', error);
    throw error;
  }
};
