import { z } from 'zod';
import {
  deleteProgramSchema,
  deleteDependencySchema,
  deleteProjectSchema,
} from '../schema/schema.js';
import { scarb } from '@snak/database/queries';

/**
 * Delete several programs from a project
 *
 * @param agent The StarkNet agent
 * @param params The deletion parameters
 * @returns The deletion result
 */
export const deleteProgramAction = async (
  params: z.infer<typeof deleteProgramSchema>
) => {
  try {
    const projectData = await scarb.retrieveProjectData(params.projectName);
    if (!projectData) {
      throw new Error(`project ${params.projectName} does not exist`);
    }

    for (const program of params.programName) {
      await scarb.deleteProgram(projectData.id, program);
    }

    const find = (program: scarb.Program) => program.name === params.programName;
    const index = projectData.programs.findIndex(find);
    projectData.programs.splice(index, 1);

    return JSON.stringify({
      status: 'success',
      message: `Programs ${params.programName} deleted from project ${params.projectName}`,
      projectId: projectData.id,
      projectName: projectData.name,
      programsCount: projectData.programs.length,
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
  params: z.infer<typeof deleteDependencySchema>
) => {
  try {
    const projectData = await scarb.retrieveProjectData(params.projectName);
    if (!projectData) {
      throw new Error(`project ${params.projectName} does not exist`);
    }

    for (const dep of params.dependencyName) {
      await scarb.deleteDependency(projectData.id, dep);
    }

    const find = (dependency: scarb.Dependency) => dependency.name === params.dependencyName;
    const index = projectData.dependencies.findIndex(find);
    projectData.dependencies.splice(index, 1);

    return JSON.stringify({
      status: 'success',
      message: `Dependencies ${params.dependencyName} deleted from project ${params.projectName}`,
      projectId: projectData.id,
      projectName: projectData.name,
      dependenciesCount: projectData.dependencies.length,
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
  params: z.infer<typeof deleteProjectSchema>
) => {
  try {
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
