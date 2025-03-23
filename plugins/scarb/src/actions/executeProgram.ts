import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { executeProject } from '../utils/command.js';
import { setupScarbProject, setupToml, setupSrc } from '../utils/common.js';
import { retrieveProjectData, Dependency } from '../utils/db_init.js';
import { executeProgramSchema } from '../schema/schema.js';
import { z } from 'zod';
import { saveExecutionResults } from '../utils/db_save.js';
import { cleanProject } from '../utils/command.js';

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
      const projectData = await retrieveProjectData(agent, params.projectName);

      const { projectDir } = await setupScarbProject({
        projectName: params.projectName,
      });
      
      if (projectData.type !== 'cairo_program')
        throw new Error('Only Cairo programs can be executed');

      if (projectData.programs.length > 1) {
        if (params.executableName === undefined)
          throw new Error('Multiple contracts require an executable name');
      }

      const executableName = params.executableName ? params.executableName : projectData.programs[0].name.replace('.cairo', '');
      const formattedExecutable = `${params.projectName}::${executableName}::${params.executableFunction ? params.executableFunction : 'main'}`;
      const mode = params.mode || 'bootloader';

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

      await setupToml(projectDir, tomlSections, projectData.dependencies, requiredDependencies);
      await setupSrc(projectDir, projectData.programs, formattedExecutable);

      const execResult = await executeProject({
        projectDir: projectDir,
        formattedExecutable: formattedExecutable,
        arguments: params.arguments,
        target: mode
      });

      const parsedExecResult = JSON.parse(execResult);
      
      await saveExecutionResults(
        agent,
        projectDir,
        projectData.id,
        parsedExecResult.tracePath
      )

      await cleanProject({ path: projectDir });
      // const retrievedTracePath = 'cairo_trace.zip'
      // const files = await retrieveTrace(agent, projectData.name, retrievedTracePath);
      // console.log(`Trace retrieved successfully`);

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