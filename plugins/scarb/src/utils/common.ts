import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { checkScarbInstalled, getScarbInstallInstructions } from './install.js';
import { initProject } from './command.js';
import {
  addSeveralDependancies,
  cleanLibCairo,
  checkWorkspaceLimit,
  isProjectInitialized
} from './preparation.js';
import { getWorkspacePath, resolveContractPath } from './path.js';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface ScarbBaseParams {
  projectName: string;
  filePaths: string[];
  dependencies?: any[];
}

/**
 * Setup a base Scarb project and handle common initialization steps
 */
export async function setupScarbProject(
  params: ScarbBaseParams
): Promise<{ 
  projectDir: string; 
  resolvedPaths: string[];
  status: 'success' | 'failure';
  error?: string;
}> {
  try {
    const isScarbInstalled = await checkScarbInstalled();
    if (!isScarbInstalled) {
      throw new Error(await getScarbInstallInstructions());
    }
    
    const workspaceDir = getWorkspacePath();
    try {
      await fs.mkdir(workspaceDir, { recursive: true });
    } catch (error) {}
    await checkWorkspaceLimit(workspaceDir, params.projectName);
    
    const projectDir = path.join(workspaceDir, params.projectName);
    const isInitialized = await isProjectInitialized(projectDir);
    if (!isInitialized) {
      await initProject({ name: params.projectName, projectDir });
    }
    
    const resolvedPaths = params.filePaths.map(filePath => 
      resolveContractPath(filePath)
    );
    
    await addSeveralDependancies(params.dependencies || [], projectDir);
    await cleanLibCairo(projectDir);
    
    return {
      status: 'success',
      projectDir,
      resolvedPaths
    };
  } catch (error) {
      throw new Error('Error setting up Scarb project: ' + error.message);
  }
}
