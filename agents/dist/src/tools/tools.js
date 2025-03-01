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
exports.createAllowedTools = exports.createTools = exports.registerTools = exports.initializeTools = exports.StarknetToolRegistry = void 0;
const tools_1 = require("@langchain/core/tools");
class StarknetToolRegistry {
    static registerTool(tool) {
        this.tools.push(tool);
    }
    static createTools(agent) {
        return this.tools.map(({ name, description, schema, execute }) => (0, tools_1.tool)(async (params) => execute(agent, params), {
            name,
            description,
            ...(schema && { schema }),
        }));
    }
    static async createAllowedTools(agent, allowed_tools) {
        await (0, exports.registerTools)(agent, allowed_tools, this.tools);
        return this.tools.map(({ name, description, schema, execute }) => (0, tools_1.tool)(async (params) => execute(agent, params), {
            name,
            description,
            ...(schema && { schema }),
        }));
    }
}
exports.StarknetToolRegistry = StarknetToolRegistry;
StarknetToolRegistry.tools = [];
const initializeTools = (agent) => { };
exports.initializeTools = initializeTools;
const registerTools = async (agent, allowed_tools, tools) => {
    try {
        let index = 0;
        await Promise.all(allowed_tools.map(async (tool) => {
            index = index + 1;
            const imported_tool = await Promise.resolve(`${`@starknet-agent-kit/plugin-${tool}`}`).then(s => __importStar(require(s)));
            if (typeof imported_tool.registerTools !== 'function') {
                return false;
            }
            await imported_tool.registerTools(tools);
            return true;
        }));
    }
    catch (error) {
        console.log(error);
    }
};
exports.registerTools = registerTools;
const createTools = (agent) => {
    return StarknetToolRegistry.createTools(agent);
};
exports.createTools = createTools;
const createAllowedTools = async (agent, allowed_tools) => {
    return StarknetToolRegistry.createAllowedTools(agent, allowed_tools);
};
exports.createAllowedTools = createAllowedTools;
exports.default = StarknetToolRegistry;
//# sourceMappingURL=tools.js.map