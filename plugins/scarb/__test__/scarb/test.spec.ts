// __test__/scarb/simple-init-test.spec.ts
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { initializeProjectData } from '../../src/utils/db.js';
import { createMockStarknetAgent } from '../jest/setEnvVars.js';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { PostgresAdaptater } from '@starknet-agent-kit/agents';

// Define a type for our mocks that matches the expected structure
type MockDB = {
  select: jest.Mock;
  insert: jest.Mock;
  createTable: jest.Mock;
  addExistingTable: jest.Mock;
  update?: jest.Mock;
};

describe('Simple initializeProjectData Test', () => {
  // Create the agent and mocks
  let agent: StarknetAgentInterface;
  let mockDb: MockDB;

  beforeEach(() => {
    // Reset the mocks
    jest.clearAllMocks();

    // Create the agent
    agent = createMockStarknetAgent();

    // Create mocks for the Postgres adapter
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      createTable: jest.fn(),
      addExistingTable: jest.fn(),
      update: jest.fn(),
    };

    // Configure responses
    mockDb.select.mockImplementation(
      (params: { FROM: string[]; SELECT: string[] }) => {
        // Determine which query is being executed
        if (params.FROM[0] === 'project') {
          if (params.SELECT[0] === 'id') {
            // Check if the project exists or retrieve ID
            return { query: { rows: [{ id: 1 }] } };
          } else {
            // retrieveProjectData - project info
            return {
              query: {
                rows: [{ id: 1, name: 'test_project', type: 'contract' }],
              },
            };
          }
        } else if (params.FROM[0] === 'program') {
          // Retrieve programs
          return { query: { rows: [] } };
        } else if (params.FROM[0] === 'dependency') {
          // Retrieve dependencies
          return { query: { rows: [] } };
        }

        return { query: { rows: [] } };
      }
    );

    mockDb.insert.mockReturnValue({ status: 'success' });
    mockDb.createTable.mockReturnValue({ status: 'success' });

    // Replace the createDatabase method - use the appropriate technique for mocking
    const origCreateDatabase = agent.createDatabase;
    agent.createDatabase = jest.fn(async (dbName: string) => {
      return mockDb as unknown as PostgresAdaptater;
    });
  });

  it('correctly initializes a new project', async () => {
    // Test parameters
    const projectName = 'test_project';
    const contractPaths = ['src/contract/test.cairo'];
    const dependencies = [{ name: 'openzeppelin', version: '1.0.0' }];

    // Call the function to test
    const result = await initializeProjectData(
      agent,
      projectName,
      contractPaths,
      dependencies
    );
    console.log('Initialization result:', result);

    expect(result).toBeDefined();
    expect(result.name).toBe(projectName);
    expect(result.id).toBe(1);

    expect(agent.createDatabase).toHaveBeenCalledWith('scarb_db');

    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('retrieveProjectData correctly retrieves project data', async () => {
    const projectName = 'test_project';
    const expectedProject = {
      id: 1,
      name: projectName,
      type: 'contract',
      programs: [
        { name: 'program1', source_code: 'source_code1' },
        { name: 'program2', source_code: 'source_code2' },
      ],
      dependencies: [
        { name: 'dep1', version: '1.0.0' },
        { name: 'dep2', version: '2.0.0' },
      ],
    };

    mockDb.select.mockImplementation(
      (params: { FROM: string[]; SELECT: string[] }) => {
        if (params.FROM[0] === 'project') {
          return {
            query: { rows: [{ id: 1, name: projectName, type: 'contract' }] },
          };
        } else if (params.FROM[0] === 'program') {
          return {
            query: {
              rows: [
                { name: 'program1', source_code: 'source_code1' },
                { name: 'program2', source_code: 'source_code2' },
              ],
            },
          };
        } else if (params.FROM[0] === 'dependency') {
          return {
            query: {
              rows: [
                { name: 'dep1', version: '1.0.0' },
                { name: 'dep2', version: '2.0.0' },
              ],
            },
          };
        }
        return { query: { rows: [] } };
      }
    );

    const { retrieveProjectData } = require('../../src/utils/db.js');

    const result = await retrieveProjectData(agent, projectName);

    expect(result).toEqual(expectedProject);
    expect(mockDb.select).toHaveBeenCalledTimes(3);
    expect(agent.createDatabase).toHaveBeenCalledWith('scarb_db');
  });
});
