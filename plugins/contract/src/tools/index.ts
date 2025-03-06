import {
  StarknetAgentInterface,
  StarknetTool,
} from '@starknet-agent-kit/agents';
import { 
  declareContractSchema, 
  deployContractSchema, 
  getConstructorParamsSchema 
} from '../schemas/schema';
import { declareContract } from '../actions/declareContract';
import { deployContract } from '../actions/deployContract';
import { getConstructorParams } from '../actions/getConstructorParams';

export const registerContractTools = (StarknetToolRegistry: StarknetTool[]) => {
  StarknetToolRegistry.push({
    name: 'declare_contract',
    plugins: 'contract',
    description: 'Declare a contract on StarkNet using Sierra and CASM files',
    schema: declareContractSchema,
    execute: declareContract,
  });

  StarknetToolRegistry.push({
    name: 'deploy_contract',
    plugins: 'contract',
    description: 'Deploy a previously declared contract on StarkNet with constructor arguments',
    schema: deployContractSchema,
    execute: deployContract,
  });

  StarknetToolRegistry.push({
    name: 'get_constructor_params',
    plugins: 'contract',
    description: 'Get the constructor parameters for a contract to understand what arguments are needed for deployment',
    schema: getConstructorParamsSchema,
    execute: getConstructorParams,
  });
};