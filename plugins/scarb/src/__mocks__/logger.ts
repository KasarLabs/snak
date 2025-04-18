import { jest } from '@jest/globals';

// Define a simple interface for the logger shape
interface MockLogger {
  level: string;
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  silent: boolean;
  transports: any[];
  enableLogging: jest.Mock<() => void>;
  disableLogging: jest.Mock<() => void>;
}

// Create a simple mock object that mimics the logger interface
// Provide no-op functions for all logging levels
const mockLogger: MockLogger = {
  level: 'info',
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  silent: false,
  transports: [],
  enableLogging: jest.fn<() => void>(),
  disableLogging: jest.fn<() => void>(),
};

export default mockLogger;
export const enableLogging: jest.Mock<() => void> = mockLogger.enableLogging;
export const disableLogging: jest.Mock<() => void> = mockLogger.disableLogging; 