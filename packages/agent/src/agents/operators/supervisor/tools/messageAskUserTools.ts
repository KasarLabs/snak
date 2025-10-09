import { DynamicStructuredTool } from '@langchain/core/tools';
import {
  MessageAskUserSchema,
  MessageAskUserType,
} from './schemas/message_ask_user.schema.js';
import { interrupt } from '@langchain/langgraph';
import { logger } from '@snakagent/core';

export function messageAskUserTool(): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'message_ask_user',
    description:
      'Ask user a question and wait for response. Use for requesting clarification, asking for confirmation, or gathering additional information. This tool creates an interrupt in the graph execution that pauses until the user provides a response.',
    schema: MessageAskUserSchema,
    func: async (input: MessageAskUserType) => {
      logger.info(
        `messageAskUserTool called with input: ${JSON.stringify(input)}`
      );
      // Prepare attachments if provided
      const attachments = input.attachments
        ? Array.isArray(input.attachments)
          ? input.attachments
          : [input.attachments]
        : [];

      // Create interrupt - this will pause execution and wait for user response
      // The interrupt() function returns the user's response when they resume
      const h_response = interrupt(input.text);

      // Build response object
      const response = {
        human_response: h_response,
        awaiting_response: false,
      };

      return JSON.stringify({
        success: true,
        message: 'Response received from user',
        data: response,
      });
    },
  });
}
