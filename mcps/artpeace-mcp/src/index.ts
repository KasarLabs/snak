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
import { Account, constants, Contract } from 'starknet';
import { artpeaceAbi } from './abis/artpeaceAbi.js';
import { artpeaceAddr } from './constants/artpeace.js';
import { ArtpeaceHelper } from './utils/helper.js';
import { placePixelParam, placePixelSchema } from './schema/index.js';
import { Checker } from './utils/checker.js';

// Initialize the MCP server
const server = new Server({
  name: "artpeace-mcp-server",
  version: "0.0.1",
  description: "MCP server for collaborative pixel art creation on a shared canvas using the Artpeace contract on Starknet."
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {}
  }
});

// Define schemas for validation
const placePixelMCPSchema = z.object({
  params: z.array(z.object({
    canvasId: z.union([z.number(), z.string()]).optional().nullable().default(0),
    xPos: z.number().optional().nullable(),
    yPos: z.number().optional().nullable(),
    color: z.string().optional().nullable().default('0'),
  }))
});

// Tool: Place pixel on Artpeace canvas
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "place_pixel",
        description: "Places a pixel on the Artpeace collaborative canvas, all parameters are optional",
        inputSchema: {
          type: "object",
          properties: {
            params: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  canvasId: {
                    type: ["number", "string"],
                    description: "The id or the unique name of the world to dispose the pixel"
                  },
                  xPos: {
                    type: "number",
                    description: "The position on x axe of the pixel"
                  },
                  yPos: {
                    type: "number",
                    description: "The position on y axe of the pixel"
                  },
                  color: {
                    type: "string",
                    description: "The color of the pixel by name or by hexadecimal"
                  }
                }
              },
              description: "Array of parameter to place one or multiple pixel, all parameters are optional"
            }
          },
          required: ["params"]
        }
      },
      {
        name: "place_pixel_signature",
        description: "Generates transaction signature data for placing pixels on Artpeace canvas",
        inputSchema: {
          type: "object",
          properties: {
            params: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  canvasId: {
                    type: ["number", "string"],
                    description: "The id or the unique name of the world to dispose the pixel"
                  },
                  xPos: {
                    type: "number",
                    description: "The position on x axe of the pixel"
                  },
                  yPos: {
                    type: "number",
                    description: "The position on y axe of the pixel"
                  },
                  color: {
                    type: "string",
                    description: "The color of the pixel by name or by hexadecimal"
                  }
                }
              },
              description: "Array of parameter to place one or multiple pixel, all parameters are optional"
            }
          },
          required: ["params"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "place_pixel": {
        const { params } = placePixelMCPSchema.parse(args);

        // Get account credentials from environment variables
        const accountPublicKey = process.env.STARKNET_ACCOUNT_PUBLIC_KEY;
        const accountPrivateKey = process.env.STARKNET_ACCOUNT_PRIVATE_KEY;

        if (!accountPublicKey || !accountPrivateKey) {
          throw new Error('STARKNET_ACCOUNT_PUBLIC_KEY and STARKNET_ACCOUNT_PRIVATE_KEY environment variables are required');
        }

        const provider = new (await import('starknet')).RpcProvider({
          nodeUrl: process.env.STARKNET_RPC_URL || 'https://starknet-mainnet.infura.io/v3/your-api-key'
        });

        const account = new Account(
          provider,
          accountPublicKey,
          accountPrivateKey,
          undefined,
          constants.TRANSACTION_VERSION.V3
        );

        const artpeaceContract = new Contract(artpeaceAbi, artpeaceAddr, provider);
        const checker = new Checker(params[0].canvasId || 0);
        const id = await checker.checkWorld();
        await checker.getColors();

        const txHash = [];
        for (const param of params) {
          const { position, color } = await ArtpeaceHelper.validateAndFillDefaults(
            param,
            checker
          );
          const timestamp = Math.floor(Date.now() / 1000);

          artpeaceContract.connect(account);
          const call = artpeaceContract.populate('place_pixel', {
            canvas_id: id,
            pos: position,
            color: color,
            now: timestamp,
          });

          const res = await account.execute(call);
          await provider.waitForTransaction(res.transaction_hash);
          txHash.push(res.transaction_hash);
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: 'success',
              transaction_hash: txHash,
            }, null, 2)
          }]
        };
      }

      case "place_pixel_signature": {
        const { params } = placePixelMCPSchema.parse(args);
        const checker = new Checker(params[0].canvasId || 0);
        const id = await checker.checkWorld();
        await checker.getColors();
        let timestamp = Math.floor(Date.now() / 1000);

        const results = [];
        for (const param of params) {
          if (param.color === '255') continue;
          const { position, color } = await ArtpeaceHelper.validateAndFillDefaults(
            param,
            checker
          );

          const call = {
            status: 'success',
            transactions: {
              contractAddress: artpeaceAddr,
              entrypoint: 'place_pixel',
              calldata: [id, position, color, timestamp],
            },
          };

          timestamp = timestamp + 5;
          results.push({
            status: 'success',
            transactions: {
              ...call,
            },
          });
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ transaction_type: 'INVOKE', results }, null, 2)
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

// Resource: Artpeace canvas information
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "artpeace://canvas-info",
        name: "artpeace-canvas-info",
        description: "Information about Artpeace collaborative canvas and pixel placement",
        mimeType: "text/plain"
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
  const { uri } = request.params;

  if (uri === "artpeace://canvas-info") {
    return {
      contents: [{
        uri: uri,
        mimeType: "text/plain",
        text: `Artpeace Collaborative Canvas Information

Artpeace is a collaborative pixel art platform on Starknet where users can place pixels on shared canvases.

Key Features:
- Collaborative pixel art creation
- Multiple canvas worlds
- Color palette management
- Real-time pixel placement
- Transaction-based pixel placement

Contract Address: ${artpeaceAddr}

Available Operations:
1. Place pixel - Places a pixel on the canvas with specified coordinates and color
2. Place pixel signature - Generates transaction data for pixel placement

Environment Variables:
- STARKNET_RPC_URL: Starknet RPC endpoint
- STARKNET_ACCOUNT_PUBLIC_KEY: Your Starknet account public key
- STARKNET_ACCOUNT_PRIVATE_KEY: Your Starknet account private key

API Endpoints:
- World information: https://api.art-peace.net/get-world
- Color palette: https://api.art-peace.net/get-worlds-colors
- World ID lookup: https://api.art-peace.net/get-world-id

Usage:
- All parameters are optional and will use random/default values if not provided
- Canvas ID can be a number or world name string
- Colors can be specified as hex codes, color names, or palette indices
- Multiple pixels can be placed in a single transaction
`
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
        name: "place_random_pixel",
        description: "Place a pixel at a random location on the canvas",
        arguments: [
          {
            name: "canvasId",
            description: "The canvas ID or world name",
            required: false
          },
          {
            name: "color",
            description: "The color for the pixel",
            required: false
          }
        ]
      },
      {
        name: "place_pixel_at_position",
        description: "Place a pixel at specific coordinates",
        arguments: [
          {
            name: "canvasId",
            description: "The canvas ID or world name",
            required: false
          },
          {
            name: "xPos",
            description: "X coordinate",
            required: true
          },
          {
            name: "yPos",
            description: "Y coordinate",
            required: true
          },
          {
            name: "color",
            description: "The color for the pixel",
            required: false
          }
        ]
      },
      {
        name: "generate_pixel_signature",
        description: "Generate transaction signature for pixel placement",
        arguments: [
          {
            name: "canvasId",
            description: "The canvas ID or world name",
            required: false
          },
          {
            name: "xPos",
            description: "X coordinate",
            required: false
          },
          {
            name: "yPos",
            description: "Y coordinate",
            required: false
          },
          {
            name: "color",
            description: "The color for the pixel",
            required: false
          }
        ]
      }
    ]
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request: GetPromptRequest) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "place_random_pixel": {
      const { canvasId, color } = args || {};
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Please place a pixel at a random location on the Artpeace canvas${canvasId ? ` (canvas: ${canvasId})` : ''}${color ? ` with color ${color}` : ''}`
          }
        }]
      };
    }

    case "place_pixel_at_position": {
      const { canvasId, xPos, yPos, color } = args || {};
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Please place a pixel at position (${xPos}, ${yPos}) on the Artpeace canvas${canvasId ? ` (canvas: ${canvasId})` : ''}${color ? ` with color ${color}` : ''}`
          }
        }]
      };
    }

    case "generate_pixel_signature": {
      const { canvasId, xPos, yPos, color } = args || {};
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Please generate a transaction signature for placing a pixel${xPos && yPos ? ` at position (${xPos}, ${yPos})` : ' at a random location'} on the Artpeace canvas${canvasId ? ` (canvas: ${canvasId})` : ''}${color ? ` with color ${color}` : ''}`
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
console.log("Artpeace MCP Server started successfully");
