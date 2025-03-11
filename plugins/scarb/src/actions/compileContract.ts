import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import * as fs from 'fs/promises';
import * as path from 'path';
import { initProject, buildProject, configureSierraAndCasm, isProjectInitialized } from '../utils/project.js';
import { addSeveralDependancies, importContract, cleanLibCairo, resolveContractFilePath } from '../utils/index.js';

export interface Dependency {
  name: string;
  version?: string;
  git?: string;
}

export interface CompileContractParams {
  projectName: string;
  contractPath: string;
  targetDir?: string;
  dependencies?: Dependency[];
}

export const compileContract = async (
  agent: StarknetAgentInterface,
  params: CompileContractParams
) => {
  try {
    const workspaceDir = './src/workspace';
    const projectDir = path.join(workspaceDir, params.projectName);
    const contractPath = resolveContractFilePath(params.contractPath);

    try {
      await fs.mkdir(workspaceDir, { recursive: true });
    } catch (error) {}
    
    const isInitialized = await isProjectInitialized(projectDir);
    if (!isInitialized) {
      await initProject(agent, { name: params.projectName, projectDir });
      await configureSierraAndCasm(agent, { path: projectDir });
    }
    await addSeveralDependancies(params.dependencies || [], projectDir);
    await cleanLibCairo(projectDir);
    await importContract(contractPath, projectDir);

    const buildResult = await buildProject(agent, { path: projectDir });
    const parsedBuildResult = JSON.parse(buildResult);
    
    let generatedFiles : any[] = [];
    try {
      const targetDir = path.join(projectDir, 'target');
      generatedFiles = await fs.readdir(targetDir, { recursive: true });
    } catch (error) {
      console.warn(`Could not list generated files: ${error.message}`);
    }
    
    return JSON.stringify({
      status: 'success',
      message: `Contract compiled successfully`,
      output: parsedBuildResult.output,
      warnings: parsedBuildResult.errors,
      generatedFiles: generatedFiles,
      projectDir: projectDir
    });
    
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};