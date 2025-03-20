import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import * as fs from 'fs/promises';
import * as path from 'path';
import { resolveContractPath } from './path.js';
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
    console.log(`Compilation record created successfully`);
    for (let i = 0 ; i < sierraFiles.length ; i++) {
      const sierraFile = sierraFiles[i];
      const casmFile = casmFiles[i];
      console.log(`Sierra file: ${sierraFile}, CASM file: ${casmFile}`);
      console.log(`Artifact ${artifactFile} index : ${i}`);
      
      const nameContract = await extractModuleFromArtifact(artifactFile, i);
      console.log(`Contract name : ${nameContract}`);
      const program_id = await database.query(`
        SELECT id 
        FROM program 
        WHERE project_id = ${projectId}
        AND name = '${nameContract + '.cairo'}'
      `);
      console.log(program_id);
      console.log(`Program id : ${program_id.query?.rows[0].id}`);
      await storeJsonFromFile(agent, 'program', program_id.query?.rows[0].id, 'sierra', sierraFile);
      await storeJsonFromFile(agent, 'program', program_id.query?.rows[0].id, 'casm', casmFile);
    }

  } catch (error) {
    console.error("Error saving compilation results:", error);
    throw error;
  }
};