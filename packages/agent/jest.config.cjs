// jest.config.cjs
/** @type {import('jest').Config} */
module.exports = {
  // Tell Jest to look in the src directory, not dist
  roots: ['<rootDir>/src'],

  // Specify the test environment
  testEnvironment: 'node',

  // Transform TypeScript files
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tsconfig.test.json',
      },
    ],
  },

  // Handle .js extensions in import paths
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@snakagent/core$': '<rootDir>/src/__mocks__/@snakagent/core.ts',
    '^@snakagent/database$': '<rootDir>/src/__mocks__/@snakagent/database.ts',
    '^@snakagent/database/queries$': '<rootDir>/src/__mocks__/@snakagent/database.ts',
    '^snak-mcps$': '<rootDir>/src/__mocks__/snak-mcps.ts',
    '^../../config/agentConfig\\.js$': '<rootDir>/src/__mocks__/agentConfig.ts',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@agents/core/utils\\.js$': '<rootDir>/src/agents/core/utils.ts',
    '^@agents/(.*)$': '<rootDir>/src/agents/$1',
    '^@lib/(.*)$': '<rootDir>/src/shared/lib/$1',
    '^@prompts/index\\.js$': '<rootDir>/src/shared/prompts/index.ts',
    '^@prompts/core/prompts\\.js$': '<rootDir>/src/shared/prompts/core/prompts.ts',
    '^@prompts/(.*)$': '<rootDir>/src/shared/prompts/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@types/(.*)$': '<rootDir>/src/shared/types/$1',
    '^@enums/agent-modes\\.enum\\.js$': '<rootDir>/src/shared/enums/agent-modes.enum.ts',
    '^@enums/event\\.enums\\.js$': '<rootDir>/src/shared/enums/event.enums.ts',
    '^@enums/utils\\.js$': '<rootDir>/src/shared/enums/utils.ts',
    '^@enums/execution-status\\.enum\\.js$': '<rootDir>/src/shared/enums/execution-status.enum.ts',
    '^@enums/(.*)$': '<rootDir>/src/shared/enums/$1',
    '^@schemas/(.*)$': '<rootDir>/src/shared/schemas/$1',
    '^@tools/(.*)$': '<rootDir>/src/tools/$1',
    '^@services/mcp/src/mcp\\.js$': '<rootDir>/src/services/mcp/src/mcp.ts',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
  },

  // Only treat TypeScript files as ESM
  extensionsToTreatAsEsm: ['.ts'],

  // Ignore the dist directory
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],

  // Use .ts extension for test files
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.ts$',

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
  ],
  coverageReporters: [],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
};
