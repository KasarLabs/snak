import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { verifyProgram } from '../utils/project.js';
import { checkScarbInstalled, getScarbInstallInstructions } from '../utils/environment.js';
import { getWorkspacePath } from '../utils/path.js';
import { verifyContractSchema } from '../schema/schema.js';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

export const verifyContract = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof verifyContractSchema>
) => {
  try {
    const isScarbInstalled = await checkScarbInstalled();
    if (!isScarbInstalled) {
        return JSON.stringify({
        status: 'failure',
        error: await getScarbInstallInstructions(),
        });
    }

    const workspaceDir = getWorkspacePath();
    try {
        await fs.mkdir(workspaceDir, { recursive: true });
    } catch (error) {}
    
    const projectDir = path.join(workspaceDir, params.projectName);
    const result = await verifyProgram({
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