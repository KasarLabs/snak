# Kasarlabs Argent Plugins

A collection of Starknet tools for creating and deploying Argent accounts through the Kasarlabs ecosystem.

## Overview

This package provides Starknet tools that allow developers to easily create and deploy Argent accounts on the Starknet network. These tools integrate with the Kasarlabs core framework to streamline account management operations.

## Features

- Create new Argent accounts
- Deploy existing Argent accounts
- Manage account details securely

## Installation

```bash
npm install @kasarlabs/argent-plugins
```

## Usage

### Registering the Tools

Import and register the Argent tools in your application:

```javascript
import { registerTools } from '@kasarlabs/argent-plugins';
import { StarknetTool, StarknetAgentInterface } from '@kasarlabs/core';

// Initialize your tools registry
const StarknetToolRegistry = [];

// Optional: Your agent implementation
const agent = yourStarknetAgent;

// Register the Argent tools
registerTools(StarknetToolRegistry, agent);
```

### Creating a New Argent Account

Once registered, you can use the tools to create a new Argent account:

```javascript
// Assuming you have an agent instance
const result = await agent.execute('create_new_argent_account');

console.log('New Argent Account:', result);
// Output will include privateKey, publicKey, and contractAddress
```

### Deploying an Existing Argent Account

To deploy an existing account:

```javascript
const accountDetails = {
  privateKey: 'your_private_key',
  // Other required account details according to accountDetailsSchema
};

const deploymentResult = await agent.execute('deploy_existing_argent_account', accountDetails);

console.log('Deployed Account:', deploymentResult);
```

## Tool Descriptions

### create_new_argent_account

Creates a new Argent account and returns essential account information.

- **Name**: `create_new_argent_account`
- **Description**: Creates a new Argent account and returns the privateKey/publicKey/contractAddress
- **Plugin**: `argent`
- **Parameters**: None
- **Returns**: Object containing account information (wrapped by `wrapAccountCreationResponse`)

### deploy_existing_argent_account

Deploys an existing Argent account using provided account details.

- **Name**: `deploy_existing_argent_account`
- **Description**: Deploy an existing Argent Account and return the privateKey/publicKey/contractAddress
- **Plugin**: `argent`
- **Schema**: Uses `accountDetailsSchema` for validation
- **Parameters**: Account details according to the schema
- **Returns**: Deployment information including account details

## Schema Information

The package uses `accountDetailsSchema` to validate account details for deployment. Refer to the schema documentation for the exact format and required fields.

## Dependencies

- `@kasarlabs/core`: Core framework for Starknet tools and agent interfaces
- Account management utilities from '../utils/AccountManager.js'
- Account creation and deployment actions

## License

MIT License - see the LICENSE file for details.

---

For detailed documentation visit [docs.kasar.io](https://docs.kasar.io)
