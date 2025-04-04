import { logger, StarknetAgentInterface } from '@starknet-agent-kit/agents';

/**
 * Initialize the contract database
 * @param agent The Starknet agent
 * @returns The database instance
 */
export const initializeContractDatabase = async (
  agent: StarknetAgentInterface
): Promise<any | undefined> => {
  try {
    let database = await agent.createDatabase('contract_db');

    if (!database) {
      database = agent.getDatabaseByName('contract_db');
      if (!database) {
        throw new Error('Database not found');
      }
    }

    const tables = [
      {
        table_name: 'contract',
        fields: new Map<string, string>([
          ['id', 'SERIAL PRIMARY KEY'],
          ['class_hash', 'VARCHAR(100) UNIQUE NOT NULL'],
          ['declare_tx_hash', 'VARCHAR(100)'],
        ]),
      },
      {
        table_name: 'deployment',
        fields: new Map<string, string>([
          ['id', 'SERIAL PRIMARY KEY'],
          ['contract_id', 'INTEGER REFERENCES contract(id) ON DELETE CASCADE'],
          ['contract_address', 'VARCHAR(100) UNIQUE NOT NULL'],
          ['deploy_tx_hash', 'VARCHAR(100)'],
        ]),
      },
    ];

      for (const table of tables) {
      const result = await database.createTable({
        table_name: table.table_name,
        if_not_exist: true,
        fields: table.fields,
      });

      if (result.status === 'error' && result.code !== '42P07') {
        throw new Error(`Error ${result.code} : ${result.error_message}`);
      }
    }

    return database;
  } catch (error) {
    throw new Error(`Error initializing contract database: ${error.message}`);
  }
};

/**
 * Save the contract declaration
 * @param agent The Starknet agent
 * @param classHash The class hash
 * @param transactionHash The transaction hash
 * @returns The contract id
 */
export const saveContractDeclaration = async (
  agent: StarknetAgentInterface,
  classHash: string,
  transactionHash: string
): Promise<number> => {
  try {
    const database = agent.getDatabaseByName('contract_db');
    if (!database) {
      throw new Error('Contract database not found');
    }

    const existingContract = await database.select({
      SELECT: ['id'],
      FROM: ['contract'],
      WHERE: [`class_hash = '${classHash}'`],
    });

    if (existingContract.query && existingContract.query.rows.length > 0) {
      return existingContract.query.rows[0].id;
    }

    const res = await database.insert({
      table_name: 'contract',
      fields: new Map<string, string>([
        ['class_hash', classHash],
        ['declare_tx_hash', transactionHash],
      ]),
    });

    const newContract = await database.select({
      SELECT: ['id'],
      FROM: ['contract'],
      WHERE: [`class_hash = '${classHash}'`],
    });

    if (!newContract.query?.rows.length) {
      throw new Error('Failed to insert contract declaration');
    }

    return newContract.query.rows[0].id;
  } catch (error) {
    throw new Error(`Error saving contract declaration: ${error.message}`);
  }
};

/**
 * Save the contract deployment
 * @param agent The Starknet agent
 * @param classHash The class hash
 * @param contractAddress The contract address
 * @param transactionHash The transaction hash
 */
export const saveContractDeployment = async (
  agent: StarknetAgentInterface,
  classHash: string,
  contractAddress: string,
  transactionHash: string
): Promise<number> => {
  try {
    const database = agent.getDatabaseByName('contract_db');
    if (!database) {
      throw new Error('Contract database not found');
    }

    const contract = await database.select({
      SELECT: ['id'],
      FROM: ['contract'],
      WHERE: [`class_hash = '${classHash}'`],
    });

    if (!contract.query?.rows.length) {
      throw new Error(`Contract with class hash ${classHash} not found`);
    }

    const contractId = contract.query.rows[0].id;

    const existingDeployment = await database.select({
      SELECT: ['id'],
      FROM: ['deployment'],
      WHERE: [`contract_address = '${contractAddress}'`],
    });

    if (existingDeployment.query && existingDeployment.query.rows.length > 0) {
      return existingDeployment.query.rows[0].id;
    }

    await database.insert({
      table_name: 'deployment',
      fields: new Map<string, any>([
        ['contract_id', contractId],
        ['contract_address', contractAddress],
        ['deploy_tx_hash', transactionHash],
      ]),
    });

    const newDeployment = await database.select({
      SELECT: ['id'],
      FROM: ['deployment'],
      WHERE: [`contract_address = '${contractAddress}'`],
    });

    if (!newDeployment.query?.rows.length) {
      throw new Error('Failed to insert contract deployment');
    }

    return newDeployment.query.rows[0].id;
  } catch (error) {
    throw new Error(`Error saving contract deployment: ${error.message}`);
  }
};

/**
 * Delete a contract by its class hash
 * @param agent The Starknet agent
 * @param classHash The class hash
 * @returns The result of the operation
 */
export const deleteContractByClassHash = async (
  agent: StarknetAgentInterface,
  classHash: string
): Promise<void> => {
  try {
    const database = agent.getDatabaseByName('contract_db');
    if (!database) {
      throw new Error('Contract database not found');
    }

    await database.delete({
      table_name: 'contract',
      ONLY: false,
      WHERE: [`class_hash = '${classHash}'`],
    });

  } catch (error) {
    throw new Error(`Error deleting contract: ${error.message}`);
  }
};