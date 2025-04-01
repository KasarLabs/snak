import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { listProjectsSchema } from '../schema/schema.js';

/**
 * List all projects in the scarb_db database
 * 
 * @param agent The StarkNet agent
 * @returns JSON string with all projects information
 */
export const listProjects = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof listProjectsSchema>
) => {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    const projectsResult = await database.select({
      SELECT: ['id', 'name'],
      FROM: ['project']
    });

    if (!projectsResult.query?.rows.length) {
      return JSON.stringify({
        status: 'success',
        message: 'No projects found in the database',
        projects: [],
      });
    }

    const projects = [];
    for (const project of projectsResult.query.rows) {
      projects.push({
        name: project.name,
      });
    }

    return JSON.stringify({
      status: 'success',
      message: `Found ${projects.length} projects in the database`,
      projects: projects,
    });
  } catch (error) {
    console.error('Error listing projects:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}; 