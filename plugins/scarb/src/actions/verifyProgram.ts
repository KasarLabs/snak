import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { verifyProject } from '../utils/command.js';
import { checkScarbInstalled } from '../utils/install.js';
import { getProjectDir } from '../utils/preparation.js';
import { verifyProgramSchema } from '../schema/schema.js';
import { z } from 'zod';

export const verifyProgram = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof verifyProgramSchema>
) => {
  try {
    await checkScarbInstalled();

    const projectDir = await getProjectDir(params.projectName);

    const result = await verifyProject({
        projectDir: projectDir,
        proofPath: params.proofPath,
    });
    const parsedResult = JSON.parse(result);
    
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