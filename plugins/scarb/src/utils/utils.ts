export function getBootloaderTracePath(stdout: string): string | undefined {
  const match = stdout.match(/Saving output to: (.+\.zip)/);
  return match ? match[1] : undefined;
}

/**
 * Extracts execution number from the "Saving output to:" line in Scarb output
 * @param {string} output - The stdout from scarb execute command
 * @returns {string|null} Just the execution number or null if not found
 */
export function getExecutionNumber(output : string) {
  const match = output.match(/Saving output to:.*\/execution(\d+)/);
  return match ? match[1] : null;
}

/**
 * Extracts the path to the proof.json file from scarb prove command output
 * @param {string} output - The stdout from scarb prove command
 * @returns {string|null} - The full path to the proof.json file or null if not found
 */
export function extractProofJsonPath(output : string) {
  const match = output.match(/Saving proof to:\s*(.*proof\.json)/);
  return match ? match[1].trim() : null;
}

/**
 * Extrait le nom du module depuis le module_path d'un contrat
 * @param modulePath Format: "relou::test::SimpleStorage"
 * @returns Le nom du module (ex: "test")
 */
export function extractModuleName(modulePath: string): string {
  if (!modulePath) return '';
  console.log('modulePath:', modulePath);
  const parts = modulePath.split('::');
  console.log('parts:', parts);
  // Le module est l'avant-dernier élément du chemin
  return parts[parts.length - 2];
}

import * as fs from 'fs/promises';
/**
 * Extrait le nom du module depuis un objet d'artifact
 * @param artifactContent String JSON ou objet artifact
 * @returns Le nom du module
 */
export async function extractModuleFromArtifact(artifactFile: string | any, contract_index : number = 0): Promise<string> {
  try {
    const content = await fs.readFile(artifactFile, 'utf-8');
    const artifact = JSON.parse(content);
    console.log('artifact:', artifact);

    if (artifact.contracts && artifact.contracts.length > 0) {
      const modulePath = artifact.contracts[contract_index].module_path;
      return extractModuleName(modulePath);
    }
    
    return '';
  } catch (error) {
    console.error('Erreur lors de l\'extraction du module:', error);
    throw new Error('Erreur lors de l\'extraction du module');
  }
}