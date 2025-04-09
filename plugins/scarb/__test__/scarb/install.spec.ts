// __test__/scarb/install.spec.ts
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { installScarb } from '../../src/actions/installScarb.js';
import { createMockStarknetAgent } from '../jest/setEnvVars.js';
import * as environmentModule from '../../src/utils/install.js';

// Mock child_process module
jest.mock('child_process', () => {
  const mockExec = jest.fn();

  return {
    exec: jest.fn().mockImplementation((command, options, callback) => {
      // Handle case where options is the callback
      if (typeof options === 'function') {
        callback = options;
        options = undefined;
      }

      // If a callback is provided
      if (typeof callback === 'function') {
        const promise: any = mockExec(command);
        promise
          .then((result: any) => callback(null, result))
          .catch((error: any) => callback(error));
        return;
      }

      // Otherwise, return the promise
      return mockExec(command);
    }),
    // Expose mock function for tests
    __mockExec: mockExec,
  };
});

// Get reference to the mock function
const mockExec = require('child_process').__mockExec;

// Mock util.promisify
jest.mock('util', () => ({
  promisify: jest.fn((fn) => fn),
}));

describe('Scarb Installation Tests', () => {
  const agent = createMockStarknetAgent();

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    mockExec.mockReset();
  });

  it('should detect when Scarb is already installed with correct version', async () => {
    // Simulate Scarb already installed with correct version
    jest
      .spyOn(environmentModule, 'getScarbVersion')
      .mockResolvedValue('2.10.0');

    const result = await installScarb();
    const parsedResult = JSON.parse(result);

    expect(parsedResult.status).toBe('success');
    expect(parsedResult.message).toContain('already installed');
    expect(parsedResult.message).toContain('2.10.0');

    // Verify that getScarbVersion was called
    expect(environmentModule.getScarbVersion).toHaveBeenCalled();
    // Verify that exec was not called (no installation needed)
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('should successfully install Scarb when not installed', async () => {
    // Simulate Scarb not installed initially
    jest
      .spyOn(environmentModule, 'getScarbVersion')
      .mockResolvedValueOnce('unknown')
      .mockResolvedValueOnce('2.10.0'); // After installation

    // Mock checkScarbInstalled to return true after installation
    jest
      .spyOn(environmentModule, 'checkScarbInstalled')
      .mockResolvedValue(true);

    // Simulate successful installation
    mockExec.mockResolvedValue({
      stdout: 'Installation successful',
      stderr: '',
    });

    const result = await installScarb();
    const parsedResult = JSON.parse(result);

    expect(parsedResult.status).toBe('success');
    expect(parsedResult.message).toContain('installed successfully');
    expect(parsedResult.message).toContain('2.10.0');
    expect(parsedResult.output).toBe('Installation successful');

    // Verify that getScarbVersion was called
    expect(environmentModule.getScarbVersion).toHaveBeenCalled();
    // Verify that checkScarbInstalled was called after installation
    expect(environmentModule.checkScarbInstalled).toHaveBeenCalled();
    // Verify that exec was called with the correct command
    expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('curl'));
    expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('2.10.0'));
  });

  it('should handle installation errors', async () => {
    // Simulate Scarb not installed
    jest
      .spyOn(environmentModule, 'getScarbVersion')
      .mockResolvedValue('unknown');

    // Simulate an error during command execution
    const execError = new Error('Command failed');
    mockExec.mockRejectedValue(execError);

    const result = await installScarb();
    const parsedResult = JSON.parse(result);

    expect(parsedResult.status).toBe('failure');
    expect(parsedResult.error).toBe('Command failed');

    // Verify that getScarbVersion was called
    expect(environmentModule.getScarbVersion).toHaveBeenCalled();
    // Verify that exec was called with the correct command
    expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('curl'));
  });

  it('should handle when Scarb is installed with wrong version', async () => {
    // This test is a bit tricky since the current implementation doesn't check for specific versions
    // We'll simulate that Scarb is already installed with a different version
    jest.spyOn(environmentModule, 'getScarbVersion').mockResolvedValue('2.9.0'); // Different version than 2.10.0

    const result = await installScarb();
    const parsedResult = JSON.parse(result);

    // With the current implementation, it will just report that Scarb is already installed
    expect(parsedResult.status).toBe('success');
    expect(parsedResult.message).toContain('already installed');
    expect(parsedResult.message).toContain('2.9.0');

    // Verify that getScarbVersion was called
    expect(environmentModule.getScarbVersion).toHaveBeenCalled();
    // Verify that exec was not called (no installation attempted)
    expect(mockExec).not.toHaveBeenCalled();
  });
});
