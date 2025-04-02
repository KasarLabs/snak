import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Install Scarb
 * @returns The installation results
 */
export async function checkScarbInstalled(): Promise<boolean> {
  try {
    await execAsync('scarb --version');
    return true;
  } catch (error) {
    throw new Error('Scarb is not installed. Please install it');
  }
}

/**
 * Get the Scarb version
 * @returns The Scarb version
 */
export async function getScarbVersion(): Promise<string> {
  try {
    const { stdout } = await execAsync('scarb --version');
    return stdout.trim();
  } catch (error) {
    return 'unknown';
  }
}
