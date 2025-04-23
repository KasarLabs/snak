import { logger, StarknetAgentInterface } from '@snakagent/core';
('@snakagent/core');
import { executeProject, cleanProject } from '../utils/workspace.js';
import { setupScarbProject, setupToml, setupSrc } from '../utils/common.js';
import { executeProgramSchema } from '../schema/schema.js';
import { formatCompilationError } from '../utils/utils.js';
import { z } from 'zod';
import { scarbQueries } from '@snakagent/database/queries';
import path from 'path';
import { readFileSync } from 'fs';

/**
 * Execute a program
 * @param agent The Starknet agent
 * @param params The parameters of the execution
 * @returns The execution results
 */
export const executeProgram = async (
  _agent: StarknetAgentInterface,
  params: z.infer<typeof executeProgramSchema>
) => {
  let projectDir = '';
  let mode = '';
  try {
    logger.debug('\n Executing program');
    logger.debug(JSON.stringify(params, null, 2));
    const scarb = _agent.getDatabase().get('scarb') as scarbQueries;
    if (!scarb) {
      throw new Error('Scarb database not found');
    }
    const projectData = await scarb.retrieveProjectData(params.projectName);
    if (!projectData) {
      throw new Error(`project ${params.projectName} does not exist`);
    }

    projectDir = await setupScarbProject({
      projectName: params.projectName,
    });

    if (projectData.type !== 'cairo_program')
      throw new Error('Only Cairo programs can be executed');

    if (projectData.programs.length > 1) {
      if (params.executableName === undefined)
        throw new Error('Multiple contracts require an executable name');
    }

    const executableName = params.executableName
      ? params.executableName
      : projectData.programs[0].name.replace('.cairo', '');
    const formattedExecutable = `${params.projectName}::${executableName}::${params.executableFunction ? params.executableFunction : 'main'}`;
    mode = params.mode || 'bootloader';

    const tomlSections = [
      {
        workingDir: projectDir,
        sectionTitle: 'executable',
        valuesObject: {
          function: formattedExecutable,
        },
      },
      {
        workingDir: projectDir,
        sectionTitle: 'cairo',
        valuesObject: {
          'enable-gas': false,
        },
      },
    ];

    const requiredDependencies = [
      {
        name: 'cairo_execute',
        version: '2.10.0',
      },
    ];

    await setupToml(
      projectDir,
      tomlSections,
      projectData.dependencies,
      requiredDependencies
    );
    await setupSrc(projectDir, projectData.programs, formattedExecutable);

    const execResult = await executeProject({
      projectDir: projectDir,
      formattedExecutable: formattedExecutable,
      arguments: params.arguments,
      target: mode,
    });

    const parsedExecResult = JSON.parse(execResult);

    if (mode !== 'standalone') {
      const fullTracePath = path.join(projectDir, parsedExecResult.tracePath);
      const executionTrace = readFileSync(fullTracePath);
      await scarb.saveExecutionResults(projectData.id, executionTrace);
    }

    return JSON.stringify({
      status: 'success',
      message: 'Contract executed successfully',
      executionId: parsedExecResult.executionId,
      tracePath: parsedExecResult.tracePath,
      output: parsedExecResult.output,
      errors: parsedExecResult.errors,
      projectName: params.projectName,
    });
  } catch (error) {
    const errors = formatCompilationError(error);
    return JSON.stringify({
      status: 'failure',
      errors: errors,
      projectDir: projectDir,
    });
  } finally {
    if (projectDir) {
      if (mode !== 'standalone')
        await cleanProject({ path: projectDir, removeDirectory: true });
    }
  }
};
