# CairoCoder Plugin - Comprehensive Guide

## Overview
CairoCoder is a Starknet Agent Kit plugin that lets you generate, fix, and manage Cairo code using AI. It organizes your code in a structured system of projects, programs, and dependencies, stored in a database for persistence.

## Required Environment Variables

For the CairoCoder plugin to function properly, make sure to set these environment variables in your `.env` file:

- **CAIRO_GENERATION_API_URL**: URL of the API used for Cairo code generation
- **CAIRO_UPLOAD_DIR**: Directory where Cairo files should be placed for import (relative to plugin root)
- **PostgreSQL variables**: Standard database connection variables (see database documentation)


## Core Tools and Their Usage

### Project Management

#### `cairocoder_register_project`
- **Purpose**: Creates a new Cairo project in the database
- **Usage**: "Create a new project called my_project"
- **Details**: This establishes a container for all your Cairo programs and dependencies. Projects are isolated from each other and can have different dependencies.

#### `cairocoder_list_projects`
- **Purpose**: Lists all stored Cairo projects
- **Usage**: "List all my projects"
- **Details**: Shows project names and can be useful to remember what projects you've created.

#### `cairocoder_delete_project`
- **Purpose**: Permanently removes a project and all its data
- **Usage**: "Delete the project my_project"
- **Details**: This is irreversible and will remove all programs and dependencies associated with the project.

### Code Generation and Fixing

#### `cairocoder_generate_code`
- **Purpose**: Generates Cairo code using AI
- **Usage**: "Generate an ERC-20 contract in my_project called token.cairo"
- **Parameters**:
  - Project name: The target project
  - Program name: What to name the file
  - Prompt: Description of the code to generate
- **Details**: The more specific your description, the better the generated code will be. You can specify structure, interfaces, and functionality.

#### `cairocoder_fix_code`
- **Purpose**: Fixes errors in existing Cairo code
- **Usage**: "Fix token.cairo in my_project which has an error in the transfer function"
- **Parameters**:
  - Project name: Where the program is stored
  - Program name: The file to fix
  - Error description: Details about the error
- **Details**: Works best when you provide the exact error message or a clear description of what's not working.

### Program Management

#### `cairocoder_add_program`
- **Purpose**: Adds programs to an existing project
- **Usage**: "Add the wallet.cairo program to my_project"
- **Parameters**:
  - Project name: Target project
  - Program paths: Files to add
- **Details**: Can add multiple programs at once. 
  - **Important**: The path must be a filename inside the CAIRO_UPLOAD_DIR directory
  - Example: If CAIRO_UPLOAD_DIR="uploads/" and you have a file in "uploads/wallet.cairo", then use "wallet.cairo" as the program path
  - All Cairo files to be added must be placed in this directory beforehand

#### `cairocoder_delete_program`
- **Purpose**: Removes programs from a project
- **Usage**: "Remove unused.cairo from my_project"
- **Parameters**:
  - Project name: Source project
  - Program names: Programs to delete
- **Details**: Permanently removes the programs from the database.

### Dependency Management

#### `cairocoder_add_dependency`
- **Purpose**: Adds dependencies to a project
- **Usage**: "Add openzeppelin dependency to my_project"
- **Parameters**:
  - Project name: Target project
  - Dependency names: Dependencies to add
- **Details**: 
  - Only the dependency name is required (e.g., "openzeppelin", "alexandria")
  - The system will automatically associate the latest version referenced in the Scarb registry
  - Before adding, verify that the dependency actually exists in the Scarb registry
  - These references help track project dependencies and will be used when compiling with the Scarb plugin
  - Dependencies are stored in the database but not physically installed until compilation

#### `cairocoder_delete_dependency`
- **Purpose**: Removes dependencies from a project
- **Usage**: "Remove unwanted dependency from my_project"
- **Parameters**:
  - Project name: Source project
  - Dependency names: Dependencies to remove
- **Details**: Only removes the reference from the database.

## Usage Examples with Tool Details

### NFT Project Example
```
1. Create a new project called nft_project
   [Uses cairocoder_register_project]

2. Generate a simple ERC-721 contract in nft_project named nft_contract.cairo with mint, transfer, and approve functions
   [Uses cairocoder_generate_code with detailed prompt]

3. Add the openzeppelin dependency to nft_project
   [Uses cairocoder_add_dependency for ERC-721 standards]

4. Fix any compilation errors in nft_contract.cairo
   [Uses cairocoder_fix_code with specific error details]
```

## Integration with Scarb Plugin

Once your Cairo projects are created and stored in the database, they can be seamlessly used with the Scarb plugin to:

- **Compile your contracts**: Use `scarb_compile_contract` to build your Cairo code
- **Execute programs**: Run program functions with `scarb_execute_program` 
- **Generate proofs**: Create mathematical proofs for your Cairo programs with `scarb_prove_program`
- **Verify proofs**: Validate program execution proofs with `scarb_verify_program`

This integration provides a complete development workflow from code generation and management with CairoCoder to compilation and execution with Scarb, all within the Starknet Agent Kit environment.
