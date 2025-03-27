import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import * as fs from 'fs/promises';
import * as path from 'path';
import { resolveContractPath } from './path.js';
import { ProjectData, Dependency, CairoProgram } from '../types/index.js';

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
 * Initializes the database
 * @param agent The StarkNet agent
 * @returns The database instance
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
          ['execution_trace', 'BYTEA'],
          ['proof', 'JSONB'],
          ['verified', 'BOOLEAN DEFAULT FALSE'],
        ]),
      },
      {
        table_name: 'program',
        fields: new Map<string, string>([
          ['id', 'SERIAL PRIMARY KEY'],
          ['project_id', 'INTEGER REFERENCES project(id) ON DELETE CASCADE'],
          ['name', 'VARCHAR(255) NOT NULL'],
          ['source_code', 'TEXT'],
          ['sierra', 'JSONB'],
          ['casm', 'JSONB'],
        ]),
      },
      {
        table_name: 'dependency',
        fields: new Map<string, string>([
          ['id', 'SERIAL PRIMARY KEY'],
          ['project_id', 'INTEGER REFERENCES project(id) ON DELETE CASCADE'],
          ['name', 'VARCHAR(255) NOT NULL'],
          ['version', 'VARCHAR(50)'],
        ]),
      },
    ];

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
 * @param agent The StarkNet agent
 * @param projectName The name of the project
 * @param projectType The type of the project
 * @returns The project ID
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

    const existingProject = await database.select({
      SELECT: ['id'],
      FROM: ['project'],
      WHERE: [`name = '${projectName}'`],
    });

    if (existingProject.query && existingProject.query.rows.length > 0) {
      return existingProject.query.rows[0].id;
    }

    await database.insert({
      table_name: 'project',
      fields: new Map<string, string>([
        ['id', 'DEFAULT'],
        ['name', projectName],
        ['type', projectType],
      ]),
    });

    const newProject = await database.select({
      SELECT: ['id'],
      FROM: ['project'],
      WHERE: [`name = '${projectName}'`],
    });

    if (!newProject.query?.rows.length) {
      throw new Error('Failed to create project');
    }

    return newProject.query.rows[0].id;
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
};

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
  sourcePath: string
) => {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    const resolvedPath = resolveContractPath(sourcePath);
    const sourceCode = await fs.readFile(resolvedPath, 'utf-8');
    const encodedCode = encodeSourceCode(sourceCode);

    const existingProgram = await database.select({
      SELECT: ['id'],
      FROM: ['program'],
      WHERE: [`project_id = ${projectId}`, `name = '${name}'`],
    });

    if (existingProgram.query && existingProgram.query.rows.length > 0) {
      await database.update({
        table_name: 'program',
        ONLY: false,
        SET: [`source_code = ${encodedCode}`],
        WHERE: [`id = ${existingProgram.query.rows[0].id}`],
      });
    } else {
      await database.insert({
        table_name: 'program',
        fields: new Map<string, string | number>([
          ['id', 'DEFAULT'],
          ['project_id', projectId],
          ['name', name],
          ['source_code', encodedCode],
        ]),
      });
    }
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
  dependency: Dependency
) => {
  try {
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    const existingDep = await database.select({
      SELECT: ['id'],
      FROM: ['dependency'],
      WHERE: [`project_id = ${projectId}`, `name = '${dependency.name}'`],
    });

    if (existingDep.query && existingDep.query.rows.length > 0) {
      const correctVersion = dependency.version || '';
      await database.update({
        table_name: 'dependency',
        ONLY: false,
        SET: [`version = '${correctVersion}'`],
        WHERE: [`id = ${existingDep.query.rows[0].id}`],
      });
    } else {
      await database.insert({
        table_name: 'dependency',
        fields: new Map<string, string | number>([
          ['id', 'DEFAULT'],
          ['project_id', projectId],
          ['name', dependency.name],
          ['version', dependency.version || ''],
        ]),
      });
    }
  } catch (error) {
    console.error(`Error adding dependency ${dependency.name}:`, error);
    throw error;
  }
};

/**
 * Initializes the project data in the database
 * @param agent The StarkNet agent
 * @param projectName The name of the project
 * @param contractPaths The paths to the contract files
 * @param dependencies The dependencies of the project
 * @param projectType The type of the project
 */
export const initializeProjectData = async (
  agent: StarknetAgentInterface,
  projectName: string,
  contractPaths: string[],
  dependencies: Dependency[] = [],
  projectType: 'contract' | 'cairo_program'
) => {
  try {
    const projectId = await createProject(agent, projectName, projectType);

    for (const contractPath of contractPaths) {
      const fileName = path.basename(contractPath);
      await addProgram(agent, projectId, fileName, contractPath);
    }

    for (const dependency of dependencies) {
      await addDependency(agent, projectId, dependency);
    }
  } catch (error) {
    console.error('Error initializing project data:', error);
    throw error;
  }
};

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
        source_code: decodeSourceCode(row.source_code),
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
    console.error('Error in retrieving data : ', error.message);
    throw error;
  }
};

/**
 * Checks if a project already exists in the database
 * @param agent The StarkNet agent
 * @param projectName The name of the project
 * @returns The project data if it exists, otherwise undefined
 */
export const projectAlreadyExists = async (
  agent: StarknetAgentInterface,
  projectName: string
): Promise<ProjectData | undefined> => {
  try {
    return await retrieveProjectData(agent, projectName);
  } catch (error) {
    return undefined;
  }
};
