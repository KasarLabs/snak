# Starknet Agent Kit - ArtPeace Plugin

The ArtPeace Plugin provides tools for interacting with pixel art on the Starknet blockchain, allowing users to place pixels on a collaborative canvas.

## Features

This plugin adds the following tool:

- **place_pixel**: Places a pixel on the collaborative canvas, with optional parameters.

## Usage

The ArtPeace Plugin is used internally by the Starknet Agent and doesn't need to be called directly. When the agent is initialized, it automatically registers this tool, making it available for use.

## Example

When asking the agent to perform ArtPeace-related tasks, it will use the place_pixel tool:

```
"Place a red pixel at position x:100, y:200"
"Draw a blue dot on the canvas at coordinates 150,300"
```

## Development

To extend this plugin, add new tools in the `src/tools` directory and register them in the `registerTools` function in `src/tools/index.ts`.
