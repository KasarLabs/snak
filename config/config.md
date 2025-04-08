# Configuration Guide

This directory contains configurations for Agents and MCP (Model Context Protocol) servers.

## Directory Structure

```
config/
├── agents/
│   ├── default.agent.json
│   └── example.agent.json
└── mcp/
    └── example.mcp.json
```

## Agent Configuration

Agents are configured via JSON files in the `agents/` directory. Each agent requires a configuration file with the following parameters:

### Agent Configuration Parameters

- `name` : Agent name
- `bio` : Agent's biographical description
- `lore` : Array containing the agent's history/context
- `objectives` : Array of objectives the agent must follow
- `knowledge` : Array of the agent's knowledge
- `interval` : Interval in milliseconds between each agent transaction
- `chat_id` : Unique identifier to isolate agent memory
- `autonomous` : Boolean indicating if the agent is autonomous
- `mcp` : Boolean indicating if the agent can use MCP
- `internal_plugins` : Array of internal plugins used by the agent
- `external_plugins` : Array of external plugins used by the agent
- `memory` : Boolean to enable/disable agent memory

### Example Agent Configuration

```json
{
  "name": "Your Agent name",
  "bio": "Your AI Agent Bio",
  "lore": ["Some lore of your AI Agent 1", "Some lore of your AI Agent 2"],
  "objectives": [
    "first objective that your AI Agent need to follow",
    "second objective that your AI Agent need to follow"
  ],
  "knowledge": [
    "first knowledge of your AI Agent",
    "second knowledge of your AI Agent"
  ],
  "interval": "Your agent interval beetween each transaction of the Agent in ms",
  "chat_id": "Your Agent Chat-id for isolating memory",
  "autonomous": true,
  "mcp": true,
  "internal_plugins": [
    "Your first internal plugin",
    "Your second internal plugin"
  ],
  "external_plugins": [
    "Your first external plugin",
    "Your second external plugin"
  ],
  "memory": true
}
```

## MCP Server Configuration

MCP servers are configured in the `mcp/` directory. The configuration file defines the available MCP servers.

### Configuration

To integrate MCP servers with your Snak agent, you need to make two configuration changes:

1. Add `mcp: true` in your agent configuration
2. Create a `example.mcp.json` file

Here is an example of the `mcp.config.json` file:

```json
{
  "mcpServers": {
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

### Example MCP Configuration

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/path/to/allowed/files"
      ]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<YOUR_TOKEN>"
      }
    }
  }
}
```

## How to Configure

1. To create a new agent:

   - Copy `example.agent.json` to the `agents/` directory
   - Rename it with an appropriate name (e.g., `my-agent.agent.json`)
   - Modify the parameters according to your needs

2. To configure MCP servers:
   - Copy `example.mcp.json` to the `mcp/` directory
   - Rename if necessary
   - Configure the servers you need
   - Make sure to set appropriate access paths and tokens
