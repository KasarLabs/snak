import { logger, StarknetAgentInterface } from '@snakagent/core';
('@snakagent/core');
import { z } from 'zod';
import { listProjectsSchema } from '../schema/schema.js';
import { scarb } from '@snakagent/database/queries';

/**
 * List all projects in the scarb_db database
 *
 * @param agent The StarkNet agent
 * @returns JSON string with all projects information
 */
export const listProjects = async (
  _agent: StarknetAgentInterface,
  _params: z.infer<typeof listProjectsSchema>
) => {
  try {
    // TODO: there probably is a more intelligent way of doing this using
    // cursors. For now this is just a port of the previous database logic.
    const projects = await scarb.selectProjects();

    return JSON.stringify({
      status: 'success',
      message:
        projects.length > 0
          ? `Found ${projects.length} projects in the database`
          : 'No projects found in the database',
      projects: projects,
    });
  } catch (error) {
    logger.error('Error listing projects:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
