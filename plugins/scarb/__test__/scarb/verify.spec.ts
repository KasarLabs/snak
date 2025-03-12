import { verifyContract } from '../../src/actions/verifyContract.js';
import { createMockStarknetAgent } from '../jest/setEnvVars.js';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Mock for execAsync to avoid actually running Scarb commands during tests
jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: jest.fn((fn) => {
    if (fn === exec) {
      return jest.fn().mockResolvedValue({
        stdout: 'Verification successful',
        stderr: ''
      });
    }
    return jest.requireActual('util').promisify(fn);
  })
}));

describe('Tests for verifyContract function', () => {
  const agent = createMockStarknetAgent();

  it('should verify a proof successfully', async () => {
    // Define test parameters
    const proofPath = '/path/to/proof.json';
    
    // Mock fs.access to simulate that the proof.json file exists
    jest.spyOn(fs, 'access').mockResolvedValue(undefined);
    
    // Call the function
    const result = await verifyContract(agent, {
      proofPath
    });
    
    // Parse and check result
    const parsedResult = JSON.parse(result);
    console.log('Verification result:', parsedResult);
    
    expect(parsedResult.status).toBe('success');
    expect(parsedResult.message).toBe('Proof verified successfully');
  });

  it('should handle missing proof file', async () => {
    // Mock fs.access to simulate a missing file
    jest.spyOn(fs, 'access').mockRejectedValue(new Error('File not found'));
    
    // Call the function
    const result = await verifyContract(agent, {
      proofPath: '/nonexistent/path/to/proof.json'
    });
    
    // Parse and check result
    const parsedResult = JSON.parse(result);
    
    expect(parsedResult.status).toBe('failure');
    expect(parsedResult.error).toContain('Proof file not found');
  });
});