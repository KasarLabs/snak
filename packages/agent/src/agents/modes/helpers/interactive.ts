import { logger, AgentConfig } from '@snakagent/core';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import {
  BaseMessage,
  HumanMessage,
  AIMessageChunk,
} from '@langchain/core/messages';
import { ModelSelector } from 'agents/operators/modelSelector.js';
import { interactiveRules } from 'prompt/prompts.js';
import { TokenTracker } from 'token/tokenTracking.js';
import { MemoryAgent } from 'agents/operators/memoryAgent.js';
import { RagAgent } from 'agents/operators/ragAgent.js';
import { SupervisorAgent } from 'agents/supervisor/supervisorAgent.js';
import { formatAgentResponse, truncateToolResults } from 'agents/core/utils.js';

import { Tool, DynamicStructuredTool, StructuredTool } from '@langchain/core/tools';
import { AIMessage } from '@langchain/core/messages';

export async function getMemoryAgent(): Promise<MemoryAgent | null> {
  try {
    const supervisorAgent = SupervisorAgent.getInstance?.() || null;
    if (supervisorAgent) {
      return await supervisorAgent.getMemoryAgent();
    }
  } catch (error) {
    logger.error(`Failed to get memory agent: ${error}`);
  }
  return null;
}

export async function getRagAgent(): Promise<RagAgent | null> {
  try {
    const supervisorAgent = SupervisorAgent.getInstance?.() || null;
    if (supervisorAgent) {
      return await supervisorAgent.getRagAgent();
    }
  } catch (error) {
    logger.error(`Failed to get rag agent: ${error}`);
  }
  return null;
}

export interface CallModelParams {
  agent_config: AgentConfig;
  toolsList: (Tool | DynamicStructuredTool<any> | StructuredTool)[];
  modelSelector: ModelSelector | null;
  memoryAgent: MemoryAgent | null;
  ragAgent: RagAgent | null;
  finalPrompt: string;
}

export async function callModel<S extends { messages: BaseMessage[] }>(
  state: S,
  {
    agent_config,
    toolsList,
    modelSelector,
    memoryAgent,
    ragAgent,
    finalPrompt,
  }: CallModelParams
): Promise<{ messages: BaseMessage[] }> {
  if (!agent_config) {
    throw new Error('Agent configuration is required but not available');
  }

  const interactiveSystemPrompt = `
        ${interactiveRules}
        Available tools: ${toolsList.map((tool) => tool.name).join(', ')}
      `;
  const systemMessages: (string | MessagesPlaceholder | [string, string])[] = [
    [
      'system',
      `${finalPrompt.trim()}
        ${interactiveSystemPrompt}`.trim(),
    ],
  ];

  const lastUserMessage =
    [...state.messages].reverse().find((msg) => msg instanceof HumanMessage) ||
    state.messages[state.messages.length - 1];

  if (memoryAgent && lastUserMessage) {
    try {
      const memories = await memoryAgent.retrieveRelevantMemories(
        lastUserMessage,
        agent_config.chatId || 'default_chat',
        agent_config.id
      );
      if (memories?.length) {
        const memoryContext = memoryAgent.formatMemoriesForContext(memories);
        if (memoryContext.trim()) {
          systemMessages.push(['system', memoryContext]);
        }
      }
    } catch (error) {
      logger.error(`Error retrieving memory context: ${error}`);
    }
  }

  if (ragAgent && lastUserMessage) {
    try {
      const docs = await ragAgent.retrieveRelevantRag(
        lastUserMessage,
        agent_config.rag?.topK,
        agent_config.id
      );
      if (docs?.length) {
        const ragContext = ragAgent.formatRagForContext(docs);
        if (ragContext.trim()) {
          systemMessages.push(['system', ragContext]);
        }
      }
    } catch (error) {
      logger.error(`Error retrieving rag context: ${error}`);
    }
  }

  systemMessages.push(new MessagesPlaceholder('messages'));

  const prompt = ChatPromptTemplate.fromMessages(systemMessages);

  try {
    const filteredMessages = state.messages.filter(
      (msg) =>
        !(
          msg instanceof AIMessageChunk &&
          msg.additional_kwargs?.from === 'model-selector'
        )
    );

    const currentMessages = filteredMessages;

    if (modelSelector) {
      const originalUserMessage = currentMessages.find(
        (msg): msg is HumanMessage => msg instanceof HumanMessage
      );
      const originalUserQuery = originalUserMessage
        ? typeof originalUserMessage.content === 'string'
          ? originalUserMessage.content
          : JSON.stringify(originalUserMessage.content)
        : '';

      const selectedModelType = await modelSelector.selectModelForMessages(
        filteredMessages,
        { originalUserQuery }
      );

      const boundModel =
        typeof selectedModelType.model.bindTools === 'function'
          ? selectedModelType.model.bindTools(toolsList)
          : selectedModelType.model;

      const formattedPrompt = await prompt.formatMessages({
        messages: currentMessages,
      });

      const result = await boundModel.invoke(formattedPrompt);
      TokenTracker.trackCall(result, selectedModelType.model_name);
      return {
        messages: [...formattedPrompt, result],
      };
    } else {
      const existingModelSelector = ModelSelector.getInstance();
      if (existingModelSelector) {
        throw new Error('Model selection requires a configured ModelSelector');
      }
      logger.warn(
        'No model selector available, using direct provider selection is not supported without a ModelSelector.'
      );
      throw new Error('Model selection requires a configured ModelSelector');
    }
  } catch (error: any) {
    if (
      error instanceof Error &&
      (error.message.includes('token limit') ||
        error.message.includes('tokens exceed') ||
        error.message.includes('context length'))
    ) {
      logger.error(`Token limit error: ${error.message}`);
      logger.error(`Model invocation failed: ${error}`);
      throw error;
    }
    throw error;
  }
}

export function formatAIMessageResult(result: any): { messages: BaseMessage[] } {
  let finalResult = result;
  if (!(finalResult instanceof AIMessage)) {
    finalResult = new AIMessage({
      content:
        typeof finalResult.content === 'string'
          ? finalResult.content
          : JSON.stringify(finalResult.content),
      additional_kwargs: {
        from: 'snak',
        final: true,
      },
    });
  } else if (!finalResult.additional_kwargs) {
    finalResult.additional_kwargs = { from: 'snak', final: true };
  } else if (!finalResult.additional_kwargs.from) {
    finalResult.additional_kwargs.from = 'snak';
    finalResult.additional_kwargs.final = true;
  }

  const truncatedResultInstance = truncateToolResults(finalResult, 5000);
  const resultToLog = truncatedResultInstance || finalResult;

  if (
    resultToLog instanceof AIMessage ||
    (resultToLog && typeof resultToLog === 'object' && 'content' in resultToLog)
  ) {
    const content =
      typeof resultToLog.content === 'string'
        ? resultToLog.content
        : JSON.stringify(resultToLog.content || '');

    if (content?.trim()) {
      logger.info(`Agent Response:\n\n${formatAgentResponse(content)}`);
    }
  }
  return {
    messages: [result],
  };
}