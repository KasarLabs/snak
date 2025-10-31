import { DynamicStructuredTool } from '@langchain/core/tools';
import { Command } from '@langchain/langgraph';
import z from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { AIMessage, ToolMessage } from '@langchain/core/messages';

export function transferBackToSupervisorTool() {
  return new DynamicStructuredTool({
    name: 'transfer_back_to_supervisor',
    description:
      'Use this tool to transfer the conversation back to the supervisor agent for further handling.',
    schema: z.object({}),
    func: async () => {
      const tool_id = uuidv4();
      const aiMessage = new AIMessage(`Executing transfer_back_to_supervisor.`);
      aiMessage.tool_calls = [
        {
          id: tool_id,
          name: `transfer_back_to_supervisor`,
          args: {},
        },
      ];

      const tMessage = new ToolMessage({
        content: `Successfully transferred back to supervisor.`,
        tool_call_id: tool_id,
        name: `transfer_back_to_supervisor`,
      });
      // Logic to handle the transfer back to the supervisor agent
      return new Command({
        goto: 'supervisor',
        graph: Command.PARENT,
      });
    },
  });
}
