import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

/**
 * Custom database error class for better error handling
 */
export class DatabaseError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Initializes the database with a rawProgram table to store generated Cairo code
 * @param agent The StarkNet agent
 * @returns The database instance
 */
export const initializeDatabase = async (
  agent: StarknetAgentInterface
): Promise<any | undefined> => {
  try {
    console.log('Initializing CairoCoder database...');
    let database = await agent.createDatabase('cairocoder_db');

    if (!database) {
      database = agent.getDatabaseByName('cairocoder_db');
      if (!database) {
        throw new Error('Failed to create or get cairocoder_db database');
      }
    }

    // Create rawProgram table
    const table = {
      table_name: 'rawProgram',
      fields: new Map<string, string>([
        ['id', 'SERIAL PRIMARY KEY'],
        ['name', 'VARCHAR(255) NOT NULL'],
        ['source_code', 'TEXT NOT NULL'],
        ['created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP']
      ]),
    };

    // Create the table if it doesn't exist
    const result = await database.createTable({
      table_name: table.table_name,
      if_not_exist: true,
      fields: table.fields,
    });

    if (result.status === 'error') {
      if (result.code === '42P07') {
        console.warn(`Table ${table.table_name} already exists. Adding it.`);
        database.addExistingTable({
          table_name: table.table_name,
          if_not_exist: true,
          fields: table.fields,
        });
      } else {
        throw new Error(`Error ${result.code} : ${result.error_message}`);
      }
    }

    console.log('CairoCoder table initialized successfully');
    return database;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

/**
 * Get the database connection
 * @param agent The StarkNet agent
 * @returns The database instance
 * @throws DatabaseError if the database is not found
 */
export const getDatabase = (agent: StarknetAgentInterface): any => {
  const database = agent.getDatabaseByName('cairocoder_db');
  if (!database) {
    throw new DatabaseError('Database not found: cairocoder_db');
  }
  return database;
};

/**
 * Check if a program exists in the database
 * @param agent The StarkNet agent
 * @param programName The name of the program to check
 * @returns Object containing existence info and program ID if found
 */
export const checkProgramExists = async (
  agent: StarknetAgentInterface,
  programName: string
): Promise<{ exists: boolean; programId?: number }> => {
  try {
    const database = getDatabase(agent);
    
    // Check if the program already exists
    const programResult = await database.select({
      SELECT: ['id'],
      FROM: ['rawProgram'],
      WHERE: [`name = '${programName}'`],
    });

    if (programResult.status === 'error') {
      throw new DatabaseError(
        `Error checking if program exists: ${programResult.error_message}`,
        programResult.code
      );
    }

    if (programResult.query && programResult.query.rows.length > 0) {
      return { exists: true, programId: programResult.query.rows[0].id };
    }
    
    return { exists: false };
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Error checking if program exists: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};


/**
 * Encodes Cairo source code for database storage
 * @param code The source code to encode
 * @returns The encoded source code
 */
export function encodeCode(code: string): string {
  return code.replace(/\0/g, '');
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
    programName: string,
    sourceCode: string
) => {
  try {
    const database = agent.getDatabaseByName('cairocoder_db');
    if (!database) {
      throw new Error('Database not found');
    }
      
    const encodedCode = encodeCode(sourceCode);

    const existingProgram = await database.select({
      SELECT: ['id'],
      FROM: ['rawProgram'],
      WHERE: [`name = '${programName}'`],
    });

    if (existingProgram.query && existingProgram.query.rows.length > 0) {
      console.log(`Updating existing program ${programName}`);
      const res = await database.query(
        `UPDATE rawProgram SET source_code = $1 WHERE name = $2`,
        [encodeCode(sourceCode), programName]
      );
      console.log(res);
    } else {
      console.log(`Adding new program ${programName}`);
      const res = await database.insert({
        table_name: 'rawProgram',
        fields: new Map<string, string | number>([
          ['id', 'DEFAULT'],
          ['name', programName],
          ['source_code', encodedCode],
        ]),
      });
      console.log(res);
    }
    console.log(`Program ${programName} added to database`);
  } catch (error) {
    console.error(`Error adding program ${programName}:`, error);
    throw error;
  }
};


/**
 * Gets all raw programs from the database
 * @param agent The StarkNet agent
 * @returns Array of raw programs
 */
export const getAllRawPrograms = async (
  agent: StarknetAgentInterface
): Promise<any[]> => {
  try {
    const database = getDatabase(agent);
    
    const result = await database.select({
      SELECT: ['id', 'name', 'source_code', 'created_at'],
      FROM: ['rawProgram'],
    });

    if (result.status === 'error') {
      throw new DatabaseError(
        `Error retrieving programs: ${result.error_message}`,
        result.code
      );
    }

    if (result.query && result.query.rows) {
      return result.query.rows;
    }
    
    return [];
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Error getting programs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}; 