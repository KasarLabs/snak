<div align="center">
  <picture>
    <!-- For users in dark mode, load a white logo -->
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/KasarLabs/brand/blob/main/projects/snak/snak-full-white-alpha.png?raw=true">
    <!-- Default image for light mode -->
    <img src="https://github.com/KasarLabs/brand/blob/main/projects/snak/snak-full-black-alpha.png?raw=true" width="200" alt="Snak Logo">
  </picture>

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

A Agent Engine for creating powerful and secure AI Agents powered by Starknet. Available as both an NPM package and a ready-to-use backend.

## Quick Start

### Prerequisites

- Starknet wallet (recommended: [Argent X](https://www.argent.xyz/argent-x))
- AI provider API key (Anthropic/OpenAI/Google Gemini/Ollama)
- Docker and Docker compose installed
- Node.js and pnpm installed

### Installation

```bash
git clone https://github.com/kasarlabs/snak.git
cd snak
pnpm install
```

### Configuration

1.  Create a `.env` file by copying `.env.example`:

```bash
cp .env.example .env
```

Then, fill in the necessary values in your `.env` file:

```env
# --- Starknet configuration (mandatory) ---
STARKNET_PUBLIC_ADDRESS="YOUR_STARKNET_PUBLIC_ADDRESS"
STARKNET_PRIVATE_KEY="YOUR_STARKNET_PRIVATE_KEY"
STARKNET_RPC_URL="YOUR_STARKNET_RPC_URL"

# --- AI Model API Keys (mandatory) ---
# Add the API keys for the specific AI providers you use in config/models/default.models.json
# The agent will automatically load the correct key based on the provider name.

# Example for OpenAI:
OPENAI_API_KEY="YOUR_OPENAI_API_KEY" # (e.g., sk-...)

# Example for Anthropic:
ANTHROPIC_API_KEY="YOUR_ANTHROPIC_API_KEY" # (e.g., sk-ant-...)

# Example for Google Gemini:
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# Example for DeepSeek:
DEEPSEEK_API_KEY="YOUR_DEEPSEEK_API_KEY"

# Note: You do not need an API key if using a local Ollama model.

# --- General Agent Configuration (mandatory) ---
SERVER_API_KEY="YOUR_SERVER_API_KEY" # A secret key for your agent server API
SERVER_PORT="3001"

# --- PostgreSQL Database Configuration (mandatory) ---
POSTGRES_USER=admin
POSTGRES_HOST=localhost
POSTGRES_DB=postgres
POSTGRES_PASSWORD=admin
POSTGRES_PORT=5432

# --- LangSmith Tracing (Optional) ---
# Set LANGSMITH_TRACING=true to enable tracing
LANGSMITH_TRACING=false
LANGSMITH_ENDPOINT="https://api.smith.langchain.com"
LANGSMITH_API_KEY="YOUR_LANGSMITH_API_KEY" # (Only needed if LANGSMITH_TRACING=true)
LANGSMITH_PROJECT="Snak" # (Optional project name for LangSmith)

# --- Node Environment ---
NODE_ENV="development" # "development" or "production"
```

2.  Configure AI Models (Optional):
    The `config/models/default.models.json` file defines the default AI models used for different tasks (`fast`, `smart`, `cheap`). You can customize this file or create new model configurations (e.g., `my_models.json`) and specify them when running the agent. See `config/models/example.models.json` for the structure.

    The agent uses the `provider` field in the model configuration to determine which API key to load from the `.env` file (e.g., if `provider` is `openai`, it loads `OPENAI_API_KEY`).

3.  Create your agent configuration file (e.g., `default.agent.json` or `my_agent.json`) in the `config/agents/` directory:

```json
{
  "name": "Your Agent name",
  "group": "Your Agent group",
  "description": "Your AI Agent Description",
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
  "chatId": "Your Agent Chat-id for isolating memory",
  "max_iterations": "The number of iterations your agent will execute before stopping",
  "mode": "The mode of your agent, can be interactive, autonomous or hybrid",
  "memory": {
    "enabled": "true or false to enable or disable memory",
    "shortTermMemorySize": "The number of messages your agent will remember"
  },
  "plugins": ["Your first plugin", "Your second plugin"],
  "mcp_servers": {
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
pnpm run start --agent="name_of_your_config.json" --models="name_of_your_config.json"
```

### Server Mode

Run the server :

```bash
# start with the default.agent.json
pnpm run start:server

# start with your custom configuration
pnpm run start:server --agent="name_of_your_config.json" --models="name_of_your_config.json"
```

#### Available Modes

|             | Interactive Mode | Autonomous Mode |
| ----------- | ---------------- | --------------- |
| Prompt Mode | ✅               | ✅              |
| Server Mode | ✅               | ✅              |

### Implement Snak in your project

1. Install snak package

```bash
#using npm
npm install @snakagent

# using pnpm
pnpm add @snakagent
```

2. Create your agent instance

```typescript
import { SnakAgent } from 'starknet-agent-kit';

const agent = new SnakAgent({
  provider: new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }),
  accountPrivateKey: process.env.STARKNET_PRIVATE_KEY,
  accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS,
  aiModel: process.env.AI_MODEL,
  aiProvider: process.env.AI_PROVIDER,
  aiProviderApiKey: process.env.AI_PROVIDER_API_KEY,
  signature: 'key',
  agentMode: 'interactive',
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
