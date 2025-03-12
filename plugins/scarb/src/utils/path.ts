import * as fs from 'fs';
import * as path from 'path';

/**
 * Recherche un fichier en remontant dans les répertoires parents
 * @param filename Le nom du fichier à rechercher
 * @param startDir Le répertoire de départ (par défaut: répertoire courant)
 * @returns Le chemin complet si trouvé, null sinon
 */
function findUp(filename: string, startDir: string = process.cwd()): string | null {
  let currentDir = path.resolve(startDir);
  const { root } = path.parse(currentDir);
  
  while (true) {
    const filePath = path.join(currentDir, filename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    
    // Stop si nous atteignons la racine du système de fichiers
    if (currentDir === root) {
      return null;
    }
    
    // Remonter d'un niveau
    currentDir = path.dirname(currentDir);
  }
}

/**
 * Détecte la racine du repository en cherchant un package.json parent
 * @returns Chemin absolu vers la racine du repository
 */
function getRepoRoot() {
  const rootPackageJsonPath = findUp('lerna.json');
  if (!rootPackageJsonPath) {
    throw new Error('Impossible de trouver la racine du repository');
  }
  return path.dirname(rootPackageJsonPath);
}

/**
 * Obtient le chemin racine du plugin Scarb
 * @returns Chemin absolu vers le répertoire du plugin Scarb
 */
export function getPluginRoot() {
  const repoRoot = getRepoRoot();
  const pluginPath = path.join(repoRoot, 'plugins', 'scarb');
  
  // Vérification que le chemin existe
  if (!fs.existsSync(pluginPath)) {
    throw new Error(`Chemin du plugin non trouvé: ${pluginPath}`);
  }
  
  return pluginPath;
}

/**
 * Obtient le chemin vers le répertoire workspace du plugin Scarb
 * @returns Chemin absolu vers le répertoire workspace
 */
export function getWorkspacePath() {
  const workspacePath = path.join(getPluginRoot(), 'src', 'workspace');
  
  // Création du répertoire s'il n'existe pas
  if (!fs.existsSync(workspacePath)) {
    try {
      fs.mkdirSync(workspacePath, { recursive: true });
      console.log(`Répertoire workspace créé: ${workspacePath}`);
    } catch (error) {
      console.error(`Erreur lors de la création du répertoire workspace: ${error.message}`);
    }
  }
  
  return workspacePath;
}

/**
 * Résout un chemin relatif par rapport à la racine du plugin
 * @param paths Segments de chemin à joindre au chemin du plugin
 * @returns Chemin absolu
 */
export function resolvePluginPath(...paths: string[]) {
  return path.join(getPluginRoot(), ...paths);
}

/**
 * Résout un chemin de contrat, cherchant d'abord dans les chemins relatifs au répertoire
 * de travail courant, puis dans les chemins relatifs au plugin
 * @param contractPath Chemin relatif ou nom du fichier contrat
 * @returns Chemin absolu vers le fichier contrat
 */
export function resolveContractPath(contractPath: string): string {
  const possiblePaths = [
    contractPath, // Chemin absolu fourni
    path.resolve(process.cwd(), contractPath), // Relatif au CWD
    resolvePluginPath('src', 'contract', path.basename(contractPath)), // Dans le dossier contract du plugin
    path.join(getWorkspacePath(), path.basename(contractPath)) // Dans le workspace
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`Chemin de contrat résolu: ${p}`);
      return p;
    }
  }
  
  throw new Error(`Impossible de résoudre le chemin du contrat: ${contractPath}`);
}