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
        isolatedModules: true,
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
