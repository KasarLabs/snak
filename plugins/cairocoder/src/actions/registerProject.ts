import { logger, StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { registerProjectSchema } from '../schema/schema.js';
import { scarb } from '@snak/database/queries';
import { basename } from 'path';
import { resolveContractPath } from '@/utils/path.js';
import { readFile } from 'fs/promises';
import { getAllPackagesList } from '@/utils/dependencies.js';

/**
 * Register a new project in the database
 *
 * @param params The project registration parameters
 * @returns The registration result
 */
export const registerProject = async (
  _agent: StarknetAgentInterface,
  params: z.infer<typeof registerProjectSchema>
) => {
  try {
    logger.debug('\n Registering project');
    logger.debug(JSON.stringify(params, null, 2));

    let projectData: scarb.ProjectData | undefined;

    if (params.projectName.includes('-'))
      throw new Error(
        "Project name cannot contain hyphens ('-'). Please use underscores ('_') instead."
      );

    if (/[A-Z]/.test(params.projectName)) {
      throw new Error(
        'Project name cannot contain uppercase letters. Please use snake_case (lowercase letters and underscores) for the project name.'
      );
    }

    projectData = await scarb.retrieveProjectData(params.projectName);
    if (projectData) {
      return JSON.stringify({
        status: 'success',
        message: `Project ${params.projectName} already registered`,
        projectId: projectData.id,
        projectName: projectData.name,
        projectType: projectData.type,
      });
    }

    projectData = await (async () => {
      const programs: scarb.Program[] = [];
      const dependencies: scarb.Dependency[] = [];
      const project: scarb.Project = {
        name: params.projectName,
        type: params.projectType ?? 'cairo_program',
      };

      for (const path of params.existingProgramNames || []) {
        const fileName = basename(path);
        const pathResolved = await resolveContractPath(path);
        const sourceCode = await readFile(pathResolved, 'utf-8');
        const encoded = sourceCode.replace(/\0/g, '');
        programs.push({ name: fileName, source_code: encoded });
      }

      const allDependencies = await getAllPackagesList();
      for (const depName of params.dependencies || []) {
        const dep = allDependencies.find((dep) => dep.name === depName);
        if (!dep) {
          throw new Error(`Dependency ${depName} not found`);
        }
        dependencies.push({ name: dep.name, version: dep.version });
      }

      return scarb.initProject(project, programs, dependencies);
    })();

    if (!projectData) {
      throw new Error(`Failed to initialize project ${params.projectName}`);
    }

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
    logger.error('Error registering project:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
