import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import * as fs from 'fs/promises';
import * as path from 'path';
import { initProject, buildProject, configureSierraAndCasm, isProjectInitialized, cleanProject } from '../utils/project.js';
import { addSeveralDependancies, importContract, cleanLibCairo, checkWorkspaceLimit, getGeneratedContractFiles } from '../utils/index.js';
import { getWorkspacePath, resolveContractPath } from '../utils/path.js';

export interface Dependency {
  name: string;
  version?: string;
  git?: string;
}

export interface CompileContractParams {
  projectName: string;
  contractPaths: string[];
  targetDir?: string;
  dependencies?: Dependency[];
}

export const compileContract = async (
  agent: StarknetAgentInterface,
  params: CompileContractParams
) => {
  try {
    const workspaceDir = getWorkspacePath();
    const projectDir = path.join(workspaceDir, params.projectName);
    const contractPaths = params.contractPaths.map(contractPath => 
      resolveContractPath(contractPath)
    );

    try {
      await fs.mkdir(workspaceDir, { recursive: true });
    } catch (error) {}
    
    await checkWorkspaceLimit(workspaceDir, params.projectName);
    const isInitialized = await isProjectInitialized(projectDir);
    if (!isInitialized) {
      await initProject(agent, { name: params.projectName, projectDir });
      await configureSierraAndCasm(agent, { path: projectDir });
    }
    await addSeveralDependancies(params.dependencies || [], projectDir);
    await cleanLibCairo(projectDir);
    for (const contractPath of contractPaths) {
      await importContract(contractPath, projectDir);
    }

    await cleanProject(agent, { path: projectDir });
    const buildResult = await buildProject(agent, { path: projectDir });
    const parsedBuildResult = JSON.parse(buildResult);
    
    const contractFiles = await getGeneratedContractFiles(projectDir);
    
    return JSON.stringify({
      status: 'success',
      message: `Contract compiled successfully`,
      output: parsedBuildResult.output,
      warnings: parsedBuildResult.errors,
      sierraFiles: contractFiles.sierraFiles,
      casmFiles: contractFiles.casmFiles,
      projectDir: projectDir
    });
    
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};