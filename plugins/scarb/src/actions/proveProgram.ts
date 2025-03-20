import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { checkScarbInstalled } from '../utils/install.js';
import { getProjectDir } from '../utils/preparation.js';
import { proveProject } from '../utils/command.js';
import { proveProgramSchema } from '../schema/schema.js';
import { executeProgram } from './executeProgram.js';
import { z } from 'zod';

export const proveProgram = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof proveProgramSchema>
) => {
  try {
    await checkScarbInstalled();
    
    const execResult = await executeProgram(agent, { ...params, mode: 'standalone' });
    const parsedExecResult = JSON.parse(execResult);
    
    if (parsedExecResult.status !== 'success' || !parsedExecResult.executionId) {
      throw new Error(`Failed to execute program: ${parsedExecResult.error || 'Unknown error'}`);
    }
    console.log(`Program executed successfully with execution ID: ${parsedExecResult.executionId}`); 

    const projectDir = await getProjectDir(params.projectName);

    const result = await proveProject({
      projectDir: projectDir,
      executionId: parsedExecResult.executionId,
    });

    const parsedResult = JSON.parse(result);
    
    return JSON.stringify({
      status: 'success',
      message: 'Contract execution proved successfully',
      proofPath: parsedResult.proofPath,
      output: parsedResult.output,
      error: parsedResult.errors
    });
  } catch (error) {
    console.error("Error proving contract execution:", error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};