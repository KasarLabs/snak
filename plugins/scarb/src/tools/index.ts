// plugins/scarb/src/tools/index.ts
import {
    StarknetAgentInterface,
    StarknetTool,
  } from '@starknet-agent-kit/agents';
  import { 
    initProject, 
    buildProject, 
    addDependency, 
  } from '../utils/project.js';
  import {
    installScarb,
    configureSierraAndCasm
  } from '../utils/install.js';
  import { 
    initProjectSchema, 
    buildProjectSchema, 
    addDependencySchema, 
    installScarbSchema,
    configureSierraAndCasmSchema
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
      description: 'Compile a StarkNet contract using Scarb',
      plugins: 'scarb',
      schema: configureSierraAndCasmSchema,
      execute: configureSierraAndCasm,
    });
  };