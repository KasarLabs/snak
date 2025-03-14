import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { executeProject } from '../utils/command.js';
import { setupScarbProject, setupToml, setupSrc } from '../utils/common.js';
import { executeProgramSchema } from '../schema/schema.js';
import * as path from 'path';
import { z } from 'zod';

/**
  * Execute a StarkNet contract
  *
  * @param agent The StarkNet agent
  * @param params The contract execution parameters
  * @returns The contract execution result
 */
export const executeProgram = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof executeProgramSchema>
) => {
  try {
      const { projectDir, resolvedPaths } = await setupScarbProject({
        projectName: params.projectName,
        filePaths: params.programPaths,
      });
      
      if (resolvedPaths.length > 1) {
        if (params.executableName === undefined)
          throw new Error('Multiple contracts require an executable name');
      }

      const executableName = params.executableName ? params.executableName : path.parse(path.basename(resolvedPaths[0])).name;
      const formattedExecutable = `${params.projectName}::${executableName}::${params.executableFunction ? params.executableFunction : 'main'}`;

      const tomlSections = [
      {
        workingDir: projectDir,
        sectionTitle: 'executable',
        valuesObject: {
          'function' : formattedExecutable,
        }
      },
      {
        workingDir: projectDir,
        sectionTitle: 'cairo',
        valuesObject: {
          'enable-gas' : false
        }
      }];

      const requiredDependencies = [
      {
        name: 'cairo_execute',
        version: '2.10.0'
      }];

      await setupToml(projectDir, tomlSections, params.dependencies, requiredDependencies);
      await setupSrc(projectDir, resolvedPaths, formattedExecutable);

      const execResult = await executeProject({
        projectDir: projectDir,
        formattedExecutable: formattedExecutable,
        arguments: params.arguments,
        target: params.mode || 'standalone' 
      });

      const parsedExecResult = JSON.parse(execResult);
      
      return JSON.stringify({
        status: 'success',
        message: 'Contract executed successfully',
        executionId: parsedExecResult.executionId,
        tracePath: parsedExecResult.tracePath,
        output: parsedExecResult.output,
        errors: parsedExecResult.errors
      });
      
    } catch (error) {
      console.log("Error executing contract:", error);
      return JSON.stringify({
        status: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
}