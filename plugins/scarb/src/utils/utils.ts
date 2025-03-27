import * as fsp from 'fs/promises';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Get the trace path from the stdout of the bootloader command
 * @param stdout The stdout from the bootloader command
 * @returns The path to the trace file or undefined if not found
 */
export function getBootloaderTracePath(stdout: string): string | undefined {
  const match = stdout.match(/Saving output to: (.+\.zip)/);
  return match ? match[1] : undefined;
}

/**
 * Extracts execution number from the "Saving output to:" line in Scarb output
 * @param {string} output - The stdout from scarb execute command
 * @returns {string|null} Just the execution number or null if not found
 */
export function getExecutionNumber(output: string) {
  const match = output.match(/Saving output to:.*\/execution(\d+)/);
  return match ? match[1] : null;
}

/**
 * Extracts the path to the proof.json file from scarb prove command output
 * @param {string} output - The stdout from scarb prove command
 * @returns {string|null} - The full path to the proof.json file or null if not found
 */
export function extractProofJsonPath(output: string) {
  const match = output.match(/Saving proof to:\s*(.*proof\.json)/);
  return match ? match[1].trim() : null;
}

/**
 * Extracts the module name from a module path
 * @param modulePath The module path
 * @returns The module name
 */
export function extractModuleName(modulePath: string): string {
  if (!modulePath) return '';
  const parts = modulePath.split('::');
  return parts[parts.length - 2];
}

/**
 * Extracts the module name from a StarkNet artifact file
 * @param artifactFile The path to the artifact file
 * @param contract_index The index of the contract in the artifact file
 * @returns The module name
 */
export async function extractModuleFromArtifact(
  artifactFile: string | any,
  contract_index: number = 0
): Promise<string> {
  try {
    const content = await fsp.readFile(artifactFile, 'utf-8');
    const artifact = JSON.parse(content);

    if (artifact.contracts && artifact.contracts.length > 0) {
      const modulePath = artifact.contracts[contract_index].module_path;
      return extractModuleName(modulePath);
    }

    return '';
  } catch (error) {
    throw new Error(
      `Failed to extract module from artifact: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Write JSON data to a file
 * @param data The JSON data
 * @param outputDir The output directory
 * @param fileName The file name
 * @returns The path to the file
 */
export const writeJsonToFile = (
  data: any,
  outputDir: string,
  fileName: string = 'data'
): string => {
  try {
    const filePath = path.join(outputDir, fileName);
    const proofContent =
      typeof data === 'string' ? data : JSON.stringify(data, null, 2);

    fs.writeFileSync(filePath, proofContent);

    return filePath;
  } catch (error) {
    throw new Error(
      `Failed to write JSON to file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};
