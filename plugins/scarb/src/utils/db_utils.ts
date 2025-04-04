import * as fs from 'fs';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import * as fspromises from 'fs/promises';
import { retrieveProjectData } from './db_retrieve.js';
import { ProjectData } from '../types/index.js';

/**
 * Store a JSON file in the database
 * @param agent The StarkNet agent
 * @param tableName The name of the table
 * @param recordId The record ID
 * @param columnName The column name
 * @param jsonFilePath The path to the JSON file
 */
export async function storeJsonFromFile(
  agent: StarknetAgentInterface,
  tableName: string,
  recordId: number,
  columnName: string,
  jsonFilePath: string
) {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    const jsonContent = await fspromises.readFile(jsonFilePath, 'utf-8');

    const query = `UPDATE ${tableName} SET ${columnName} = $1 WHERE id = $2`;
    const updateResult = await database.query(query, [
      JSON.stringify(jsonContent),
      recordId,
    ]);

    // console.log(jsonContent);
    if (updateResult.status !== 'success') {
      throw new Error(
        `Failed to store JSON file: ${updateResult.error_message}`
      );
    }
  } catch (error) {
    console.error('Error storing JSON file:', error);
    throw error;
  }
}

/**
 * Compare two JSON files
 * @param file1 The path to the first file
 * @param file2 The path to the second file
 * @returns True if the files are equal, false otherwise
 */
export function compareFiles(file1: string, file2: string): boolean {
  const content1 = JSON.parse(fs.readFileSync(file1, 'utf-8'));
  const content2 = JSON.parse(fs.readFileSync(file2, 'utf-8'));

  return JSON.stringify(content1) === JSON.stringify(content2);
}

/**
 * Checks if a project already exists in the database
 * @param agent The StarkNet agent
 * @param projectName The name of the project
 * @returns The project data if it exists, otherwise undefined
 */
export const projectAlreadyExists = async (
  agent: StarknetAgentInterface,
  projectName: string
): Promise<ProjectData | undefined> => {
  try {
    return await retrieveProjectData(agent, projectName);
  } catch (error) {
    return undefined;
  }
};
