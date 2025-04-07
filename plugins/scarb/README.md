# Scarb Plugin - Comprehensive Guide

## Overview
The Scarb plugin for Starknet Agent Kit provides a seamless interface for working with Scarb, the Cairo package manager and build tool. It enables installing Scarb, compiling Cairo contracts, executing programs, and generating/verifying proofs - all through conversational commands to your agent.

> **IMPORTANT**: This plugin requires Scarb version 2.10.0 specifically. Other versions may cause compatibility issues with the tools provided.

## Core Tools and Their Usage

### Installation

#### `scarb_install`
- **Purpose**: Installs or verifies Scarb installation
- **Usage**: ```install scarb```
- **Details**: Automatically installs Scarb version 2.10.0 if not present, or verifies that the exact required version is installed. If a different version is detected, it will notify you.

### Contract Compilation

#### `compile_contract`
- **Purpose**: Compiles Cairo contracts or programs using Scarb
- **Usage**: ```compile my project erc20_contract```
- **Parameters**:
  - Project name: Name of the project in the database containing the contract/program to compile
- **Details**: 
  - For projects of contract type, this produces Sierra and CASM outputs
  - For projects of program type, this produces Cairo bytecode only

### Program Execution

#### `execute_program`
- **Purpose**: Executes a Cairo program function
- **Usage**: ```execute my project fibonacci```
- **Parameters**:
  - Project name: Name of the project to execute
  - Executable name (optional): The specific executable target name to run
  - Function name (optional): The specific function to call
  - Arguments (optional): Comma-separated function arguments (serialized as integers)
  - Mode (optional): Target mode - "standalone" or "bootloader" (defaults to bootloader)
- **Details**: 
  - Only works with Cairo program projects
  - Arguments format: comma-separated integers (e.g., "1,2,3" for three integer arguments)
  - Executable name vs Function name:
    - Use executable name when multiple targets are defined with unique names in Scarb.toml
    - Use function name to specify a particular #[executable] function to run (default is main)
  - Execution modes:
    - Standalone: For internal scarb proving
    - Bootloader: For external Stwo proving (produce a trace file .zip) (default)

### Proof Generation and Verification

#### `prove_program`
- **Purpose**: Generates a mathematical proof for a Cairo program execution in a JSON file
- **Usage**: ```prove my project fibonacci```
- **Parameters**:
  - Project name: Target project
- **Details**: 
  - Only works with Cairo program projects
  - Creates cryptographic proofs that verify the correct execution of Cairo programs
  - Automatically runs scarb_execute_program beforehand to get the execution trace

#### `verify_program`
- **Purpose**: Verifies a proof for a Cairo program execution
- **Usage**: ```verify my project fibonacci```
- **Parameters**:
  - Project name: Target project
- **Details**: 
  - Only works with Cairo program projects
  - Validates that a proof correctly represents the execution of a program
  - You have to run scarb_prove_program beforehand to get the proof file

## Usage Examples

### Basic Workflow
```
1. Install Scarb on my system
   [Uses scarb_install to set up the required tooling]

2. Compile my project my_cairo_program
   [Uses compile_contract to build the project]

3. Execute the main function in my project my_cairo_program
   [Uses execute_program]

4. Generate a proof for this execution
   [Uses prove_program with the execution trace]

5. Verify the generated proof
   [Uses verify_program to validate the execution]
```

### Integration with Other Plugins
```
1. Create a new Cairo project called erc20_contract
   [Uses CairoCoder plugin]

2. Generate an ERC20 contract called erc20.cairo
   [Uses CairoCoder plugin]

3. Compile project erc20_contract
   [Uses Scarb plugin]

4. Declare and deploy erc20.cairo of project erc20_contract
   [Uses Contract plugin]
```

## Integration with CairoCoder Plugin

CairoCoder serves as a powerful companion that enhances your development experience:

- **Error resolution**: When Scarb compilation fails, CairoCoder can analyze and fix syntax errors or logical issues
- **Project management**: Organizes your Cairo projects, programs, and dependencies in a structured database
- **Code generation**: Quickly scaffolds boilerplate code to use with Scarb, saving development time
- **Dependency tracking**: Keeps track of all project dependencies that Scarb needs to compile

This integration creates a feedback loop where compilation or execution issues encountered with Scarb can be immediately addressed through CairoCoder, streamlining the development process.

## Integration with Contract Plugin

The Scarb plugin seamlessly bridges the development and deployment workflows by integrating with the Contract plugin. After compiling your Cairo contracts with Scarb, you can:

- **Declare contracts** on Starknet using the compiled artifacts
- **Deploy contracts** to Starknet network

This integration creates a complete end-to-end workflow:
1. Generate and manage code with CairoCoder
2. Compile and test with Scarb
3. Deploy and interact on-chain with Contract plugin

The three plugins working together provide a comprehensive development experience from initial code creation to on-chain deployment, all through natural language commands to your Starknet Agent.
