import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { buildProject } from '../utils/command.js';
import { setupScarbProject, setupToml, setupSrc } from '../utils/common.js';
import { 
  getGeneratedContractFiles
} from '../utils/preparation.js';
import { retrieveProjectData, Dependency } from '../utils/db_init.js';
import { saveCompilationResults } from '../utils/db_save.js';
import { retrieveCompilationFilesByName } from '../utils/db_retrieve.js';


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

    const buildResult = await buildProject({ path: projectDir });
    const parsedBuildResult = JSON.parse(buildResult);
    
    const contractFiles = await getGeneratedContractFiles(projectDir);
    
    await saveCompilationResults(
      agent,
      projectData.id,
      'success',
      JSON.stringify(parsedBuildResult),
      contractFiles.sierraFiles,
      contractFiles.casmFiles,
      contractFiles.artifactFile
    );

    // await cleanProject(agent, { path: projectDir });

    // const files = await retrieveCompilationFilesByName(agent, params.projectName, projectData.programs[0].name);
    // console.log(`Sierra and CASM retrieved successfully`);

    return JSON.stringify({
      status: 'success',
      message: `Contract compiled successfully`,
      output: parsedBuildResult.output,
      warnings: parsedBuildResult.errors,
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