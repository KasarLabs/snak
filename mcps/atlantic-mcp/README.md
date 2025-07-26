# Atlantic MCP Server

An MCP (Model Context Protocol) server for working with zero-knowledge proofs via the Atlantic proof service.

## Features

- **Proof Generation**: Generate zero-knowledge proofs from ZIP files
- **Proof Verification**: Verify proofs from JSON files
- **File Validation**: Automatic validation of ZIP and JSON files
- **API Integration**: Direct integration with Atlantic proof service
- **Dashboard Integration**: Links to Atlantic dashboard for status tracking
- **Error Handling**: Comprehensive error handling with detailed messages

## Installation

```bash
npm install atlantic-mcp-server
```

## Usage

### Environment Variables

Set the following environment variables for Atlantic service operations:

```bash
export ATLANTIC_API_KEY="your-atlantic-api-key"
export PATH_UPLOAD_DIR="/path/to/upload/directory/"
export SECRET_PHRASE="optional-secret-phrase-for-file-hashing"
```

### Available Tools

#### 1. Generate Proof

Generates a zero-knowledge proof from a ZIP file.

```json
{
  "name": "get_proof_service",
  "arguments": {
    "filename": "proof-data.zip"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "url": "https://staging.dashboard.herodotus.dev/explorer/atlantic/query-id"
}
```

#### 2. Verify Proof

Verifies a zero-knowledge proof from a JSON file.

```json
{
  "name": "verify_proof_service",
  "arguments": {
    "filename": "proof.json",
    "memoryVerification": "verification-type"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "url": "https://staging.dashboard.herodotus.dev/explorer/atlantic/query-id"
}
```

### Available Resources

#### Atlantic Proof Service Information

Access information about Atlantic proof service and available operations.

**URI:** `atlantic://proof-service-info`

### Available Prompts

1. **generate_proof**: Generate a zero-knowledge proof from a ZIP file
2. **verify_proof**: Verify a zero-knowledge proof from a JSON file
3. **check_proof_status**: Check the status of a proof generation or verification

## File Requirements

### Proof Generation
- **Input**: ZIP file containing proof generation data
- **Validation**: File must have valid ZIP signature
- **Content**: Should contain circuit data and inputs for proof generation

### Proof Verification
- **Input**: JSON file containing proof data
- **Validation**: File must be valid JSON format
- **Content**: Should contain proof data and verification parameters

## API Integration

The server integrates with Atlantic API endpoints:
- **Proof Generation**: `https://atlantic.api.herodotus.cloud/v1/proof-generation`
- **Proof Verification**: `https://atlantic.api.herodotus.cloud/v1/l2/atlantic-query/proof-verification`
- **Dashboard**: `https://staging.dashboard.herodotus.dev/explorer/atlantic/`

## Configuration

### Required Environment Variables
- `ATLANTIC_API_KEY`: Your Atlantic API key for authentication
- `PATH_UPLOAD_DIR`: Directory path where uploaded files are stored

### Optional Environment Variables
- `SECRET_PHRASE`: Secret phrase used for file hashing (if not provided, files are accessed directly)

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

- **Proof Generation**: Handles ZIP file upload and proof generation requests
- **Proof Verification**: Handles JSON file upload and proof verification requests
- **File Validation**: Validates ZIP and JSON file formats
- **Error Handling**: Comprehensive error handling with custom error types
- **API Integration**: Direct integration with Atlantic proof service API
- **File Management**: Secure file handling with optional hashing

## Security Notes

- API keys should be properly secured in production
- File upload directory should have appropriate permissions
- Optional secret phrase provides additional file security through hashing
- All file operations are validated before processing
- Error messages are sanitized to prevent information leakage

## Error Handling

The server provides detailed error handling for:
- **Validation Errors**: Invalid file formats or missing parameters
- **Not Found Errors**: Missing files or resources
- **API Errors**: Atlantic service communication issues
- **File System Errors**: File access and permission issues

## License

MIT
