import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { buildProject } from '../utils/command.js';
import { setupScarbProject } from '../utils/common.js';
import { 
  addSeveralDependancies, 
  importContract, 
  cleanLibCairo,  
  addTomlSection, 
  getGeneratedContractFiles
} from '../utils/preparation.js';

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
    const { projectDir, resolvedPaths } = await setupScarbProject({
      projectName: params.projectName,
      filePaths: params.contractPaths,
      dependencies: params.dependencies
    });
    
    await addTomlSection({
      workingDir: projectDir,
      sectionTitle: 'target.starknet-contract',
      valuesObject: {
        'sierra' : true,
        'casm' : true
      }
    });

    await addSeveralDependancies(params.dependencies || [], projectDir);
    await cleanLibCairo(projectDir);
    for (const contractPath of resolvedPaths) {
      await importContract(contractPath, projectDir);
    }

    // await cleanProject(agent, { path: projectDir });
    const buildResult = await buildProject({ path: projectDir });
    const parsedBuildResult = JSON.parse(buildResult);

    const contractFiles = await getGeneratedContractFiles(projectDir);
    
    console.log(`Contract compiled successfully`);
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
    console.log("Error compiling contract:", error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};