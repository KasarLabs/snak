// agents/src/__mocks__/logger.ts

// Create a simple mock object that mimics the logger interface
// Provide no-op functions for all logging levels
const mockLogger = {
  level: 'info', // Default level, can be adjusted if needed for specific tests
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  // Add other methods used by the logger if necessary (e.g., silent, transports)
  silent: false,
  transports: [],
  // Mock the exported enable/disable functions as well
  enableLogging: jest.fn(),
  disableLogging: jest.fn(),
};

// Export the mock logger as the default export
export default mockLogger;

// Also export the mocked enable/disable functions if they are used directly
export const enableLogging = mockLogger.enableLogging;
export const disableLogging = mockLogger.disableLogging;
