import {
  DiscordChannelSearchTool,
  DiscordGetGuildsTool,
  DiscordGetMessagesTool,
  DiscordGetTextChannelsTool,
  DiscordSendMessagesTool,
} from '@langchain/community/tools/discord';
import { Tool } from '@langchain/core/tools';

const DiscordToolKits = (): Tool[] => {
  return [
    new DiscordSendMessagesTool(),
    new DiscordGetGuildsTool(),
    new DiscordChannelSearchTool(),
    new DiscordGetMessagesTool(),
    new DiscordGetTextChannelsTool(),
  ];
};

export const createAllowedToollkits = async (
  Toolkits?: string[]
): Promise<Tool[]> => {
  const allowedToolsKits: Tool[] = [];
  if (!Array.isArray(Toolkits)) {
    return allowedToolsKits;
  }
  Toolkits.forEach((tools_kit) => {
    if (tools_kit === 'discord') {
      const discord_tools = DiscordToolKits();
      discord_tools.forEach((tool) => {
        allowedToolsKits.push(tool);
      });
    }
  });
  return allowedToolsKits;
};
