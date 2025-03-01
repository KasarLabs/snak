"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTools = void 0;
const telegram_1 = require("../actions/telegram");
const schema_1 = require("../schema");
const registerTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'telegram_get_messages_from_conversation',
        plugins: 'telegram',
        description: 'Get the lates messages of telegram channel',
        schema: schema_1.getTelegramMessageUpdateFromConversationSchema,
        execute: telegram_1.telegram_get_messages_from_conversation,
    });
};
exports.registerTools = registerTools;
//# sourceMappingURL=index.js.map