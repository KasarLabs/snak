import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import * as fs from 'fs/promises';
import * as path from 'path';
import { initProject, buildProject, addDependency, configureSierraAndCasm } from '../utils/project.js';
import { prepareContract } from '../utils/index.js';

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
    const workingDir = params.targetDir || process.cwd();
    const projectDir = path.join(workingDir, params.projectName);
    
    try {
      await fs.mkdir(workingDir, { recursive: true });
    } catch (error) {}
    
    const initResult = await initProject(agent, { name: params.projectName });
    console.log(`Project initialized: ${JSON.parse(initResult).message}`);

    const configResult = await configureSierraAndCasm(agent, { path: projectDir });
    console.log(`Sierra and CASM configured: ${JSON.parse(configResult).message}`);

    if (params.dependencies && params.dependencies.length > 0) {
      for (const dependency of params.dependencies) {
        const addDepResult = await addDependency(agent, {
            package: dependency.name,
            version: dependency.version,
            git: dependency.git,
            path: projectDir
        });

        console.log(`Dependency added: ${JSON.parse(addDepResult).message}`);
      }
    }
    
    await prepareContract(params.contractPath, projectDir);
    
    const buildResult = await buildProject(agent, { path: projectDir });
    const parsedBuildResult = JSON.parse(buildResult);
    console.log(`Project built: ${parsedBuildResult.message}`);
    
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