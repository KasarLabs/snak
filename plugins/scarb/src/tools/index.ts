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
      name: 'scarb_init_project',
      description: 'Initialize a new Scarb project',
      plugins: 'scarb',
      schema: initProjectSchema,
      execute: initProject,
    });
  
    StarknetToolRegistry.push({
      name: 'scarb_build_project',
      description: 'Build a Scarb project',
      plugins: 'scarb',
      schema: buildProjectSchema,
      execute: buildProject,
    });
  
    StarknetToolRegistry.push({
      name: 'scarb_add_dependency',
      description: 'Add a dependency to a Scarb project',
      plugins: 'scarb',
      schema: addDependencySchema,
      execute: addDependency,
    });
  
    StarknetToolRegistry.push({
      name: 'scarb_install',
      description: 'Install the latest version of Scarb if not already installed',
      plugins: 'scarb',
      schema: installScarbSchema,
      execute: installScarb,
    });
  
    StarknetToolRegistry.push({
      name: 'scarb_configure_sierra_casm',
      description: 'Configure Scarb.toml to include Sierra and CASM compilation settings',
      plugins: 'scarb',
      schema: configureSierraAndCasmSchema,
      execute: configureSierraAndCasm,
    });
  };