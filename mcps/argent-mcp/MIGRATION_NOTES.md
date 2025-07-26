# Argent Plugin to MCP Server Migration

This document outlines the conversion of the Argent plugin to an MCP (Model Context Protocol) server.

## What Changed

### Original Plugin Structure
- Used `@snakagent/core` for tool registration
- Integrated with Snak's plugin system
- Had separate signature tools and regular tools
- Used Snak's agent interface for deployment

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
    name: 'create_new_argent_account',
    description: 'Creates a new Argent account...',
    plugins: 'argent',
    execute: async () => {
      // implementation
    },
  });
};
```

**After (MCP Server):**
```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_new_argent_account",
        description: "Creates a new Argent account...",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      }
    ]
  };
});
```

### Tool Execution
**Before (Plugin):**
```typescript
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;
  // Direct function calls
});
```

**After (MCP Server):**
```typescript
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "create_new_argent_account": {
      // Implementation with proper MCP response format
      return {
        content: [{
          type: "text",
          text: result
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

## Migration Steps

1. **Dependencies**: Replaced `@snakagent/core` with `@modelcontextprotocol/sdk`
2. **Server Setup**: Created MCP server with stdio transport
3. **Tool Conversion**: Converted plugin tools to MCP tools
4. **Response Format**: Updated responses to match MCP format
5. **Error Handling**: Improved error handling with proper MCP error responses
6. **Documentation**: Updated documentation for MCP usage

## Usage

### Before (Plugin)
```typescript
// Used within Snak's plugin system
import { registerTools } from '@snakagent/plugin-argent';
```

### After (MCP Server)
```bash
# Run as standalone server
node dist/index.js

# Or use with MCP client
mcp-client argent-mcp-server
```

## Configuration

The MCP server requires the same environment variables as the original plugin:
- `STARKNET_RPC_URL`: Starknet RPC endpoint for deployment operations

## Testing

The MCP server can be tested using:
- MCP client tools
- Direct JSON-RPC communication
- The provided test script (`test-server.js`)
