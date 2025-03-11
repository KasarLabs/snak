import { exec } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

/**
 * Prépare le contrat dans le projet Scarb
 * - Copie le fichier de contrat source dans le répertoire src du projet
 * - Met à jour le fichier lib.cairo pour exposer le module du contrat
 * 
 * @param contractPath Chemin vers le fichier de contrat source
 * @param projectDir Répertoire du projet Scarb
 * @returns Un objet avec le statut de l'opération
 */
export async function prepareContract(contractPath : string, projectDir : string) {
  const contractFileName = path.basename(contractPath);
  const srcDir = path.join(projectDir, 'src');
  const destContractPath = path.join(srcDir, contractFileName);
  
  try {
    // 1. Lire le contenu du contrat source
    const contractContent = await fs.readFile(contractPath, 'utf-8');
    
    // 2. Écrire le contenu dans le nouveau fichier
    await fs.writeFile(destContractPath, contractContent);
    console.log(`Contract copied to ${destContractPath}`);
    
    // 3. Mettre à jour le fichier lib.cairo pour exposer le contrat
    const libFilePath = path.join(srcDir, 'lib.cairo');
    
    // Lire le contenu actuel de lib.cairo
    let libContent = await fs.readFile(libFilePath, 'utf-8');
    
    // Extraire le nom du module (sans l'extension .cairo)
    const moduleName = path.basename(contractFileName, '.cairo');
    
    // Ajouter l'export du module s'il n'existe pas déjà
    if (!libContent.includes(`mod ${moduleName};`)) {
      libContent += `\nmod ${moduleName};\n`;
    }
    
    // Écrire le contenu mis à jour
    await fs.writeFile(libFilePath, libContent);
    console.log(`Updated lib.cairo to include the contract module`);
    
    // Succès
    return {
      success: true
    };
  } catch (error) {
    // Échec
    return {
      success: false,
      error: `Failed to prepare contract: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
