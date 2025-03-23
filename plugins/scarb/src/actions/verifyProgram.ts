import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { verifyProject } from '../utils/command.js';
import { checkScarbInstalled } from '../utils/install.js';
import { getProjectDir } from '../utils/preparation.js';
import { verifyProgramSchema } from '../schema/schema.js';
import { z } from 'zod';
import { saveVerification } from '../utils/db_save.js';
import { retrieveVerification } from '../utils/db_retrieve.js';
import { retrieveProjectData } from '../utils/db_init.js';
import { retrieveProof } from '../utils/db_retrieve.js';
import { setupScarbProject } from '../utils/common.js';
import * as fs from 'fs';
import * as path from 'path';
import { writeJsonToFile } from '../utils/utils.js';
import { cleanProject } from '../utils/command.js';

export const verifyProgram = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof verifyProgramSchema>
) => {
  try {
    const projectData = await retrieveProjectData(agent, params.projectName);
    const { projectDir } = await setupScarbProject({
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
      parsedResult.status === 'success' ? true : false,
    )

    await cleanProject({ path: projectDir });
    // const verif = await retrieveVerification(agent, projectData.name);
    
    return JSON.stringify({
      status: parsedResult.status,
      message: parsedResult.message,
      output: parsedResult.output,
      errors: parsedResult.errors
    });
  } catch (error) {
    console.error("Error verifying proof:", error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};