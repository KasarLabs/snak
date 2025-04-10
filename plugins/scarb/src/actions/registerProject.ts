import { z } from 'zod';
import { registerProjectSchema } from '../schema/schema.js';
import { scarb } from '@snak/database/queries';
import { basename } from 'path';
import { resolveContractPath } from '@/utils/path.js';
import { readFile } from 'fs/promises';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

/**
 * Register a new project in the database
 *
 * @param agent The StarkNet agent
 * @param params The project registration parameters
 * @returns The registration result
 */
export const registerProject = async (
  _agent: StarknetAgentInterface,
  params: z.infer<typeof registerProjectSchema>
) => {
  try {
    if (params.projectName.includes('-')) {
      throw new Error(
        "Project name cannot contain hyphens ('-'). Please use underscores ('_') instead."
      );
    }

    const projectData = await (async () => {
      return await scarb.retrieveProjectData(params.projectName)
    })() ?? await (async () => {
      const programs: scarb.Program[] = [];
      const dependencies: scarb.Dependency[] = [];

      for (const path of params.programPaths || []) {
        const fileName = basename(path);
        const pathResolved = resolveContractPath(path);
        const sourceCode = await readFile(pathResolved, 'utf-8');
        const encoded = sourceCode.replace(/\0/g, '');
        programs.push({ name: fileName, source_code: encoded });
      }

      for (const dep of params.dependencies || []) {
        dependencies.push({ name: dep.name, version: dep.version });
      }

      const name = params.projectName;
      const type = params.projectType ?? 'cairo_program';
      return await scarb.initProject(name, type, programs, dependencies);
    })() ?? (() => {
      throw new Error(`Failed to initialize project ${params.projectName}`);
    })();

    console.log(
      `Project ${params.projectName}: ${projectData ? 'updated' : 'created'}`
    );

    return JSON.stringify({
      status: 'success',
      message: projectData
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
