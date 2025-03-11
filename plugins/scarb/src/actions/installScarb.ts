// plugins/scarb/src/actions/installActions.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { checkScarbInstalled, getScarbVersion } from '../utils/environment.js';

const execAsync = promisify(exec);

export const installScarb = async (
  agent: StarknetAgentInterface,
  params: { path?: string }
) => {
  try {
    // Check if Scarb is already installed
    const isScarbInstalled = await checkScarbInstalled();
    if (isScarbInstalled) {
      const version = await getScarbVersion();
      return JSON.stringify({
        status: 'success',
        message: `Scarb is already installed (version: ${version})`,
      });
    }

    // Install Scarb
    const { stdout, stderr } = await execAsync('curl --proto \'=https\' --tlsv1.2 -sSf https://sh.starkup.dev | sh');
    
    // Verify installation was successful
    const installSuccess = await checkScarbInstalled();
    if (!installSuccess) {
      return JSON.stringify({
        status: 'failure',
        error: 'Failed to install Scarb',
        output: stdout,
        errors: stderr || undefined,
      });
    }

    // Get installed version
    const version = await getScarbVersion();
    
    return JSON.stringify({
      status: 'success',
      message: `Scarb installed successfully (version: ${version})`,
      output: stdout,
      errors: stderr || undefined,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};