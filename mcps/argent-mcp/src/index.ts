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
import { RpcProvider } from 'starknet';
import { ARGENT_CLASS_HASH } from './constant/contract.js';
import { AccountManager, wrapAccountCreationResponse } from './utils/AccountManager.js';
import { accountDetailsSchema } from './schemas/schema.js';

// Initialize the MCP server
const server = new Server({
  name: "argent-mcp-server",
  version: "0.0.1",
  description: "MCP server for creating and deploying Argent wallet accounts on Starknet."
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {}
  }
});

// Define schemas for validation
const createAccountSchema = z.object({});

const deployAccountSchema = z.object({
  contractAddress: z.string().describe("The address of the account's contract"),
  publicKey: z.string().describe('The public key of the account'),
  privateKey: z.string().describe('The private key of the account'),
});

const createAccountWithFeeSchema = z.object({});

// Tool: Create new Argent account
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_new_argent_account",
        description: "Creates a new Argent account and returns the privateKey/publicKey/contractAddress",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "deploy_existing_argent_account",
        description: "Deploy an existing Argent Account and return the transaction hash and contract address",
        inputSchema: {
          type: "object",
          properties: {
            contractAddress: {
              type: "string",
              description: "The address of the account's contract"
            },
            publicKey: {
              type: "string",
              description: "The public key of the account"
            },
            privateKey: {
              type: "string",
              description: "The private key of the account"
            }
          },
          required: ["contractAddress", "publicKey", "privateKey"]
        }
      },
      {
        name: "create_argent_account_with_fee",
        description: "Creates a new Argent account with deployment fee estimation",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "create_new_argent_account": {
        const accountManager = new AccountManager(undefined);
        const accountDetails = await accountManager.createAccount(ARGENT_CLASS_HASH);

        const response = JSON.stringify({
          status: 'success',
          wallet: 'AX',
          publicKey: accountDetails.publicKey,
          privateKey: accountDetails.privateKey,
          contractAddress: accountDetails.contractAddress,
        });

        const wrappedResponse = wrapAccountCreationResponse(response);
        const data = JSON.parse(wrappedResponse);

        return {
          content: [{
            type: "text",
            text: data.message || wrappedResponse
          }]
        };
      }

      case "deploy_existing_argent_account": {
        const { contractAddress, publicKey, privateKey } = deployAccountSchema.parse(args);

        const provider = new RpcProvider({
          nodeUrl: process.env.STARKNET_RPC_URL || 'https://starknet-mainnet.infura.io/v3/your-api-key'
        });

        const accountManager = new AccountManager(provider);
        const tx = await accountManager.deployAccount(ARGENT_CLASS_HASH, {
          contractAddress,
          publicKey,
          privateKey
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: 'success',
              wallet: 'AX',
              transaction_hash: tx.transactionHash,
              contract_address: tx.contractAddress,
            }, null, 2)
          }]
        };
      }

      case "create_argent_account_with_fee": {
        const provider = new RpcProvider({
          nodeUrl: process.env.STARKNET_RPC_URL || 'https://starknet-mainnet.infura.io/v3/your-api-key'
        });

        const accountManager = new AccountManager(provider);
        const accountDetails = await accountManager.createAccount(ARGENT_CLASS_HASH);
        const suggestedMaxFee = await accountManager.estimateAccountDeployFee(
          ARGENT_CLASS_HASH,
          accountDetails
        );
        const maxFee = suggestedMaxFee.suggestedMaxFee * 2n;

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: 'success',
              transaction_type: 'CREATE_ACCOUNT',
              wallet: 'AX',
              publicKey: accountDetails.publicKey,
              privateKey: accountDetails.privateKey,
              contractAddress: accountDetails.contractAddress,
              deployFee: maxFee.toString(),
            }, null, 2)
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

// Resource: Argent account information
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "argent://account-info",
        name: "argent-account-info",
        description: "Information about Argent account creation and deployment",
        mimeType: "text/plain"
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
  const { uri } = request.params;

  if (uri === "argent://account-info") {
    return {
      contents: [{
        uri: uri,
        mimeType: "text/plain",
        text: `Argent Account Information

Argent accounts are smart contract wallets on Starknet that provide enhanced security features.

Key Features:
- Smart contract-based wallet
- Guardian system for account recovery
- Multi-signature capabilities
- Enhanced security through social recovery

Class Hash: ${ARGENT_CLASS_HASH}

Available Operations:
1. Create new account - Generates new keys and calculates contract address
2. Deploy existing account - Deploys a pre-created account to the network
3. Create with fee estimation - Creates account with deployment fee calculation

Environment Variables:
- STARKNET_RPC_URL: Starknet RPC endpoint (required for deployment operations)
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
        name: "create_argent_account",
        description: "Create a new Argent account",
        arguments: []
      },
      {
        name: "deploy_argent_account",
        description: "Deploy an existing Argent account",
        arguments: [
          {
            name: "contractAddress",
            description: "The contract address of the account",
            required: true
          },
          {
            name: "publicKey",
            description: "The public key of the account",
            required: true
          },
          {
            name: "privateKey",
            description: "The private key of the account",
            required: true
          }
        ]
      },
      {
        name: "estimate_deployment_fee",
        description: "Create an Argent account with fee estimation",
        arguments: []
      }
    ]
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request: GetPromptRequest) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "create_argent_account": {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: "Please create a new Argent account for me on Starknet"
          }
        }]
      };
    }

    case "deploy_argent_account": {
      const { contractAddress, publicKey, privateKey } = args || {};
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Please deploy my existing Argent account with the following details:
Contract Address: ${contractAddress}
Public Key: ${publicKey}
Private Key: ${privateKey}`
          }
        }]
      };
    }

    case "estimate_deployment_fee": {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: "Please create a new Argent account and estimate the deployment fee"
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
console.log("Argent MCP Server started successfully");
