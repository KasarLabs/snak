import { fixCairoCode } from '../src/actions/fixCairoCode.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { getAllRawPrograms } from '../src/utils/db_utils.js';

// Mock dependencies
jest.mock('axios');
jest.mock('fs');
jest.mock('path');
jest.mock('../src/utils/db_utils.js');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedPath = path as jest.Mocked<typeof path>;
const mockedGetAllRawPrograms = getAllRawPrograms as jest.MockedFunction<typeof getAllRawPrograms>;

describe('fixCairoCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock path.join
    mockedPath.join.mockImplementation((...args) => args.join('/'));
    
    // Mock fs.existsSync and fs.mkdirSync
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.mkdirSync.mockImplementation(() => undefined);
    mockedFs.writeFileSync.mockImplementation(() => undefined);
  });

  it('should successfully fix Cairo code and update it in the database', async () => {
    // Mock the database response
    const mockProgram = {
      id: 1,
      name: 'test-contract.cairo',
      source_code: 'fn main() {\n    // Buggy Cairo code\n}',
      created_at: '2023-01-01T00:00:00Z'
    };
    
    mockedGetAllRawPrograms.mockResolvedValue([mockProgram]);
    
    // Mock the API response
    const mockResponse = {
      data: {
        id: "91a4420c-6846-4d4e-adf7-9c78ff1695db",
        object: "chat.completion",
        created: 1742898710375,
        model: "gemini-2.0-flash",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "```cairo\nfn main() {\n    // Fixed Cairo code\n}\n```"
            },
            logprobs: null,
            finish_reason: "stop"
          }
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      }
    };
    
    mockedAxios.post.mockResolvedValue(mockResponse);
    
    // Mock agent
    const mockAgent = {
      getProvider: jest.fn(),
      getAccountCredentials: jest.fn(),
      getDatabaseByName: jest.fn().mockReturnValue({})
    };
    
    // Call the function
    const result = await fixCairoCode(
      mockAgent as any,
      { 
        programName: 'test-contract.cairo',
        error: 'There is a bug in the main function'
      }
    );
    
    // Parse the result
    const parsedResult = JSON.parse(result);
    
    // Verify the result
    expect(parsedResult.status).toBe('success');
    expect(parsedResult.fixedCode).toBe('fn main() {\n    // Fixed Cairo code\n}');
    expect(parsedResult.originalCode).toBe('fn main() {\n    // Buggy Cairo code\n}');
    expect(parsedResult.programName).toBe('test-contract.cairo');
    
    // Verify axios was called with the right prompt
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://backend.agent.starknet.id/v1/chat/completions',
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('The error is: There is a bug in the main function')
          })
        ])
      }),
      expect.any(Object)
    );
    
    // Verify the file was written
    expect(mockedFs.writeFileSync).toHaveBeenCalled();
  });

  it('should handle errors when the program is not found', async () => {
    // Mock empty database
    mockedGetAllRawPrograms.mockResolvedValue([]);
    
    // Mock agent
    const mockAgent = {
      getProvider: jest.fn(),
      getAccountCredentials: jest.fn(),
      getDatabaseByName: jest.fn().mockReturnValue({})
    };
    
    // Call the function
    const result = await fixCairoCode(
      mockAgent as any,
      { 
        programName: 'nonexistent-contract.cairo',
        error: 'Error description'
      }
    );
    
    // Parse the result
    const parsedResult = JSON.parse(result);
    
    // Verify the result indicates failure
    expect(parsedResult.status).toBe('failure');
    expect(parsedResult.error).toContain('not found in the database');
  });

  it('should handle errors from the API', async () => {
    // Mock the database response
    const mockProgram = {
      id: 1,
      name: 'test-contract.cairo',
      source_code: 'fn main() {\n    // Buggy Cairo code\n}',
      created_at: '2023-01-01T00:00:00Z'
    };
    
    mockedGetAllRawPrograms.mockResolvedValue([mockProgram]);
    
    // Mock an API error response
    mockedAxios.post.mockRejectedValue(new Error('API connection error'));
    
    // Mock agent
    const mockAgent = {
      getProvider: jest.fn(),
      getAccountCredentials: jest.fn(),
      getDatabaseByName: jest.fn().mockReturnValue({})
    };
    
    // Call the function
    const result = await fixCairoCode(
      mockAgent as any,
      { 
        programName: 'test-contract.cairo',
        error: 'Error description'
      }
    );
    
    // Parse the result
    const parsedResult = JSON.parse(result);
    
    // Verify the result indicates failure
    expect(parsedResult.status).toBe('failure');
    expect(parsedResult.error).toBe('API connection error');
  });

  it('should validate program name format', async () => {
    // Mock agent
    const mockAgent = {
      getProvider: jest.fn(),
      getAccountCredentials: jest.fn(),
      getDatabaseByName: jest.fn().mockReturnValue({})
    };
    
    // Call the function with an invalid program name
    const result = await fixCairoCode(
      mockAgent as any,
      { 
        programName: 'invalid-contract',
        error: 'Error description'
      }
    );
    
    // Parse the result
    const parsedResult = JSON.parse(result);
    
    // Verify the result indicates failure due to validation
    expect(parsedResult.status).toBe('failure');
    expect(parsedResult.error).toContain('must end with .cairo');
  });
}); 