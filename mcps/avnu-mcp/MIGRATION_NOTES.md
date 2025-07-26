# AVNU Plugin to MCP Server Migration Notes

This document outlines the conversion of the AVNU plugin from the SnakAgent framework to a standalone Model Context Protocol (MCP) server.

## Overview

The AVNU plugin has been successfully converted from a SnakAgent plugin to a standalone MCP server, enabling it to operate independently while maintaining all original functionality.

## Key Changes

### 1. Package Configuration

**Before (Plugin):**
```json
{
  "name": "@snakagent/plugin-avnu",
  "dependencies": {
    "@snakagent/core": "workspace:*"
  }
}
```

**After (MCP Server):**
```json
{
  "name": "avnu-mcp-server",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "starknet": "^6.0.0",
    "zod": "^3.22.4"
  }
}
```

### 2. Architecture Changes

#### Dependency Injection
- **Removed**: `SnakAgentInterface` dependency
- **Added**: Direct `RpcProvider` and credential management
- **Benefit**: Standalone operation without framework dependencies

#### Service Initialization
- **Before**: Services initialized with `SnakAgentInterface`
- **After**: Services initialized with `RpcProvider` and credentials
- **Impact**: More explicit dependency management

### 3. Modified Files

#### Core Action Files
- `src/actions/swap.ts`: Updated to use `RpcProvider` instead of `SnakAgentInterface`
- `src/actions/fetchRoute.ts`: Modified for standalone operation
- `src/actions/approval.ts`: Updated constructor to accept provider and private key

#### Utility Files
- `src/utils/contractInteractor.ts`: Fixed TypeScript error handling
- `src/utils/transactionMonitor.ts`: Fixed TypeScript error handling
- `src/actions/fetchTokens.ts`: Fixed TypeScript error handling

#### Removed Files
- `src/tools/index.ts`: No longer needed (plugin registration removed)

### 4. New MCP Server Features

#### Tools
- `avnu_swap_tokens`: Token swapping functionality
- `avnu_get_route`: Route discovery functionality

#### Resources
- `avnu://exchange-info`: Exchange information resource

#### Prompts
- `swap_eth_for_usdc`: Predefined ETH to USDC swap prompt
- `get_swap_route`: Route discovery prompt

### 5. Environment Variables

The MCP server requires the following environment variables:
- `STARKNET_RPC_URL`: Starknet RPC endpoint
- `STARKNET_WALLET_ADDRESS`: User's wallet address
- `STARKNET_PRIVATE_KEY`: User's private key

### 6. Error Handling Improvements

Fixed TypeScript compilation errors related to:
- `unknown` error types in catch blocks
- Proper error message extraction
- Type-safe error handling

## Migration Benefits

### 1. Independence
- No longer tied to SnakAgent framework
- Can be used with any MCP-compatible client
- Standalone deployment capability

### 2. Standardization
- Follows MCP specification
- Standardized tool, resource, and prompt interfaces
- Better integration with AI models

### 3. Maintainability
- Cleaner dependency management
- Explicit credential handling
- Improved error handling

### 4. Extensibility
- Easy to add new tools and resources
- Modular architecture
- Clear separation of concerns

## Testing

The converted server has been tested for:
- ✅ TypeScript compilation
- ✅ Dependency installation
- ✅ Build process
- ✅ MCP server initialization

## Usage Comparison

### Before (Plugin Usage)
```typescript
// Required SnakAgent framework
const agent = new SnakAgent();
agent.registerPlugin('avnu');
// Use through agent interface
```

### After (MCP Server Usage)
```bash
# Standalone server
export STARKNET_WALLET_ADDRESS="your_address"
export STARKNET_PRIVATE_KEY="your_key"
npm start
```

## Future Enhancements

1. **Additional Tools**: Add more AVNU-specific functionality
2. **Enhanced Resources**: Provide more detailed exchange information
3. **Custom Prompts**: Add domain-specific prompts for common operations
4. **Configuration**: Add configuration file support
5. **Monitoring**: Add transaction monitoring and status tracking

## Conclusion

The migration successfully converts the AVNU plugin to a standalone MCP server while maintaining all original functionality. The new architecture provides better independence, standardization, and maintainability while following MCP best practices.
