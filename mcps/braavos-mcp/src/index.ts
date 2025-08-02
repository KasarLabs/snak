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
import { CreateBraavosAccount, CreateBraavosAccountSignature } from "./actions/createAccount.js";
import { DeployBraavosAccountSignature } from "./actions/deployAccount.js";
import { accountDetailsSchema } from "./schemas/schema.js";

const server = new Server({
  name: "braavos-mcp-server",
  version: "0.0.1",
  description: "MCP server for creating and deploying Braavos wallet accounts on Starknet."
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {}
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_new_braavos_account",
        description: "Create a new Braavos account and return the privateKey/publicKey/contractAddress.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "create_braavos_account_with_fee",
        description: "Create a new Braavos account and estimate deployment fee.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "deploy_existing_braavos_account",
        description: "Deploy an existing Braavos account.",
        inputSchema: {
          type: "object",
          properties: {
            contractAddress: { type: "string", description: "The starknet address of the account's contract" },
            publicKey: { type: "string", description: "The public key of the braavos account" },
            privateKey: { type: "string", description: "The private key of the braavos account" }
          },
          required: ["contractAddress", "publicKey", "privateKey"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  try {
    const { name, arguments: args } = request.params;
    switch (name) {
      case "create_new_braavos_account": {
        const result = await CreateBraavosAccount();
        return { content: [{ type: "text", text: result }] };
      }
      case "create_braavos_account_with_fee": {
        const result = await CreateBraavosAccountSignature();
        return { content: [{ type: "text", text: result }] };
      }
      case "deploy_existing_braavos_account": {
        const params = accountDetailsSchema.parse(args);
        const result = await DeployBraavosAccountSignature(params);
        return { content: [{ type: "text", text: result }] };
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

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "braavos://account-info",
        name: "braavos-account-info",
        description: "Information about Braavos account creation and deployment.",
        mimeType: "application/json"
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
  const { uri } = request.params;
  if (uri === "braavos://account-info") {
    return {
      contents: [{
        uri: uri,
        mimeType: "application/json",
        text: JSON.stringify({
          name: "Braavos Wallet",
          description: "Smart contract wallet for Starknet with multi-sig and social recovery.",
          features: [
            "Account creation",
            "Account deployment",
            "Fee estimation",
            "Multi-signature",
            "Social recovery"
          ]
        }, null, 2)
      }]
    };
  }
  throw new Error(`Unknown resource: ${uri}`);
});

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "create_braavos_account",
        description: "Create a new Braavos account.",
        arguments: []
      },
      {
        name: "deploy_braavos_account",
        description: "Deploy an existing Braavos account.",
        arguments: [
          { name: "contractAddress", description: "The account contract address", required: true },
          { name: "publicKey", description: "The public key", required: true },
          { name: "privateKey", description: "The private key", required: true }
        ]
      }
    ]
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request: GetPromptRequest) => {
  const { name, arguments: args } = request.params;
  switch (name) {
    case "create_braavos_account":
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: "Please create a new Braavos account for me."
          }
        }]
      };
    case "deploy_braavos_account":
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Please deploy my Braavos account with contract address ${args?.contractAddress}, public key ${args?.publicKey}, and private key ${args?.privateKey}.`
          }
        }]
      };
    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.log("Braavos MCP Server started successfully");
