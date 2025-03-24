import * as fs from 'fs';
import * as path from 'path';

/**
 * Search for a file in the parent directories
 * @param filename The name of the file to search for
 * @param startDir The directory to start the search from
 * @returns The absolute path to the file
 */
function findUp(
  filename: string,
  startDir: string = process.cwd()
): string | null {
  let currentDir = path.resolve(startDir);
  const { root } = path.parse(currentDir);

  while (true) {
    const filePath = path.join(currentDir, filename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }

    if (currentDir === root) {
      return null;
    }

    currentDir = path.dirname(currentDir);
  }
}

/**
 * Get the root path of the repository
 * @returns The absolute path to the repository root
 */
function getRepoRoot() {
  const rootPackageJsonPath = findUp('lerna.json');
  if (!rootPackageJsonPath) {
    throw new Error('File lerna.json not found');
  }
  return path.dirname(rootPackageJsonPath);
}

/**
 * Get the path to the Scarb plugin directory
 * @returns The absolute path to the plugin directory
 */
export function getPluginRoot() {
  const repoRoot = getRepoRoot();
  const pluginPath = path.join(repoRoot, 'plugins', 'scarb');

  if (!fs.existsSync(pluginPath)) {
    throw new Error(`Plugin Scarb not found: ${pluginPath}`);
  }

  return pluginPath;
}

/**
 * Get the path to the workspace directory
 * @returns The absolute path to the workspace directory
 */
export function getWorkspacePath() {
  const workspacePath = path.join(getPluginRoot(), 'src', 'workspace');

  if (!fs.existsSync(workspacePath)) {
    try {
      fs.mkdirSync(workspacePath, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create workspace directory: ${workspacePath}`);
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
    contractPath,
    path.resolve(process.cwd(), contractPath),
    resolvePluginPath('src', 'contract', path.basename(contractPath)),
    path.join(getWorkspacePath(), path.basename(contractPath)),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  throw new Error(`Contract file not found: ${contractPath}`);
}
