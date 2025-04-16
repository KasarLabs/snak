import { logger, StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { addProgramSchema, addDependencySchema } from '../schema/schema.js';
import { extractFile } from '../utils/utils.js';
import path from 'path';
import { z } from 'zod';
import { scarb } from '@snak/database/queries';
import { getAllPackagesList } from '../utils/dependencies.js';
import { Id } from '@snak/database/common';

/**
 * Add several programs to a project
 * @param _angent The Starknet agent
 * @param params The parameters of the program
 * @returns The result of the operation
 */
export const addProgramAction = async (
  _angent: StarknetAgentInterface,
  params: z.infer<typeof addProgramSchema>
) => {
  try {
    logger.debug('\n Adding program');
    logger.debug(JSON.stringify(params, null, 2));

    const projectData = await scarb.retrieveProjectData(params.projectName);
    if (!projectData) {
      throw new Error(`project ${params.projectName} does not exist`);
    }

    const programs: scarb.Program<Id.Id>[] = [];
    for (const contractPath of params.programPaths) {
      programs.push({
        project_id: projectData.id,
        name: path.basename(contractPath),
        source_code: await extractFile(contractPath),
      });
    }
    await scarb.insertPrograms(programs);

    return JSON.stringify({
      status: 'success',
      message: `Programs added to project ${params.projectName}`,
      projectId: projectData.id,
      projectName: projectData.name,
      programsCount: projectData.programs.length + params.programPaths.length,
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
 * @param _angent The Starknet agent
 * @param params The parameters of the dependencies
 * @returns The result of the operation
 */
export const addDependencyAction = async (
  _angent: StarknetAgentInterface,
  params: z.infer<typeof addDependencySchema>
) => {
  try {
    logger.debug('\n Adding dependency');
    logger.debug(JSON.stringify(params, null, 2));

    const projectData = await scarb.retrieveProjectData(params.projectName);
    if (!projectData) {
      throw new Error(`project ${params.projectName} does not exist`);
    }

    const allDeps = await getAllPackagesList();
    const deps: scarb.Dependency<Id.Id>[] = params.dependencies.map((name) => {
      const info = allDeps.find((dep) => dep.name === name);

      if (!info) {
        throw new Error(`Dependency ${name} not found`);
      }

      return {
        project_id: projectData.id,
        name: info.name,
        version: info.version,
      };
    });

    await scarb.insertDependencies(deps);

    return JSON.stringify({
      status: 'success',
      message: `Dependencies added to project ${params.projectName}`,
      projectId: projectData.id,
      projectName: projectData.name,
      dependenciesCount: projectData.dependencies.length + deps.length,
    });
  } catch (error) {
    logger.error('Error adding dependency:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
