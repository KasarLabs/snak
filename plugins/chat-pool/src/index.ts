// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { chat } from "./database.js";

// Initialize the MCP server
const server = new McpServer({
  name: "chat-pool-server",
  version: "0.0.7",
  description: "MCP server for storing and retrieving chat instructions in a database, enabling persistent chat data."
});

// Initialize the database
try {
  await chat.init();
  console.log("Chat pool database initialized successfully");
} catch (error) {
  console.error("Failed to initialize chat-pool database:", error);
  process.exit(1);
}

// Tool: Insert chat instruction
server.tool(
  "insert_chat_instruction",
  {
    instruction: z.string().describe("The chat instruction to store")
  },
  async ({ instruction }) => {
    try {
      await chat.insert_instruction(instruction);
      return {
        content: [{
          type: "text",
          text: "Chat instruction inserted successfully"
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error inserting chat instruction: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Tool: Read chat pool (get all instructions)
server.tool(
  "read_chat_pool",
  {},
  async () => {
    try {
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
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error reading chat pool: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Resource: Chat pool instructions (dynamic resource)
server.resource(
  "chat-instructions",
  "chat-pool://instructions",
  async (uri) => {
    try {
      const instructions = await chat.select_instructions();
      const instructionTexts = instructions.map(row => row.instruction);

      return {
        contents: [{
          uri: uri.href,
          mimeType: "text/plain",
          text: instructionTexts.length > 0
            ? instructionTexts.join('\n\n---\n\n')
            : "No chat instructions available"
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          mimeType: "text/plain",
          text: `Error loading chat instructions: ${error}`
        }]
      };
    }
  }
);

// Prompt: Create instruction prompt
server.prompt(
  "create_instruction",
  { instruction: z.string().describe("The instruction to save") },
  ({ instruction }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Save this instruction to the chat pool: "${instruction}"`
      }
    }]
  })
);

// Prompt: Review instructions prompt
server.prompt(
  "review_instructions",
  {},
  () => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: "Please show me all the chat instructions currently stored in the pool"
      }
    }]
  })
);

// Connect to stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);

console.log("Chat Pool MCP Server started successfully");
