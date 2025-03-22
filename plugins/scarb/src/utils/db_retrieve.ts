import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import * as fs from 'fs/promises';
import * as path from 'path';
import { resolveContractPath } from './path.js';

export interface CairoProgram {
  name: string;
  source_code: string;
}

export interface Dependency {
  name: string;
  version?: string;
  git?: string;
}

export interface ProjectData {
  id: number;
  name: string;
  type: 'contract' | 'cairo_program';
  programs: CairoProgram[];
  dependencies: Dependency[];
}


/**
 * Récupère les fichiers Sierra et CASM pour une compilation en fonction du nom du projet et du nom du contrat
 */
export const retrieveCompilationFilesByName = async (
  agent: StarknetAgentInterface,
  projectName: string,
  contractName: string
): Promise<{ sierra: JSON, casm: JSON }> => {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    const projectResult = await database.select({
      SELECT: ['id'],
      FROM: ['project'],
      WHERE: [`name = '${projectName}'`]
    });
    
    if (projectResult.status !== 'success' || !projectResult.query?.rows.length) {
      throw new Error(`Project with name "${projectName}" not found`);
    }
    
    const projectId = projectResult.query.rows[0].id;
    
    const programResult = await database.query(`
      SELECT sierra, casm 
      FROM program 
      WHERE project_id = ${projectId} AND name = '${contractName}'
    `);

    if (programResult.status !== 'success' || !programResult.query?.rows.length) {
      throw new Error(`Contract "${contractName}" not found in project "${projectName}"`);
    }
    
    const { sierra, casm } = programResult.query.rows[0];

    console.log(`Retrieved compilation files for contract "${contractName}" in project "${projectName}"`);
    
    return { sierra, casm };
  } catch (error) {
    console.error("Error retrieving compilation files:", error);
    throw error;
  }
};

/**
 * Récupère les derniers résultats d'exécution pour un projet
 * @param agent L'agent Starknet pour accéder à la base de données
 * @param projectId ID du projet
 * @returns Les résultats d'exécution
 */
export const retrieveTrace = async (
  agent: StarknetAgentInterface,
  projectName: number,
  outputPath?: string
) : Promise<Buffer | void> => {
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
    
    if (outputPath)
      await fs.writeFile(outputPath, buffer);
    else
      return buffer;

  } catch (error) {
    console.error("Error retrieving execution results:", error);
    throw error;
  }
};



export const retrieveProof = async (
  agent: StarknetAgentInterface,
  projectName: string,
): Promise<{ proof: JSON }> => {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    const projectResult = await database.select({
      SELECT: ['proof'],
      FROM: ['project'],
      WHERE: [`name = '${projectName}'`]
    });

    if (projectResult.status !== 'success' || !projectResult.query?.rows.length) {
      throw new Error(`Project with name "${projectName}" not found`);
    }
    
    const projectProof = projectResult.query.rows[0].proof;
    console.log(`Retrieved proof for project "${projectName}"`);
    
    return projectProof;
  } catch (error) {
    console.error("Error retrieving compilation files:", error);
    throw error;
  }
};

export const retrieveVerification = async (
  agent: StarknetAgentInterface,
  projectName: string,
): Promise<{ sierra: JSON, casm: JSON }> => {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    const projectResult = await database.select({
      SELECT: ['verified'],
      FROM: ['project'],
      WHERE: [`name = '${projectName}'`]
    });
    
    if (projectResult.status !== 'success' || !projectResult.query?.rows.length) {
      throw new Error(`Project with name "${projectName}" not found`);
    }
    
    const projectVerification = projectResult.query.rows[0].verified;
    console.log(`Retrieved proof for project "${projectName}"`);
    
    return projectVerification;
  } catch (error) {
    console.error("Error retrieving compilation files:", error);
    throw error;
  }
};