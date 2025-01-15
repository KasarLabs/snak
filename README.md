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

A toolkit for creating AI agents that can interact with the Starknet blockchain, available both as an NPM package and a ready-to-use NestJS server.

> ⚠️ **Warning**: This kit is currently under development. Use it at your own risk! Please be aware that sharing sensitive information such as private keys, personal data, or confidential details with AI models or tools carries inherent security risks. The contributors of this repository are **not responsible** for any loss, damage, or issues arising from its use.

## Features

- Retrieve account information (Balance, public key, etc.)
- Create one or multiple accounts (Argent & OpenZeppelin)
- Transfer assets between accounts
- DeFi operations (Swap on Avnu)
- dApp interactions (Create a .stark domain)
- All RPC read methods supported (getBlockNumber, getStorageAt, etc.)

## Installation

```bash
npm install starknet-agent-kit
```

Required peer dependencies:

```bash
npm install @nestjs/common @nestjs/core @nestjs/platform-fastify starknet @langchain/anthropic
```

## Prerequisites

You will need:
- A Starknet wallet private key (you can get one from [Argent X](https://www.argent.xyz/argent-x))
- An AI provider API key (supported providers: Anthropic, OpenAI, Google (Gemini), Ollama)

## Usage

### As an NPM Package

```typescript
import { StarknetAgent } from 'starknet-agent-kit';

const agent = new StarknetAgent({
  aiProviderApiKey: 'your-ai-provider-key',
  aiProvider: 'anthropic', // or 'openai', 'gemini', 'ollama'
  aiModel: 'claude-3-5-sonnet-latest',
  walletPrivateKey: 'your-wallet-private-key',
  rpcUrl: 'your-rpc-url'
});

// Execute commands in natural language
await agent.execute('transfer 0.1 ETH to 0x123...');
await agent.execute('What is my ETH balance?');
await agent.execute('Swap 5 USDC for ETH');
```

### Using Individual Tools

All Langchain tools are available for direct import:

```typescript
import { getBalance, transfer, swapTokens } from 'starknet-agent-kit';

// Use tools individually
const balance = await getBalance(address);
```

## Running as a Server

The package includes a ready-to-use NestJS server implementation.

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/kasarlabs/starknet-agent-kit.git
cd starknet-agent-kit
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
Create a `.env` file:
```env
# Required for both package and server
PRIVATE_KEY=""
PUBLIC_ADDRESS=""
AI_PROVIDER_API_KEY=""
AI_MODEL=""  # e.g., "claude-3-5-sonnet-latest"
AI_PROVIDER=""  # "anthropic", "openai", "gemini", or "ollama"
RPC_URL=""

# Required only for server
API_KEY=""  # Security key for API endpoints
PORT=3001  # Optional, defaults to 3000
```

4. Start the development server:
```bash
npm run start:dev
```

### Server API Endpoints

#### Make Agent Requests
```bash
curl --location 'localhost:3001/api/agent/request' \
--header 'x-api-key: your-api-key' \
--header 'Content-Type: application/json' \
--data '{
    "request": "What's my ETH balance?"
}'
```

## Testing

```bash
# Run unit tests
npm run test

# Run end-to-end tests
npm run test:e2e
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.