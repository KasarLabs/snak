import { installScarb } from '../actions/installScarb.js';
import { compileContract } from '../actions/buildProgram.js';
import { executeProgram } from '../actions/executeProgram.js';
import { proveProgram } from '../actions/proveProgram.js';
import { verifyProgram } from '../actions/verifyProgram.js';
import { registerProject } from '../actions/registerProject.js';
import {
  deleteProgramAction,
  deleteDependencyAction,
  deleteProjectAction,
} from '../actions/deleteItemProject.js';
import {
  executeProgramSchema,
  proveProgramSchema,
  verifyProgramSchema,
  installScarbSchema,
  compileContractSchema,
  registerProjectSchema,
  deleteProgramSchema,
  deleteDependencySchema,
  deleteProjectSchema,
} from '../schema/schema.js';
import {
  PostgresAdaptater,
  StarknetAgentInterface,
  StarknetTool,
} from '@starknet-agent-kit/agents';
import { initializeDatabase } from '../utils/db_init.js';

export const initializeTools = async (
  agent: StarknetAgentInterface
): Promise<PostgresAdaptater | undefined> => {
  try {
    const res = await initializeDatabase(agent);
    return res;
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

export const registerTools = async (
  StarknetToolRegistry: StarknetTool[],
  agent: StarknetAgentInterface
) => {
  const database_instance = await initializeTools(agent);
  if (!database_instance) {
    console.error('Error while initializing database');
    return;
  }

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
    name: 'scarb_execute_program',
    description: 'Execute a Cairo program function using Scarb',
    plugins: 'scarb',
    schema: executeProgramSchema,
    execute: executeProgram,
  });

  StarknetToolRegistry.push({
    name: 'scarb_prove_program',
    description: 'Generate a proof for a Cairo program execution using Scarb',
    plugins: 'scarb',
    schema: proveProgramSchema,
    execute: proveProgram,
  });

  StarknetToolRegistry.push({
    name: 'scarb_verify_program',
    description: 'Verify a proof for a Cairo program execution using Scarb',
    plugins: 'scarb',
    schema: verifyProgramSchema,
    execute: verifyProgram,
  });

  StarknetToolRegistry.push({
    name: 'scarb_register_project',
    description: 'Register or update a Cairo project in the database',
    plugins: 'scarb',
    schema: registerProjectSchema,
    execute: registerProject,
  });

  StarknetToolRegistry.push({
    name: 'scarb_delete_program',
    description: 'Delete a program from a Cairo project in the database',
    plugins: 'scarb',
    schema: deleteProgramSchema,
    execute: deleteProgramAction,
  });

  StarknetToolRegistry.push({
    name: 'scarb_delete_dependency',
    description: 'Delete a dependency from a Cairo project in the database',
    plugins: 'scarb',
    schema: deleteDependencySchema,
    execute: deleteDependencyAction,
  });

  StarknetToolRegistry.push({
    name: 'scarb_delete_project',
    description:
      'Delete an entire Cairo project and all its data from the database',
    plugins: 'scarb',
    schema: deleteProjectSchema,
    execute: deleteProjectAction,
  });
};
