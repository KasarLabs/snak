import fs from 'fs';
import path from 'path';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { scarb } from '@snak/database/queries';

/**
 * Write JSON data to a file
 * @param data The JSON data
 * @param outputDir The output directory
 * @param fileName The file name
 * @returns The path to the file
 */
export const writeJsonToFile = (
  data: any,
  outputDir: string,
  fileName: string = 'data'
): string => {
  try {
    const filePath = path.join(outputDir, fileName);
    const proofContent =
      typeof data === 'string' ? data : JSON.stringify(data, null, 2);

    fs.writeFileSync(filePath, proofContent);

    return filePath;
  } catch (error) {
    throw new Error(
      `Failed to write JSON to file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Retrieve the compilation files for a contract in a project
 * @param agent The Starknet agent
 * @param projectName The name of the project
 * @param contractName The name of the contract
 * @returns The compilation files
 */
export const retrieveCompilationFileByName = async (
  _agent: StarknetAgentInterface,
  projectName: string,
  contractName: string
): Promise<{ sierra: JSON; casm: JSON }> => {
  try {
    const project = await scarb.selectProject(projectName);
    if (!project) {
      throw new Error(`Project with name "${projectName}" not found`);
    }

    const program = await scarb.selectProgram(project.id!, contractName);
    if (!program) {
      throw new Error(
        `Contract "${contractName}" not found in project "${projectName}"`
      );
    }

    const sierra = JSON.parse(program.sierra!);
    const casm = JSON.parse(program.casm!);

    return { sierra, casm };
  } catch (error) {
    throw new Error(`Error retrieving compilation files: ${error.message}`);
  }
};

export const getSierraCasmFromDB = async (
  agent: StarknetAgentInterface,
  projectName: string,
  contractName: string
): Promise<{ sierraPath: string; casmPath: string }> => {
  try {
    const { sierra, casm } = await retrieveCompilationFileByName(
      agent,
      projectName,
      contractName
    );

    const sierraPath = writeJsonToFile(sierra, '/tmp', 'sierra.json');
    const casmPath = writeJsonToFile(casm, '/tmp', 'casm.json');

    return { sierraPath, casmPath };
  } catch (error) {
    throw new Error(`Error retrieving compilation files: ${error.message}`);
  }
};
