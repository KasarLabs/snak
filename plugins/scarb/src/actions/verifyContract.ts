// import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
// import { exec } from 'child_process';
// import { promisify } from 'util';
// import * as path from 'path';
// import { checkScarbInstalled, getScarbInstallInstructions } from '../utils/environment.js';
// import * as fs from 'fs/promises';

// const execAsync = promisify(exec);

// export interface VerifyContractParams {
//   proofPath: string;
// }

// export const verifyContract = async (
//   agent: StarknetAgentInterface,
//   params: VerifyContractParams
// ) => {
//   try {
//     const isScarbInstalled = await checkScarbInstalled();
//     if (!isScarbInstalled) {
//       return JSON.stringify({
//         status: 'failure',
//         error: await getScarbInstallInstructions(),
//       });
//     }

//     // Check if the proof file exists
//     try {
//       await fs.access(params.proofPath);
//     } catch (error) {
//       return JSON.stringify({
//         status: 'failure',
//         error: `Proof file not found at path: ${params.proofPath}`,
//       });
//     }

//     const command = `scarb verify ${params.proofPath}`;
    
//     console.log(`Verifying proof with command: ${command}`);
//     const { stdout, stderr } = await execAsync(command);
    
//     // Check if verification was successful based on output
//     const isVerified = stdout.includes('Verification successful') || 
//                        !stderr.includes('Verification failed');
    
//     return JSON.stringify({
//       status: isVerified ? 'success' : 'failure',
//       message: isVerified ? 'Proof verified successfully' : 'Proof verification failed',
//       output: stdout,
//       errors: stderr || undefined,
//     });
//   } catch (error) {
//     console.error("Error verifying proof:", error);
//     return JSON.stringify({
//       status: 'failure',
//       error: error instanceof Error ? error.message : 'Unknown error',
//     });
//   }
// };