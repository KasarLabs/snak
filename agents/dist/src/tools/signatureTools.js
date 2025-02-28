"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSignatureTools = exports.RegisterSignatureTools = exports.StarknetSignatureToolRegistry = void 0;
const tools_1 = require("@langchain/core/tools");
class StarknetSignatureToolRegistry {
    static RegisterSignatureTools(tool) {
        this.tools.push(tool);
    }
    static async createSignatureTools(allowed_signature_tools) {
        await (0, exports.RegisterSignatureTools)(allowed_signature_tools, this.tools);
        return this.tools.map(({ name, description, schema, execute }) => {
            const toolInstance = (0, tools_1.tool)(async (params) => execute(params), {
                name,
                description,
                ...(schema && { schema }),
            });
            return toolInstance;
        });
    }
}
exports.StarknetSignatureToolRegistry = StarknetSignatureToolRegistry;
StarknetSignatureToolRegistry.tools = [];
const RegisterSignatureTools = async (allowed_signature_tools, tools) => {
    try {
        await Promise.all(allowed_signature_tools.map(async (tool) => {
            const imported_tool = await Promise.resolve(`${`@starknet-agent-kit/plugin-${tool}`}`).then(s => __importStar(require(s)));
            if (typeof imported_tool.registerSignatureTools !== 'function') {
                return false;
            }
            imported_tool.registerSignatureTools(tools);
            return true;
        }));
    }
    catch (error) {
        console.log(error);
    }
};
exports.RegisterSignatureTools = RegisterSignatureTools;
const createSignatureTools = async (allowed_signature_tools) => {
    return StarknetSignatureToolRegistry.createSignatureTools(allowed_signature_tools);
};
exports.createSignatureTools = createSignatureTools;
exports.default = StarknetSignatureToolRegistry;
//# sourceMappingURL=signatureTools.js.map