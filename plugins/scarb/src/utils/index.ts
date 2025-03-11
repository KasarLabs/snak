import { exec } from 'child_process';
import fs from 'fs-extra';
import { promisify } from 'util';
import path from 'path';
import { Dependency } from '../actions/compileContract.js';
import { addDependency } from './project.js';

/**
 * Prépare le contrat dans le projet Scarb
 * - Copie le fichier de contrat source dans le répertoire src du projet
 * - Met à jour le fichier lib.cairo pour exposer le module du contrat
 * 
 * @param contractPath Chemin vers le fichier de contrat source
 * @param projectDir Répertoire du projet Scarb
 * @returns Un objet avec le statut de l'opération
 */
export async function importContract(contractPath : string, projectDir : string) {
  const contractFileName = path.basename(contractPath);
  const srcDir = path.join(projectDir, 'src');
  const destContractPath = path.join(srcDir, contractFileName);
  
  try {

    const contractContent = await fs.readFile(contractPath, 'utf-8');
    await fs.writeFile(destContractPath, contractContent);
    console.log(`Contract copied to ${destContractPath}`);
    
    const libFilePath = path.join(srcDir, 'lib.cairo');
    let libContent = await fs.readFile(libFilePath, 'utf-8');

    const moduleName = path.basename(contractFileName, '.cairo');
    if (!libContent.includes(`mod ${moduleName};`)) {
      libContent += `\nmod ${moduleName};\n`;
    }
    
    await fs.writeFile(libFilePath, libContent);
    console.log(`Updated lib.cairo to include the contract module`);
    
    return {
      success: true
    };
  } catch (error) {
    throw new Error(`Failed to prepare contract: ${error.message}`);
  }
}

export async function addSeveralDependancies(dependencies: Dependency[], projectDir: string) {
      try {
        if (dependencies && dependencies.length > 0) {
          for (const dependency of dependencies) {
            const addDepResult = await addDependency({
                package: dependency.name,
                version: dependency.version,
                git: dependency.git,
                path: projectDir
            });
    
            console.log(`Dependency added: ${JSON.parse(addDepResult).message}`);
          }
        }
        console.log("addSeveralDependancies");
      } catch (error) {
        console.log("eror : ", error);
        throw new Error(`Failed to add several dependencie: ${error.message}`);
      }
}

/**
 * Nettoie le fichier lib.cairo en le réinitialisant à un état vierge
 * @param projectDir Répertoire du projet Scarb
 * @returns Un objet avec le statut de l'opération
 */
export async function cleanLibCairo(projectDir: string) {
  try {
    const srcDir = path.join(projectDir, 'src');
    const libFilePath = path.join(srcDir, 'lib.cairo');
    
    // Contenu minimal pour un fichier lib.cairo vierge
    const defaultLibContent = `// lib.cairo - Module exports for the project
`;
    
    // Réinitialiser le fichier lib.cairo
    await fs.writeFile(libFilePath, defaultLibContent, 'utf-8');
    console.log(`Cleaned lib.cairo file at ${libFilePath}`);
    
    return {
      success: true,
      message: 'lib.cairo file cleaned successfully'
    };
  } catch (error) {
    throw new Error(`Failed to clean lib.cairo: ${error.message}`);
  }
}

/**
 * Resolves file paths to locate contract files
 * @param {string} filePath - Original file path provided
 * @returns {string} Resolved file path
 */
export function resolveContractFilePath(filePath: string): string {
  console.log("pwd : ", process.cwd());
  const possiblePaths = [
    filePath,
    path.resolve(process.cwd(), filePath),
    path.resolve(process.cwd(), '..', filePath),
    path.resolve(
      process.cwd(),
      '..',
      'plugins',
      'scarb',
      'src',
      'contract',
      path.basename(filePath)
    ),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`Resolved path for ${filePath}: ${p}`);
      return p;
    }
  }
  throw new Error(`Could not resolve path for: ${filePath}`);
}