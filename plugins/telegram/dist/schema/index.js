"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTelegramMessageUpdateFromConversationSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.getTelegramMessageUpdateFromConversationSchema = zod_1.default.object({
    max_message: zod_1.default
        .number()
        .describe('The maximum massage you want to get from the channel by default is set to 10')
        .optional()
        .default(10),
    channel_id: zod_1.default
        .number()
        .describe('The id of the channel you want to get the message'),
});
//# sourceMappingURL=index.js.map