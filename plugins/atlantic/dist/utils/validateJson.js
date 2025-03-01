"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateJson = validateJson;
async function validateJson(content) {
    try {
        if (!content.startsWith('{') && !content.startsWith('[')) {
            return false;
        }
        JSON.parse(content);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=validateJson.js.map