# AVNU MCP Server

A Model Context Protocol (MCP) server for interacting with the AVNU decentralized exchange on Starknet, enabling token swaps and route discovery.

## Features

- **Token Swapping**: Execute token swaps on AVNU DEX
- **Route Discovery**: Find optimal trading routes for token pairs
- **Price Discovery**: Get quotes and pricing information
- **MEV Protection**: Benefit from AVNU's MEV protection features

## Installation

```bash
npm install
npm run build
```

## Usage

### Environment Variables

Set the following environment variables:

```bash
export STARKNET_RPC_URL="https://alpha-mainnet.starknet.io"
export STARKNET_WALLET_ADDRESS="your_wallet_address"
export STARKNET_PRIVATE_KEY="your_private_key"
```

### Running the Server

```bash
npm start
```

Or for development:

```bash
npm run dev
```

## Available Tools

### `avnu_swap_tokens`

Swaps a specified amount of one token for another token using AVNU DEX.

**Parameters:**
- `sellTokenSymbol` (string): Symbol of the token to sell (e.g., 'ETH', 'USDC')
- `buyTokenSymbol` (string): Symbol of the token to buy (e.g., 'ETH', 'USDC')
- `sellAmount` (number): Amount of tokens to sell

**Example:**
```json
{
  "sellTokenSymbol": "ETH",
  "buyTokenSymbol": "USDC",
  "sellAmount": 1.5
}
```

### `avnu_get_route`

Gets a specific route for token swapping on AVNU.

**Parameters:**
- `sellTokenSymbol` (string): Symbol of the token to sell
- `buyTokenSymbol` (string): Symbol of the token to buy
- `sellAmount` (number): Amount of tokens to sell

## Available Resources

### `avnu://exchange-info`

Provides information about the AVNU decentralized exchange, including supported features and tokens.

## Available Prompts

### `swap_eth_for_usdc`

Predefined prompt for swapping ETH for USDC.

**Parameters:**
- `amount` (string): Amount of ETH to swap

### `get_swap_route`

Predefined prompt for getting the best route for a token swap.

**Parameters:**
- `sellToken` (string): Token to sell
- `buyToken` (string): Token to buy
- `amount` (string): Amount to sell

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Clean

```bash
npm run clean
```

## Architecture

The server is built using:
- **Model Context Protocol (MCP)**: For standardized AI model interactions
- **AVNU SDK**: For DEX interactions
- **Starknet.js**: For blockchain interactions
- **TypeScript**: For type safety
- **Zod**: For schema validation

## Security Notes

- **Private Keys**: Never expose your private key in code or logs
- **Environment Variables**: Use secure environment variable management
- **Network Security**: Ensure secure RPC endpoint connections
- **Transaction Validation**: Always verify transaction details before execution

## Supported Tokens

The server supports various tokens including:
- ETH
- USDC
- USDT
- DAI
- WBTC

## Error Handling

The server provides comprehensive error handling for:
- Network connectivity issues
- Insufficient token balances
- Invalid token pairs
- Transaction failures
- Route discovery failures

## License

MIT License
