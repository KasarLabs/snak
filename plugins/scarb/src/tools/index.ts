import {
    StarknetAgentInterface,
    StarknetTool,
  } from '@starknet-agent-kit/agents';
  import {
    installScarb
  } from '../actions/installScarb.js';
  import { 
    compileContract 
  } from '../actions/buildContract.js';
  import { 
    installScarbSchema,
    compileContractSchema
  } from '../schema/schema.js';
  import { 
    executeContract 
  } from '../actions/executeProgram.js';
  import { 
    proveContract 
  } from '../actions/proveContract.js';
  import { 
    verifyContract 
  } from '../actions/verifyContract.js';
  import { 
    executeContractSchema,
    proveContractSchema,
    verifyContractSchema
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

    StarknetToolRegistry.push({
      name: 'scarb_execute_contract',
      description: 'Execute a StarkNet contract function using Scarb',
      plugins: 'scarb',
      schema: executeContractSchema,
      execute: executeContract,
    });
  
    StarknetToolRegistry.push({
      name: 'scarb_prove_contract',
      description: 'Generate a proof for a contract execution using Scarb',
      plugins: 'scarb',
      schema: proveContractSchema,
      execute: proveContract,
    });
  
    StarknetToolRegistry.push({
      name: 'scarb_verify_contract',
      description: 'Verify a proof for a contract execution using Scarb',
      plugins: 'scarb',
      schema: verifyContractSchema,
      execute: verifyContract,
    });
  };