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
  console.log("\n➜ Registering project");
  try {
    console.log("[REGISTER] Starting project registration");
    console.log(`[REGISTER] Project: ${params.projectName}, Type: ${params.projectType || 'cairo_program'}`);
    console.log(`[REGISTER] Programs: ${params.programPaths?.length || 0}, Dependencies: ${params.dependencies?.length || 0}`);
    if (params.projectName.includes('-'))
      throw new Error(
        "Project name cannot contain hyphens ('-'). Please use underscores ('_') instead."
      );

    const alreadyRegistered = await doesProjectExist(
      agent,
      params.projectName
    );

    if (alreadyRegistered)
      throw new Error("Project already registered");

    const projectType = params.projectType
      ? params.projectType
        : 'cairo_program';

    await initializeProjectData(
      agent,
      params.projectName,
      params.programPaths || [],
      params.dependencies || [],
      projectType
    );

    
    const projectData = await retrieveProjectData(agent, params.projectName);
    
    console.log("[REGISTER] Status: Success");
    console.log(`[REGISTER] Project ID: ${projectData.id}`);

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
    // console.error('Error registering project:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
