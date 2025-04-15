# Starknet Agent Kit - Fibrous Plugin

The Fibrous Plugin provides tools for interacting with the Fibrous decentralized exchange on the Starknet blockchain, enabling token swaps and routing.

## Features

This plugin adds the following tools:

- **fibrous_swap**: Swap a token for another token.
- **fibrous_batch_swap**: Swap multiple tokens for another token.
- **fibrous_get_route**: Get a specific route for swapping tokens.

## Usage

The Fibrous Plugin is used internally by the Starknet Agent and doesn't need to be called directly. When the agent is initialized, it automatically registers these tools, making them available for use.

## Example

When asking the agent to perform Fibrous-related tasks, it will use the appropriate tool from this plugin:

```
"Swap 0.1 ETH for USDC on Fibrous"  // Uses fibrous_swap
"Swap both my ETH and USDT for USDC"  // Uses fibrous_batch_swap
"What's the best route to swap ETH to DAI on Fibrous?"  // Uses fibrous_get_route
```

## Development

To extend this plugin, add new tools in the `src/tools` directory and register them in the `registerTools` function in `src/tools/index.ts`. 