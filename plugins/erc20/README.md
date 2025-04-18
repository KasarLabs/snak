# Starknet Agent Kit - ERC20 Plugin

The ERC20 Plugin provides comprehensive tools for interacting with ERC20 tokens on the Starknet blockchain.

## Features

This plugin adds the following tools:

- **erc20_get_allowance**: Get the amount of tokens that a spender is allowed to spend on behalf of an owner.
- **erc20_get_my_given_allowance**: Get the amount of tokens that a spender is allowed to spend on your behalf.
- **erc20_get_allowance_given_to_me**: Get the amount of tokens that you are allowed to spend on behalf of an owner.
- **erc20_get_total_supply**: Get the total supply of a token.
- **erc20_transfer_from**: Transfer tokens from one address to another using an allowance.
- **erc20_get_balance**: Get the balance of an asset for a given wallet address.
- **erc20_get_own_balance**: Get the balance of an asset in your wallet.
- **erc20_approve**: Approve a spender to spend tokens on your behalf.
- **erc20_transfer**: Transfer ERC20 tokens to a specific address.
- **erc20_deploy_new_contract**: Create and deploy a new ERC20 contract.

## Usage

The ERC20 Plugin is used internally by the Starknet Agent and doesn't need to be called directly. When the agent is initialized, it automatically registers these tools, making them available for use.

## Example

When asking the agent to perform ERC20-related tasks, it will use the appropriate tool from this plugin:

```
"Approve 50 USDC for address 0x1234..."  // Uses erc20_approve
"What's the total supply of DAI?"  // Uses erc20_get_total_supply
"Deploy a new token called MyToken"  // Uses erc20_deploy_new_contract
```

## Development

To extend this plugin, add new tools in the `src/tools` directory and register them in the `registerTools` function in `src/tools/index.ts`.
