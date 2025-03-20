import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { buildProject } from '../utils/command.js';
import { setupScarbProject, setupToml, setupSrc } from '../utils/common.js';
import { 
  getGeneratedContractFiles
} from '../utils/preparation.js';
import { retrieveProjectData, Dependency } from '../utils/db.js';
import { initializeProjectData } from '../utils/db.js';


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
    const projectData = await retrieveProjectData(agent, params.projectName);

    const { projectDir } = await setupScarbProject({
      projectName: params.projectName,
    });
    

    const tomlSections = projectData.type === 'cairo_program' ? [] : [{
      workingDir: projectDir,
      sectionTitle: 'target.starknet-contract',
      valuesObject: {
        'sierra' : true,
        'casm' : true
      }
    }];

    await setupToml(projectDir, tomlSections, projectData.dependencies);
    await setupSrc(projectDir, projectData.programs);

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
      // sierraFiles: contractFiles.sierraFiles,
      // casmFiles: contractFiles.casmFiles,
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