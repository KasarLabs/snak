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

    // Lire le contenu du fichier d'artefact pour obtenir les informations correctes sur les contrats
    const artifactContent = await fs.promises.readFile(artifactFile, 'utf-8');
    const artifact = JSON.parse(artifactContent);

    if (!artifact.contracts || !Array.isArray(artifact.contracts)) {
      throw new Error('Invalid artifact file format: missing contracts array');
    }

    // COMMENTÉ: Cette boucle cause l'inversion des associations entre noms de modules et fichiers Sierra/CASM
    /*
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

      console.log('program_name:', nameContract + '.cairo');
      console.log('sierraFile:', sierraFile);

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
    */

    // NOUVEAU: Association correcte basée sur les informations de l'artefact
    for (const contract of artifact.contracts) {
      // Extraire le nom du module (deuxième segment du chemin du module)
      const modulePath = contract.module_path;
      const parts = modulePath.split('::');
      const nameContract = parts.length >= 3 ? parts[parts.length - 2] : '';
      
      // Trouver les fichiers Sierra et CASM correspondants
      const sierraFileName = contract.artifacts.sierra;
      const casmFileName = contract.artifacts.casm;
      
      const sierraFile = sierraFiles.find(file => path.basename(file) === sierraFileName);
      const casmFile = casmFiles.find(file => path.basename(file) === casmFileName);
      
      if (!sierraFile || !casmFile) {
        console.warn(`Could not find Sierra or CASM file for ${nameContract}`);
        continue;
      }

      // Obtenir l'ID du programme
      const program_id = await database.query(`
        SELECT id 
        FROM program 
        WHERE project_id = ${projectId}
        AND name = '${nameContract + '.cairo'}'
      `);

      if (program_id.status !== 'success') {
        console.warn(`Failed to get program id for ${nameContract}: ${program_id.error_message}`);
        continue;
      }

      console.log('program_name:', nameContract + '.cairo');
      console.log('sierraFile:', sierraFile);

      // Stocker les fichiers Sierra et CASM
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
