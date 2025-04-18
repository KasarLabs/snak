# Starknet Agent Kit - Contract Plugin

The Contract Plugin provides tools for managing contracts on the Starknet blockchain, including declaration, deployment, and contract management.

## Features

This plugin adds the following tools:

- **declare_contract**: Declare a Cairo project's contract on Starknet - the first step in the deployment process.
- **step1_prepare_deploy**: Prepare for deployment by understanding the required constructor arguments.
- **step2_deploy_contract**: Deploy a contract on Starknet using the class hash (must be used after prepare_deploy).
- **list_declared_contracts**: List all declared contracts and their deployed instances.
- **list_deployed_contracts_by_class_hash**: List all deployed instances of a contract by its class hash.
- **delete_contract_by_class_hash**: Remove a contract class hash from the database and all its deployments.

## Usage

The Contract Plugin is used internally by the Starknet Agent and doesn't need to be called directly. When the agent is initialized, it automatically registers these tools, making them available for use.

## Example

When asking the agent to perform contract-related tasks, it will use the appropriate tools from this plugin:

```
"Deploy my smart contract from the cairo-project directory"
// Uses declare_contract, step1_prepare_deploy, and step2_deploy_contract in sequence

"Show me all my declared contracts"  // Uses list_declared_contracts

"Delete the contract with class hash 0x1234..."  // Uses delete_contract_by_class_hash
```

## Development

The Contract Plugin maintains a local database of contract declarations and deployments. To extend this plugin, add new tools in the `src/tools` directory and register them in the `registerTools` function in `src/tools/index.ts`.
