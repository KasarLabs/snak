# Contract Plugin - Comprehensive Guide

## Overview
The Contract plugin for Starknet Agent Kit provides tools for declaring, deploying, and managing Cairo contracts on the Starknet blockchain. It offers a streamlined workflow for taking compiled contracts and deploying them to Starknet network through simple conversational commands.

## Core Tools and Their Usage

### Contract Declaration

#### `declare_contract`
- **Purpose**: Declares a Cairo contract on Starknet
- **Usage**: "Declare erc20.cairo from the project my_project"
- **Parameters**:
  - Project name: Name of the project in the database containing the contract to declare
  - Contract name: Name of the specific contract to declare
- **Details**: This is the first step in the deployment process, registering the contract's code on-chain and returning a class hash.

### Contract Deployment

#### `deploy_contract`
- **Purpose**: Deploys a declared contract to Starknet
- **Usage**: "Deploy my contract with class hash 0x123... with parameters x:10, y:'hello'"
- **Parameters**:
  - Class hash: Hash of the declared contract
  - Constructor arguments: Arguments for the contract constructor
- **Details**: Creates a new instance of the contract on-chain and returns the deployment address.

### Contract Management

#### `list_declared_contracts`
- **Purpose**: Lists all declared contracts
- **Usage**: "List all my declared contracts"
- **Details**: Show all contracts that have been declared with their class hashes and transaction hashes.

#### `list_deployed_contracts_by_class_hash`
- **Purpose**: Lists all deployments of a specific contract
- **Usage**: "List all deployments of contractwith class hash 0x123..."
- **Parameters**:
  - Class hash: The contract's class hash
- **Details**: Shows all instances where a particular contract has been deployed.

#### `delete_contract_by_class_hash`
- **Purpose**: Removes a contract from the database
- **Usage**: "Delete the contract with class hash 0x123... from my database"
- **Parameters**:
  - Class hash: The contract's class hash
- **Details**: Removes the contract reference from local storage. This doesn't affect on-chain deployments.

## Usage Examples

### Basic Deployment Workflow
```
1. Declare my token erc20.cairo from the project in my_project
   [Uses declare_contract to register on Starknet]

2. Deploy my token contract with parameters name:'MyToken', symbol:'MTK', decimals:18
   [Uses deploy_contract to create a contract instance on-chain]
```

### Contract Management
```
1. List all my declared contracts
   [Uses list_declared_contracts to see all contracts]

2. List all deployments of the contract with class hash 0x123...
   [Uses list_deployed_contracts_by_class_hash to see all instances]

3. Delete the contract with class hash 0x456... from my database
   [Uses delete_contract_by_class_hash to clean up]
```

## Integration with Other Plugins

### Integration with Scarb Plugin
The Contract plugin works as the final step in the development pipeline after compilation with Scarb:

- Seamlessly takes Scarb-compiled artifacts for declaration and deployment
- Works with Scarb's Sierra and CASM outputs for various contract operations
- Enables a complete workflow from compilation to on-chain deployment

### Integration with CairoCoder Plugin
From a Contract deployment perspective, CairoCoder provides:

- Contract templates that are deployment-ready once compiled
- Quick fixes for deployment-related issues in contract code
- Project organization to manage multiple deployable contracts
- Smart constructor parameter handling through code generation

This three-plugin integration (CairoCoder → Scarb → Contract) creates a powerful end-to-end development experience, allowing you to go from code generation to on-chain deployment through simple conversational commands.
