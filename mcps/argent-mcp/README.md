# Argent MCP Server

An MCP (Model Context Protocol) server for creating and deploying Argent wallet accounts on Starknet.

## Features

- **Create New Argent Account**: Generate new private/public keys and calculate contract address
- **Deploy Existing Account**: Deploy a pre-created Argent account to the Starknet network
- **Fee Estimation**: Create accounts with deployment fee estimation
- **Smart Contract Integration**: Full integration with Argent's smart contract wallet system

## Installation

```bash
npm install argent-mcp-server
```

## Usage

### Environment Variables

Set the following environment variable for deployment operations:

```bash
export STARKNET_RPC_URL="https://starknet-mainnet.infura.io/v3/your-api-key"
```

### Available Tools

#### 1. Create New Argent Account

Creates a new Argent account with generated keys and contract address.

```json
{
  "name": "create_new_argent_account",
  "arguments": {}
}
```

**Response:**
```json
{
  "status": "success",
  "wallet": "AX",
  "publicKey": "0x...",
  "privateKey": "0x...",
  "contractAddress": "0x...",
  "message": "Your AX account has been successfully created at 0x..."
}
```

#### 2. Deploy Existing Argent Account

Deploys an existing Argent account to the network.

```json
{
  "name": "deploy_existing_argent_account",
  "arguments": {
    "contractAddress": "0x...",
    "publicKey": "0x...",
    "privateKey": "0x..."
  }
}
```

**Response:**
```json
{
  "status": "success",
  "wallet": "AX",
  "transaction_hash": "0x...",
  "contract_address": "0x..."
}
```

#### 3. Create Account with Fee Estimation

Creates a new Argent account with deployment fee estimation.

```json
{
  "name": "create_argent_account_with_fee",
  "arguments": {}
}
```

**Response:**
```json
{
  "status": "success",
  "transaction_type": "CREATE_ACCOUNT",
  "wallet": "AX",
  "publicKey": "0x...",
  "privateKey": "0x...",
  "contractAddress": "0x...",
  "deployFee": "1000000000000000"
}
```

### Available Resources

#### Argent Account Information

Access information about Argent accounts and available operations.

**URI:** `argent://account-info`

### Available Prompts

1. **create_argent_account**: Create a new Argent account
2. **deploy_argent_account**: Deploy an existing Argent account
3. **estimate_deployment_fee**: Create an Argent account with fee estimation

## Development

### Building

```bash
npm run build
```

### Running in Development

```bash
npm run dev
```

### Testing

```bash
npm test
```

## Architecture

The server is built using the Model Context Protocol SDK and includes:

- **AccountManager**: Handles account creation, deployment, and fee estimation
- **Argent Integration**: Uses Argent's specific smart contract class hash and Cairo enums
- **Starknet Provider**: Integrates with Starknet for network operations
- **Schema Validation**: Uses Zod for input validation

## Security Notes

- Private keys are generated locally and not stored
- All operations use Starknet's secure cryptographic primitives
- Environment variables should be properly secured in production

## License

MIT
