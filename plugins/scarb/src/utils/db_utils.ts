import * as fs from 'fs';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import * as fspromises from 'fs/promises';

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
      const jsonContent = await fspromises.readFile(jsonFilePath, 'utf-8');
  
      // Mettre à jour l'enregistrement dans la base de données
      const query = `UPDATE ${tableName} SET ${columnName} = $1 WHERE id = $2`;
      const params = [jsonContent, recordId];
      
      const updateResult = await database.query(query, [JSON.stringify(jsonContent), recordId]);
  
      return updateResult.status === 'success';
    } catch (error) {
      console.error(`Error storing JSON file: ${error.message}`);
      throw new Error('Error storing JSON file');
    }
  }



/**
 * Compare deux fichiers pour vérifier s'ils sont identiques
 * @param file1 Chemin du premier fichier
 * @param file2 Chemin du second fichier
 * @returns true si les fichiers sont identiques, false sinon
 */
export function compareFiles(file1: string, file2: string): boolean {
  const content1 = JSON.parse(fs.readFileSync(file1, 'utf-8'));
  const content2 = JSON.parse(fs.readFileSync(file2, 'utf-8'));
  
  // Comparer les objets JSON structurellement
  return JSON.stringify(content1) === JSON.stringify(content2);
}