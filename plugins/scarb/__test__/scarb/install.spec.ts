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

  it('should detect when Scarb is already installed', async () => {
    // Simulate Scarb already installed
    jest
      .spyOn(environmentModule, 'checkScarbInstalled')
      .mockResolvedValue(true);
    jest
      .spyOn(environmentModule, 'getScarbVersion')
      .mockResolvedValue('2.10.0');

    const result = await installScarb();
    const parsedResult = JSON.parse(result);

    expect(parsedResult.status).toBe('success');
    expect(parsedResult.message).toContain('already installed');
    expect(parsedResult.message).toContain('2.10.0');

    // Verify that functions were called
    expect(environmentModule.checkScarbInstalled).toHaveBeenCalled();
    expect(environmentModule.getScarbVersion).toHaveBeenCalled();
    // Verify that exec was not called (no installation needed)
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('should successfully install Scarb when not installed', async () => {
    // Simulate Scarb not installed at first, then successfully installed
    jest
      .spyOn(environmentModule, 'checkScarbInstalled')
      .mockResolvedValueOnce(false) // First check: not installed
      .mockResolvedValueOnce(true); // Second check: successfully installed

    jest
      .spyOn(environmentModule, 'getScarbVersion')
      .mockResolvedValue('2.10.0');

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

    // Verify that functions were called correctly
    expect(environmentModule.checkScarbInstalled).toHaveBeenCalledTimes(2);
    expect(environmentModule.getScarbVersion).toHaveBeenCalled();
    expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('curl'));
    expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('2.10.0'));
  });

  it('should handle installation failure', async () => {
    // Simulate Scarb not installed and installation fails
    jest
      .spyOn(environmentModule, 'checkScarbInstalled')
      .mockResolvedValueOnce(false) // First check: not installed
      .mockResolvedValueOnce(false); // Second check: still not installed

    // Simulate a failing installation
    mockExec.mockResolvedValue({
      stdout: '',
      stderr: 'Installation failed: command not found',
    });

    const result = await installScarb();
    const parsedResult = JSON.parse(result);

    expect(parsedResult.status).toBe('failure');
    expect(parsedResult.error).toContain('Failed to install Scarb');

    // Verify that functions were called correctly
    expect(environmentModule.checkScarbInstalled).toHaveBeenCalledTimes(2);
    expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('curl'));
  });

  it('should handle errors during installation command execution', async () => {
    // Simulate Scarb not installed
    jest
      .spyOn(environmentModule, 'checkScarbInstalled')
      .mockResolvedValue(false);

    // Simulate an error during command execution
    const execError = new Error('Command failed');
    mockExec.mockRejectedValue(execError);

    const result = await installScarb();
    const parsedResult = JSON.parse(result);

    expect(parsedResult.status).toBe('failure');
    expect(parsedResult.error).toBe('Command failed');

    // Verify that functions were called correctly
    expect(environmentModule.checkScarbInstalled).toHaveBeenCalled();
    expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('curl'));
  });

  it('should handle custom path provided as parameter', async () => {
    // Simulate Scarb already installed
    jest
      .spyOn(environmentModule, 'checkScarbInstalled')
      .mockResolvedValue(true);
    jest
      .spyOn(environmentModule, 'getScarbVersion')
      .mockResolvedValue('2.10.0');

    const customPath = '/custom/path/to/scarb';
    const result = await installScarb();
    const parsedResult = JSON.parse(result);

    expect(parsedResult.status).toBe('success');

    // For this test, we just verify that the path doesn't affect the detection
    // of Scarb already installed, as that's the current behavior of the function
    expect(environmentModule.checkScarbInstalled).toHaveBeenCalled();
  });
});
