import {
    StarknetAgentInterface,
    StarknetTool,
  } from '@starknet-agent-kit/agents';
  import {
    installScarb
  } from '../actions/installScarb.js';
  import { 
    compileContract 
  } from '../actions/compileContract.js';
  import { 
    installScarbSchema,
    compileContractSchema
  } from '../schema/schema.js';
  
  export const registerTools = (
    StarknetToolRegistry: StarknetTool[],
    agent?: StarknetAgentInterface
  ) => {
  
    StarknetToolRegistry.push({
      name: 'scarb_install',
      description: 'Install the latest version of Scarb if not already installed',
      plugins: 'scarb',
      schema: installScarbSchema,
      execute: installScarb,
    });
  
    StarknetToolRegistry.push({
      name: 'scarb_compile_contract',
      description: 'Compile StarkNet contracts using Scarb',
      plugins: 'scarb',
      schema: compileContractSchema,
      execute: compileContract,
    });
  };