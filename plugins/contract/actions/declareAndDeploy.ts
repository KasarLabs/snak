// import { Account, constants } from 'starknet';
// import { StarknetAgentInterface } from 'src/lib/agent/tools/tools';
// import { z } from 'zod';
// import { ContractManager } from '../utils/contractManager';
// import { declareAndDeployContractSchema } from '../schemas/schema';

// /**
//  * Declares and deploys a contract on StarkNet in a single operation
//  * @param {StarknetAgentInterface} agent - Starknet agent interface
//  * @param {z.infer<typeof declareAndDeployContractSchema>} params - Contract declaration and deployment parameters
//  * @returns {Promise<string>} JSON string with declaration and deployment result or error
//  */
// export const declareAndDeployContract = async (
//   agent: StarknetAgentInterface,
//   params: z.infer<typeof declareAndDeployContractSchema>
// ): Promise<string> => {
//   try {
//     // Validate required parameters
//     if (!params?.sierraPath || !params?.casmPath) {
//       throw new Error('Sierra and CASM file paths are required');
//     }

//     // Set up provider and account
//     const provider = agent.getProvider();
//     const accountCredentials = agent.getAccountCredentials();
//     const account = new Account(
//       provider,
//       accountCredentials.accountPublicKey,
//       accountCredentials.accountPrivateKey,
//       undefined,
//       constants.TRANSACTION_VERSION.V3
//     );

//     // Initialize contract manager and load contract files
//     const contractManager = new ContractManager(account);
//     await contractManager.loadContractCompilationFiles(
//       params.sierraPath,
//       params.casmPath
//     );

//     // Prepare constructor arguments
//     const constructorArgs = params.constructorArgs || [];

//     // Declare and deploy the contract in a single operation
//     const response = await contractManager.declareAndDeployContract(constructorArgs);
    
//     console.log('Contract declaration and deployment result:', response);
    
//     return JSON.stringify({
//       status: 'success',
//       declare: {
//         transactionHash: response.declare.transactionHash,
//         classHash: response.declare.classHash,
//       },
//       deploy: {
//         transactionHash: response.deploy.transactionHash,
//         contractAddress: response.deploy.contractAddress,
//       }
//     });
//   } catch (error) {
//     console.error('Contract declaration and deployment failed:', error);
//     return JSON.stringify({
//       status: 'failure',
//       error: error instanceof Error ? error.message : 'Unknown error',
//       step: 'contract declaration and deployment'
//     });
//   }
// };