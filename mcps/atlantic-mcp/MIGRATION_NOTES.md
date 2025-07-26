# Atlantic Plugin to MCP Server Migration

This document outlines the conversion of the Atlantic plugin to an MCP (Model Context Protocol) server.

## What Changed

### Original Plugin Structure
- Used `@snakagent/core` for tool registration
- Integrated with Snak's plugin system
- Had two main tools: proof generation and proof verification
- Used Snak's agent interface for service interactions

### New MCP Server Structure
- Uses `@modelcontextprotocol/sdk` for MCP server implementation
- Standalone server that can be used with any MCP-compatible client
- Unified tool interface with proper JSON-RPC communication
- Direct Atlantic API integration without Snak dependencies

## Key Differences

### Tool Registration
**Before (Plugin):**
```typescript
export const registerTools = (StarknetToolRegistry: StarknetTool[]) => {
  StarknetToolRegistry.push({
    name: 'get_proof_service',
    description: 'Query atlantic api to generate a proof from .zip file on starknet and return the query id',
    plugins: 'atlantic',
    schema: GetProofServiceSchema,
    execute: async (params) => {
      return getProofService(params as unknown as AtlanticParam);
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
      }
    ]
  };
});
```

### Tool Execution
**Before (Plugin):**
```typescript
export const getProofService = async (
  param: AtlanticParam
): Promise<string> => {
  // Implementation with agent interface
};
```

**After (MCP Server):**
```typescript
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
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
import { registerTools } from '@snakagent/plugin-atlantic';
```

### After (MCP Server)
```bash
# Run as standalone server
node dist/index.js

# Or use with MCP client
mcp-client atlantic-mcp-server
```

## Configuration

The MCP server requires environment variables instead of agent credentials:
- `ATLANTIC_API_KEY`: Your Atlantic API key for authentication
- `PATH_UPLOAD_DIR`: Directory path where uploaded files are stored
- `SECRET_PHRASE`: Optional secret phrase for file hashing

## Preserved Functionality

- **Proof Generation**: All ZIP file processing and proof generation logic preserved
- **Proof Verification**: All JSON file processing and proof verification logic maintained
- **File Validation**: ZIP and JSON validation preserved
- **Error Handling**: Custom error types and handling maintained
- **API Integration**: Atlantic API integration preserved
- **Schema Validation**: Zod schemas preserved and enhanced

## Testing

The MCP server can be tested using:
- MCP client tools
- Direct JSON-RPC communication
- Environment variable configuration
- Atlantic API integration

## Architecture Improvements

- **Cleaner Separation**: Better separation between MCP layer and business logic
- **Enhanced Validation**: Improved input validation with detailed error messages
- **Resource Integration**: Added proof service information resource
- **Prompt System**: Added prompts for common proof operations
- **File Management**: Improved file handling with better error messages

## API Integration

The server maintains integration with Atlantic API endpoints:
- **Proof Generation**: `https://atlantic.api.herodotus.cloud/v1/proof-generation`
- **Proof Verification**: `https://atlantic.api.herodotus.cloud/v1/l2/atlantic-query/proof-verification`
- **Dashboard**: `https://staging.dashboard.herodotus.dev/explorer/atlantic/`

## File Handling

The server preserves the original file handling capabilities:
- **ZIP Validation**: Validates ZIP file signatures
- **JSON Validation**: Validates JSON file formats
- **File Path Resolution**: Handles file path resolution with optional hashing
- **Error Handling**: Comprehensive error handling for file operations
