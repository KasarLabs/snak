# Contributing to Starknet Agent Kit

Thank you for your interest in contributing to Starknet Agent Kit! We welcome all contributions, no matter how big or small.

## Table of Contents

- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Adding New Features](#adding-new-features)
- [Contributing Guidelines](#contributing-guidelines)
- [Testing](#testing)
- [Documentation](#documentation)

## Repository Structure

The Starknet Agent Kit is organized with the following structure:

```
.
├── client/                # Frontend application
├── src/                   # Backend source code
│   ├── agents/            # Agent system implementation
│   ├── common/            # Shared utilities and error handling
│   ├── config/            # Configuration management
│   ├── lib/
│   │   ├── agent/         # Core agent functionality (START HERE)
│   │   │   ├── plugins/   # Protocol-specific implementations
│   │   │   │   ├── core/  # Core functionality (RPC, accounts, etc.)
│   │   │   │   ├── avnu/  # Avnu DEX integration (example)
│   │   │   │   └── ...    # Other protocol integrations
│   │   │   ├── tools/    # Tool implementations
│   │   │   └── schemas/  # Validation schemas
│   │   └── ...
│   └── ...
└── test/                # Test files
```

## Getting Started

1. Fork and clone the repository:

```bash
git clone https://github.com/kasarlabs/starknet-agent-kit.git
cd starknet-agent-kit
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up your environment variables:

```bash
cp .env.example .env
```

```
# Starknet configuration (mandatory)
STARKNET_PUBLIC_ADDRESS="YOUR_STARKNET_PUBLIC_ADDRESS"
STARKNET_PRIVATE_KEY="YOUR_STARKNET_PRIVATE_KEY"
STARKNET_RPC_URL="YOUR_STARKNET_RPC_URL"

# AI Provider configuration (mandatory)
AI_PROVIDER_API_KEY="YOUR_AI_PROVIDER_API_KEY"
AI_MODEL="YOUR_AI_MODEL"
AI_PROVIDER="YOUR_AI_PROVIDER"

# NestJS server configuration
SERVER_API_KEY="YOUR_SERVER_API_KEY"
SERVER_PORT="YOUR_SERVER_PORT"

# Agent additional configuration
DISCORD_BOT_TOKEN?="YOUR_DISCORD_BOT_TOKEN"
DISCORD_CHANNEL_ID?="YOUR_DISCORD_CHANNEL_ID"
```

4. Start the development environment:

```bash
pnpm dev
```

## Development Workflow

1. **Create a new branch** following the convention:

   ```bash
   git checkout -b feat/scope-your-feature
   ```

2. **Make your changes** while following project guidelines.

3. **Commit using conventional commits**:

   ```bash
   git commit -m "feat(scope): add new feature"
   ```

4. **Push your changes and create a pull request**:
   ```bash
   git push origin feat/scope-your-feature
   ```

## Adding New Features

### Adding a New Protocol Integration

1. Create a new directory under `@plugins/`:

```
@plugins/your-protocol/
├── abis/         # Protocol-specific ABIs
├── actions/      # Protocol actions
├── utils/        # Utility functions
├── constants/    # Protocol constants
└── types/        # Type definitions
```

2. Implement your protocol's actions in the `actions/` directory following the existing patterns

3. Create validation schemas in `schemas/` directory using Zod

4. Register your actions in the toolkit registry

### Adding New Actions

1. Create a new action file in the appropriate protocol directory
2. Define the action's schema using Zod
3. Implement the action's functionality
4. Register the action in the registry

Example:

```typescript
StarknetToolRegistry.push
({
  name: 'your_action_name',
  description: 'Description of what your action does',
  schema: yourActionSchema,
  execute: youractionFunction,
});
```

Follow [this documentation](https://docs.kasar.io/add-agent-actions) for more informations regarding Tools and Actions.

## Contributing Guidelines

- Follow TypeScript best practices and use types appropriately
- Write clear commit messages following conventional commits
- Include tests for new Actions
- Update documentation for API changes
- Ensure all tests pass before submitting PR
- Follow the existing code style and formatting

## Testing

1. Run tests:

```bash
pnpm test
```

2. Write tests for new features:

```typescript
describe('YourFeature', () => {
  it('should work as expected', async () => {
    // Your test implementation
  });
});
```

## Documentation

- Document all public APIs and functions
- Update README.md if adding new features
- Include examples in documentation
- Update CHANGELOG.md with your changes

## Best Practices

### Error Handling

- Use the provided error classes in `common/errors/`
- Always return properly formatted JSON responses
- Include appropriate error messages and types

### Input Validation

- Use Zod schemas for all inputs
- Include descriptive schema messages
- Handle edge cases appropriately

### Code Style

- Use meaningful variable and function names
- Keep functions focused and single-purpose
- Comment complex logic
- Follow the existing project structure

## Getting Help

If you're stuck or have questions:

1. Check existing issues and pull requests
2. Create a new issue with a detailed description
3. Tag appropriate maintainers

## Pull Request Process

1. Fill out the PR template completely
2. Link related issues
3. Ensure CI checks pass
4. Request review from maintainers
5. Address review comments
6. Update documentation as needed

Thank you for contributing to Starknet Agent Kit!
