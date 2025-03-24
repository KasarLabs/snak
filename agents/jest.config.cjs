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
      },
    ],
  },

  // Handle .js extensions in import paths
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // Only treat TypeScript files as ESM
  extensionsToTreatAsEsm: ['.ts'],

  // Ignore the dist directory
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],

  // Use .ts extension for test files
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.ts$',
};
