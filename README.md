<div align="center">
<img src="https://pbs.twimg.com/profile_images/1834202903189618688/N4J8emeY_400x400.png" width="50" alt="Starknet Agent Kit Logo">

**starknet-agent-kit (alpha)**

<p>
<a href="https://www.npmjs.com/package/starknet-agent-kit">
<img src="https://img.shields.io/npm/v/starknet-agent-kit.svg" alt="NPM Version" />
</a>
<a href="https://github.com/kasarlabs/starknet-agent-kit/blob/main/LICENSE">
<img src="https://img.shields.io/npm/l/starknet-agent-kit.svg" alt="License" />
</a>
<a href="https://github.com/kasarlabs/starknet-agent-kit/stargazers">
<img src="https://img.shields.io/github/stars/kasarlabs/starknet-agent-kit.svg" alt="GitHub Stars" />
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
git clone https://github.com/kasarlabs/starknet-agent-kit.git
cd starknet-agent-kit
pnpm install
```

### Configuration

Create a `.env` file:

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

# Agent additional configuration
DISCORD_BOT_TOKEN?="YOUR_DISCORD_BOT_TOKEN"
DISCORD_CHANNEL_ID?="YOUR_DISCORD_CHANNEL_ID"
```

## Usage

### Server Mode

Run the server:

```bash
pnpm run start
```

#### Available Modes:

1. **Chat Mode**: Have conversations with the agent

   - Check balances
   - Execute transfers
   - Manage accounts

2. **Autonomous Mode**: Configure automated monitoring
   Set up in `config/agents/config-agent.json`:
   ```json
   {
     "name": "MyAgent",
     "context": "You are a Starknet monitoring agent...",
     "interval": 60000,
     "chat_id": "your_discord_channel_id",
     "allowed_actions": ["get_balance", "get_block_number"],
     "prompt": "Monitor ETH balance and alert if it drops below 1 ETH..."
   }
   ```

### Library Mode

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
