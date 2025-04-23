import { logger, StarknetAgentInterface } from '@snakagent/core';
import { buildProject, cleanProject } from '../utils/workspace.js';
import { setupScarbProject, setupToml, setupSrc } from '../utils/common.js';
import { getGeneratedContractFiles } from '../utils/preparation.js';
import { compileContractSchema } from '../schema/schema.js';
import { formatCompilationError } from '../utils/utils.js';
import { z } from 'zod';
import { scarb } from '@snakagent/database/queries';
import { readFile } from 'fs/promises';
import { extractModuleFromArtifact } from '../utils/utils.js';

/**
 * Compile a contract
 * @param agent The Starknet agent
 * @param params The parameters of the compilation
 * @returns The compilation results
 */
export const compileContract = async (
  _agent: StarknetAgentInterface,
  params: z.infer<typeof compileContractSchema>
) => {
  let projectDir = '';
  try {
    logger.info('\n➜ Compiling contract');
    logger.info(JSON.stringify(params, null, 2));

    const projectData = await scarb.retrieveProjectData(params.projectName);
    if (!projectData) {
      throw new Error(`project ${params.projectName} does not exist`);
    }

    projectDir = await setupScarbProject({
      projectName: params.projectName,
    });

    const tomlSections = (() => {
      switch (projectData.type) {
        case 'cairo_program':
          return [];
        case 'contract':
          return [
            {
              workingDir: projectDir,
              sectionTitle: 'target.starknet-contract',
              valuesObject: {
                sierra: true,
                casm: true,
              },
            },
          ];
      }
    })();

    await setupToml(projectDir, tomlSections, projectData.dependencies);
    await setupSrc(projectDir, projectData.programs);

    const buildResult = await buildProject({ path: projectDir });
    const parsedBuildResult = JSON.parse(buildResult);

    if (projectData.type !== 'cairo_program') {
      const contractFiles = await getGeneratedContractFiles(projectDir);

      let programNames: string[] = [];
      let sierraFiles: string[] = [];
      let casmFiles: string[] = [];

      for (let i = 0; i < contractFiles.sierraFiles.length; i++) {
        const name = await extractModuleFromArtifact(
          contractFiles.artifactFile,
          i
        );
        programNames.push(name + '.cairo');
        sierraFiles.push(await readFile(contractFiles.sierraFiles[i], 'utf-8'));
        casmFiles.push(await readFile(contractFiles.casmFiles[i], 'utf-8'));
      }

      await scarb.saveCompilationResults(programNames, sierraFiles, casmFiles);
    }

    return JSON.stringify({
      status: 'success',
      message: `Contract compiled successfully`,
      output: parsedBuildResult.output,
      warnings: parsedBuildResult.errors,
      projectName: params.projectName,
    });
  } catch (error) {
    const errors = formatCompilationError(error);
    return JSON.stringify({
      status: 'failure',
      errors: errors,
      metadata: {
        error_type: 'raw_cairo_error',
        needs_exact_forwarding: true,
      },
      projectName: params.projectName,
    });
  } finally {
    if (projectDir) {
      await cleanProject({ path: projectDir, removeDirectory: true });
    }
  }
};
