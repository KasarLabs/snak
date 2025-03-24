import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { proveProject } from '../utils/command.js';
import { proveProgramSchema } from '../schema/schema.js';
import { executeProgram } from './executeProgram.js';
import { z } from 'zod';
import { saveProof } from '../utils/db_save.js';
import { retrieveProjectData } from '../utils/db_init.js';
import { cleanProject } from '../utils/command.js';
import { getProjectDir } from '../utils/preparation.js';

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

    const projectData = await retrieveProjectData(agent, params.projectName);

    projectDir = await getProjectDir(projectData.name);

    const result = await proveProject({
      projectDir: projectDir,
      executionId: parsedExecResult.executionId,
    });

    const parsedResult = JSON.parse(result);

    await saveProof(agent, projectData.id, projectDir, parsedResult.proofPath);

    return JSON.stringify({
      status: 'success',
      message: 'Contract execution proved successfully',
      output: parsedResult.output,
      errors: parsedResult.errors,
    });
  } catch (error) {
    console.error('Error proving contract execution:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    await cleanProject({ path: projectDir, removeDirectory: true });
  }
};
