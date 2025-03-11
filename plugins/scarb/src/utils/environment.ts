import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function checkScarbInstalled(): Promise<boolean> {
  try {
    await execAsync('scarb --version');
    return true;
  } catch (error) {
    return false;
  }
}

export async function getScarbVersion(): Promise<string> {
  try {
    const { stdout } = await execAsync('scarb --version');
    return stdout.trim();
  } catch (error) {
    return 'unknown';
  }
}

export async function getScarbInstallInstructions(): Promise<string> {
  return `Scarb is not installed. Please install it with the following command:
curl --proto '=https' --tlsv1.2 -sSf https://sh.starkup.dev | sh`;
}