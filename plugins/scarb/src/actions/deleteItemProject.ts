import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import {
  deleteProgram,
  deleteDependency,
  deleteProject,
} from '../utils/db_delete.js';
import { retrieveProjectData } from '../utils/db_init.js';
import {
  deleteProgramSchema,
  deleteDependencySchema,
  deleteProjectSchema,
} from '../schema/schema.js';

/**
 * Delete a program from a project
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

    await deleteProgram(agent, projectData.id, params.programName);

    const updatedProject = await retrieveProjectData(agent, params.projectName);

    return JSON.stringify({
      status: 'success',
      message: `Program ${params.programName} deleted from project ${params.projectName}`,
      projectId: updatedProject.id,
      projectName: updatedProject.name,
      programsCount: updatedProject.programs.length,
    });
  } catch (error) {
    console.error('Error deleting program:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Delete a dependency from a project
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

    await deleteDependency(agent, projectData.id, params.dependencyName);

    const updatedProject = await retrieveProjectData(agent, params.projectName);

    return JSON.stringify({
      status: 'success',
      message: `Dependency ${params.dependencyName} deleted from project ${params.projectName}`,
      projectId: updatedProject.id,
      projectName: updatedProject.name,
      dependenciesCount: updatedProject.dependencies.length,
    });
  } catch (error) {
    console.error('Error deleting dependency:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Delete an entire project
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
    await deleteProject(agent, params.projectName);

    return JSON.stringify({
      status: 'success',
      message: `Project ${params.projectName} deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
