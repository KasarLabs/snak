# Starknet Agent Kit - Transaction Plugin

The Transaction Plugin provides tools for simulating various types of transactions on the Starknet blockchain without actually executing them.

## Features

This plugin adds the following simulation tools:

- **simulate_transaction**: Simulate an invoke transaction without executing it.
- **simulate_deploy_transaction**: Simulate a deploy transaction.
- **simulate_declare_transaction**: Simulate a declare transaction.
- **simulate_deploy_account_transaction**: Simulate a deploy account transaction.

## Usage

The Transaction Plugin is used internally by the Starknet Agent and doesn't need to be called directly. When the agent is initialized, it automatically registers these tools, making them available for use.

## Example

When asking the agent to perform transaction-related tasks, it will use the appropriate tool from this plugin:

```
"What would happen if I called this contract function?"  // Uses simulate_transaction
"Show me the result of deploying this contract without actually deploying it"  // Uses simulate_deploy_transaction
```

## Development

To extend this plugin, add new tools in the `src/tools` directory and register them in the `registerTools` function in `src/tools/index.ts`. 