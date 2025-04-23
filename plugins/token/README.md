# Snak - Token Plugin

The Token Plugin provides tools for working with tokens on the Starknet blockchain.

## Features

This plugin adds the following tools:

- **transfer**: Transfer ERC20 tokens to a specific address.
- **get_own_balance**: Get the balance of a cryptocurrency in your wallet.
- **get_balance**: Get the balance of an asset for a given wallet address.

## Usage

The Token Plugin is used internally by the Starknet Agent and doesn't need to be called directly. When the agent is initialized, it automatically registers these tools, making them available for use.

## Example

When asking the agent to perform token-related tasks, it will use the appropriate tool from this plugin:

```
"What's my ETH balance?"  // Uses get_own_balance
"Transfer 0.1 ETH to 0x1234..."  // Uses transfer
"Check the USDC balance of 0x5678..."  // Uses get_balance
```

## Development

To extend this plugin, add new tools in the `src/tools` directory and register them in the `registerTools` function in `src/tools/index.ts`.
