# MCPs in Snak

## How to Implement MCP Servers in Snak

### Configuration

To integrate MCP servers with your Snak agent, you need to make two configuration changes:

1. Add `mcp: true` in your agent configuration
2. Create a `mcp.config.json` file

Here is an example of the `mcp.config.json` file:

```json
{
  "servers": {
    "nxp_server_example": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/npx_server_example"],
      "env": {
        // You need to check the documentation of the MCP server to know what to include in the env
        "API_KEY": "YOUR_API_KEY"
      }
    },
    "local_server": {
      "command": "node",
      "args": ["node /User/username/snak/mcp_server/local_server/dist/index.js"]
    }
  }
}
```

After creating these configuration files, build and start your project. All tools provided by the MCP servers you've added will be automatically integrated into your Snak Agent.

```bash
pnpm run start
```

## How to Use Snak-Mcp-Server in Your Claude Desktop

### Installation

1. Install [Claude desktop](https://claude.ai/download)
2. Enable Developer Mode in Claude > Settings > Developer

### Configuration

To integrate Snak-Mcp-Server with your Claude Desktop environment, follow these steps:

1. Locate your `claude_desktop_config.json` configuration file
2. Add the following MCP server configuration:

```json
{
  "mcpServers": {
    "starknet_test": {
      "command": "node",
      "args": [
        "/absolute/path/to/snak/mcp_server/starknet/dist/index.js",
        "plugins_name_1",
        "plugins_name_2",
        "plugins_name_3",
        "plugins_name_4"
      ]
    }
  }
}
```

3. Compile your MCP server by executing:

```bash
 pnpm build
```

4. Restart the Claude Desktop application to apply the changes.
   **_NOTE:_** Ensure you replace the placeholder path with the actual absolute path to your Starknet server implementation, and specify only the plugins you wish to enable.
