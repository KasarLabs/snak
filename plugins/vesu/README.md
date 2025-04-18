# Starknet Agent Kit - Vesu Plugin

The Vesu Plugin provides tools for interacting with the Vesu protocol on the Starknet blockchain, enabling deposit and withdrawal operations for earning positions.

## Features

This plugin provides the following functionality:

- **Deposit Services**: Deposit tokens into the Vesu protocol to earn yield.
- **Withdrawal Services**: Withdraw tokens from existing Vesu positions.

## Usage

The Vesu Plugin is used internally by the Starknet Agent and doesn't need to be called directly. This plugin interfaces with the Vesu protocol's smart contracts to manage yield-earning positions.

The plugin provides services for:

- Getting pool information
- Retrieving token prices
- Approving vToken operations
- Executing deposit and withdrawal transactions

## Example

When asking the agent to perform Vesu-related tasks, it will use the appropriate functionality from this plugin:

```
"Deposit 100 ETH into Vesu"
"Withdraw my tokens from Vesu"
"What's the current yield for ETH in Vesu?"
```

## Development

To extend this plugin, add new services in the `src/actions` directory and export them in the `src/index.ts` file.
