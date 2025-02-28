"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseMessage = void 0;
const common_1 = require("@nestjs/common");
const ResponseMessage = (message) => (0, common_1.SetMetadata)('response_message', message);
exports.ResponseMessage = ResponseMessage;
//# sourceMappingURL=reponse_message.js.map