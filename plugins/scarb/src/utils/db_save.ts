import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { resolveContractPath } from './path.js';
import { storeJsonFromFile, createOperationRecord } from './db_utils.js';
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
  status: 'success' | 'failed',
  logs: string,
  sierraFiles: string[],
  casmFiles: string[],
  artifactFile : string
) => {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    console.log(`Sierra files count: ${sierraFiles.length}, CASM files count: ${casmFiles.length}`);
    
    // Créer un enregistrement principal pour cette compilation
    const compilationResult = await database.insert({
      table_name: 'compilation',
      fields: new Map<string, any>([
        ['id', 'DEFAULT'],
        ['project_id', projectId],
        ['status', status],
        ['logs', logs]
      ])
    });
    
    if (compilationResult.status !== 'success') {
      throw new Error(`Failed to create compilation record: ${compilationResult.error_message}`);
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

      await storeJsonFromFile(agent, 'program', program_id.query?.rows[0].id, 'sierra', sierraFile);
      await storeJsonFromFile(agent, 'program', program_id.query?.rows[0].id, 'casm', casmFile);
    }

  } catch (error) {
    console.error("Error saving compilation results:", error);
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
  status: 'success' | 'failed',
  logs: string,
  tracePath?: string
) => {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }
    
    // Créer un enregistrement pour cette exécution
    const executionResult = await createOperationRecord(
      agent,
      'execution',
      projectId,
      status,
      logs
    );
    
    // Si un chemin de trace est fourni, mettre à jour le champ trace du projet
    if (status === 'success' && tracePath) {
      try {
        const fullTracePath = path.join(projectDir, tracePath);
        
        console.log(`Looking for trace file at: ${fullTracePath}`);
        
        const traceData = fs.readFileSync(fullTracePath);
        const traceBase64 = traceData.toString('hex');
        
        const updateResult = await database.query(`
          UPDATE project
          SET execution_trace = E'\\\\x${traceData.toString('hex')}'
          WHERE id = ${projectId}
        `);

        if (updateResult.status !== 'success') {
          console.warn(`Warning: Failed to update project trace data: ${updateResult.error_message}`);
        } else {
          console.log(`Updated trace data for project ${projectId}`);
        }
      } catch (error) {
        console.warn(`Warning: Failed to read trace file: ${error.message}`);
      }
    }
    
    return executionResult;
  } catch (error) {
    console.error("Error saving execution results:", error);
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
    console.error("Error saving execution results:", error);
    throw error;
  }
};


export const saveVerification = async (
  agent: StarknetAgentInterface,
  projectDir: string,
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
      console.warn(`Warning: Failed to update verification data: ${updateResult.error_message}`);
    } else {
      console.log(`Updated trace data for project ${projectId}`);
    }
  } catch (error) {
    console.error("Error saving execution results:", error);
    throw error;
  }
};