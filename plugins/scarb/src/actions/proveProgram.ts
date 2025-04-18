import { logger, StarknetAgentInterface } from '@snakagent/core';
('@snakagent/core');
import { proveProject, cleanProject } from '../utils/workspace.js';
import { proveProgramSchema } from '../schema/schema.js';
import { executeProgram } from './executeProgram.js';
import { getProjectDir } from '../utils/preparation.js';
import { scarb } from '@snakagent/database/queries';
import path from 'path';
import { readFile } from 'fs/promises';
import { formatCompilationError } from '../utils/utils.js';
import { z } from 'zod';

/**
 * Prove a program execution
 * @param agent The Starknet agent
 * @param params The parameters of the proof
 * @returns The proof results
 */
export const proveProgram = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof proveProgramSchema>
) => {
  let projectDir = '';
  try {
    logger.debug('\n Proving program');
    logger.debug(JSON.stringify(params, null, 2));

    const projectData = await scarb.retrieveProjectData(params.projectName);
    if (!projectData) {
      throw new Error(`project ${params.projectName} does not exist`);
    }

    const execResult = await executeProgram(agent, {
      ...params,
      mode: 'standalone',
    });
    const parsedExecResult = JSON.parse(execResult);

    if (
      parsedExecResult.status !== 'success' ||
      !parsedExecResult.executionId
    ) {
      throw new Error(
        `Failed to execute program: ${parsedExecResult.error || 'Unknown error'}`
      );
    }

    projectDir = await getProjectDir(projectData.name);

    const res = JSON.parse(
      await proveProject({
        projectDir: projectDir,
        executionId: parsedExecResult.executionId,
      })
    );

    const fullPath = path.join(projectDir, res.proofPath);
    const proof = await readFile(fullPath, 'utf-8');
    await scarb.saveProof(projectData.id, proof);

    return JSON.stringify({
      status: 'success',
      message: 'Contract execution proved successfully',
      output: res.output,
      errors: res.errors,
      projectName: params.projectName,
    });
  } catch (error) {
    const errors = formatCompilationError(error);
    return JSON.stringify({
      status: 'failure',
      errors: errors,
      projectName: params.projectName,
    });
  } finally {
    if (projectDir) {
      await cleanProject({ path: projectDir, removeDirectory: true });
    }
  }
};
