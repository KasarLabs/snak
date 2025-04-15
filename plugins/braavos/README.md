# Starknet Agent Kit - Braavos Plugin

The Braavos Plugin provides tools for creating and deploying Braavos wallet accounts on the Starknet blockchain.

## Features

This plugin adds the following tools:

- **create_new_braavos_account**: Create a new Braavos account and return the privateKey, publicKey, and contractAddress.
- **deploy_existing_braavos_account**: Deploy an existing Braavos Account and return the privateKey, publicKey, and contractAddress.

## Usage

The Braavos Plugin is used internally by the Starknet Agent and doesn't need to be called directly. When the agent is initialized, it automatically registers these tools, making them available for use.

## Example

When asking the agent to perform Braavos-related tasks, it will use the appropriate tool from this plugin:

```
"Create a new Braavos wallet for me"  // Uses create_new_braavos_account
"Deploy my existing Braavos account"  // Uses deploy_existing_braavos_account
```

## Development

To extend this plugin, add new tools in the `src/tools` directory and register them in the `registerTools` function in `src/tools/index.ts`. 