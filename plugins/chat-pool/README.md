# Snak - Chat Pool Plugin

The Chat Pool Plugin provides tools for storing and retrieving chat instructions in a database, allowing for persistent chat-related data.

## Features

This plugin adds the following tools:

- **insert_chat_instruction**: Insert a chat instruction in a database.
- **read_chat_pool**: Read all stored chat instructions from the pool.

## Usage

The Chat Pool Plugin is used internally by the Starknet Agent and doesn't need to be called directly. When the agent is initialized, it automatically registers these tools, making them available for use.

## Example

When asking the agent to perform chat pool-related tasks, it will use the appropriate tool from this plugin:

```
"Save this instruction for later: Buy ETH when price drops below $3000"  // Uses insert_chat_instruction
"Show me all my saved chat instructions"  // Uses read_chat_pool
```

## Development

This plugin uses a PostgreSQL database for storage. To extend this plugin, add new tools in the `src/tools` directory and register them in the `registerTools` function in `src/tools/index.ts`.
