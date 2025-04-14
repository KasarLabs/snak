import { logger, StarknetAgentInterface } from '@kasarlabs/core';
('@kasarlabs/core');
import * as path from 'path';
import { CairoProgram, ProjectData } from '../types/index.js';
import { addProgram } from './db_add.js';
import { addDependency } from './db_add.js';
import { extractFile } from './utils.js';

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
    logger.error('Error initializing database:', error);
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
    throw new Error(`Error creating project: ${error.message}`);
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
  dependencies: string[] = [],
  projectType: 'contract' | 'cairo_program'
) => {
  try {
    const projectId = await createProject(agent, projectName, projectType);

    for (const contractPath of contractPaths) {
      const fileName = path.basename(contractPath);
      const sourceCode = await extractFile(fileName);
      await addProgram(agent, projectId, fileName, sourceCode);
    }

    for (const dependency of dependencies) {
      await addDependency(agent, projectId, dependency);
    }
  } catch (error) {
    throw new Error(`Error initializing project data: ${error.message}`);
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
    const project = await getProjectByName(agent, projectName);
    const database = agent.getDatabaseByName('scarb_db');
    if (!database) {
      throw new Error('Database not found');
    }

    const projectId = project.id;
    const projectType = project.type;

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
      (row: any) => ({
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
    throw new Error(`Error retrieving project data: ${error.message}`);
  }
};

/**
 * Checks if a project already exists in the database
 * @param agent The StarkNet agent
 * @param projectName The name of the project
 * @returns The project data if it exists, otherwise undefined
 */
export const getProjectByName = async (
  agent: StarknetAgentInterface,
  projectName: string
): Promise<{
  id: number;
  name: string;
  type: 'contract' | 'cairo_program';
}> => {
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

    return projectResult.query?.rows[0];
  } catch (error) {
    throw new Error(`Error getting project by name: ${error.message}`);
  }
};

export const doesProjectExist = async (
  agent: StarknetAgentInterface,
  projectName: string
): Promise<
  { id: number; name: string; type: 'contract' | 'cairo_program' } | undefined
> => {
  try {
    const project = await getProjectByName(agent, projectName);
    return project;
  } catch (error) {
    return undefined;
  }
};
