import { logger, StarknetAgentInterface } from '@starknet-agent-kit/core';
('@starknet-agent-kit/core');
import { addProgramSchema, addDependencySchema } from '../schema/schema.js';
import { retrieveProjectData } from '../utils/db_init.js';
import { addProgram, addDependency } from '../utils/db_add.js';
import { extractFile } from '../utils/utils.js';
import path from 'path';
import { z } from 'zod';

/**
 * Add several programs to a project
 * @param agent The Starknet agent
 * @param params The parameters of the program
 * @returns The result of the operation
 */
export const addProgramAction = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof addProgramSchema>
) => {
  try {
    logger.debug('\n Adding program');
    logger.debug(JSON.stringify(params, null, 2));

    const projectData = await retrieveProjectData(agent, params.projectName);

    for (const contractPath of params.programPaths) {
      const fileName = path.basename(contractPath);
      const sourceCode = await extractFile(contractPath);
      await addProgram(agent, projectData.id, fileName, sourceCode);
    }

    const updatedProject = await retrieveProjectData(agent, params.projectName);

    return JSON.stringify({
      status: 'success',
      message: `Programs added to project ${params.projectName}`,
      projectId: updatedProject.id,
      projectName: updatedProject.name,
      programsCount: updatedProject.programs.length,
    });
  } catch (error) {
    logger.error('Error adding program:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Add several dependencies to a project
 * @param agent The Starknet agent
 * @param params The parameters of the dependencies
 * @returns The result of the operation
 */
export const addDependencyAction = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof addDependencySchema>
) => {
  try {
    logger.debug('\n Adding dependency');
    logger.debug(JSON.stringify(params, null, 2));

    const projectData = await retrieveProjectData(agent, params.projectName);

    for (const dependency of params.dependencies) {
      await addDependency(agent, projectData.id, dependency);
    }

    const updatedProject = await retrieveProjectData(agent, params.projectName);

    return JSON.stringify({
      status: 'success',
      message: `Dependencies added to project ${params.projectName}`,
      projectId: updatedProject.id,
      projectName: updatedProject.name,
      dependenciesCount: updatedProject.dependencies.length,
    });
  } catch (error) {
    logger.error('Error adding dependency:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
