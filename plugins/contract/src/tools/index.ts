import {
  StarknetTool,
  StarknetAgentInterface,
} from '@snakagent/core';
import {
  declareContractSchema,
  deployContractSchema,
  getConstructorParamsSchema,
  listContractsSchema,
  listDeploymentsByClassHashSchema,
  deleteContractByClassHashSchema,
} from '../schemas/schema.js';
import { declareContract } from '../actions/declareContract.js';
import { deployContract } from '../actions/deployContract.js';
import { getConstructorParams } from '../actions/getConstructorParams.js';
import { listDeclaredContracts } from '../actions/listContracts.js';
import { listDeploymentsByClassHash } from '../actions/listDeploymentsByClassHash.js';
import { deleteContractByClassHashAction } from '../actions/deleteContractByClassHash.js';
import { contract } from '@snakagent/database/queries';

export const initializeTools = async (
  _agent: StarknetAgentInterface
): Promise<void> => {
  try {
    await contract.init();
  } catch (error) {
    console.error('Error initializing contract database:', error);
  }
};

export const registerTools = async (
  StarknetToolRegistry: StarknetTool[],
  agent: StarknetAgentInterface
) => {
  await initializeTools(agent);

  StarknetToolRegistry.push({
    name: 'declare_contract',
    plugins: 'contract',
    description:
      "Declare a cairo project's contract on Starknet. This is the first step in the deployment process if no classhash is provided.",
    schema: declareContractSchema,
    execute: declareContract,
  });

  StarknetToolRegistry.push({
    name: 'step2_deploy_contract',
    plugins: 'contract',
    description:
      'ALWAYS use prepare_deploy FIRST, then deploy a contract on StarkNet using the class hash. This tool requires the class hash and MUST be called after prepare_deploy, even if you think you have all the arguments.',
    schema: deployContractSchema,
    execute: deployContract,
  });

  StarknetToolRegistry.push({
    name: 'step1_prepare_deploy',
    plugins: 'contract',
    description:
      "Prepare the deployment. ALWAYS use this before deploying a cairo project's contract to understand the required arguments and their correct order. This tool returns the exact parameter names required by the contract constructor",
    schema: getConstructorParamsSchema,
    execute: getConstructorParams,
  });

  StarknetToolRegistry.push({
    name: 'list_declared_contracts',
    plugins: 'contract',
    description:
      'List all declared contracts and their deployed instances. Can be filtered by project name or contract name.',
    schema: listContractsSchema,
    execute: listDeclaredContracts,
  });

  StarknetToolRegistry.push({
    name: 'list_deployed_contracts_by_class_hash',
    plugins: 'contract',
    description: 'List all deployed instances of a contract by its class hash.',
    schema: listDeploymentsByClassHashSchema,
    execute: listDeploymentsByClassHash,
  });

  StarknetToolRegistry.push({
    name: 'delete_contract_by_class_hash',
    plugins: 'contract',
    description:
      'Remove a contract classhash from the database and all its deployments. This operation cannot be undone.',
    schema: deleteContractByClassHashSchema,
    execute: deleteContractByClassHashAction,
  });
};
