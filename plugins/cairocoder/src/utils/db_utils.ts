import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

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

    console.log('CairoCoder database initialized successfully');
    return database;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

/**
 * Adds a Cairo program to the database or updates it if it exists
 * @param agent The StarkNet agent
 * @param programName The name of the Cairo program file (with .cairo extension)
 * @param sourceCode The Cairo source code
 * @param dependencies Optional array of dependencies (empty by default)
 */
export const addOrUpdateRawProgram = async (
  agent: StarknetAgentInterface,
  programName: string,
  sourceCode: string,
): Promise<void> => {
  try {
    const database = agent.getDatabaseByName('cairocoder_db');
    if (!database) {
      throw new Error('Database not found: cairocoder_db');
    }
    
    // Check if the program already exists
    const programResult = await database.select({
      SELECT: ['id'],
      FROM: ['rawProgram'],
      WHERE: [`name = '${programName}'`],
    });


    if (programResult.query && programResult.query.rows.length > 0) {
      console.log('Program already exists in the database');
      const programId = programResult.query.rows[0].id;
      const res = await database.update({
        table_name: 'rawProgram',
        ONLY: false,
        SET: [
          `source_code = '${sourceCode}'`,
          `created_at = CURRENT_TIMESTAMP`
        ],
        WHERE: [`id = ${programId}`],
      });
      if (res.status === 'error') {
        console.error(`Error updating existing Cairo program: ${programName}`);
        throw new Error(`Error ${res.code} : ${res.error_message}`);
      }
      console.log(`Updated existing Cairo program: ${programName}`);
    } else {
      console.log('Program does not exist in the database');
      const res = await database.insert({
        table_name: 'rawProgram',
        fields: new Map<string, string | number>([
          ['id', 'DEFAULT'],
          ['name', programName],
          ['source_code', sourceCode],
        ]),
      });
      if (res.status === 'error') {
        console.error(`Error adding new Cairo program: ${programName}`);
        throw new Error(`Error ${res.code} : ${res.error_message}`);
      }
      console.log(`Added new Cairo program: ${programName}`);
    }
  } catch (error) {
    console.error(`Error adding/updating program ${programName}:`, error);
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
    const database = agent.getDatabaseByName('cairocoder_db');
    if (!database) {
      throw new Error('Database not found: cairocoder_db');
    }
    
    const result = await database.select({
      SELECT: ['id', 'name', 'source_code', 'created_at'],
      FROM: ['rawProgram'],
    });

    if (result.query && result.query.rows) {
      return result.query.rows;
    }
    
    return [];
  } catch (error) {
    console.error('Error getting raw programs:', error);
    throw error;
  }
}; 