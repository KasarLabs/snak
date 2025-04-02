import * as fs from 'fs';
import * as path from 'path';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { storeJsonFromFile } from './db_utils.js';
import { extractModuleFromArtifact } from './utils.js';

/**
 * Save the compilation results in the database
 * @param agent The StarkNet agent to access the database
 * @param projectId The project ID
 * @param sierraFiles The Sierra files
 * @param casmFiles The Casm files
 * @param artifactFile The artifact file
 */
export const saveCompilationResults = async (
  agent: StarknetAgentInterface,
  projectId: number,
  sierraFiles: string[],
  casmFiles: string[],
  artifactFile: string
) => {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    for (let i = 0; i < sierraFiles.length; i++) {
      const sierraFile = sierraFiles[i];
      const casmFile = casmFiles[i];

      const nameContract = await extractModuleFromArtifact(artifactFile, i);
      const program_id = await database.query(`
        SELECT id 
        FROM program 
        WHERE project_id = ${projectId}
        AND name = '${nameContract + '.cairo'}'
      `);

      if (program_id.status !== 'success') {
        throw new Error(
          `Failed to get program id: ${program_id.error_message}`
        );
      }

      await storeJsonFromFile(
        agent,
        'program',
        program_id.query?.rows[0].id,
        'sierra',
        sierraFile
      );
      await storeJsonFromFile(
        agent,
        'program',
        program_id.query?.rows[0].id,
        'casm',
        casmFile
      );
    }
  } catch (error) {
    console.error('Error saving compilation results:', error);
    throw error;
  }
};

/**
 * Save the execution results in the database
 * @param agent The StarkNet agent to access the database
 * @param projectDir The project directory
 * @param projectId The project ID
 * @param tracePath The path to the trace data
 */
export const saveExecutionResults = async (
  agent: StarknetAgentInterface,
  projectDir: string,
  projectId: number,
  tracePath: string
) => {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    const fullTracePath = path.join(projectDir, tracePath);
    const traceData = fs.readFileSync(fullTracePath);

    const updateResult = await database.query(`
      UPDATE project
      SET execution_trace = E'\\\\x${traceData.toString('hex')}'
      WHERE id = ${projectId}
    `);

    if (updateResult.status !== 'success') {
      throw new Error(`Failed to save trace: ${updateResult.error_message}`);
    }

    return updateResult;
  } catch (error) {
    console.error('Error saving execution results:', error);
    throw error;
  }
};

/**
 * Save the proof in the database
 * @param agent The StarkNet agent to access the database
 * @param projectId The project ID
 * @param projectDir The project directory
 * @param proofPath The path to the proof data
 */
export const saveProof = async (
  agent: StarknetAgentInterface,
  projectId: number,
  projectDir: string,
  proofPath: string
) => {
  try {
    const fullPath = path.join(projectDir, proofPath);
    await storeJsonFromFile(agent, 'project', projectId, 'proof', fullPath);
  } catch (error) {
    console.error('Error saving proof:', error);
    throw error;
  }
};

/**
 * Save the verification status in the database
 * @param agent The StarkNet agent to access the database
 * @param projectId The project ID
 * @param verified The verification status
 */
export const saveVerification = async (
  agent: StarknetAgentInterface,
  projectId: number,
  verified: boolean
) => {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    const updateResult = await database.query(`
      UPDATE project
      SET verified = ${verified}
      WHERE id = ${projectId}
    `);

    if (updateResult.status !== 'success') {
      throw new Error(
        `Failed to save verification status: ${updateResult.error_message}`
      );
    }
  } catch (error) {
    console.error('Error saving verification status:', error);
    throw error;
  }
};
