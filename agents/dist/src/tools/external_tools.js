"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAllowedToollkits = void 0;
const discord_1 = require("@langchain/community/tools/discord");
const DiscordToolKits = () => {
    return [
        new discord_1.DiscordSendMessagesTool(),
        new discord_1.DiscordGetGuildsTool(),
        new discord_1.DiscordChannelSearchTool(),
        new discord_1.DiscordGetMessagesTool(),
        new discord_1.DiscordGetTextChannelsTool(),
    ];
};
const createAllowedToollkits = (Toolkits, allowed_external_tool) => {
    let allowedToolsKits = [];
    if (!Array.isArray(Toolkits)) {
        return allowedToolsKits;
    }
    Toolkits.forEach((tools_kit) => {
        if (tools_kit === 'discord') {
            const discord_tools = !Array.isArray(allowed_external_tool)
                ? DiscordToolKits()
                : DiscordToolKits().filter((tool) => allowed_external_tool.includes(tool.name));
            discord_tools.forEach((tool) => {
                allowedToolsKits.push(tool);
            });
        }
    });
    return allowedToolsKits;
};
exports.createAllowedToollkits = createAllowedToollkits;
//# sourceMappingURL=external_tools.js.map