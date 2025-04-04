import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { Dependency } from '../types/index.js';
import fs from 'fs';
import fsPromises from 'fs/promises'; 
import path from 'path';
import crypto from 'crypto';
import { getRepoRoot } from './path.js';
import { getAllPackagesList } from './dependencies.js';



/**
 * Résout le chemin complet d'un fichier de contrat à partir de son nom
 * en utilisant le répertoire d'upload défini dans les variables d'environnement
 * @param fileName Nom du fichier de contrat
 * @returns Chemin complet du fichier
 */
export async function resolveContractPath(fileName: string): Promise<string> {
  let uploadDir = process.env.UPLOAD_DIR;
  if (!uploadDir) {
    throw new Error('UPLOAD_DIR is not defined');
  }

  let repoRoot = getRepoRoot();

  const filePath = path.join(repoRoot, uploadDir, fileName);

  try {
    await fsPromises.access(filePath);
  } catch (error) {
    throw new Error(`File not found: ${filePath}. Make sure the file exists in the ${uploadDir} directory.`);
  }

  return filePath;
}

/**
 * Encodes Cairo source code for database storage
 * @param code The source code to encode
 * @returns The encoded source code
 */
export function encodeSourceCode(code: string): string {
    return code.replace(/\0/g, '');
  }
  
  /**
   * Decodes Cairo source code from database storage
   * @param encodedCode The encoded source code
   * @returns The decoded source code
   */
  export function decodeSourceCode(encodedCode: string): string {
    return encodedCode;
  }

  /**
   * Modifie la fonction extractFile pour utiliser la nouvelle version asynchrone de resolveContractPath
   */
  export async function  extractFile(sourcePath: string): Promise<string> {
    const resolvedPath = await resolveContractPath(sourcePath);
    const sourceCode = await fsPromises.readFile(resolvedPath, 'utf-8');
    return sourceCode;
  }
  
  /**
   * Adds a program to the database
   * @param agent The StarkNet agent
   * @param projectId The project ID
   * @param name The name of the program
   * @param sourcePath The path to the source code file
   */
  export const addProgram = async (
      agent: StarknetAgentInterface,
      projectId: number,
      name: string,
      sourceCode: string
  ) => {
    try {
        const database = agent.getDatabaseByName('scarb_db');
        if (!database) {
          throw new Error('Database not found');
        }
    
        const encodedCode = encodeSourceCode(sourceCode);
    
        const existingProgram = await database.select({
          SELECT: ['id'],
          FROM: ['program'],
          WHERE: [`project_id = ${projectId}`, `name = '${name}'`],
        });

      if (existingProgram.query && existingProgram.query.rows.length > 0) {
        // console.log(`Updating existing program ${name}`);
        const res = await database.query(
          `UPDATE program SET source_code = $1 WHERE id = $2`,
          [encodedCode, existingProgram.query.rows[0].id]
        );
        // console.log(res);
      } else {
        // console.log(`Adding new program ${name}`);
        const res = await database.insert({
          table_name: 'program',
          fields: new Map<string, string | number>([
            ['id', 'DEFAULT'],
            ['project_id', projectId],
            ['name', name],
            ['source_code', encodedCode],
          ]),
        });
        // console.log(res);
      }
      // console.log(`Program ${name} added to database`);
    } catch (error) {
      console.error(`Error adding program ${name}:`, error);
      throw error;
    }
  };
  
  /**
   * Adds a dependency to the database
   * @param agent The StarkNet agent
   * @param projectId The project ID
   * @param dependency The dependency to add
   */
  export const addDependency = async (
    agent: StarknetAgentInterface,
    projectId: number,
    dependencyName: string
  ) => {
    try {
      const database = agent.getDatabaseByName('scarb_db');
      if (!database) {
        throw new Error('Database not found');
      }
      const allDependencies = await getAllPackagesList();
      const dependency = allDependencies.find(dep => dep.name === dependencyName);
      if (!dependency) {
        throw new Error(`Dependency ${dependencyName} not found`);
      }
  
      await database.insert({
        table_name: 'dependency',
        fields: new Map<string, string | number>([
          ['id', 'DEFAULT'],
          ['project_id', projectId],
          ['name', dependency.name],
          ['version', dependency.version || ''],
        ]),
      });
    } catch (error) {
      console.error(`Error adding dependency ${dependencyName}:`, error);
      throw error;
    }
  };