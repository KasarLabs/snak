import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import {
  initializeProjectData,
  doesProjectExist,
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
    console.log('\n➜ Registering project');
    console.log(JSON.stringify(params, null, 2));
    
    if (params.projectName.includes('-'))
      throw new Error(
        "Project name cannot contain hyphens ('-'). Please use underscores ('_') instead."
      );

    if (/[A-Z]/.test(params.projectName)) {
      throw new Error(
        "Project name cannot contain uppercase letters. Please use snake_case (lowercase letters and underscores) for the project name."
      );
    }

    const alreadyRegistered = await doesProjectExist(
      agent,
      params.projectName
    );

    if (alreadyRegistered) {
      return JSON.stringify({
        status: 'success',
        message: `Project ${params.projectName} already registered`,
        projectId: alreadyRegistered.id,
        projectName: alreadyRegistered.name,
        projectType: alreadyRegistered.type,
      });
    }

    const projectType = params.projectType
      ? params.projectType
        : 'cairo_program';

    await initializeProjectData(
      agent,
      params.projectName,
      params.existingProgramNames || [],
      params.dependencies || [],
      projectType
    );

    
    const projectData = await retrieveProjectData(agent, params.projectName);

    return JSON.stringify({
      status: 'success',
      message: `Project ${params.projectName} created successfully`,
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
