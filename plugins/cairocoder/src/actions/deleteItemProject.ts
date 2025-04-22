import { z } from 'zod';
import {
  deleteProgramSchema,
  deleteDependencySchema,
  deleteProjectSchema,
} from '../schema/schema.js';
import { scarbQueries } from '@hijox/database/queries';
import { logger, StarknetAgentInterface } from '@hijox/core';

/**
 * Delete several programs from a project
 *
 * @param agent The StarkNet agent
 * @param params The deletion parameters
 * @returns The deletion result
 */
export const deleteProgramAction = async (
  _agent: StarknetAgentInterface,
  params: z.infer<typeof deleteProgramSchema>
) => {
  try {
    const scarb = _agent.getDatabase().get('scarb') as scarbQueries;
    if (!scarb) {
      throw new Error('Scarb database not found');
    }
    const projectData = await scarb.retrieveProjectData(params.projectName);
    if (!projectData) {
      throw new Error(`project ${params.projectName} does not exist`);
    }

    await scarb.deletePrograms(
      params.programName.map((program) => ({
        projectId: projectData.id,
        name: program,
      }))
    );

    return JSON.stringify({
      status: 'success',
      message: `Programs ${params.programName} deleted from project ${params.projectName}`,
      projectId: projectData.id,
      projectName: projectData.name,
      programsCount: projectData.programs.length - params.programName.length,
    });
  } catch (error) {
    logger.error('Error deleting programs:', error);
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
  _agent: StarknetAgentInterface,
  params: z.infer<typeof deleteDependencySchema>
) => {
  try {
    const scarb = _agent.getDatabase().get('scarb') as scarbQueries;
    if (!scarb) {
      throw new Error('Scarb database not found');
    }
    const projectData = await scarb.retrieveProjectData(params.projectName);
    if (!projectData) {
      throw new Error(`project ${params.projectName} does not exist`);
    }

    scarb.deleteDependencies(
      params.dependencyName.map((dep) => ({
        projectId: projectData.id,
        name: dep,
      }))
    );

    return JSON.stringify({
      status: 'success',
      message: `Dependencies ${params.dependencyName} deleted from project ${params.projectName}`,
      projectId: projectData.id,
      projectName: projectData.name,
      dependenciesCount:
        projectData.dependencies.length - params.dependencyName.length,
    });
  } catch (error) {
    logger.error('Error deleting dependencies:', error);
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
  _agent: StarknetAgentInterface,
  params: z.infer<typeof deleteProjectSchema>
) => {
  try {
    const scarb = _agent.getDatabase().get('scarb') as scarbQueries;
    if (!scarb) {
      throw new Error('Scarb database not found');
    }
    for (const project of params.projectName) {
      await scarb.deleteProject(project);
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
