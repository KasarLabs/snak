import fs from 'fs';
import path from 'path';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

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
export const retrieveCompilationFilesByName = async (
  agent: StarknetAgentInterface,
  projectName: string,
  contractName: string
): Promise<{ sierra: JSON; casm: JSON }> => {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    const projectResult = await database.select({
      SELECT: ['id'],
      FROM: ['project'],
      WHERE: [`name = '${projectName}'`],
    });

    if (
      projectResult.status !== 'success' ||
      !projectResult.query?.rows.length
    ) {
      throw new Error(`Project with name "${projectName}" not found`);
    }

    const projectId = projectResult.query.rows[0].id;

    const programResult = await database.query(`
        SELECT sierra, casm 
        FROM program 
        WHERE project_id = ${projectId} AND name = '${contractName}'
      `);

    if (
      programResult.status !== 'success' ||
      !programResult.query?.rows.length
    ) {
      throw new Error(
        `Contract "${contractName}" not found in project "${projectName}"`
      );
    }

    const { sierra, casm } = programResult.query.rows[0];

    return { sierra, casm };
  } catch (error) {
    console.error('Error retrieving compilation files:', error);
    throw error;
  }
};

export const getSierraCasmFromDB = async (
  agent: StarknetAgentInterface,
  projectName: string,
  contractName: string
): Promise<{ sierraPath: string; casmPath: string }> => {
  try {
    const { sierra, casm } = await retrieveCompilationFilesByName(
      agent,
      projectName,
      contractName
    );

    const sierraPath = await writeJsonToFile(sierra, '/tmp', 'sierra.json');
    const casmPath = await writeJsonToFile(casm, '/tmp', 'casm.json');

    return { sierraPath, casmPath };
  } catch (error) {
    console.error('Error retrieving compilation files:', error);
    throw error;
  }
};
