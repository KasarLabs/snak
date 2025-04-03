import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { buildProject } from '../utils/command.js';
import { setupScarbProject, setupToml, setupSrc } from '../utils/common.js';
import { getGeneratedContractFiles } from '../utils/preparation.js';
import { retrieveProjectData } from '../utils/db_init.js';
import { saveCompilationResults } from '../utils/db_save.js';
import { cleanProject } from '../utils/command.js';
import { compileContractSchema } from '../schema/schema.js';
import { z } from 'zod';
import { formatCompilationError } from '../utils/errorHandler.js';

/**
 * Compile a contract
 * @param agent The Starknet agent
 * @param params The parameters of the compilation
 * @returns The compilation results
 */
export const compileContract = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof compileContractSchema>
) => {
  let projectDir = '';
  try {
    console.log('\n➜ Compiling contract');
    console.log(JSON.stringify(params, null, 2));
    const projectData = await retrieveProjectData(agent, params.projectName);

    projectDir = await setupScarbProject({
      projectName: params.projectName,
    });

    const tomlSections =
      projectData.type === 'cairo_program'
        ? []
        : [
            {
              workingDir: projectDir,
              sectionTitle: 'target.starknet-contract',
              valuesObject: {
                sierra: true,
                casm: true,
              },
            },
          ];

    await setupToml(projectDir, tomlSections, projectData.dependencies);
    await setupSrc(projectDir, projectData.programs);

    const buildResult = await buildProject({ path: projectDir });
    const parsedBuildResult = JSON.parse(buildResult);

    const contractFiles = await getGeneratedContractFiles(projectDir);

    await saveCompilationResults(
      agent,
      projectData.id,
      contractFiles.sierraFiles,
      contractFiles.casmFiles,
      contractFiles.artifactFile
    );

    return JSON.stringify({
      status: 'success',
      message: `Contract compiled successfully`,
      output: parsedBuildResult.output,
      warnings: parsedBuildResult.errors,
      projectDir: projectDir,
    });
  } catch (error) {
    const errors = formatCompilationError(error);
    // console.log('Error compiling contract:', errors);
    return JSON.stringify({
      status: 'failure',
      errors: errors,
      metadata: {
        error_type: 'raw_cairo_error',
        needs_exact_forwarding: true
      },
      projectDir: projectDir,
    });
  } finally {
    await cleanProject({ path: projectDir, removeDirectory: true });
  }
};
