import { exec } from 'child_process';
import { promisify } from 'util';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { checkScarbInstalled, getScarbVersion } from '../utils/install.js';

const execAsync = promisify(exec);

export const installScarb = async (
  agent: StarknetAgentInterface,
  params: { path?: string }
) => {
  try {
    let version =  await getScarbVersion();
    if (version !== 'unknown') {
      return JSON.stringify({
        status: 'success',
        message: `Scarb is already installed (version: ${version})`,
      });
    }

    const { stdout, stderr } = await execAsync("curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh -s -- -v 2.10.0");

    await checkScarbInstalled();
    
    return JSON.stringify({
      status: 'success',
      message: `Scarb installed successfully (version: '2.10.0')`,
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