# Braavos MCP Server

A Model Context Protocol (MCP) server for creating and deploying Braavos wallet accounts on Starknet.

## Features
- Create new Braavos accounts (with keys and contract address)
- Estimate deployment fees for new accounts
- Deploy existing Braavos accounts
- Expose account info as an MCP resource
- Provide user-friendly prompts for account operations

## Installation
```bash
npm install
npm run build
```

## Usage
### Environment Variables
Set the following environment variable (optional, for custom Starknet RPC):
```bash
export STARKNET_RPC_URL="https://alpha-mainnet.starknet.io"
```

### Running the Server
```bash
npm start
```
Or for development:
```bash
npm run dev
```

## Available Tools
### `create_new_braavos_account`
Create a new Braavos account and return the privateKey/publicKey/contractAddress.

### `create_braavos_account_with_fee`
Create a new Braavos account and estimate deployment fee.

### `deploy_existing_braavos_account`
Deploy an existing Braavos account.
- **Parameters:**
  - `contractAddress` (string): The account contract address
  - `publicKey` (string): The public key
  - `privateKey` (string): The private key

## Available Resources
### `braavos://account-info`
Provides information about Braavos account creation and deployment.

## Available Prompts
### `create_braavos_account`
Prompt to create a new Braavos account.

### `deploy_braavos_account`
Prompt to deploy an existing Braavos account.
- **Arguments:**
  - `contractAddress` (string)
  - `publicKey` (string)
  - `privateKey` (string)

## Development
### Build
```bash
npm run build
```
### Test
```bash
npm test
```
### Clean
```bash
npm run clean
```

## Security Notes
- Never expose your private key in code or logs
- Use secure environment variable management
- Always verify transaction details before execution

## License
MIT License
