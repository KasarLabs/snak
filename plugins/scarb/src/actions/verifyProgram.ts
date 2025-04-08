import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { verifyProject } from '../utils/command.js';
import { verifyProgramSchema } from '../schema/schema.js';
import { z } from 'zod';
import { saveVerification } from '../utils/db_save.js';
import { retrieveProjectData } from '../utils/db_init.js';
import { retrieveProof } from '../utils/db_retrieve.js';
import { setupScarbProject } from '../utils/common.js';
import { writeJsonToFile } from '../utils/utils.js';
import { cleanProject } from '../utils/command.js';

/**
 * Verify a program
 * @param agent The Starknet agent
 * @param params The parameters of the verification
 * @returns The verification results
 */
export const verifyProgram = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof verifyProgramSchema>
) => {
  console.log("\n➜ Verifying program");
  let projectDir = '';
  try {
    console.log("[VERIFY] Starting program verification");
    console.log(`[VERIFY] Project: ${params.projectName}`);
    
    const projectData = await retrieveProjectData(agent, params.projectName);

    projectDir = await setupScarbProject({
      projectName: params.projectName,
    });

    const proof = await retrieveProof(agent, projectData.name);
    writeJsonToFile(proof, projectDir, 'proof.json');

    const result = await verifyProject({
      projectDir: projectDir,
      proofPath: 'proof.json',
    });
    const parsedResult = JSON.parse(result);

    await saveVerification(
      agent,
      projectData.id,
      parsedResult.status === 'success' ? true : false
    );

    if (parsedResult.status === 'success') {
      console.log('[VERIFY] Status: Success');
      console.log(`[VERIFY] Project: ${projectData.name}`);
    }

    return JSON.stringify({
      status: parsedResult.status,
      message: parsedResult.message,
      output: parsedResult.output,
      errors: parsedResult.errors,
    });
  } catch (error) {
    // console.error('Error verifying proof:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    await cleanProject({ path: projectDir, removeDirectory: true });
  }
};
