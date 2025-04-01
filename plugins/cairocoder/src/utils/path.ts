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
  export function getRepoRoot() {
    const rootPackageJsonPath = findUp('lerna.json');
    if (!rootPackageJsonPath) {
      throw new Error('File lerna.json not found');
    }
    return path.dirname(rootPackageJsonPath);
  }
  
