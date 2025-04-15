# Starknet Agent Kit - Atlantic Plugin

The Atlantic Plugin provides tools for working with zero-knowledge proofs on the Starknet blockchain via the Atlantic proof service.

## Features

This plugin adds the following tools:

- **get_proof_service**: Query Atlantic API to generate a proof from a .zip file on Starknet and return the query ID.
- **verify_proof_service**: Query Atlantic API to verify a proof from a .json file on Starknet and return the query ID.

## Usage

The Atlantic Plugin is used internally by the Starknet Agent and doesn't need to be called directly. When the agent is initialized, it automatically registers these tools, making them available for use.

## Example

When asking the agent to perform Atlantic-related tasks, it will use the appropriate tool from this plugin:

```
"Generate a proof for my project.zip file"  // Uses get_proof_service
"Verify the proof in proof.json"  // Uses verify_proof_service
```

## Development

To extend this plugin, add new tools in the `src/tools` directory and register them in the `registerTools` function in `src/tools/index.ts`. 