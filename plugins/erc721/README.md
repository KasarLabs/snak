# Snak - ERC721 Plugin

The ERC721 Plugin provides comprehensive tools for interacting with ERC721 Non-Fungible Tokens (NFTs) on the Starknet blockchain.

## Features

This plugin adds the following tools:

- **erc721_owner_of**: Get the owner of a specific NFT.
- **erc721_get_balance**: Get the balance of NFTs for a given wallet address.
- **erc721_get_own_balance**: Get the balance of NFTs in your wallet.
- **erc721_is_approved_for_all**: Check if an operator is approved for all NFTs of a given owner.
- **erc721_get_approved**: Get the approved address for a specific NFT.
- **erc721_transfer_from**: Transfer an NFT from one address to another.
- **erc721_transfer**: Transfer an NFT to a specific address.
- **erc721_approve**: Approve an address to manage a specific NFT.
- **erc721_safe_transfer_from**: Safely transfer an NFT from one address to another with additional data.
- **erc721_set_approval_for_all**: Set or revoke approval for an operator to manage all NFTs of the caller.
- **deploy_erc721**: Create and deploy a new ERC721 contract.

## Usage

The ERC721 Plugin is used internally by the Starknet Agent and doesn't need to be called directly. When the agent is initialized, it automatically registers these tools, making them available for use.

## Example

When asking the agent to perform NFT-related tasks, it will use the appropriate tool from this plugin:

```
"Who owns the NFT with ID 123 in collection 0x1234...?"  // Uses erc721_owner_of
"Transfer my NFT to 0x5678..."  // Uses erc721_transfer
"Deploy a new NFT collection"  // Uses deploy_erc721
```

## Development

To extend this plugin, add new tools in the `src/tools` directory and register them in the `registerTools` function in `src/tools/index.ts`.
