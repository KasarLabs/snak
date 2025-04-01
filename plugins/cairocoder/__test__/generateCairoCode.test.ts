import { generateCairoCode } from '../src/actions/generateCairoCode.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { addOrUpdateRawProgram } from '../src/utils/db_utils.js';

// Mock dependencies
jest.mock('axios');
jest.mock('fs');
jest.mock('path');
jest.mock('../src/utils/db_utils.js');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedPath = path as jest.Mocked<typeof path>;
const mockedAddOrUpdateRawProgram =
  addOrUpdateRawProgram as jest.MockedFunction<typeof addOrUpdateRawProgram>;

describe('generateCairoCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock path.join
    mockedPath.join.mockImplementation((...args) => args.join('/'));

    // Mock fs.existsSync and fs.mkdirSync
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.mkdirSync.mockImplementation(() => undefined);
    mockedFs.writeFileSync.mockImplementation(() => undefined);

    // Mock database functions
    mockedAddOrUpdateRawProgram.mockResolvedValue(undefined);
  });

  it('should successfully generate Cairo code and add it to the database', async () => {
    // Mock the API response
    const mockResponse = {
      data: {
        id: '91a4420c-6846-4d4e-adf7-9c78ff1695db',
        object: 'chat.completion',
        created: 1742898710375,
        model: 'gemini-2.0-flash',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content:
                '```cairo\nfn main() {\n    // Simple Cairo code\n}\n```',
            },
            logprobs: null,
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      },
    };

    mockedAxios.post.mockResolvedValue(mockResponse);

    // Mock agent
    const mockAgent = {
      getProvider: jest.fn(),
      getAccountCredentials: jest.fn(),
      getDatabaseByName: jest.fn().mockReturnValue({}),
    };

    // Call the function
    const result = await generateCairoCode(mockAgent as any, {
      prompt: 'Generate a simple Cairo function',
      contractName: 'test-contract',
    });

    // Parse the result
    const parsedResult = JSON.parse(result);

    // Verify the result
    expect(parsedResult.status).toBe('success');
    expect(parsedResult.code).toBe('fn main() {\n    // Simple Cairo code\n}');
    expect(parsedResult.contractName).toBe('test-contract.cairo');

    // Verify axios was called correctly
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://backend.agent.starknet.id/v1/chat/completions',
      {
        model: 'gemini-2.0-flash',
        messages: [
          {
            role: 'system',
            content:
              'You are a Cairo programming expert. Generate Cairo code that follows best practices.',
          },
          {
            role: 'user',
            content: 'Generate a simple Cairo function',
          },
        ],
        temperature: 0.7,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // Verify the file was written
    expect(mockedFs.writeFileSync).toHaveBeenCalled();

    // Verify database functions were called
    expect(mockedAddOrUpdateRawProgram).toHaveBeenCalledWith(
      mockAgent,
      'test-contract.cairo',
      'fn main() {\n    // Simple Cairo code\n}',
      []
    );
  });

  it('should handle errors from the API', async () => {
    // Mock an API error response
    mockedAxios.post.mockRejectedValue(new Error('API connection error'));

    // Mock agent
    const mockAgent = {
      getProvider: jest.fn(),
      getAccountCredentials: jest.fn(),
      getDatabaseByName: jest.fn().mockReturnValue({}),
    };

    // Call the function
    const result = await generateCairoCode(mockAgent as any, {
      prompt: 'Generate a simple Cairo function',
      contractName: 'test-contract',
    });

    // Parse the result
    const parsedResult = JSON.parse(result);

    // Verify the result indicates failure
    expect(parsedResult.status).toBe('failure');
    expect(parsedResult.error).toBe('API connection error');
  });

  it('should handle errors from the database', async () => {
    // Mock successful API response
    const mockResponse = {
      data: {
        id: '91a4420c-6846-4d4e-adf7-9c78ff1695db',
        object: 'chat.completion',
        created: 1742898710375,
        model: 'gemini-2.0-flash',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content:
                '```cairo\nfn main() {\n    // Simple Cairo code\n}\n```',
            },
            logprobs: null,
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      },
    };

    mockedAxios.post.mockResolvedValue(mockResponse);

    // Mock database error
    mockedAddOrUpdateRawProgram.mockRejectedValue(new Error('Database error'));

    // Mock agent
    const mockAgent = {
      getProvider: jest.fn(),
      getAccountCredentials: jest.fn(),
      getDatabaseByName: jest.fn().mockReturnValue({}),
    };

    // Call the function
    const result = await generateCairoCode(mockAgent as any, {
      prompt: 'Generate a simple Cairo function',
      contractName: 'test-contract',
    });

    // Parse the result
    const parsedResult = JSON.parse(result);

    // Verify the result indicates partial success
    expect(parsedResult.status).toBe('partial_success');
    expect(parsedResult.error).toBe('Database error');
    expect(parsedResult.code).toBe('fn main() {\n    // Simple Cairo code\n}');
  });
});
