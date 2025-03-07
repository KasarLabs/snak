import { StarknetTool } from '@starknet-agent-kit/agents';
import {
  declareContractSchema,
  deployContractSchema,
  getConstructorParamsSchema,
} from '../schemas/schema';
import { declareContract } from '../actions/declareContract';
import { deployContract } from '../actions/deployContract';
import { getConstructorParams } from '../actions/getConstructorParams';

export const registerTools = (StarknetToolRegistry: StarknetTool[]) => {
  StarknetToolRegistry.push({
    name: 'declare_contract',
    plugins: 'contract',
    description:
      'Declare a contract on StarkNet using Sierra and CASM files. This is the first step in the deployment process if no classhash is provided.',
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
      'Prepare the deployment. ALWAYS use this before deploying a contract to understand the required arguments and their correct order. This tool returns the exact parameter names required by the contract constructor',
    schema: getConstructorParamsSchema,
    execute: getConstructorParams,
  });
};
