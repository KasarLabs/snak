# Artpeace MCP Server

An MCP (Model Context Protocol) server for collaborative pixel art creation on a shared canvas using the Artpeace contract on Starknet.

## Features

- **Place Pixels**: Place pixels on collaborative canvases with optional parameters
- **Transaction Signatures**: Generate transaction data for pixel placement
- **Color Management**: Support for hex colors, color names, and palette indices
- **Multi-Pixel Support**: Place multiple pixels in a single transaction
- **Canvas Validation**: Automatic validation of canvas dimensions and color palettes
- **API Integration**: Direct integration with Artpeace API for world and color data

## Installation

```bash
npm install artpeace-mcp-server
```

## Usage

### Environment Variables

Set the following environment variables for pixel placement operations:

```bash
export STARKNET_RPC_URL="https://starknet-mainnet.infura.io/v3/your-api-key"
export STARKNET_ACCOUNT_PUBLIC_KEY="your-account-public-key"
export STARKNET_ACCOUNT_PRIVATE_KEY="your-account-private-key"
```

### Available Tools

#### 1. Place Pixel

Places a pixel on the Artpeace collaborative canvas.

```json
{
  "name": "place_pixel",
  "arguments": {
    "params": [
      {
        "canvasId": 0,
        "xPos": 100,
        "yPos": 200,
        "color": "red"
      }
    ]
  }
}
```

**Response:**
```json
{
  "status": "success",
  "transaction_hash": ["0x..."]
}
```

#### 2. Place Pixel Signature

Generates transaction signature data for placing pixels.

```json
{
  "name": "place_pixel_signature",
  "arguments": {
    "params": [
      {
        "canvasId": 0,
        "xPos": 100,
        "yPos": 200,
        "color": "#FF0000"
      }
    ]
  }
}
```

**Response:**
```json
{
  "transaction_type": "INVOKE",
  "results": [
    {
      "status": "success",
      "transactions": {
        "contractAddress": "0x...",
        "entrypoint": "place_pixel",
        "calldata": [0, 20100, 0, 1234567890]
      }
    }
  ]
}
```

### Available Resources

#### Artpeace Canvas Information

Access information about Artpeace canvases and available operations.

**URI:** `artpeace://canvas-info`

### Available Prompts

1. **place_random_pixel**: Place a pixel at a random location
2. **place_pixel_at_position**: Place a pixel at specific coordinates
3. **generate_pixel_signature**: Generate transaction signature for pixel placement

## Parameters

### Canvas ID
- Can be a numeric ID or world name string
- Defaults to 0 if not specified
- Validated against Artpeace API

### Position (xPos, yPos)
- Optional coordinates for pixel placement
- If not provided, random position is generated
- Validated against canvas dimensions

### Color
- Can be specified as:
  - Hex color code (e.g., "#FF0000")
  - Color name (e.g., "red", "blue", "green")
  - Palette index (e.g., "0", "1", "2")
- Defaults to "0" (first palette color) if not specified

## API Integration

The server integrates with Artpeace API endpoints:
- `https://api.art-peace.net/get-world` - Get canvas information
- `https://api.art-peace.net/get-worlds-colors` - Get color palette
- `https://api.art-peace.net/get-world-id` - Lookup world ID by name

## Development

### Building

```bash
npm run build
```

### Running in Development

```bash
npm run dev
```

### Testing

```bash
npm test
```

## Architecture

The server is built using the Model Context Protocol SDK and includes:

- **ArtpeaceHelper**: Handles pixel placement validation and defaults
- **Checker**: Validates canvas dimensions, positions, and colors
- **ColorAnalyzer**: Converts between color formats (HEX, RGB, HSV)
- **Starknet Integration**: Direct contract interaction for pixel placement
- **API Integration**: Fetches canvas and color data from Artpeace API

## Security Notes

- Account credentials should be properly secured in production
- All transactions are signed with the provided account
- Color validation ensures only valid palette colors are used
- Position validation prevents out-of-bounds pixel placement

## License

MIT
