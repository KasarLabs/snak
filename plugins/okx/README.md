# Starknet Agent Kit - OKX Plugin

The OKX Plugin provides tools for creating and deploying OKX wallet accounts on the Starknet blockchain.

## Features

This plugin adds the following tools:

- **create_new_okx_account**: Create a new OKX account and return the privateKey, publicKey, and contractAddress.
- **deploy_existing_okx_account**: Deploy an existing OKX Account and return the privateKey, publicKey, and contractAddress.

## Usage

The OKX Plugin is used internally by the Starknet Agent and doesn't need to be called directly. When the agent is initialized, it automatically registers these tools, making them available for use.

## Example

When asking the agent to perform OKX-related tasks, it will use the appropriate tool from this plugin:

```
"Create a new OKX wallet for me"  // Uses create_new_okx_account
"Deploy my existing OKX account"  // Uses deploy_existing_okx_account
```

## Development

To extend this plugin, add new tools in the `src/tools` directory and register them in the `registerTools` function in `src/tools/index.ts`. 