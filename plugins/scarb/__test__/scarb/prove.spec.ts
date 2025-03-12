import { proveContract } from '../../src/actions/proveContract.js';
import { createMockStarknetAgent } from '../jest/setEnvVars.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Mock for execAsync to avoid actually running Scarb commands during tests
jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: jest.fn((fn) => {
    if (fn === exec) {
      return jest.fn().mockResolvedValue({
        stdout: 'Proof generated successfully',
        stderr: ''
      });
    }
    return jest.requireActual('util').promisify(fn);
  })
}));

describe('Tests for proveContract function', () => {
  const agent = createMockStarknetAgent();

  it('should prove a contract execution', async () => {
    // Define test parameters
    const projectName = 'test_project';
    const executionId = '1';
    
    // Mock fs.access to simulate that the proof.json file exists
    jest.spyOn(fs, 'access').mockResolvedValue(undefined);
    
    // Call the function
    const result = await proveContract(agent, {
      projectName,
      executionId
    });
    
    // Parse and check result
    const parsedResult = JSON.parse(result);
    console.log('Proving result:', parsedResult);
    
    expect(parsedResult.status).toBe('success');
    expect(parsedResult.message).toBe('Contract execution proved successfully');
    expect(parsedResult.proofPath).not.toBeNull();
  });

  it('should handle proving with execute flag', async () => {
    // Spy on execAsync to check command construction
    const execAsyncSpy = execAsync as jest.Mock;
    execAsyncSpy.mockClear();
    
    // Define test parameters with execute flag
    const params = {
      projectName: 'test_project',
      executionId: '1',
      execute: true,
      executableFunction: 'main',
      arguments: '1,2,3',
      target: 'standalone' as const
    };
    
    // Call the function
    await proveContract(agent, params);
    
    // Check that the command was constructed correctly
    expect(execAsyncSpy).toHaveBeenCalled();
    const callArgs = execAsyncSpy.mock.calls[0][0];
    
    expect(callArgs).toContain('--execute');
    expect(callArgs).toContain('--executable-function main');
    expect(callArgs).toContain('--arguments "1,2,3"');
    expect(callArgs).toContain('--target standalone');
  });
});