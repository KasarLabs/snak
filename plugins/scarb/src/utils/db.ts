// src/utils/db.ts

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
 * Safely encodes Cairo source code for database storage
 */
export function encodeSourceCode(code: string): string {
  return code.replace(/\0/g, '');
}

/**
 * Decodes Cairo source code from database storage
 */
export function decodeSourceCode(encodedCode: string): string {
  return encodedCode;
}

/**
 * Initializes the database with all required tables
 */
export const initializeDatabase = async (
  agent: StarknetAgentInterface
): Promise<any | undefined> => {
  try {
    let database = await agent.createDatabase('scarb_db');

    if (!database) { 
      database = agent.getDatabaseByName('scarb_db');
      if (!database) {
        throw new Error('Database not found');
      }
    }
    
    const tables = [
      {
        table_name: 'project',
        fields: new Map<string, string>([
          ['id', 'SERIAL PRIMARY KEY'],
          ['name', 'VARCHAR(100) UNIQUE'],
          ['type', `VARCHAR(50) CHECK (type IN ('contract', 'cairo_program'))`],
          ['execution_trace', 'TEXT'],
          // ['proof_id', 'INTEGER REFERENCES proof(id)']
        ]),
      },
      {
        table_name: 'program',
        fields: new Map<string, string>([
          ['id', 'SERIAL PRIMARY KEY'],
          ['project_id', 'INTEGER REFERENCES project(id) ON DELETE CASCADE'],
          ['name', 'VARCHAR(255) NOT NULL'],
          ['source_code', 'TEXT']
        ]),
      },
      {
        table_name: 'dependency', // Relation 1:N avec projects
        fields: new Map<string, string>([
          ['id', 'SERIAL PRIMARY KEY'],
          ['project_id', 'INTEGER REFERENCES project(id) ON DELETE CASCADE'],
          ['name', 'VARCHAR(255) NOT NULL'],
          ['version', 'VARCHAR(50)'],
          // ['git', 'TEXT'] // Optionnel pour stocker l'URL du repo
        ]),
      },
      {
        table_name: 'compilation',
        fields: new Map<string, string>([
          ['id', 'SERIAL PRIMARY KEY'],
          ['project_id', 'INTEGER REFERENCES project(id)'],
          ['status', `VARCHAR(50) CHECK (status IN ('success', 'failed'))`],
          ['logs', 'TEXT'],
          ['sierra', 'TEXT'],
          ['casm', 'TEXT'],
        ]),
      },
      // {
      //   table_name: 'execution',
      //   fields: new Map<string, string>([
      //     ['id', 'SERIAL PRIMARY KEY'],
      //     ['project_id', 'INTEGER REFERENCES project(id)'],
      //     ['mode', `VARCHAR(50) CHECK (mode IN ('standalone', 'bootloader'))`],
      //     ['execution_id', 'TEXT'],
      //     ['trace_path', 'TEXT'],
      //     ['status', `VARCHAR(50) CHECK (status IN ('success', 'failed'))`],
      //     ['logs', 'TEXT']
      //   ]),
      // },
      // {
      //   table_name: 'proof',
      //   fields: new Map<string, string>([
      //     ['id', 'SERIAL PRIMARY KEY'],
      //     ['project_id', 'INTEGER REFERENCES project(id)'],
      //     ['proof', 'JSONB'],
      //     ['verified', 'BOOLEAN'],
      //     ['verification_logs', 'TEXT']
      //   ]),
      // }
    ];
    
    // Création des tables avec gestion des erreurs
    for (const table of tables) {
      const result = await database.createTable({
        table_name: table.table_name,
        if_not_exist: false,
        fields: table.fields,
      });
      
      if (result.status === 'error') {
        if (result.code === '42P07') {
          console.warn(`Table ${table.table_name} already exists. Adding it.`);
          database.addExistingTable({
            table_name: table.table_name,
            if_not_exist: false,
            fields: table.fields,
          });
        } else {
          throw new Error(`Error ${result.code} : ${result.error_message}`);
        }
      }
    }
    return database;
  } catch (error) {
    console.error('Error initializing database:', error);
    return undefined;
  }
};

/**
 * Creates a new project in the database
 */
export const createProject = async (
  agent: StarknetAgentInterface,
  projectName: string,
  projectType: 'contract' | 'cairo_program' = 'contract'
): Promise<number> => {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    // Check if project exists using select method
    const existingProject = await database.select({
      SELECT: ['id'],
      FROM: ['project'],
      WHERE: [`name = '${projectName}'`]
    });

    if (existingProject.query && existingProject.query.rows.length > 0) {
      return existingProject.query.rows[0].id;
    }

    // Create project using insert method
    await database.insert({
      table_name: 'project',
      fields: new Map<string, string>([
        ['id', 'DEFAULT'],
        ['name', projectName],
        ['type', projectType]
      ])
    });

    // Get the ID of the newly created project
    const newProject = await database.select({
      SELECT: ['id'],
      FROM: ['project'],
      WHERE: [`name = '${projectName}'`]
    });
    
    if (!newProject.query?.rows.length) {
      throw new Error('Failed to create project');
    }

    return newProject.query.rows[0].id;
  } catch (error) {
    console.error("Error creating project:", error);
    throw error;
  }
};

/**
 * Adds a Cairo program to the database
 */
export const addProgram = async (
  agent: StarknetAgentInterface,
  projectId: number,
  name: string,
  sourcePath: string
): Promise<boolean> => {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    // Read and encode the source code
    const resolvedPath = resolveContractPath(sourcePath);
    const sourceCode = await fs.readFile(resolvedPath, 'utf-8');
    const encodedCode = encodeSourceCode(sourceCode);
    
    // Check if program exists
    const existingProgram = await database.select({
      SELECT: ['id'],
      FROM: ['program'],
      WHERE: [`project_id = ${projectId}`, `name = '${name}'`]
    });

    if (existingProgram.query && existingProgram.query.rows.length > 0) {
      await database.update({
        table_name: 'program',
        ONLY: false,
        SET: [`source_code = ${encodedCode}`],
        WHERE: [`id = ${existingProgram.query.rows[0].id}`]
      });
    } else {
      await database.insert({
        table_name: 'program',
        fields: new Map<string, string | number>([
          ['id', 'DEFAULT'],
          ['project_id', projectId],
          ['name', name],
          ['source_code', encodedCode]
        ])
      });
    }
    console.log(`Program ${name} added to project ${projectId}`);
    return true;
  } catch (error) {
    console.error(`Error adding program ${name}:`, error);
    throw error;
  }
};

/**
 * Adds a dependency to the database
 */
export const addDependency = async (
  agent: StarknetAgentInterface,
  projectId: number,
  dependency: Dependency
): Promise<boolean> => {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    // Check if dependency exists
    const existingDep = await database.select({
      SELECT: ['id'],
      FROM: ['dependency'],
      WHERE: [`project_id = ${projectId}`, `name = '${dependency.name}'`]
    });

    if (existingDep.query && existingDep.query.rows.length > 0) {
      // Update using the database's update method
      const escapedVersion = (dependency.version || '').replace(/'/g, "''");
      await database.update({
        table_name: 'dependency',
        ONLY: false,
        SET: [`version = '${escapedVersion}'`],
        WHERE: [`id = ${existingDep.query.rows[0].id}`]
      });
    } else {
      // Insert new dependency
      await database.insert({
        table_name: 'dependency',
        fields: new Map<string, string | number>([
          ['id', 'DEFAULT'],
          ['project_id', projectId],
          ['name', dependency.name],
          ['version', dependency.version || '']
        ])
      });
    }
    console.log(`Dependency ${dependency.name} added to project ${projectId}`);
    return true;
  } catch (error) {
    console.error(`Error adding dependency ${dependency.name}:`, error);
    throw error;
  }
};

/**
 * Initializes a project with programs and dependencies
 */
export const initializeProjectData = async (
  agent: StarknetAgentInterface,
  projectName: string,
  contractPaths: string[],
  dependencies: Dependency[] = [],
  projectType: 'contract' | 'cairo_program' = 'contract'
) => {
  try {
    // Ensure database structure exists
    await initializeDatabase(agent);
    
    // Create project
    const projectId = await createProject(agent, projectName, projectType);

    // Add all programs
    for (const contractPath of contractPaths) {
      const fileName = path.basename(contractPath);
      await addProgram(agent, projectId, fileName, contractPath);
    }

    // Add all dependencies
    for (const dependency of dependencies) {
      await addDependency(agent, projectId, dependency);
    }
  } catch (error) {
    console.error("Error initializing project data:", error);
    throw error;
  }
};

/**
 * Retrieves project data from the database
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

    // Get project info using select method
    const projectResult = await database.select({
      SELECT: ['id', 'name', 'type'],
      FROM: ['project'],
      WHERE: [`name = '${projectName}'`]
    });

    if (!projectResult.query?.rows.length) {
      throw new Error(`Project "${projectName}" not found in database`);
    }

    const projectId = projectResult.query.rows[0].id;
    const projectType = projectResult.query.rows[0].type;

    // Get programs using select method
    const programsResult = await database.select({
      SELECT: ['name', 'source_code'],
      FROM: ['program'],
      WHERE: [`project_id = ${projectId}`]
    });


    // Get dependencies using select method
    const dependenciesResult = await database.select({
      SELECT: ['name', 'version'],
      FROM: ['dependency'],
      WHERE: [`project_id = ${projectId}`]
    });

    // Parse programs
    const programs: CairoProgram[] = (programsResult.query?.rows || []).map(row => ({
      name: row.name,
      source_code: decodeSourceCode(row.source_code)
    }));

    return {
      id: projectId,
      name: projectName,
      type: projectType, 
      programs: programs,
      dependencies: dependenciesResult.query?.rows || []
    };
  } catch (error) {
    throw error;
  }
};

export const projectAlreadyExists = async (
  agent: StarknetAgentInterface,
  projectName: string
): Promise<boolean> => {
    try {
      await retrieveProjectData(agent, projectName);
      return true;
    } catch (error) {
      return false;
    }
}