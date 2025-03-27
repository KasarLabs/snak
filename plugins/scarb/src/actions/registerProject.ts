import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import {
  initializeProjectData,
  projectAlreadyExists,
  retrieveProjectData,
} from '../utils/db_init.js';
import { registerProjectSchema } from '../schema/schema.js';

/**
 * Register a new project in the database
 *
 * @param agent The StarkNet agent
 * @param params The project registration parameters
 * @returns The registration result
 */
export const registerProject = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof registerProjectSchema>
) => {
  try {
    if (params.projectName.includes('-'))
      throw new Error(
        "Project name cannot contain hyphens ('-'). Please use underscores ('_') instead."
      );

    const alreadyRegistered = await projectAlreadyExists(
      agent,
      params.projectName
    );
    const projectType = params.projectType
      ? params.projectType
      : alreadyRegistered
        ? alreadyRegistered.type
        : 'cairo_program';

    await initializeProjectData(
      agent,
      params.projectName,
      params.programPaths || [],
      params.dependencies || [],
      projectType
    );

    const projectData = await retrieveProjectData(agent, params.projectName);
    console.log(
      `Project ${params.projectName}: ${alreadyRegistered ? 'updated' : 'created'}`
    );

    return JSON.stringify({
      status: 'success',
      message: alreadyRegistered
        ? `Project ${params.projectName} updated successfully`
        : `Project ${params.projectName} created successfully`,
      projectId: projectData.id,
      projectName: projectData.name,
      projectType: projectData.type,
      programsCount: projectData.programs.length,
      dependenciesCount: projectData.dependencies.length,
    });
  } catch (error) {
    console.error('Error registering project:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
