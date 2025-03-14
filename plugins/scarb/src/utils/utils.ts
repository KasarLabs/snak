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
