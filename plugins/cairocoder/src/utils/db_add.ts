import { StarknetAgentInterface } from '@kasarlabs/core';
import { getAllPackagesList } from './dependencies.js';
import { encodeSourceCode } from './utils.js';

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
      await database.query(
        `UPDATE program SET source_code = $1 WHERE id = $2`,
        [encodedCode, existingProgram.query.rows[0].id]
      );
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
    throw new Error(`Error adding program: ${error.message}`);
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
    const dependency = allDependencies.find(
      (dep) => dep.name === dependencyName
    );
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
    throw new Error(`Error adding dependency: ${error.message}`);
  }
};
