import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import * as path from 'path';
import { storeJsonFromFile } from './db_utils.js';
import { extractModuleFromArtifact } from './utils.js';

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
 * Sauvegarde les résultats de compilation (fichiers Sierra et CASM) dans la base de données
 */
export const saveCompilationResults = async (
  agent: StarknetAgentInterface,
  projectId: number,
  sierraFiles: string[],
  casmFiles: string[],
  artifactFile : string
) => {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    for (let i = 0 ; i < sierraFiles.length ; i++) {
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
        throw new Error(`Failed to get program id: ${program_id.error_message}`);
      }

      await storeJsonFromFile(agent, 'program', program_id.query?.rows[0].id, 'sierra', sierraFile);
      await storeJsonFromFile(agent, 'program', program_id.query?.rows[0].id, 'casm', casmFile);
    }

  } catch (error) {
    throw error;
  }
};

import * as fs from 'fs';
/**
 * Sauvegarde les résultats d'exécution dans la base de données
 * @param agent L'agent Starknet pour accéder à la base de données
 * @param projectDir Chemin du projet
 * @param projectId ID du projet
 * @param status Statut de l'exécution ('success' ou 'failed')
 * @param logs Logs de l'exécution
 * @param tracePath Chemin vers le fichier de trace (optionnel)
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
    throw error;
  }
};


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
    throw error;
  }
};


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
      throw new Error(`Failed to save verification status: ${updateResult.error_message}`);
    }
  } catch (error) {
    throw error;
  }
};