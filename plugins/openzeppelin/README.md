# Snak - OpenZeppelin Plugin

The OpenZeppelin Plugin provides tools for creating and deploying OpenZeppelin account contracts on the Starknet blockchain.

## Features

This plugin adds the following tools:

- **create_new_openzeppelin_account**: Create a new OpenZeppelin account and return the privateKey, publicKey, and contractAddress.
- **deploy_existing_openzeppelin_account**: Deploy an existing OpenZeppelin Account and return the privateKey, publicKey, and contractAddress.

## Usage

The OpenZeppelin Plugin is used internally by the Starknet Agent and doesn't need to be called directly. When the agent is initialized, it automatically registers these tools, making them available for use.

## Example

When asking the agent to perform OpenZeppelin-related tasks, it will use the appropriate tool from this plugin:

```
"Create a new OpenZeppelin wallet for me"  // Uses create_new_openzeppelin_account
"Deploy my existing OpenZeppelin account"  // Uses deploy_existing_openzeppelin_account
```

## Development

To extend this plugin, add new tools in the `src/tools` directory and register them in the `registerTools` function in `src/tools/index.ts`.
