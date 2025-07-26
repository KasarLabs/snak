// src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CallToolRequest,
  ReadResourceRequest,
  GetPromptRequest
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { chat } from "./database.js";

// Initialize the database
try {
  await chat.init();
  console.log("Chat pool database initialized successfully");
} catch (error) {
  console.error("Failed to initialize chat-pool database:", error);
  process.exit(1);
}

// Initialize the MCP server
const server = new Server({
  name: "chat-pool-server",
  version: "0.0.7",
  description: "MCP server for storing and retrieving chat instructions in a database, enabling persistent chat data."
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {}
  }
});

// Define schemas for validation
const insertInstructionSchema = z.object({
  instruction: z.string().describe("The chat instruction to store")
});

const createInstructionPromptSchema = z.object({
  instruction: z.string().describe("The instruction to save")
});

// Tool: Insert chat instruction
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "insert_chat_instruction",
        description: "Insert a chat instruction into the database",
        inputSchema: {
          type: "object",
          properties: {
            instruction: {
              type: "string",
              description: "The chat instruction to store"
            }
          },
          required: ["instruction"]
        }
      },
      {
        name: "read_chat_pool",
        description: "Read all chat instructions from the database",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "insert_chat_instruction": {
        const { instruction } = insertInstructionSchema.parse(args);
        await chat.insert_instruction(instruction);
        return {
          content: [{
            type: "text",
            text: "Chat instruction inserted successfully"
          }]
        };
      }

      case "read_chat_pool": {
        const instructions = await chat.select_instructions();
        const instructionTexts = instructions.map(row => row.instruction);
        return {
          content: [{
            type: "text",
            text: instructionTexts.length > 0
              ? `Found ${instructionTexts.length} chat instructions:\n${instructionTexts.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}`
              : "No chat instructions found in the pool"
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
});

// Resource: Chat pool instructions
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "chat-pool://instructions",
        name: "chat-instructions",
        description: "All chat instructions stored in the pool",
        mimeType: "text/plain"
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
  const { uri } = request.params;

  if (uri === "chat-pool://instructions") {
    try {
      const instructions = await chat.select_instructions();
      const instructionTexts = instructions.map(row => row.instruction);
      return {
        contents: [{
          uri: uri,
          mimeType: "text/plain",
          text: instructionTexts.length > 0
            ? instructionTexts.join('\n\n---\n\n')
            : "No chat instructions available"
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri,
          mimeType: "text/plain",
          text: `Error loading chat instructions: ${error}`
        }]
      };
    }
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// Prompts
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "create_instruction",
        description: "Create and save a new chat instruction",
        arguments: [
          {
            name: "instruction",
            description: "The instruction to save",
            required: true
          }
        ]
      },
      {
        name: "review_instructions",
        description: "Review all stored chat instructions",
        arguments: []
      }
    ]
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request: GetPromptRequest) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "create_instruction": {
      const { instruction } = createInstructionPromptSchema.parse(args || {});
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Save this instruction to the chat pool: "${instruction}"`
          }
        }]
      };
    }

    case "review_instructions": {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: "Please show me all the chat instructions currently stored in the pool"
          }
        }]
      };
    }

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

// Connect to stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
console.log("Chat Pool MCP Server started successfully");
