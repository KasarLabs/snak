import * as fs from 'fs';
import * as path from 'path';
import fsPromises from 'fs/promises';
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

/**
 * Resolves the full path of a contract file based on its name
 * @param fileName The name of the contract file
 * @returns The full path of the contract file
 */
export async function resolveContractPath(fileName: string): Promise<string> {
  const uploadDir = process.env.CAIRO_UPLOAD_DIR;
  if (!uploadDir) {
    throw new Error('CAIRO_UPLOAD_DIR is not defined');
  }

  const repoRoot = getRepoRoot();

  const filePath = path.join(repoRoot, uploadDir, fileName);

  try {
    await fsPromises.access(filePath);
  } catch (error) {
    throw new Error(
      `File not found: ${filePath}. Make sure the file exists in the ${uploadDir} directory.`
    );
  }

  return filePath;
}
