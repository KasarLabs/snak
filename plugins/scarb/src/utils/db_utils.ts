import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import * as fs from 'fs/promises';

/**
 * Stocke un fichier JSON dans la base de données
 * @param agent L'agent Starknet pour accéder à la base de données
 * @param tableName Nom de la table où stocker le JSON
 * @param recordId ID de l'enregistrement à mettre à jour
 * @param columnName Nom de la colonne où stocker le JSON
 * @param jsonFilePath Chemin vers le fichier JSON à stocker
 */
export async function storeJsonFromFile(
    agent: StarknetAgentInterface,
    tableName: string,
    recordId: number,
    columnName: string,
    jsonFilePath: string
  ): Promise<boolean> {
    try {
      // Obtenir la connexion à la base de données
      const database = agent.getDatabaseByName('scarb_db');
      if (!database) {
        throw new Error('Database not found');
      }
  
      // Lire le fichier JSON
      const jsonContent = await fs.readFile(jsonFilePath, 'utf-8');
  
      // Mettre à jour l'enregistrement dans la base de données
      const updateResult = await database.update({
        table_name: tableName,
        ONLY: false,
        SET: [`${columnName} = '${JSON.stringify(jsonContent)}'`],
        WHERE: [`id = ${recordId}`]
      });
  
      return updateResult.status === 'success';
    } catch (error) {
      console.error(`Error storing JSON file: ${error.message}`);
      throw new Error('Error storing JSON file');
    }
  }