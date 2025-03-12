import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import * as path from 'path';
import { checkScarbInstalled, getScarbInstallInstructions } from '../utils/environment.js';
import * as fs from 'fs/promises';
import { initProject, buildProject, configureSierraAndCasm, isProjectInitialized, cleanProject, addDependency } from '../utils/project.js';
import { addSeveralDependancies, importContract, cleanLibCairo, checkWorkspaceLimit, getGeneratedContractFiles } from '../utils/index.js';
import { addTomlSection } from '../utils/toml-utils.js';
import { getWorkspacePath, resolveContractPath } from '../utils/path.js';
import { z } from 'zod';
import { executeContractSchema } from '@/schema/schema.js';
import { executeProject } from '../utils/project.js';


export interface ExecuteContractParams {
  projectName: string;
  executableName?: string;
  executableFunction?: string;
  arguments?: string;
}

/**
  * Execute a StarkNet contract
  *
  * @param agent The StarkNet agent
  * @param params The contract execution parameters
  * @returns The contract execution result
 */
export const executeProgram = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof executeContractSchema>
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
      const programPaths = params.programPaths.map(programPath => 
        resolveContractPath(programPath)
      );
      if (programPaths.length > 1) {
        if (params.executableName === undefined)
          throw new Error('Multiple contracts require an executable name');
      }
      const executableName = params.executableName ? params.executableName : path.parse(path.basename(programPaths[0])).name;
  
      await checkWorkspaceLimit(workspaceDir, params.projectName);
      const isInitialized = await isProjectInitialized(projectDir);
      if (!isInitialized) {
        await initProject(agent, { name: params.projectName, projectDir });
      }

      const formattedExecutable = `${params.projectName}::${executableName}::${params.executableFunction ? params.executableFunction : 'main'}`;
      await addTomlSection({
        workingDir: projectDir,
        sectionTitle: 'executable',
        valuesObject: {
          'function' : formattedExecutable,
        }
      });
      await addTomlSection({
        workingDir: projectDir,
        sectionTitle: 'cairo',
        valuesObject: {
          'enable-gas' : false
        }
      });
      await addDependency({
        package: 'cairo_execute',
        version: '2.10.0',
        path: projectDir
      });

      await addSeveralDependancies(params.dependencies || [], projectDir);
      await cleanLibCairo(projectDir);
      for (const programPath of programPaths) {
        await importContract(programPath, projectDir);
      }
      
      // await cleanProject(agent, { path: projectDir });
      const execResult = await executeProject({
        projectDir: projectDir,
        formattedExecutable: formattedExecutable,
        arguments: params.arguments
      });
      const parsedExecResult = JSON.parse(execResult);
      
      return JSON.stringify({
        status: 'success',
        message: 'Contract executed successfully',
        executionId: parsedExecResult.executionId,
        output: parsedExecResult.stdout,
        errors: parsedExecResult.stderr || undefined,
      });
      
    } catch (error) {
      return JSON.stringify({
        status: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
}