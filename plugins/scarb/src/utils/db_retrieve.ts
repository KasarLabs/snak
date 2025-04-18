import { CairoProgram, ProjectData } from '../types/index.js';
import { StarknetAgentInterface } from '@kasarlabs/core';
import * as fs from 'fs/promises';

/**
 * Retrieves the project data from the database
 * @param agent The StarkNet agent
 * @param projectName The name of the project
 * @returns The project data
 */
export const retrieveProjectData = async (
  agent: StarknetAgentInterface,
  projectName: string
): Promise<ProjectData> => {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    const projectResult = await database.select({
      SELECT: ['id', 'name', 'type', 'execution_trace', 'proof', 'verified'],
      FROM: ['project'],
      WHERE: [`name = '${projectName}'`],
    });

    if (!projectResult.query?.rows.length) {
      throw new Error(`Project "${projectName}" not found in database`);
    }

    const projectId = projectResult.query.rows[0].id;
    const projectType = projectResult.query.rows[0].type;

    const programsResult = await database.select({
      SELECT: ['name', 'source_code'],
      FROM: ['program'],
      WHERE: [`project_id = ${projectId}`],
    });

    const dependenciesResult = await database.select({
      SELECT: ['name', 'version'],
      FROM: ['dependency'],
      WHERE: [`project_id = ${projectId}`],
    });

    const programs: CairoProgram[] = (programsResult.query?.rows || []).map(
      (row) => ({
        name: row.name,
        source_code: row.source_code,
      })
    );

    return {
      id: projectId,
      name: projectName,
      type: projectType,
      programs: programs,
      dependencies: dependenciesResult.query?.rows || [],
    };
  } catch (error) {
    throw new Error(`Error in retrieving data: ${error.message}`);
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

    console.log(
      `Retrieved compilation files for contract "${contractName}" in project "${projectName}"`
    );

    return { sierra, casm };
  } catch (error) {
    throw new Error(`Error retrieving compilation files: ${error.message}`);
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
    throw new Error(`Error retrieving execution results: ${error.message}`);
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
    throw new Error(`Error retrieving proof: ${error.message}`);
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
    throw new Error(`Error retrieving verification: ${error.message}`);
  }
};
