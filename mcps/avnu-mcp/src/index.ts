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
import { RpcProvider } from "starknet";
import { swapTokens } from "./actions/swap.js";
import { getRoute } from "./actions/fetchRoute.js";

// Initialize the MCP server
const server = new Server({
  name: "avnu-mcp-server",
  version: "0.0.1",
  description: "MCP server for interacting with the AVNU decentralized exchange, enabling token swaps and routing."
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {}
  }
});

// Define schemas for validation
const swapTokensSchema = z.object({
  sellTokenSymbol: z.string().describe("Symbol of the token to sell (e.g., 'ETH', 'USDC')"),
  buyTokenSymbol: z.string().describe("Symbol of the token to buy (e.g., 'ETH', 'USDC')"),
  sellAmount: z.number().positive().describe("Amount of tokens to sell")
});

const getRouteSchema = z.object({
  sellTokenSymbol: z.string().describe("Symbol of the token to sell (e.g., 'ETH', 'USDC')"),
  buyTokenSymbol: z.string().describe("Symbol of the token to buy (e.g., 'ETH', 'USDC')"),
  sellAmount: z.number().positive().describe("Amount of tokens to sell")
});

// Tool: Swap tokens
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "avnu_swap_tokens",
        description: "Swap a specified amount of one token for another token using AVNU DEX",
        inputSchema: {
          type: "object",
          properties: {
            sellTokenSymbol: {
              type: "string",
              description: "Symbol of the token to sell (e.g., 'ETH', 'USDC')"
            },
            buyTokenSymbol: {
              type: "string",
              description: "Symbol of the token to buy (e.g., 'ETH', 'USDC')"
            },
            sellAmount: {
              type: "number",
              description: "Amount of tokens to sell"
            }
          },
          required: ["sellTokenSymbol", "buyTokenSymbol", "sellAmount"]
        }
      },
      {
        name: "avnu_get_route",
        description: "Get a specific route for token swapping on AVNU",
        inputSchema: {
          type: "object",
          properties: {
            sellTokenSymbol: {
              type: "string",
              description: "Symbol of the token to sell (e.g., 'ETH', 'USDC')"
            },
            buyTokenSymbol: {
              type: "string",
              description: "Symbol of the token to buy (e.g., 'ETH', 'USDC')"
            },
            sellAmount: {
              type: "number",
              description: "Amount of tokens to sell"
            }
          },
          required: ["sellTokenSymbol", "buyTokenSymbol", "sellAmount"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  try {
    const { name, arguments: args } = request.params;

    // Get environment variables for Starknet configuration
    const rpcUrl = process.env.STARKNET_RPC_URL || "https://alpha-mainnet.starknet.io";
    const walletAddress = process.env.STARKNET_WALLET_ADDRESS;
    const privateKey = process.env.STARKNET_PRIVATE_KEY;

    if (!walletAddress || !privateKey) {
      throw new Error("STARKNET_WALLET_ADDRESS and STARKNET_PRIVATE_KEY environment variables must be set");
    }

    const provider = new RpcProvider({ nodeUrl: rpcUrl });

    switch (name) {
      case "avnu_swap_tokens": {
        const { sellTokenSymbol, buyTokenSymbol, sellAmount } = swapTokensSchema.parse(args);
        const result = await swapTokens(provider, walletAddress, privateKey, {
          sellTokenSymbol,
          buyTokenSymbol,
          sellAmount
        });
        return {
          content: [{
            type: "text",
            text: result
          }]
        };
      }

      case "avnu_get_route": {
        const { sellTokenSymbol, buyTokenSymbol, sellAmount } = getRouteSchema.parse(args);
        const result = await getRoute(provider, walletAddress, {
          sellTokenSymbol,
          buyTokenSymbol,
          sellAmount
        });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result)
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

// Resource: AVNU exchange information
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "avnu://exchange-info",
        name: "avnu-exchange-info",
        description: "Information about the AVNU decentralized exchange",
        mimeType: "application/json"
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
  const { uri } = request.params;

  if (uri === "avnu://exchange-info") {
    return {
      contents: [{
        uri: uri,
        mimeType: "application/json",
        text: JSON.stringify({
          name: "AVNU",
          description: "Decentralized exchange on Starknet",
          features: [
            "Token swapping",
            "Route finding",
            "Best price discovery",
            "MEV protection"
          ],
          supportedTokens: [
            "ETH", "USDC", "USDT", "DAI", "WBTC"
          ]
        }, null, 2)
      }]
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// Prompts
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "swap_eth_for_usdc",
        description: "Swap ETH for USDC on AVNU",
        arguments: [
          {
            name: "amount",
            description: "Amount of ETH to swap",
            required: true
          }
        ]
      },
      {
        name: "get_swap_route",
        description: "Get the best route for a token swap",
        arguments: [
          {
            name: "sellToken",
            description: "Token to sell",
            required: true
          },
          {
            name: "buyToken",
            description: "Token to buy",
            required: true
          },
          {
            name: "amount",
            description: "Amount to sell",
            required: true
          }
        ]
      }
    ]
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request: GetPromptRequest) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "swap_eth_for_usdc": {
      const amount = args?.amount || "1";
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `I want to swap ${amount} ETH for USDC on AVNU. Can you help me with this?`
          }
        }]
      };
    }

    case "get_swap_route": {
      const sellToken = args?.sellToken || "ETH";
      const buyToken = args?.buyToken || "USDC";
      const amount = args?.amount || "1";
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `I want to find the best route to swap ${amount} ${sellToken} for ${buyToken} on AVNU. Can you help me get the route information?`
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
console.log("AVNU MCP Server started successfully");
