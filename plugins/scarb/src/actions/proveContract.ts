import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { checkScarbInstalled, getScarbInstallInstructions } from '../utils/environment.js';
import { getWorkspacePath } from '../utils/path.js';
import { proveProgram } from '../utils/project.js';
import { proveContractSchema } from '../schema/schema.js';
import { z } from 'zod';

export const proveContract = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof proveContractSchema>
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

    const result = await proveProgram({
      projectDir: projectDir,
      executionId: params.executionId,
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