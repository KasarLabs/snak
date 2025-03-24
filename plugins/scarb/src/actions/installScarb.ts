import { exec } from 'child_process';
import { promisify } from 'util';
import { checkScarbInstalled, getScarbVersion } from '../utils/install.js';

const execAsync = promisify(exec);

/**
 * Install Scarb
 * @returns The installation results
 */
export const installScarb = async (): Promise<string> => {
  try {
    let version = await getScarbVersion();
    if (version !== 'unknown') {
      return JSON.stringify({
        status: 'success',
        message: `Scarb is already installed (version: ${version})`,
      });
    }

    const { stdout, stderr } = await execAsync(
      "curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh -s -- -v 2.10.0"
    );

    await checkScarbInstalled();

    return JSON.stringify({
      status: 'success',
      message: `Scarb installed successfully (version: '2.10.0')`,
      output: stdout,
      errors: stderr || undefined,
    });
  } catch (error) {
    console.error('Error installing Scarb:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
