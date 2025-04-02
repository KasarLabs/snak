import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import * as fs from 'fs/promises';

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

    console.log(
      `Retrieved compilation files for contract "${contractName}" in project "${projectName}"`
    );

    return { sierra, casm };
  } catch (error) {
    console.error('Error retrieving compilation files:', error);
    throw error;
  }
};

/**
 * Retrieve the of a project
 * @param agent The Starknet agent
 * @param projectName The name of the project
 * @param outputPath The path to save the trace data
 * @returns The trace data
 */
export const retrieveTrace = async (
  agent: StarknetAgentInterface,
  projectName: number,
  outputPath?: string
): Promise<Buffer | void> => {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    const result = await database.query(`
      SELECT execution_trace 
      FROM project 
      WHERE name = ${projectName}
    `);

    if (result.status !== 'success' || !result.query?.rows.length) {
      throw new Error(`No execution results found for project ${projectName}`);
    }

    const traceData = result.query.rows[0].execution_trace;

    if (!traceData) {
      throw new Error(`Trace data is empty for project ${projectName}`);
    }

    let buffer;
    if (typeof traceData === 'string' && traceData.startsWith('\\x')) {
      const hexString = traceData.substring(2);
      buffer = Buffer.from(hexString, 'hex');
    } else if (Buffer.isBuffer(traceData)) {
      buffer = traceData;
    } else {
      buffer = Buffer.from(traceData);
    }

    if (outputPath) await fs.writeFile(outputPath, buffer);
    else return buffer;
  } catch (error) {
    console.error('Error retrieving execution results:', error);
    throw error;
  }
};

/**
 * Retrieve the proof of a project
 * @param agent The Starknet agent
 * @param projectName The name of the project
 * @returns The proof data
 */
export const retrieveProof = async (
  agent: StarknetAgentInterface,
  projectName: string
): Promise<{ proof: JSON }> => {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    const projectResult = await database.select({
      SELECT: ['proof'],
      FROM: ['project'],
      WHERE: [`name = '${projectName}'`],
    });

    if (
      projectResult.status !== 'success' ||
      !projectResult.query?.rows.length
    ) {
      throw new Error(`Project with name "${projectName}" not found`);
    }

    const projectProof = projectResult.query.rows[0].proof;
    return projectProof;
  } catch (error) {
    console.error('Error retrieving compilation files:', error);
    throw error;
  }
};

/**
 * Retrieve the verification of a project
 * @param agent The Starknet agent
 * @param projectName The name of the project
 * @returns The verification data
 */
export const retrieveVerification = async (
  agent: StarknetAgentInterface,
  projectName: string
): Promise<{ sierra: JSON; casm: JSON }> => {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    const projectResult = await database.select({
      SELECT: ['verified'],
      FROM: ['project'],
      WHERE: [`name = '${projectName}'`],
    });

    if (
      projectResult.status !== 'success' ||
      !projectResult.query?.rows.length
    ) {
      throw new Error(`Project with name "${projectName}" not found`);
    }

    const projectVerification = projectResult.query.rows[0].verified;
    return projectVerification;
  } catch (error) {
    console.error('Error retrieving compilation files:', error);
    throw error;
  }
};
