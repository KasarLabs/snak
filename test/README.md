# Testing Guide for tools

## Overview
This guide helps developers create effective tests for Starknet AI agent tools. The testing framework ensures reliability and quality for all contributed tools.

## Quick Start

### Test Location
Place your tests in `test/unit-test/method/` using appropriate subdirectories (e.g., `token/`, `account/`, etc.) and name files with `.spec.ts` suffix.

### Basic Test Structure
```typescript
import { yourTool } from 'path/to/your/tool';
import { createMockStarknetAgent, createMockInvalidStarknetAgent } from 'test/jest/setEnvVars';

const agent = createMockStarknetAgent();
const wrong_agent = createMockInvalidStarknetAgent();

describe('Your Tool Tests', () => {
  // Success cases
  it('succeeds with valid parameters', async () => {
    const result = await yourTool(agent, validParams);
    const parsed = JSON.parse(result);
    expect(parsed).toMatchObject({
        status: 'success',
        // Contract-specific response data
    });
  });

  // Error cases
  it('fails with invalid parameters', async () => {
    const result = await yourTool(agent, invalidParams);
    const parsed = JSON.parse(result);
    expect(parsed).toMatchObject({
        status: 'failure',
        // Contract-specific response data
    });
  });
});
```

## Testing Essentials

### Mock Agents
- `createMockStarknetAgent()`: For successful test cases
- `createMockInvalidStarknetAgent()`: For authentication error cases


### Required Test Cases
Every tool must test:
1. Success scenarios with valid parameters
2. Authentication failures using `wrong_agent`
3. Invalid/missing parameters
4. Invalid contract addresses
5. Edge cases specific to the tool


## Test Commands
```bash
# Run all tests
npm test

# Run specific test file
npm test path/to/your/test.spec.ts

# Run with coverage
npm test -- --coverage
```


## Resources

### Useful Links
- Jest Documentation: [https://jestjs.io/docs/getting-started](https://jestjs.io/docs/getting-started)
- Starknet.js Documentation: [https://www.starknetjs.com/docs/API/](https://www.starknetjs.com/docs/API/)



### Support
- Check existing tests for examples
- Review test patterns in similar tools
- Open GitHub issues for questions
