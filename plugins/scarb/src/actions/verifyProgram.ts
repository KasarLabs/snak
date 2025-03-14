import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { verifyProject } from '../utils/command.js';
import { checkScarbInstalled, getScarbInstallInstructions } from '../utils/install.js';
import { getWorkspacePath } from '../utils/path.js';
import { verifyProgramSchema } from '../schema/schema.js';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

export const verifyProgram = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof verifyProgramSchema>
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