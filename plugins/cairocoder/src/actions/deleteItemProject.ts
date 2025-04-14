import { logger, StarknetAgentInterface } from '@starknet-agent-kit/core';
('@starknet-agent-kit/core');
import { z } from 'zod';
import {
  deleteProgram,
  deleteDependency,
  deleteProject,
} from '../utils/db_delete.js';
import {
  deleteProgramSchema,
  deleteDependencySchema,
  deleteProjectSchema,
} from '../schema/schema.js';
import { retrieveProjectData } from '../utils/db_init.js';

/**
 * Delete several programs from a project
 *
 * @param agent The StarkNet agent
 * @param params The deletion parameters
 * @returns The deletion result
 */
export const deleteProgramAction = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof deleteProgramSchema>
) => {
  try {
    const projectData = await retrieveProjectData(agent, params.projectName);

    for (const program of params.programName) {
      await deleteProgram(agent, projectData.id, program);
    }

    const updatedProject = await retrieveProjectData(agent, params.projectName);

    return JSON.stringify({
      status: 'success',
      message: `Programs ${params.programName} deleted from project ${params.projectName}`,
      projectId: updatedProject.id,
      projectName: updatedProject.name,
      programsCount: updatedProject.programs.length,
    });
  } catch (error) {
    logger.error('Error deleting program:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Delete several dependencies from a project
 *
 * @param agent The StarkNet agent
 * @param params The deletion parameters
 * @returns The deletion result
 */
export const deleteDependencyAction = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof deleteDependencySchema>
) => {
  try {
    const projectData = await retrieveProjectData(agent, params.projectName);

    for (const dependency of params.dependencyName) {
      await deleteDependency(agent, projectData.id, dependency);
    }

    const updatedProject = await retrieveProjectData(agent, params.projectName);

    return JSON.stringify({
      status: 'success',
      message: `Dependencies ${params.dependencyName} deleted from project ${params.projectName}`,
      projectId: updatedProject.id,
      projectName: updatedProject.name,
      dependenciesCount: updatedProject.dependencies.length,
    });
  } catch (error) {
    logger.error('Error deleting dependency:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Delete several projects
 *
 * @param agent The StarkNet agent
 * @param params The deletion parameters
 * @returns The deletion result
 */
export const deleteProjectAction = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof deleteProjectSchema>
) => {
  try {
    for (const project of params.projectName) {
      await deleteProject(agent, project);
    }

    return JSON.stringify({
      status: 'success',
      message: `Projects ${params.projectName} deleted successfully`,
    });
  } catch (error) {
    logger.error('Error deleting project:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
