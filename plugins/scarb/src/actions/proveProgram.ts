import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { checkScarbInstalled, getScarbInstallInstructions } from '../utils/install.js';
import { getWorkspacePath } from '../utils/path.js';
import { proveProject } from '../utils/command.js';
import { proveProgramSchema } from '../schema/schema.js';
import * as path from 'path';
import * as fs from 'fs/promises';
import { z } from 'zod';

export const proveProgram = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof proveProgramSchema>
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

    const result = await proveProject({
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