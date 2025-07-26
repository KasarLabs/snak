# Artpeace Plugin to MCP Server Migration

This document outlines the conversion of the Artpeace plugin to an MCP (Model Context Protocol) server.

## What Changed

### Original Plugin Structure
- Used `@snakagent/core` for tool registration
- Integrated with Snak's plugin system
- Had separate signature tools and regular tools
- Used Snak's agent interface for contract interactions

### New MCP Server Structure
- Uses `@modelcontextprotocol/sdk` for MCP server implementation
- Standalone server that can be used with any MCP-compatible client
- Unified tool interface with proper JSON-RPC communication
- Direct Starknet integration without Snak dependencies

## Key Differences

### Tool Registration
**Before (Plugin):**
```typescript
export const registerTools = (StarknetToolRegistry: StarknetTool[]) => {
  StarknetToolRegistry.push({
    name: 'place_pixel',
    description: 'Places a pixel, all parameters are optional',
    plugins: 'art-peace',
    schema: placePixelSchema,
    execute: placePixel,
  });
};
```

**After (MCP Server):**
```typescript
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
                  canvasId: { type: ["number", "string"] },
                  xPos: { type: "number" },
                  yPos: { type: "number" },
                  color: { type: "string" }
                }
              }
            }
          },
          required: ["params"]
        }
      }
    ]
  };
});
```

### Tool Execution
**Before (Plugin):**
```typescript
export const placePixel = async (
  agent: SnakAgentInterface,
  input: { params: placePixelParam[] }
) => {
  const credentials = agent.getAccountCredentials();
  const provider = agent.getProvider();
  // Implementation
};
```

**After (MCP Server):**
```typescript
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "place_pixel": {
      const accountPublicKey = process.env.STARKNET_ACCOUNT_PUBLIC_KEY;
      const accountPrivateKey = process.env.STARKNET_ACCOUNT_PRIVATE_KEY;
      // Implementation with proper MCP response format
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result)
        }]
      };
    }
  }
});
```

## Benefits of MCP Server

1. **Standardization**: Uses the Model Context Protocol standard
2. **Interoperability**: Works with any MCP-compatible client
3. **Standalone**: No dependency on Snak's plugin system
4. **Resources & Prompts**: Additional MCP features like resources and prompts
5. **Better Error Handling**: Proper JSON-RPC error responses
6. **Schema Validation**: Built-in input validation with Zod
7. **Environment Variables**: Cleaner configuration management

## Migration Steps

1. **Dependencies**: Replaced `@snakagent/core` with `@modelcontextprotocol/sdk`
2. **Server Setup**: Created MCP server with stdio transport
3. **Tool Conversion**: Converted plugin tools to MCP tools
4. **Response Format**: Updated responses to match MCP format
5. **Error Handling**: Improved error handling with proper MCP error responses
6. **Configuration**: Moved from agent credentials to environment variables
7. **Documentation**: Updated documentation for MCP usage

## Usage

### Before (Plugin)
```typescript
// Used within Snak's plugin system
import { registerTools } from '@snakagent/plugin-artpeace';
```

### After (MCP Server)
```bash
# Run as standalone server
node dist/index.js

# Or use with MCP client
mcp-client artpeace-mcp-server
```

## Configuration

The MCP server requires environment variables instead of agent credentials:
- `STARKNET_RPC_URL`: Starknet RPC endpoint
- `STARKNET_ACCOUNT_PUBLIC_KEY`: Your Starknet account public key
- `STARKNET_ACCOUNT_PRIVATE_KEY`: Your Starknet account private key

## Preserved Functionality

- **ArtpeaceHelper**: All pixel placement validation logic preserved
- **Checker**: Canvas and color validation maintained
- **ColorAnalyzer**: Color format conversion preserved
- **API Integration**: Artpeace API integration maintained
- **Schema Validation**: Zod schemas preserved and enhanced

## Testing

The MCP server can be tested using:
- MCP client tools
- Direct JSON-RPC communication
- Environment variable configuration
- Artpeace API integration

## Architecture Improvements

- **Cleaner Separation**: Better separation between MCP layer and business logic
- **Enhanced Validation**: Improved input validation with detailed error messages
- **Resource Integration**: Added canvas information resource
- **Prompt System**: Added prompts for common pixel placement scenarios
