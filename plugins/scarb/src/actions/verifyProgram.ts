import { logger, StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { verifyProject, cleanProject } from '../utils/workspace.js';
import { verifyProgramSchema } from '../schema/schema.js';
import { saveVerification } from '../utils/db_save.js';
import { retrieveProjectData, retrieveProof } from '../utils/db_retrieve.js';
import { setupScarbProject } from '../utils/common.js';
import { writeJsonToFile } from '../utils/utils.js';
import { z } from 'zod';
import { cleanProject } from '../utils/command.js';
import { scarb } from '@snak/database/queries';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

/**
 * Verify a program
 * @param agent The Starknet agent
 * @param params The parameters of the verification
 * @returns The verification results
 */
export const verifyProgram = async (
  _agent: StarknetAgentInterface,
  params: z.infer<typeof verifyProgramSchema>
) => {
  let projectDir = '';
  try {
    logger.debug('\n Verifying program');
    logger.debug(JSON.stringify(params, null, 2));

    const projectData = await scarb.retrieveProjectData(params.projectName);
    if (!projectData) {
      throw new Error(`project ${params.projectName} does not exist`);
    }

    projectDir = await setupScarbProject({
      projectName: params.projectName,
    });

    writeJsonToFile(projectData.proof, projectDir, 'proof.json');

    const result = await verifyProject({
      projectDir: projectDir,
      proofPath: 'proof.json',
    });
    const parsedResult = JSON.parse(result);

    await scarb.verifyProject(
      projectData.name,
      parsedResult.status === 'success' ? true : false
    );

    return JSON.stringify({
      status: parsedResult.status,
      message: parsedResult.message,
      output: parsedResult.output,
      errors: parsedResult.errors,
      projectName: params.projectName,
    });
  } catch (error) {
    logger.error('Error verifying program:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      projectName: params.projectName,
    });
  } finally {
    if (projectDir) {
      await cleanProject({ path: projectDir, removeDirectory: true });
    }
  }
};
