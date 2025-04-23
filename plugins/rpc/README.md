# Snak - RPC Plugin

The RPC Plugin provides tools for interacting directly with the Starknet blockchain via RPC (Remote Procedure Call) methods, enabling access to blockchain data and state.

## Features

This plugin adds the following RPC tools:

- **get_chain_id**: Retrieve the unique identifier (chain ID) of the Starknet network.
- **get_syncing_status**: Retrieve the syncing status of the Starknet node.
- **get_class_hash**: Retrieve the unique class hash for a contract at a specific address.
- **get_spec_version**: Get the current spec version from the Starknet RPC provider.
- **get_block_with_tx_hashes**: Retrieve block details including transaction hashes.
- **get_block_with_receipts**: Fetch block details with transaction receipts.
- **get_transaction_status**: Fetch transaction status by hash.
- **get_block_number**: Get the current block number from the Starknet network.
- **get_block_transaction_count**: Get the number of transactions in a specific block.
- **get_storage_at**: Get the storage value at a specific slot for a contract.
- **get_class**: Retrieve the complete class definition of a contract.
- **get_class_at**: Fetch the class definition of a contract at a specific address.

## Usage

The RPC Plugin is used internally by the Starknet Agent and doesn't need to be called directly. When the agent is initialized, it automatically registers these tools, making them available for use.

## Example

When asking the agent to perform RPC-related tasks, it will use the appropriate tool from this plugin:

```
"What's the current block number?"  // Uses get_block_number
"Show me the status of transaction 0x1234..."  // Uses get_transaction_status
"What's the chain ID of the current network?"  // Uses get_chain_id
```

## Development

To extend this plugin, add new tools in the `src/tools` directory and register them in the `registerTools` function in `src/tools/index.ts`.
