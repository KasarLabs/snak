# Starknet Agent Kit - Unruggable Plugin

The Unruggable Plugin provides tools for creating and analyzing memecoins on the Starknet blockchain, with a focus on safer token launches and liquidity locking.

## Features

This plugin adds the following tools:

- **is_memecoin**: Check if an address is a memecoin.
- **get_locked_liquidity**: Get locked liquidity information for a token.
- **create_memecoin**: Create a new memecoin using the Unruggable Factory.
- **launch_on_ekubo**: Launch a memecoin on Ekubo DEX with concentrated liquidity.

## Usage

The Unruggable Plugin is used internally by the Starknet Agent and doesn't need to be called directly. When the agent is initialized, it automatically registers these tools, making them available for use.

## Example

When asking the agent to perform Unruggable-related tasks, it will use the appropriate tool from this plugin:

```
"Check if 0x1234... is a memecoin"  // Uses is_memecoin
"Create a new memecoin called MyMeme"  // Uses create_memecoin
"Launch my token on Ekubo with liquidity"  // Uses launch_on_ekubo
"Is the liquidity for this token locked?"  // Uses get_locked_liquidity
```

## Development

To extend this plugin, add new tools in the `src/tools` directory and register them in the `registerTools` function in `src/tools/index.ts`.
