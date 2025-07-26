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
import { getProofService } from './actions/getProofService.js';
import { verifyProofService } from './actions/verifyProofService.js';
import { GetProofServiceSchema, VerifyProofServiceSchema } from './schema/index.js';
import { ATLANTIC_URL, DASHBOARD_URL } from './constants/atlantic.js';

// Initialize the MCP server
const server = new Server({
  name: "atlantic-mcp-server",
  version: "0.0.1",
  description: "MCP server for working with zero-knowledge proofs via the Atlantic proof service."
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {}
  }
});

// Tool: Generate and verify proofs using Atlantic service
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_proof_service",
        description: "Query atlantic api to generate a proof from '.zip' file on starknet and return the query id",
        inputSchema: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "The filename you wish to generate the proof"
            }
          },
          required: ["filename"]
        }
      },
      {
        name: "verify_proof_service",
        description: "Query atlantic api to verify a proof from '.json' file on starknet and return the query id",
        inputSchema: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "The filename you wish to verify the proof"
            },
            memoryVerification: {
              type: "string",
              description: "Type of public memory verification"
            }
          },
          required: ["filename", "memoryVerification"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "get_proof_service": {
        const { filename } = GetProofServiceSchema.parse(args);
        const result = await getProofService({ filename });

        return {
          content: [{
            type: "text",
            text: result
          }]
        };
      }

      case "verify_proof_service": {
        const { filename, memoryVerification } = VerifyProofServiceSchema.parse(args);
        const result = await verifyProofService({ filename, memoryVerification });

        return {
          content: [{
            type: "text",
            text: result
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

// Resource: Atlantic proof service information
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "atlantic://proof-service-info",
        name: "atlantic-proof-service-info",
        description: "Information about Atlantic proof service and zero-knowledge proofs",
        mimeType: "text/plain"
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
  const { uri } = request.params;

  if (uri === "atlantic://proof-service-info") {
    return {
      contents: [{
        uri: uri,
        mimeType: "text/plain",
        text: `Atlantic Proof Service Information

Atlantic is a zero-knowledge proof service that provides proof generation and verification capabilities for Starknet.

Key Features:
- Zero-knowledge proof generation from ZIP files
- Proof verification from JSON files
- Integration with Starknet ecosystem
- Dashboard for tracking proof status

API Endpoints:
- Proof Generation: ${ATLANTIC_URL}/v1/proof-generation
- Proof Verification: ${ATLANTIC_URL}/v1/l2/atlantic-query/proof-verification
- Dashboard: ${DASHBOARD_URL}

Available Operations:
1. Generate Proof - Creates a zero-knowledge proof from a ZIP file
2. Verify Proof - Verifies a proof from a JSON file

Environment Variables:
- ATLANTIC_API_KEY: Your Atlantic API key (required)
- PATH_UPLOAD_DIR: Directory path for uploaded files (required)
- SECRET_PHRASE: Optional secret phrase for file hashing

File Requirements:
- Proof Generation: Requires a valid ZIP file with proof generation data
- Proof Verification: Requires a valid JSON file with proof data and memory verification

Supported Formats:
- Input: ZIP files for proof generation
- Output: JSON files for proof verification
- Prover: Starkware SHARP
- Layout: Recursive
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
        name: "generate_proof",
        description: "Generate a zero-knowledge proof from a ZIP file",
        arguments: [
          {
            name: "filename",
            description: "The filename of the ZIP file to generate proof from",
            required: true
          }
        ]
      },
      {
        name: "verify_proof",
        description: "Verify a zero-knowledge proof from a JSON file",
        arguments: [
          {
            name: "filename",
            description: "The filename of the JSON file containing the proof",
            required: true
          },
          {
            name: "memoryVerification",
            description: "Type of public memory verification",
            required: true
          }
        ]
      },
      {
        name: "check_proof_status",
        description: "Check the status of a proof generation or verification",
        arguments: [
          {
            name: "queryId",
            description: "The Atlantic query ID to check status for",
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
    case "generate_proof": {
      const { filename } = args || {};
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Please generate a zero-knowledge proof from the ZIP file: ${filename}`
          }
        }]
      };
    }

    case "verify_proof": {
      const { filename, memoryVerification } = args || {};
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Please verify the zero-knowledge proof from the JSON file: ${filename} with memory verification: ${memoryVerification}`
          }
        }]
      };
    }

    case "check_proof_status": {
      const { queryId } = args || {};
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Please check the status of the proof with query ID: ${queryId}`
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
console.log("Atlantic MCP Server started successfully");
