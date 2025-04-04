import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
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
