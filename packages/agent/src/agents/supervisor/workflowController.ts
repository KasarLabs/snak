import { BaseMessage, HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import crypto from 'crypto';

public async stream(
  input: string | BaseMessage,
  config?: Record<string, any>
): Promise<AsyncIterable<any>> {
  this.executionId = crypto.randomUUID().substring(0, 8);
  logger.debug(
    `WorkflowController[Exec:${this.executionId}]: Starting streaming`
  );

  if (!this.initialized) {
    throw new Error('WorkflowController is not initialized');
  }

  const message = typeof input === 'string' ? new HumanMessage(input) : input;
  const threadId = config?.threadId || this.executionId;
  
  // Use "values" as mode by default for LangGraph v0.1.x+
  // to see all state updates including tool executions.
  const streamMode = config?.streamMode || 'values';

  logger.debug(
    `WorkflowController[Exec:${this.executionId}]: Using thread ID: ${threadId}, streamMode: ${streamMode}`
  );

  const initialAgent = 'snak'; // All streams start with 'snak' agent

  const runConfig = {
    configurable: { thread_id: threadId },
    recursionLimit: this.maxIterations * 2,
    streamMode, // Ensures streamMode is passed to the graph.stream() call
    toolStreamEnabled: true, // Flag for custom logic, ensure it's used or remove if not needed by LangGraph itself
    ...(config || {}), // Spread other config options
  };

  logger.debug(
    `WorkflowController[Exec:${this.executionId}]: Starting stream with initial agent: ${initialAgent}`
  );

  // Ensure the input to workflow.stream matches the graph's input schema
  const stream = this.workflow.stream(
    {
      messages: [message],
      currentAgent: initialAgent,
      metadata: { threadId }, // Example metadata, adjust as per graph state
      toolCalls: [], // Initialize as empty or based on context
      error: undefined, // Initialize as undefined
      iterationCount: 0, // Initialize iteration count
      // ... any other fields expected by the graph's GraphState
    },
    runConfig
  );

  // Transform the stream to add additional information about tools
  const self = this; // Capture 'this' for use in the async iterator
  return {
    [Symbol.asyncIterator]() {
      const iterator = stream[Symbol.asyncIterator]();
      return {
        async next() {
          try {
            const result = await iterator.next();
            
            if (result.done || !result.value) {
              return result;
            }
            
            const value = result.value;
            
            // If in mode "values" and we have a state containing messages
            // This check is based on the assumption that 'value' is the full graph state object
            // and that state object has a 'messages' array.
            if (streamMode === 'values' && value && Array.isArray(value.messages)) {
              const messages = value.messages as BaseMessage[];
              const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
              
              // Check if the last message is a ToolMessage or an AIMessage with tool_calls that just executed
              // The original prompt checks `lastMessage._getType() === 'tool'`.
              // ToolMessage is the direct result of a tool execution.
              if (lastMessage && lastMessage._getType && lastMessage._getType() === 'tool') {
                self.logToolResultEvent(value, lastMessage as ToolMessage);
                return {
                  value: {
                    ...value,
                    __tool_result: true,
                    toolName: (lastMessage as ToolMessage).name || (lastMessage as any).tool_call_id || 'unknown_tool',
                    // toolArgs: (lastMessage as ToolMessage).args, // if you need args too
                  },
                  done: false 
                };
              }
            }
            
            return result;
          } catch (error) {
            logger.error(`WorkflowController[Exec:${self.executionId}]: Stream iterator error: ${error}`);
            throw error;
          }
        }
      };
    }
  };
}

// Helper method for logging (optional, can be expanded)
private logToolResultEvent(value: any, toolMessage: ToolMessage) {
  logger.debug(
    `WorkflowController[Exec:${this.executionId}]: Stream event contains tool result. Tool: ${toolMessage.name || (toolMessage as any).tool_call_id}, State: ${Object.keys(value).join(', ')}`
  );
} 