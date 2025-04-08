<div align="center">
  <picture>
    <!-- For users in dark mode, load a white logo -->
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/KasarLabs/brand/blob/main/projects/snak/snak-logo-white-no-bg.png?raw=true">
    <!-- Default image for light mode -->
    <img src="https://github.com/KasarLabs/brand/blob/main/projects/snak/snak-logo-black-no-bg.png?raw=true" width="150" alt="Starknet Agent Kit Logo">
  </picture>
  
  <h1>Snak (alpha)</h1>

<p>
<a href="https://www.npmjs.com/package/starknet-agent-kit">
<img src="https://img.shields.io/npm/v/starknet-agent-kit.svg" alt="NPM Version" />
</a>
<a href="https://github.com/kasarlabs/snak/blob/main/LICENSE">
<img src="https://img.shields.io/npm/l/starknet-agent-kit.svg" alt="License" />
</a>
<a href="https://github.com/kasarlabs/snak/stargazers">
<img src="https://img.shields.io/github/stars/kasarlabs/snak.svg" alt="GitHub Stars" />
</a>
<a href="https://nodejs.org">
<img src="https://img.shields.io/node/v/starknet-agent-kit.svg" alt="Node Version" />
</a>
</p>
</div>

A toolkit for creating AI agents that can interact with the Starknet blockchain. Available as both an NPM package and a ready-to-use NestJS server with a web interface. Supports multiple AI providers including Anthropic, OpenAI, Google Gemini, and Ollama.

## Quick Start

### Prerequisites

- Starknet wallet (recommended: [Argent X](https://www.argent.xyz/argent-x))
- AI provider API key (Anthropic/OpenAI/Google Gemini/Ollama)
- Node.js and pnpm installed

### Installation

```bash
git clone https://github.com/kasarlabs/snak.git
cd snak
pnpm install
```

### Configuration

1. Create a `.env` file:

```env
# Starknet configuration (mandatory)
STARKNET_PUBLIC_ADDRESS="YOUR_STARKNET_PUBLIC_ADDRESS"
STARKNET_PRIVATE_KEY="YOUR_STARKNET_PRIVATE_KEY"
STARKNET_RPC_URL="YOUR_STARKNET_RPC_URL"

# AI Provider configuration (mandatory)
AI_PROVIDER_API_KEY="YOUR_AI_PROVIDER_API_KEY"
AI_MODEL="YOUR_AI_MODEL"
AI_PROVIDER="YOUR_AI_PROVIDER"

# NestJS server configuration
SERVER_API_KEY="YOUR_SERVER_API_KEY"
SERVER_PORT="YOUR_SERVER_PORT"

#Node Configuration # optional by default : production
NODE_ENV="YOUR_NODE_ENV"
# Agent additional configuration

POSTGRES_USER="YOUR_POSTGRES_USER"
POSTGRES_PASSWORD="YOUR_POSTGRES_PASSWORD"
POSTGRES_ROOT_DB="YOUR_POSTGRES_ROOT_DB"
POSTGRES_HOST="YOUR_POSTGRES_HOST"
POSTGRES_PORT="YOUR_POSTGRES_PORT"
```

2. Create your agent.config.json

```json
{
  "name": "Your Agent name",
  "bio": "Your AI Agent Bio",
  "lore": ["Some lore of your AI Agent 1", "Some lore of your AI Agent 1"],
  "objectives": [
    "first objective that your AI Agent need to follow",
    "second objective that your AI Agent need to follow"
  ],
  "knowledge": [
    "first knowledge of your AI Agent",
    "second knowledge of your AI Agent"
  ],
  "interval": "Your agent interval beetween each transaction of the Agent in ms,",
  "chat_id": "Your Agent Chat-id for isolating memory",
  "autonomous": "Your agent is autonomous or not",
  "plugins": ["Your first plugin", "Your second plugin"],
  "mcpServers": {
    "nxp_server_example": {
      "command": "npx",
      "args": ["-y", "@npm_package_example/npx_server_example"],
      "env": {
        "API_KEY": "YOUR_API_KEY"
      }
    },
    "local_server_example": {
      "command": "node",
      "args": ["node /path/to/local_server/dist/index.js"]
    }
  }
}
```

You can simply create your own agent configuration using our tool on [snakagent](https://www.snakagent.com/create-agent)

## Usage

### Prompt Mode

Run the promt:

```bash
# start with the default.agent.json
pnpm run start

# start with your custom configuration
pnpm run start --agent="name_of_your_config.json"
```

### Server Mode

Run the server :

```bash
# start with the default.agent.json
pnpm run start:server

# start with your custom configuration
pnpm run start:server --agent="name_of_your_config.json"
```

#### Available Modes

|             | Interactive Mode | Autonomous Mode |
| ----------- | ---------------- | --------------- |
| Prompt Mode | ✅               | ✅              |
| Server Mode | ✅               | ❌              |

### Implement Snak in your project

1. Install snak package

```bash
#using npm
npm install @starknet-agent-kit

# using pnpm
pnpm add @starknet-agent-kit
```

2. Create your agent instance

```typescript
import { StarknetAgent } from 'starknet-agent-kit';

const agent = new StarknetAgent({
  provider: new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }),
  accountPrivateKey: process.env.STARKNET_PRIVATE_KEY,
  accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS,
  aiModel: process.env.AI_MODEL,
  aiProvider: process.env.AI_PROVIDER,
  aiProviderApiKey: process.env.AI_PROVIDER_API_KEY,
  signature: 'key',
  agentMode: 'auto',
  agentconfig: y,
});

const response = await agent.execute("What's my ETH balance?");
```

## Actions

To learn more about actions you can read [this doc section](https://docs.kasar.io/agent-actions).
A comprehensive interface in the Kit will provide an easy-to-navigate catalog of all available plugins and their actions, making discovery and usage simpler.

To add actions to your agent you can easily follow the step-by-steps guide [here](https://docs.kasar.io/add-agent-actions)

## Contributing

Contributions are welcome! Feel free to submit a Pull Request.

## License

MIT License - see the LICENSE file for details.

---

For detailed documentation visit [docs.kasar.io](https://docs.kasar.io)
