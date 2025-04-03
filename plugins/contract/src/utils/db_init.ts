import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

/**
 * Initialise la base de données du plugin contract
 * @param agent L'agent Starknet
 * @returns L'instance de la base de données
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

    // Définition des tables
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

    // Création des tables
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
    console.error('Error initializing contract database:', error);
    return undefined;
  }
};

/**
 * Sauvegarde les informations de déclaration d'un contrat
 * @param agent L'agent Starknet
 * @param projectName Nom du projet
 * @param contractName Nom du contrat
 * @param classHash Hash de classe du contrat
 * @param transactionHash Hash de la transaction de déclaration
 * @returns L'ID du contrat dans la base de données
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

    // Vérifier si le contrat existe déjà avec ce class_hash
    const existingContract = await database.select({
      SELECT: ['id'],
      FROM: ['contract'],
      WHERE: [`class_hash = '${classHash}'`],
    });

    if (existingContract.query && existingContract.query.rows.length > 0) {
      // Le contrat existe déjà, pas besoin de le réinsérer
      return existingContract.query.rows[0].id;
    }

    // Insérer le nouveau contrat
    const res = await database.insert({
      table_name: 'contract',
      fields: new Map<string, string>([
        ['class_hash', classHash],
        ['declare_tx_hash', transactionHash],
      ]),
    });

    console.log(res);

    // Récupérer l'ID du contrat nouvellement inséré
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
    console.error('Error saving contract declaration:', error);
    throw error;
  }
};

/**
 * Sauvegarde les informations de déploiement d'un contrat
 * @param agent L'agent Starknet
 * @param classHash Hash de classe du contrat
 * @param contractAddress Adresse du contrat déployé
 * @param constructorArgs Arguments du constructeur (au format JSON)
 * @param transactionHash Hash de la transaction de déploiement
 * @returns L'ID du déploiement dans la base de données
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

    // Récupérer l'ID du contrat
    const contract = await database.select({
      SELECT: ['id'],
      FROM: ['contract'],
      WHERE: [`class_hash = '${classHash}'`],
    });

    if (!contract.query?.rows.length) {
      throw new Error(`Contract with class hash ${classHash} not found`);
    }

    const contractId = contract.query.rows[0].id;

    // Vérifier si le déploiement existe déjà
    const existingDeployment = await database.select({
      SELECT: ['id'],
      FROM: ['deployment'],
      WHERE: [`contract_address = '${contractAddress}'`],
    });

    if (existingDeployment.query && existingDeployment.query.rows.length > 0) {
      // Le déploiement existe déjà
      return existingDeployment.query.rows[0].id;
    }

    // Insérer le nouveau déploiement
    await database.insert({
      table_name: 'deployment',
      fields: new Map<string, any>([
        ['contract_id', contractId],
        ['contract_address', contractAddress],
        ['deploy_tx_hash', transactionHash],
      ]),
    });

    // Récupérer l'ID du déploiement nouvellement inséré
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
    console.error('Error saving contract deployment:', error);
    throw error;
  }
};

/**
 * Supprime un contrat et tous ses déploiements associés par son classHash
 * @param agent L'agent Starknet
 * @param classHash Hash de classe du contrat à supprimer
 * @returns Un objet indiquant le succès ou l'échec de l'opération
 */
export const deleteContractByClassHash = async (
  agent: StarknetAgentInterface,
  classHash: string
): Promise<{ success: boolean; message: string }> => {
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

    return {
      success: true,
      message: `Contract with class hash ${classHash} successfully deleted`,
    };
  } catch (error) {
    console.error('Error deleting contract:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};