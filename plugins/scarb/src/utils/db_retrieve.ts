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
    console.log("projectId  : ", projectId);
    console.log("contractName  : ", contractName);
    if (programResult.status !== 'success' || !programResult.query?.rows.length) {
      throw new Error(`Contract "${contractName}" not found in project "${projectName}"`);
    }
    
    const { sierra, casm } = programResult.query.rows[0];

    console.log(`Retrieved compilation files for contract "${contractName}" in project "${projectName}"`);
    console.log(`Sierra files preview: ${sierra}...`);
    console.log(`---------------------------------------------------------------------------------CASM files preview: ${casm}...`);
    
    return { sierra, casm };
  } catch (error) {
    console.error("Error retrieving compilation files:", error);
    throw error;
  }
};